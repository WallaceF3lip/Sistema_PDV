"""
CashRegisterService — gerencia sessões de caixa e movimentações financeiras:
  abertura → sangria / suprimento → fechamento (futuro)
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.cash_register import (
    CashRegister, CashMovement,
    CashRegisterStatusEnum, CashMovementTypeEnum,
)


class CashRegisterService:

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _get_register(db: Session, register_id: int) -> CashRegister:
        register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
        if not register:
            raise HTTPException(status_code=404, detail="Caixa não encontrado")
        return register

    @staticmethod
    def _get_open_register(db: Session, register_id: int) -> CashRegister:
        register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
        if not register:
            raise HTTPException(status_code=404, detail="Caixa não encontrado")
        if register.status != CashRegisterStatusEnum.OPEN:
            raise HTTPException(
                status_code=400,
                detail=f"Caixa não está aberto (status={register.status.value})",
            )
        return register

    @staticmethod
    def get_balance(register: CashRegister) -> Decimal:
        """Calcula o saldo corrente do caixa a partir das movimentações."""
        inflows = {
            CashMovementTypeEnum.OPENING,
            CashMovementTypeEnum.SALE,
            CashMovementTypeEnum.SUPRIMENTO,
        }
        outflows = {
            CashMovementTypeEnum.SANGRIA,
        }
        balance = Decimal("0")
        for m in register.movements:
            amount = Decimal(str(m.amount))
            if m.type in inflows:
                balance += amount
            elif m.type in outflows:
                balance -= amount
            # CLOSING é apenas registro da contagem física — não afeta saldo
        return balance

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
        Abre uma nova sessão de caixa.
        Regra: o operador não pode ter outro caixa OPEN simultâneo.
        """
        existing = (
            db.query(CashRegister)
            .filter(
                CashRegister.user_id == user_id,
                CashRegister.status == CashRegisterStatusEnum.OPEN,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Operador já possui caixa aberto (id={existing.id})",
            )

        register = CashRegister(
            user_id=user_id,
            status=CashRegisterStatusEnum.OPEN,
            opening_amount=opening_amount,
            notes=notes,
        )
        db.add(register)
        db.flush()  # obtém register.id antes de criar o movement

        # Movimento de abertura (fundo de troco)
        opening_movement = CashMovement(
            cash_register_id=register.id,
            type=CashMovementTypeEnum.OPENING,
            amount=opening_amount,
            description="Fundo de troco inicial",
            user_id=user_id,
        )
        db.add(opening_movement)

        db.commit()
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
        Regra: não permite sangria que exceda o saldo atual.
        """
        register = cls._get_open_register(db, register_id)

        balance = cls.get_balance(register)
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
        register = cls._get_open_register(db, register_id)

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
    def get_my_open_register(cls, db: Session, user_id: int) -> CashRegister:
        """Retorna o caixa OPEN do operador logado."""
        register = (
            db.query(CashRegister)
            .filter(
                CashRegister.user_id == user_id,
                CashRegister.status == CashRegisterStatusEnum.OPEN,
            )
            .first()
        )
        if not register:
            raise HTTPException(
                status_code=404, detail="Nenhum caixa aberto encontrado para este operador"
            )
        return register

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
        Fecha uma sessão de caixa.
        - O operador informa o valor contado fisicamente (closing_amount).
        - O sistema calcula o saldo esperado e registra a diferença.
        - Cria um CashMovement do tipo CLOSING.
        - Muda status para CLOSED.
        """
        register = cls._get_open_register(db, register_id)

        expected_balance = cls.get_balance(register)

        try:
            # Movimento de fechamento
            closing_movement = CashMovement(
                cash_register_id=register.id,
                type=CashMovementTypeEnum.CLOSING,
                amount=closing_amount,
                description=f"Fechamento de caixa — contagem: {closing_amount}, esperado: {expected_balance}",
                user_id=user_id,
            )
            db.add(closing_movement)

            # Atualiza registro do caixa
            register.status = CashRegisterStatusEnum.CLOSED
            register.closing_amount = closing_amount
            register.closed_at = datetime.now(timezone.utc)
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

