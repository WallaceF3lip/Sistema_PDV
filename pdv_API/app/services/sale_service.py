"""
SaleService — implementa o fluxo completo de venda conforme spec:
  abertura → bipagem → finalização → quitação → cancelamento
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload
from fastapi import HTTPException

from app.core.business_day import business_date_for
from app.models.sale import (
    DailyOrderCounter, Sale, SaleItem, Payment, SaleStatusEnum, OrderTypeEnum,
)
from app.schemas.schemas import OrderTypeFilterEnum
from app.models.product import Product
from app.models.customer import Customer
from app.models.stock import Stock
from app.services.stock_service import StockService
from app.services.cash_register_service import CashRegisterService
from app.services.delivery_zone_service import validate_active_zone


BOARD_STATUSES = (SaleStatusEnum.PENDING, SaleStatusEnum.PAID, SaleStatusEnum.CANCELED)


def sale_eager_options():
    """Eager loading de listagens/quadro (evita N+1 em itens/produtos/pagamentos/zona)."""
    return (
        selectinload(Sale.items).selectinload(SaleItem.product),
        selectinload(Sale.payments),
        selectinload(Sale.delivery_zone),
    )


def order_type_filter_clause(order_type: OrderTypeFilterEnum):
    """COUNTER ⇔ order_type IS NULL (Balcão)."""
    if order_type == OrderTypeFilterEnum.COUNTER:
        return Sale.order_type.is_(None)
    return Sale.order_type == OrderTypeEnum(order_type.value)


class SaleService:

    @staticmethod
    def get_open_sale_for_user(db: Session, user_id: int) -> Sale | None:
        """Retorna a venda OPEN mais recente do usuário, se existir."""
        return (
            db.query(Sale)
            .filter(Sale.user_id == user_id, Sale.status == SaleStatusEnum.OPEN)
            .order_by(Sale.opened_at.desc())
            .first()
        )

    @classmethod
    def open_sale(cls, db: Session, user_id: int) -> Sale:
        """Reaproveita venda OPEN existente ou cria uma nova."""
        existing = cls.get_open_sale_for_user(db, user_id)
        if existing:
            return existing

        sale = Sale(user_id=user_id, status=SaleStatusEnum.OPEN, total_amount=0)
        db.add(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def _get_open_sale(db: Session, sale_id: int) -> Sale:
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venda não encontrada")
        if sale.status != SaleStatusEnum.OPEN:
            raise HTTPException(
                status_code=400,
                detail=f"Venda não está aberta (status={sale.status})"
            )
        return sale

    @staticmethod
    def _recalculate_total(sale: Sale):
        """total_amount = soma dos itens + taxa de entrega."""
        items_total = sum(
            (Decimal(str(item.subtotal)) for item in sale.items), Decimal("0")
        )
        sale.total_amount = items_total + Decimal(str(sale.delivery_fee or 0))

    @classmethod
    def add_item(
        cls,
        db: Session,
        sale_id: int,
        sku: str,
        quantity: Decimal,
    ) -> Sale:
        """
        Etapa 2.2 — Produto bipado.
        Estoque NÃO é baixado aqui, apenas validado.
        """
        sale = cls._get_open_sale(db, sale_id)

        # 1. Busca produto
        product = db.query(Product).filter(Product.sku == sku).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Produto SKU '{sku}' não encontrado")
        if not product.is_active:
            raise HTTPException(status_code=400, detail="Produto descontinuado")

        # 2. Valida estoque disponível (sem baixar)
        stock = db.query(Stock).filter(Stock.product_id == product.id).first()
        available = Decimal(str(stock.quantity)) if stock else Decimal("0")
        if available < quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Estoque insuficiente: disponível={available}"
            )

        # 3. Adiciona ou incrementa item
        existing = next(
            (i for i in sale.items if i.product_id == product.id), None
        )
        if existing:
            new_qty = Decimal(str(existing.quantity)) + quantity
            # re-valida com nova quantidade total
            if available < new_qty:
                raise HTTPException(
                    status_code=422,
                    detail=f"Estoque insuficiente para quantidade total={new_qty}"
                )
            existing.quantity = new_qty
            existing.subtotal = new_qty * Decimal(str(existing.unit_price))
        else:
            unit_price = Decimal(str(product.sale_price))
            item = SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=quantity * unit_price,
            )
            db.add(item)
            db.flush()
            sale.items.append(item)

        cls._recalculate_total(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def remove_item(cls, db: Session, sale_id: int, item_id: int) -> Sale:
        sale = cls._get_open_sale(db, sale_id)
        item = next((i for i in sale.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado nessa venda")
        
        if item.quantity > 1:
            item.quantity -= 1
            item.subtotal = item.quantity * item.unit_price
        else:
            db.delete(item)
            
        db.flush()
        db.refresh(sale)
        cls._recalculate_total(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def update_item(
        cls,
        db: Session,
        sale_id: int,
        item_id: int,
        quantity: Decimal,
    ) -> Sale:
        """Atualiza a quantidade de um item na venda (ex: produtos vendidos por KG)."""
        sale = cls._get_open_sale(db, sale_id)
        item = next((i for i in sale.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado nessa venda")

        # Valida estoque disponível
        stock = db.query(Stock).filter(Stock.product_id == item.product_id).first()
        available = Decimal(str(stock.quantity)) if stock else Decimal("0")
        if available < quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Estoque insuficiente: disponível={available}",
            )

        item.quantity = quantity
        item.subtotal = quantity * Decimal(str(item.unit_price))

        cls._recalculate_total(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def finalize_sale(
        cls,
        db: Session,
        sale_id: int,
        payments: list[dict],
        user_id: int,
    ) -> Sale:
        """
        Etapa 2.4 — Finalização em transação atômica:
          1. Valida pagamentos
          2. Exige caixa aberto (409 se não houver)
          3. Re-valida estoque com FOR UPDATE (concorrência)
          4. Baixa estoque + cria movements
          5. Registra pagamentos + movimentos SALE no caixa (register_sale_payments)
          6. Fecha venda (PAID ou PENDING), vinculada ao caixa; paid_at se PAID
          7. Atribui business_date/daily_number (contador do dia) e faz commit
        """
        sale = cls._get_open_sale(db, sale_id)

        if not sale.items:
            raise HTTPException(status_code=400, detail="Venda sem itens")

        total = Decimal(str(sale.total_amount))

        # Permite finalizar sem pagamento quando is_paid=False (reserva de entrega ou retirada)
        is_reservation = (
            sale.order_type in (OrderTypeEnum.DELIVERY, OrderTypeEnum.PICKUP)
            and sale.is_paid is False
        )

        if not is_reservation:
            if not payments:
                raise HTTPException(
                    status_code=422,
                    detail="Pagamento obrigatório para este tipo de pedido"
                )
            paid = sum(Decimal(str(p["amount"])) for p in payments)
            if paid != total:
                raise HTTPException(
                    status_code=422,
                    detail=f"Pagamento ({paid}) difere do total da venda ({total})"
                )

        # transação — todas as operações abaixo são atômicas
        try:
            # Exige caixa aberto (FOR UPDATE) antes de qualquer baixa de estoque;
            # sem caixa → 409 e a venda continua OPEN.
            CashRegisterService.require_open_register(db)

            for item in sale.items:
                StockService.deduct_stock(
                    db=db,
                    product_id=item.product_id,
                    quantity=Decimal(str(item.quantity)),
                    user_id=user_id,
                    reference=f"SALE:{sale.id}",
                )

            created_payments = []
            for p in payments:
                payment = Payment(
                    sale_id=sale.id,
                    method=p["method"],
                    amount=Decimal(str(p["amount"])),
                )
                db.add(payment)
                created_payments.append(payment)
            db.flush()

            # Vincula a venda ao caixa e cria um movimento SALE por pagamento.
            # Reserva PENDING: lista vazia → apenas vínculo, sem movimentos.
            CashRegisterService.register_sale_payments(
                db, sale, [] if is_reservation else created_payments, user_id
            )

            now = datetime.now(timezone.utc)
            sale.status = SaleStatusEnum.PENDING if is_reservation else SaleStatusEnum.PAID
            sale.closed_at = now
            if not is_reservation:
                sale.paid_at = now

            # Número do pedido: último passo antes do commit (trava curta da
            # linha do contador do dia; rollback devolve o número).
            business_day = business_date_for(now)
            sale.business_date = business_day
            sale.daily_number = cls._next_daily_number(db, business_day)

            db.commit()
            db.refresh(sale)
            return sale

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao finalizar venda: {str(e)}")

    @staticmethod
    def _next_daily_number(db: Session, business_day: date) -> int:
        """
        Próximo número de pedido do dia de operação, via UPSERT atômico:
            INSERT INTO daily_order_counters (business_date, last_number) VALUES (:d, 1)
            ON CONFLICT (business_date) DO UPDATE SET last_number = last_number + 1
            RETURNING last_number
        No PostgreSQL a linha do dia fica travada até o commit/rollback da
        transação: finalizações concorrentes recebem números consecutivos e um
        rollback não consome número. Não faz commit.
        (SQLite suporta a mesma sintaxe — usado apenas em testes.)
        """
        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        elif dialect == "sqlite":
            from sqlalchemy.dialects.sqlite import insert
        else:  # pragma: no cover
            raise RuntimeError(f"Dialeto não suportado para numeração diária: {dialect}")

        table = DailyOrderCounter.__table__
        stmt = insert(table).values(business_date=business_day, last_number=1)
        stmt = stmt.on_conflict_do_update(
            index_elements=[table.c.business_date],
            set_={"last_number": table.c.last_number + 1},
        ).returning(table.c.last_number)
        return int(db.execute(stmt).scalar_one())

    @classmethod
    def settle_sale(
        cls,
        db: Session,
        sale_id: int,
        payments: list[dict],
        user_id: int,
    ) -> Sale:
        """
        Quitação de pedido PENDING → PAID em transação única:
          1. Trava a venda (FOR UPDATE) — serializa quitação × quitação/cancelamento
          2. Valida status (400) e soma dos pagamentos == total_amount (422)
          3. Cria Payments, registra movimentos SALE no caixa aberto (409 sem
             caixa) e vincula a venda a esse caixa
          4. status=PAID, is_paid=True, paid_at=agora; closed_at, número, itens
             e estoque permanecem inalterados
        Ordem de locks: venda → caixa.
        """
        try:
            sale = (
                db.query(Sale)
                .filter(Sale.id == sale_id)
                .populate_existing()
                .with_for_update()
                .first()
            )
            if not sale:
                raise HTTPException(status_code=404, detail="Venda não encontrada")
            if sale.status != SaleStatusEnum.PENDING:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Apenas pedidos pendentes podem ser quitados "
                        f"(status={sale.status.value})"
                    ),
                )

            total = Decimal(str(sale.total_amount))
            paid = sum((Decimal(str(p["amount"])) for p in payments), Decimal("0"))
            if not payments or paid != total:
                cents = Decimal("0.01")
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Pagamento ({paid.quantize(cents)}) difere do total da venda "
                        f"({total.quantize(cents)})"
                    ),
                )

            created_payments = []
            for p in payments:
                payment = Payment(
                    sale_id=sale.id,
                    method=p["method"],
                    amount=Decimal(str(p["amount"])),
                )
                db.add(payment)
                created_payments.append(payment)
            db.flush()

            CashRegisterService.register_sale_payments(db, sale, created_payments, user_id)

            sale.status = SaleStatusEnum.PAID
            sale.is_paid = True
            sale.paid_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(sale)
            return sale

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao quitar venda: {str(e)}")

    @staticmethod
    def get_board(db: Session, business_day: date) -> dict:
        """
        Pedidos finalizados (PENDING/PAID/CANCELED) do dia de operação,
        ordenados por daily_number, id, com contagens por status e por tipo
        (sempre completas, inclusive zeros).
        """
        orders = (
            db.query(Sale)
            .options(*sale_eager_options())
            .filter(Sale.business_date == business_day, Sale.status.in_(BOARD_STATUSES))
            .order_by(Sale.daily_number.asc().nulls_last(), Sale.id.asc())
            .all()
        )

        status_counts = {
            st: {"status": st, "count": 0, "total": Decimal("0")} for st in BOARD_STATUSES
        }
        type_counts = {
            t: {"order_type": t, "count": 0, "pending_count": 0} for t in OrderTypeFilterEnum
        }
        for sale in orders:
            sc = status_counts[sale.status]
            sc["count"] += 1
            sc["total"] += Decimal(str(sale.total_amount))

            t = (
                OrderTypeFilterEnum(sale.order_type.value)
                if sale.order_type is not None
                else OrderTypeFilterEnum.COUNTER
            )
            type_counts[t]["count"] += 1
            if sale.status == SaleStatusEnum.PENDING:
                type_counts[t]["pending_count"] += 1

        return {
            "business_date": business_day,
            "generated_at": datetime.now(timezone.utc),
            "status_counts": list(status_counts.values()),
            "type_counts": list(type_counts.values()),
            "orders": orders,
        }

    @classmethod
    def update_order_details(
        cls,
        db: Session,
        sale_id: int,
        data: dict,
    ) -> Sale:
        """
        Persiste os dados do pedido (cliente, tipo, entrega, zona/taxa) sem
        finalizar a venda. Regras de taxa:
          - order_type != DELIVERY → delivery_fee = 0 e delivery_zone_id = None;
          - DELIVERY: delivery_zone_id (se enviado) é validado — 404 inexistente,
            400 inativa (exceto se for a zona já gravada na venda);
            delivery_fee enviado prevalece; senão, se a zona mudou para uma
            zona não nula, usa a taxa atual da zona.
          - total_amount é recalculado (itens + taxa).
        """
        sale = cls._get_open_sale(db, sale_id)

        new_order_type = data["order_type"] if "order_type" in data else sale.order_type
        is_delivery = new_order_type == OrderTypeEnum.DELIVERY

        # Valida a zona antes de alterar qualquer campo da venda
        zone = None
        if is_delivery and data.get("delivery_zone_id") is not None:
            zone = validate_active_zone(
                db, data["delivery_zone_id"], allow_inactive_id=sale.delivery_zone_id
            )

        customer_id = data.get("customer_id")
        if customer_id is not None:
            customer = db.query(Customer).filter(Customer.id == customer_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")
            if not customer.is_active:
                raise HTTPException(status_code=400, detail="Cliente inativo")

        updatable_fields = [
            "customer_name", "notes", "order_type",
            "delivery_time", "delivery_address", "customer_phone",
            "delivery_payment_method", "is_paid", "customer_id",
        ]
        for field in updatable_fields:
            if field in data:
                setattr(sale, field, data[field])

        if not is_delivery:
            sale.delivery_fee = Decimal("0")
            sale.delivery_zone_id = None
        else:
            zone_changed = False
            if "delivery_zone_id" in data:
                new_zone_id = data["delivery_zone_id"]
                zone_changed = new_zone_id != sale.delivery_zone_id
                sale.delivery_zone_id = new_zone_id
            if data.get("delivery_fee") is not None:
                sale.delivery_fee = Decimal(str(data["delivery_fee"]))
            elif zone_changed and zone is not None:
                sale.delivery_fee = Decimal(str(zone.fee))

        cls._recalculate_total(sale)

        db.commit()
        db.refresh(sale)
        return sale

    @classmethod
    def cancel_sale(cls, db: Session, sale_id: int, user_id: int) -> Sale:
        """
        Etapa 2.5 — Cancelamento.
        - OPEN: apenas cancela.
        - PENDING: reverte estoque (IN); sem movimentos de caixa.
        - PAID: exige caixa aberto (409), cria SALE_CANCEL por pagamento no
          caixa aberto atual e reverte estoque (IN).
        """
        # Trava a venda antes de checar o status (ordem de locks: venda → caixa),
        # serializando com quitação/cancelamento concorrentes.
        sale = (
            db.query(Sale)
            .filter(Sale.id == sale_id)
            .populate_existing()
            .with_for_update()
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Venda não encontrada")

        if sale.status == SaleStatusEnum.CANCELED:
            raise HTTPException(status_code=400, detail="Venda já cancelada")

        try:
            if sale.status == SaleStatusEnum.PAID:
                # Estorno no caixa aberto atual (409 se não houver), antes do
                # estorno de estoque — mesma transação.
                CashRegisterService.register_sale_cancellation(db, sale, user_id)

            if sale.status in (SaleStatusEnum.PAID, SaleStatusEnum.PENDING):
                # estorno de estoque
                for item in sale.items:
                    StockService.add_stock(
                        db=db,
                        product_id=item.product_id,
                        quantity=Decimal(str(item.quantity)),
                        user_id=user_id,
                        reference=f"CANCEL:{sale.id}",
                    )

            sale.status = SaleStatusEnum.CANCELED
            sale.closed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(sale)
            return sale

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao cancelar venda: {str(e)}")
