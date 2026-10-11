import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.sale import PaymentMethodEnum


class CashRegisterStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class CashMovementTypeEnum(str, enum.Enum):
    OPENING = "OPENING"          # Fundo de troco inicial
    SALE = "SALE"                # Recebimento de venda, um por forma de pagamento (payment_method)
    SALE_CANCEL = "SALE_CANCEL"  # Estorno de venda cancelada, um por pagamento (payment_method)
    SANGRIA = "SANGRIA"          # Retirada de dinheiro
    SUPRIMENTO = "SUPRIMENTO"    # Entrada adicional
    CLOSING = "CLOSING"          # Fechamento: registro da contagem física (não afeta saldo)


class CashRegister(Base):
    """
    Caixa único do estabelecimento: abertura → vendas/sangria/suprimento → fechamento.
    Regra: no máximo um caixa OPEN no sistema (índice único parcial no banco +
    verificação no serviço). Todos os operadores vendem no mesmo caixa.
    user_id = quem abriu; closed_by_user_id = quem fechou.
    """
    __tablename__ = "cash_registers"
    __table_args__ = (
        Index(
            "ux_cash_registers_single_open",
            text("(true)"),
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
            sqlite_where=text("status = 'OPEN'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    closed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
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
    user: Mapped["User"] = relationship(
        "User", back_populates="cash_registers", foreign_keys=[user_id]
    )
    opened_by: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], viewonly=True
    )
    closed_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[closed_by_user_id]
    )
    movements: Mapped[list["CashMovement"]] = relationship(
        "CashMovement", back_populates="cash_register", cascade="all, delete-orphan"
    )

    @property
    def opened_by_name(self) -> str | None:
        return self.opened_by.name if self.opened_by else None

    @property
    def closed_by_name(self) -> str | None:
        return self.closed_by.name if self.closed_by else None


class CashMovement(Base):
    """
    Imutável após criação — log de auditoria completo.
    amount sempre positivo; type define a direção (entrada/saída).
    payment_method / sale_id preenchidos apenas em SALE e SALE_CANCEL.
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
    payment_method: Mapped[PaymentMethodEnum | None] = mapped_column(
        Enum(PaymentMethodEnum), nullable=True
    )
    sale_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales.id", ondelete="SET NULL"), nullable=True, index=True
    )
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
    sale: Mapped["Sale | None"] = relationship("Sale")
