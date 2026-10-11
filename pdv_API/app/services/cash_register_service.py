"""
CashRegisterService — caixa único compartilhado do estabelecimento:
  abertura (qualquer usuário) → vendas / estornos / sangria / suprimento → fechamento (ADMIN)

Regras centrais:
  - no máximo um caixa OPEN no sistema (verificação aqui + índice único parcial no banco);
  - cada pagamento de venda gera um movimento SALE (com forma de pagamento) no caixa aberto;
  - cancelar venda PAID gera SALE_CANCEL por pagamento no caixa aberto no momento;
  - o saldo da gaveta considera somente dinheiro (get_cash_balance).
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.cash_register import (
    CashRegister, CashMovement,
    CashRegisterStatusEnum, CashMovementTypeEnum,
)
from app.models.sale import Sale, Payment, SaleStatusEnum, PaymentMethodEnum, OrderTypeEnum
from app.schemas.schemas import SalesChannelEnum


NO_OPEN_REGISTER_DETAIL = "Nenhum caixa aberto. Abra o caixa para finalizar vendas."
NO_OPEN_REGISTER_CANCEL_DETAIL = "Nenhum caixa aberto para registrar o estorno"


def sale_channel(order_type: OrderTypeEnum | None) -> SalesChannelEnum:
    """Canal da venda: Balcão (order_type nulo) ou Delivery (Retirada + Entrega)."""
    if order_type in (OrderTypeEnum.PICKUP, OrderTypeEnum.DELIVERY):
        return SalesChannelEnum.DELIVERY
    return SalesChannelEnum.COUNTER


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")


class CashRegisterService:

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _get_register(db: Session, register_id: int, lock: bool = False) -> CashRegister:
        query = db.query(CashRegister).filter(CashRegister.id == register_id)
        if lock:
            query = query.with_for_update()
        register = query.first()
        if not register:
            raise HTTPException(status_code=404, detail="Caixa não encontrado")
        return register

    @classmethod
    def _get_open_register(cls, db: Session, register_id: int, lock: bool = False) -> CashRegister:
        register = cls._get_register(db, register_id, lock=lock)
        if register.status != CashRegisterStatusEnum.OPEN:
            raise HTTPException(
                status_code=400,
                detail=f"Caixa não está aberto (status={register.status.value})",
            )
        return register

    @staticmethod
    def get_cash_balance(register) -> Decimal:
        """
        Saldo de gaveta (somente dinheiro) — regra única usada por schema,
        sangria, fechamento, resumo e histórico.
          + OPENING, SUPRIMENTO, SALE com payment_method CASH
          − SANGRIA, SALE_CANCEL com payment_method CASH
          CLOSING é apenas registro da contagem física — não afeta saldo.
        Aceita qualquer objeto com `.movements` (model ORM ou schema).
        """
        balance = Decimal("0")
        for m in register.movements:
            amount = _dec(m.amount)
            if m.type in (CashMovementTypeEnum.OPENING, CashMovementTypeEnum.SUPRIMENTO):
                balance += amount
            elif m.type == CashMovementTypeEnum.SANGRIA:
                balance -= amount
            elif m.type == CashMovementTypeEnum.SALE:
                if m.payment_method == PaymentMethodEnum.CASH:
                    balance += amount
            elif m.type == CashMovementTypeEnum.SALE_CANCEL:
                if m.payment_method == PaymentMethodEnum.CASH:
                    balance -= amount
        return balance

    # ── caixa atual ──────────────────────────────────────────────────────────

    @staticmethod
    def get_current_register(db: Session, lock: bool = False) -> CashRegister | None:
        """Retorna o caixa OPEN do estabelecimento, se existir."""
        query = db.query(CashRegister).filter(
            CashRegister.status == CashRegisterStatusEnum.OPEN
        )
        if lock:
            query = query.with_for_update()
        return query.order_by(CashRegister.opened_at.desc(), CashRegister.id.desc()).first()

    @classmethod
    def require_open_register(
        cls,
        db: Session,
        lock: bool = True,
        detail: str = NO_OPEN_REGISTER_DETAIL,
    ) -> CashRegister:
        """
        Retorna o caixa OPEN com SELECT ... FOR UPDATE (serializa com o
        fechamento) ou levanta 409 se não houver caixa aberto.
        """
        register = cls.get_current_register(db, lock=lock)
        if not register:
            raise HTTPException(status_code=409, detail=detail)
        return register

    @classmethod
    def get_my_open_register(cls, db: Session, user_id: int | None = None) -> CashRegister:
        """Depreciado — alias de get_current_register (caixa compartilhado) com 404."""
        register = cls.get_current_register(db)
        if not register:
            raise HTTPException(status_code=404, detail="Nenhum caixa aberto encontrado")
        return register

    # ── vendas ───────────────────────────────────────────────────────────────

    @classmethod
    def register_sale_payments(
        cls,
        db: Session,
        sale: Sale,
        payments: Iterable[Payment],
        user_id: int,
    ) -> CashRegister:
        """
        Registra o recebimento de uma venda no caixa aberto:
          - vincula `sale.cash_register_id` ao caixa aberto (sobrescreve o vínculo
            anterior, ex.: quitação de PENDING em outro caixa);
          - cria um movimento SALE por pagamento (forma de pagamento + sale_id).
        `payments` são objetos Payment já adicionados à sessão. Lista vazia
        apenas vincula (reserva PENDING). NÃO faz commit — participa da
        transação do chamador. 409 se não houver caixa aberto.
        """
        register = cls.require_open_register(db)
        sale.cash_register_id = register.id
        for p in payments:
            db.add(CashMovement(
                cash_register_id=register.id,
                type=CashMovementTypeEnum.SALE,
                amount=_dec(p.amount),
                payment_method=p.method,
                sale_id=sale.id,
                user_id=user_id,
                description=f"Venda #{sale.id}",
            ))
        db.flush()
        return register

    @classmethod
    def register_sale_cancellation(cls, db: Session, sale: Sale, user_id: int) -> CashRegister:
        """
        Registra o estorno de uma venda PAID no caixa aberto ATUAL (mesmo que a
        venda pertença a um caixa já fechado): um SALE_CANCEL por pagamento.
        Não altera `sale.cash_register_id`. Não valida saldo. NÃO faz commit.
        409 se não houver caixa aberto.
        """
        register = cls.require_open_register(db, detail=NO_OPEN_REGISTER_CANCEL_DETAIL)
        for p in sale.payments:
            db.add(CashMovement(
                cash_register_id=register.id,
                type=CashMovementTypeEnum.SALE_CANCEL,
                amount=_dec(p.amount),
                payment_method=p.method,
                sale_id=sale.id,
                user_id=user_id,
                description=f"Estorno venda #{sale.id}",
            ))
        db.flush()
        return register

    # ── operações ────────────────────────────────────────────────────────────

    @classmethod
    def open_register(
        cls,
        db: Session,
        user_id: int,
        opening_amount: Decimal,
        notes: str | None = None,
    ) -> CashRegister:
        """
        Abre o caixa do estabelecimento (qualquer usuário autenticado).
        Regra: no máximo um caixa OPEN no sistema → 409 se já houver.
        """
        existing = cls.get_current_register(db)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Já existe um caixa aberto (id={existing.id})",
            )

        try:
            register = CashRegister(
                user_id=user_id,
                status=CashRegisterStatusEnum.OPEN,
                opening_amount=opening_amount,
                notes=notes,
            )
            db.add(register)
            db.flush()  # obtém register.id; o índice único barra corrida aqui

            db.add(CashMovement(
                cash_register_id=register.id,
                type=CashMovementTypeEnum.OPENING,
                amount=opening_amount,
                description="Fundo de troco inicial",
                user_id=user_id,
            ))
            db.commit()
        except IntegrityError:
            # Corrida: outra abertura concluída entre a checagem e o INSERT
            db.rollback()
            current = cls.get_current_register(db)
            suffix = f" (id={current.id})" if current else ""
            raise HTTPException(status_code=409, detail=f"Já existe um caixa aberto{suffix}")

        db.refresh(register)
        return register

    @classmethod
    def create_sangria(
        cls,
        db: Session,
        register_id: int,
        amount: Decimal,
        description: str,
        user_id: int,
    ) -> CashMovement:
        """
        Registra uma sangria (retirada de dinheiro).
        Regra: não permite sangria que exceda o saldo em dinheiro da gaveta.
        """
        register = cls._get_open_register(db, register_id, lock=True)

        balance = cls.get_cash_balance(register)
        if amount > balance:
            raise HTTPException(
                status_code=422,
                detail=f"Saldo insuficiente: saldo atual={balance}, sangria={amount}",
            )

        movement = CashMovement(
            cash_register_id=register.id,
            type=CashMovementTypeEnum.SANGRIA,
            amount=amount,
            description=description,
            user_id=user_id,
        )
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement

    @classmethod
    def create_suprimento(
        cls,
        db: Session,
        register_id: int,
        amount: Decimal,
        description: str,
        user_id: int,
    ) -> CashMovement:
        """Registra um suprimento (entrada adicional de dinheiro)."""
        register = cls._get_open_register(db, register_id, lock=True)

        movement = CashMovement(
            cash_register_id=register.id,
            type=CashMovementTypeEnum.SUPRIMENTO,
            amount=amount,
            description=description,
            user_id=user_id,
        )
        db.add(movement)
        db.commit()
        db.refresh(movement)
        return movement

    @classmethod
    def close_register(
        cls,
        db: Session,
        register_id: int,
        closing_amount: Decimal,
        user_id: int,
        notes: str | None = None,
    ) -> CashRegister:
        """
        Fecha o caixa (ADMIN).
        - Carrega o caixa com FOR UPDATE (serializa com finalizações em andamento).
        - Informa o valor contado fisicamente (closing_amount); o esperado é o
          saldo em dinheiro (get_cash_balance).
        - Cria um CashMovement CLOSING, grava quem fechou e muda para CLOSED.
        - Pedidos PENDING vinculados não impedem o fechamento.
        """
        register = cls._get_open_register(db, register_id, lock=True)

        expected_balance = cls.get_cash_balance(register)

        try:
            db.add(CashMovement(
                cash_register_id=register.id,
                type=CashMovementTypeEnum.CLOSING,
                amount=closing_amount,
                description=f"Fechamento de caixa — contagem: {closing_amount}, esperado: {expected_balance}",
                user_id=user_id,
            ))

            register.status = CashRegisterStatusEnum.CLOSED
            register.closing_amount = closing_amount
            register.closed_at = datetime.now(timezone.utc)
            register.closed_by_user_id = user_id
            if notes:
                register.notes = notes

            db.commit()
            db.refresh(register)
            return register

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Erro ao fechar caixa: {str(e)}"
            )

    # ── resumo e histórico ───────────────────────────────────────────────────

    @classmethod
    def build_summary(cls, db: Session, register: CashRegister) -> dict:
        """
        Resumo do caixa calculado a partir dos movimentos:
          - líquidos (SALE − SALE_CANCEL) por forma de pagamento e por canal
            (COUNTER = Balcão; DELIVERY = Retirada + Entrega, via sale_channel);
          - sales_count: vendas com SALE no caixa sem SALE_CANCEL nele;
          - canceled_count: vendas com SALE_CANCEL no caixa;
          - delivery_fees_total: soma de sale.delivery_fee das vendas contadas;
          - pending_*: vendas PENDING vinculadas ao caixa (não entram nos totais);
          - expected_cash: saldo em dinheiro; difference quando fechado.
        """
        methods = list(PaymentMethodEnum)
        channels = list(SalesChannelEnum)

        movements = (
            db.query(CashMovement)
            .options(selectinload(CashMovement.sale))
            .filter(CashMovement.cash_register_id == register.id)
            .all()
        )

        zero = Decimal("0")
        by_method = {m: zero for m in methods}
        by_channel_method = {c: {m: zero for m in methods} for c in channels}
        suprimentos = sangrias = gross = cancellations = zero
        sold: dict[int, Sale] = {}
        canceled: set[int] = set()

        for mv in movements:
            amount = _dec(mv.amount)
            if mv.type == CashMovementTypeEnum.SUPRIMENTO:
                suprimentos += amount
            elif mv.type == CashMovementTypeEnum.SANGRIA:
                sangrias += amount
            elif mv.type in (CashMovementTypeEnum.SALE, CashMovementTypeEnum.SALE_CANCEL):
                is_sale = mv.type == CashMovementTypeEnum.SALE
                signed = amount if is_sale else -amount
                if is_sale:
                    gross += amount
                else:
                    cancellations += amount
                channel = sale_channel(mv.sale.order_type if mv.sale else None)
                if mv.payment_method in by_method:
                    by_method[mv.payment_method] += signed
                    by_channel_method[channel][mv.payment_method] += signed
                if mv.sale_id is not None:
                    if is_sale:
                        if mv.sale is not None:
                            sold[mv.sale_id] = mv.sale
                    else:
                        canceled.add(mv.sale_id)

        counted = {sid: s for sid, s in sold.items() if sid not in canceled}

        channel_summaries = []
        for c in channels:
            c_sales = [s for s in counted.values() if sale_channel(s.order_type) == c]
            channel_summaries.append({
                "channel": c,
                "sales_count": len(c_sales),
                "net_total": sum(by_channel_method[c].values(), zero),
                "delivery_fees_total": sum((_dec(s.delivery_fee) for s in c_sales), zero),
                "by_payment_method": [
                    {"method": m, "amount": by_channel_method[c][m]} for m in methods
                ],
            })

        pending = (
            db.query(Sale)
            .filter(
                Sale.cash_register_id == register.id,
                Sale.status == SaleStatusEnum.PENDING,
            )
            .all()
        )

        expected_cash = cls.get_cash_balance(register)
        closing_amount = register.closing_amount
        difference = None
        if register.status == CashRegisterStatusEnum.CLOSED and closing_amount is not None:
            difference = _dec(closing_amount) - expected_cash

        return {
            "register_id": register.id,
            "status": register.status,
            "opened_at": register.opened_at,
            "closed_at": register.closed_at,
            "opened_by_name": register.opened_by_name,
            "closed_by_name": register.closed_by_name,
            "opening_amount": _dec(register.opening_amount),
            "suprimentos_total": suprimentos,
            "sangrias_total": sangrias,
            "gross_total": gross,
            "cancellations_total": cancellations,
            "net_total": gross - cancellations,
            "by_payment_method": [{"method": m, "amount": by_method[m]} for m in methods],
            "by_channel": channel_summaries,
            "delivery_fees_total": sum((_dec(s.delivery_fee) for s in counted.values()), zero),
            "sales_count": len(counted),
            "canceled_count": len(canceled),
            "pending_count": len(pending),
            "pending_total": sum((_dec(s.total_amount) for s in pending), zero),
            "expected_cash": expected_cash,
            "closing_amount": closing_amount,
            "difference": difference,
        }

    @classmethod
    def list_registers(
        cls,
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None,
        status: CashRegisterStatusEnum | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """
        Histórico paginado de caixas (mais recentes primeiro). Filtro por data
        de abertura (start/end inclusivos; fim exclusivo = end_date + 1 dia).
        """
        query = db.query(CashRegister)
        if start_date:
            query = query.filter(CashRegister.opened_at >= datetime.combine(start_date, time.min))
        if end_date:
            query = query.filter(
                CashRegister.opened_at < datetime.combine(end_date + timedelta(days=1), time.min)
            )
        if status:
            query = query.filter(CashRegister.status == status)

        total = query.count()
        registers = (
            query.options(
                selectinload(CashRegister.movements),
                selectinload(CashRegister.opened_by),
                selectinload(CashRegister.closed_by),
            )
            .order_by(CashRegister.opened_at.desc(), CashRegister.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        items = []
        for r in registers:
            expected = cls.get_cash_balance(r)
            difference = (
                _dec(r.closing_amount) - expected if r.closing_amount is not None else None
            )
            items.append({
                "id": r.id,
                "status": r.status,
                "opened_at": r.opened_at,
                "closed_at": r.closed_at,
                "opened_by_name": r.opened_by_name,
                "closed_by_name": r.closed_by_name,
                "opening_amount": r.opening_amount,
                "closing_amount": r.closing_amount,
                "expected_balance": expected,
                "difference": difference,
            })

        return {"items": items, "total": total, "page": page, "page_size": page_size}
