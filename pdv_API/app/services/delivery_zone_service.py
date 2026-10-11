"""
DeliveryZoneService — helpers de zonas de entrega reutilizados pelo router de
zonas, pelo cadastro de endereços de clientes e pelos detalhes do pedido.
"""
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.delivery_zone import DeliveryZone

ZONE_NOT_FOUND = "Zona de entrega não encontrada"
ZONE_INACTIVE = "Zona de entrega inativa"


def get_zone_or_404(db: Session, zone_id: int) -> DeliveryZone:
    zone = db.query(DeliveryZone).filter(DeliveryZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=ZONE_NOT_FOUND)
    return zone


def validate_active_zone(
    db: Session, zone_id: int, allow_inactive_id: int | None = None
) -> DeliveryZone:
    """
    Garante que a zona existe (404) e está ativa (400).
    `allow_inactive_id`: aceita a zona mesmo inativa quando for esta
    (ex.: re-salvar detalhes de uma venda que já aponta para a zona).
    """
    zone = get_zone_or_404(db, zone_id)
    if not zone.is_active and zone.id != allow_inactive_id:
        raise HTTPException(status_code=400, detail=ZONE_INACTIVE)
    return zone


def name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    """Checagem case-insensitive de nome duplicado."""
    query = db.query(DeliveryZone.id).filter(
        func.lower(DeliveryZone.name) == name.strip().lower()
    )
    if exclude_id is not None:
        query = query.filter(DeliveryZone.id != exclude_id)
    return query.first() is not None
