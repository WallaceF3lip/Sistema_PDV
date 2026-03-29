import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CashRegisterStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class CashMovementTypeEnum(str, enum.Enum):
    OPENING = "OPENING"        # Fundo de troco inicial
    SALE = "SALE"              # Entrada por venda em dinheiro (futuro)
    SANGRIA = "SANGRIA"        # Retirada de dinheiro
    SUPRIMENTO = "SUPRIMENTO"  # Entrada adicional
    CLOSING = "CLOSING"        # Fechamento (futuro)


class CashRegister(Base):
    """
    Sessão de caixa: abertura → fechamento.
    Regra: 1 operador → 1 caixa OPEN por vez.
    """
    __tablename__ = "cash_registers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[CashRegisterStatusEnum] = mapped_column(
        Enum(CashRegisterStatusEnum), default=CashRegisterStatusEnum.OPEN, nullable=False
    )
    opening_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    closing_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # relationships
    user: Mapped["User"] = relationship("User", back_populates="cash_registers")
    movements: Mapped[list["CashMovement"]] = relationship(
        "CashMovement", back_populates="cash_register", cascade="all, delete-orphan"
    )


class CashMovement(Base):
    """
    Imutável após criação — log de auditoria completo.
    amount sempre positivo; type define a direção (entrada/saída).
    """
    __tablename__ = "cash_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    cash_register_id: Mapped[int] = mapped_column(
        ForeignKey("cash_registers.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[CashMovementTypeEnum] = mapped_column(
        Enum(CashMovementTypeEnum), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # relationships
    cash_register: Mapped["CashRegister"] = relationship(
        "CashRegister", back_populates="movements"
    )
    user: Mapped["User"] = relationship("User", back_populates="cash_movements")
