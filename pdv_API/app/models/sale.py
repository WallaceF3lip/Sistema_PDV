import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer,
    Numeric, String, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SaleStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    PENDING = "PENDING"
    PAID = "PAID"
    CANCELED = "CANCELED"


class PaymentMethodEnum(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    PIX = "PIX"


class OrderTypeEnum(str, enum.Enum):
    PICKUP = "PICKUP"
    DELIVERY = "DELIVERY"


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[SaleStatusEnum] = mapped_column(
        Enum(SaleStatusEnum), default=SaleStatusEnum.OPEN, nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ─── Order Details ────────────────────────────────────────────────────────
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order_type: Mapped[OrderTypeEnum | None] = mapped_column(
        Enum(OrderTypeEnum), nullable=True
    )
    # Delivery-specific fields
    delivery_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    delivery_payment_method: Mapped[PaymentMethodEnum | None] = mapped_column(
        Enum(PaymentMethodEnum, name="payment_method_delivery_enum"), nullable=True
    )
    is_paid: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)

    # Vínculo opcional com cliente cadastrado (dados acima são snapshot textual)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Taxa de entrega (somente DELIVERY). total_amount = items_total + delivery_fee
    delivery_fee: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0, server_default="0", nullable=False
    )
    delivery_zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_zones.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Caixa que recebeu a venda (finalização/quitação); nulo em vendas OPEN e antigas
    cash_register_id: Mapped[int | None] = mapped_column(
        ForeignKey("cash_registers.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Momento do recebimento (finalização PAID ou quitação de PENDING).
    # closed_at continua sendo o horário em que o pedido foi registrado.
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Dia de operação e número sequencial do pedido no dia (atribuídos na
    # finalização; nulos em vendas OPEN e em vendas anteriores à numeração)
    business_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    daily_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index(
            "ux_sales_business_date_daily_number",
            "business_date",
            "daily_number",
            unique=True,
            postgresql_where=daily_number.isnot(None),
            sqlite_where=daily_number.isnot(None),
        ),
    )

    user: Mapped["User"] = relationship("User", back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(
        "SaleItem", back_populates="sale", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="sale", cascade="all, delete-orphan"
    )
    customer: Mapped["Customer | None"] = relationship("Customer")
    delivery_zone: Mapped["DeliveryZone | None"] = relationship("DeliveryZone")
    cash_register: Mapped["CashRegister | None"] = relationship("CashRegister")

    @property
    def items_total(self) -> Decimal:
        """Soma dos subtotais dos itens (sem taxa de entrega)."""
        return sum((Decimal(str(item.subtotal)) for item in self.items), Decimal("0"))

    @property
    def delivery_zone_name(self) -> str | None:
        return self.delivery_zone.name if self.delivery_zone else None


class SaleItem(Base):
    """
    unit_price: snapshot do preço no momento da venda.
    Protege histórico contra alterações futuras de preço.
    """
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="sale_items")

    @property
    def product_name(self) -> str | None:
        """Nome ATUAL do produto (não é snapshot)."""
        return self.product.name if self.product else None


class Payment(Base):
    """Permite pagamento misto (ex: parte PIX + parte CARD)."""
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"), nullable=False
    )
    method: Mapped[PaymentMethodEnum] = mapped_column(Enum(PaymentMethodEnum), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sale: Mapped["Sale"] = relationship("Sale", back_populates="payments")


class DailyOrderCounter(Base):
    """Último número de pedido atribuído em cada dia de operação."""
    __tablename__ = "daily_order_counters"
    __table_args__ = (
        CheckConstraint("last_number >= 0", name="ck_daily_order_counters_last_number"),
    )

    business_date: Mapped[date] = mapped_column(Date, primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False)
