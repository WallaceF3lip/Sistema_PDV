"""
SaleService — implementa o fluxo completo de venda conforme spec:
  abertura → bipagem → finalização → cancelamento
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.sale import Sale, SaleItem, Payment, SaleStatusEnum
from app.models.product import Product
from app.models.stock import Stock
from app.services.stock_service import StockService


class SaleService:

    @staticmethod
    def open_sale(db: Session, user_id: int) -> Sale:
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
        sale.total_amount = sum(
            Decimal(str(item.subtotal)) for item in sale.items
        )

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
        db.delete(item)
        db.flush()
        db.refresh(sale)
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
          2. Re-valida estoque com FOR UPDATE (concorrência)
          3. Baixa estoque + cria movements
          4. Registra pagamentos
          5. Fecha venda
        """
        sale = cls._get_open_sale(db, sale_id)

        if not sale.items:
            raise HTTPException(status_code=400, detail="Venda sem itens")

        total = Decimal(str(sale.total_amount))
        paid = sum(Decimal(str(p["amount"])) for p in payments)

        if paid != total:
            raise HTTPException(
                status_code=422,
                detail=f"Pagamento ({paid}) difere do total da venda ({total})"
            )

        # transação — todas as operações abaixo são atômicas
        try:
            for item in sale.items:
                StockService.deduct_stock(
                    db=db,
                    product_id=item.product_id,
                    quantity=Decimal(str(item.quantity)),
                    user_id=user_id,
                    reference=f"SALE:{sale.id}",
                )

            for p in payments:
                payment = Payment(
                    sale_id=sale.id,
                    method=p["method"],
                    amount=Decimal(str(p["amount"])),
                )
                db.add(payment)

            sale.status = SaleStatusEnum.PAID
            sale.closed_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(sale)
            return sale

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao finalizar venda: {str(e)}")

    @classmethod
    def cancel_sale(cls, db: Session, sale_id: int, user_id: int) -> Sale:
        """
        Etapa 2.5 — Cancelamento.
        - OPEN: apenas cancela.
        - PAID: reverte estoque (IN) antes de cancelar.
        """
        sale = db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venda não encontrada")

        if sale.status == SaleStatusEnum.CANCELED:
            raise HTTPException(status_code=400, detail="Venda já cancelada")

        try:
            if sale.status == SaleStatusEnum.PAID:
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

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao cancelar venda: {str(e)}")
