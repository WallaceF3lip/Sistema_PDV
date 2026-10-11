from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeliveryZone(Base):
    """
    Zona de entrega com taxa fixa. Nunca é excluída fisicamente (is_active).
    Unicidade do nome (case-insensitive) garantida por índice único lower(name)
    no SQL de migração e por checagem no router.
    """
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
