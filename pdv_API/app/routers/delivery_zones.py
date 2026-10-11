from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.delivery_zone import DeliveryZone
from app.schemas.schemas import DeliveryZoneCreate, DeliveryZoneOut, DeliveryZoneUpdate
from app.services.delivery_zone_service import get_zone_or_404, name_taken

router = APIRouter(prefix="/delivery-zones", tags=["delivery-zones"])

DUPLICATE_NAME = "Já existe uma zona com este nome"


# GET - Lista de zonas (qualquer usuário autenticado)
@router.get("/", response_model=list[DeliveryZoneOut])
def list_zones(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(DeliveryZone)
    if active_only:
        query = query.filter(DeliveryZone.is_active == True)  # noqa: E712
    return query.order_by(DeliveryZone.name).all()


# POST - Criar zona (somente ADMIN)
@router.post("/", response_model=DeliveryZoneOut, status_code=201)
def create_zone(
    payload: DeliveryZoneCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if name_taken(db, payload.name):
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)

    zone = DeliveryZone(name=payload.name, fee=payload.fee, is_active=True)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


# PATCH - Editar / reativar zona (somente ADMIN)
@router.patch("/{zone_id}", response_model=DeliveryZoneOut)
def update_zone(
    zone_id: int,
    payload: DeliveryZoneUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    zone = get_zone_or_404(db, zone_id)

    data = payload.model_dump(exclude_unset=True)
    # Nenhum campo de zona aceita null
    data = {k: v for k, v in data.items() if v is not None}

    if "name" in data and name_taken(db, data["name"], exclude_id=zone.id):
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)

    for field, value in data.items():
        setattr(zone, field, value)

    db.commit()
    db.refresh(zone)
    return zone


# DELETE - Desativar zona (exclusão lógica, somente ADMIN)
@router.delete("/{zone_id}", response_model=DeliveryZoneOut)
def deactivate_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    zone = get_zone_or_404(db, zone_id)
    zone.is_active = False
    db.commit()
    db.refresh(zone)
    return zone
