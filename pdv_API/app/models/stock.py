import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MovementTypeEnum(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"
    ADJUST = "ADJUST"


class Stock(Base):
    """
    Regra: 1 produto → 1 registro (MVP).
    Nunca atualizar quantity diretamente — sempre via service com stock_movement.
    """
    __tablename__ = "stock"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=0, nullable=False)
    min_quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped["Product"] = relationship("Product", back_populates="stock")


class StockMovement(Base):
    """
    Imutável após criação — log de auditoria completo.
    quantity sempre positivo; type define direção.
    """
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    type: Mapped[MovementTypeEnum] = mapped_column(Enum(MovementTypeEnum), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    product: Mapped["Product"] = relationship("Product", back_populates="stock_movements")
    user: Mapped["User"] = relationship("User", back_populates="stock_movements")
