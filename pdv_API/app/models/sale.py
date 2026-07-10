import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, func
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

    user: Mapped["User"] = relationship("User", back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(
        "SaleItem", back_populates="sale", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="sale", cascade="all, delete-orphan"
    )


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
