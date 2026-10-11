from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import RoleEnum
from app.schemas.schemas import (
    CustomerAddressCreate,
    CustomerAddressOut,
    CustomerAddressUpdate,
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
)
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["customers"])


# GET - Lista/busca de clientes (nome ou telefone)
@router.get("/", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    active_only: bool = True,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return CustomerService.search(db, q=q, active_only=active_only, limit=limit)


# GET - Cliente por ID
@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return CustomerService.get_or_404(db, customer_id)


# POST - Criar cliente (ADMIN ou OPERATOR)
@router.post("/", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return CustomerService.create(db, payload)


# PATCH - Editar cliente (is_active somente ADMIN)
@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if "is_active" in payload.model_fields_set and current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito ao ADMIN")
    return CustomerService.update(db, customer_id, payload)


# DELETE - Desativar cliente (exclusão lógica, somente ADMIN)
@router.delete("/{customer_id}", response_model=CustomerOut)
def deactivate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return CustomerService.deactivate(db, customer_id)


# ─── Endereços ───────────────────────────────────────────────────────────────

# POST - Adicionar endereço
@router.post("/{customer_id}/addresses", response_model=CustomerAddressOut, status_code=201)
def add_address(
    customer_id: int,
    payload: CustomerAddressCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return CustomerService.add_address(db, customer_id, payload)


# PATCH - Editar endereço
@router.patch("/{customer_id}/addresses/{address_id}", response_model=CustomerAddressOut)
def update_address(
    customer_id: int,
    address_id: int,
    payload: CustomerAddressUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return CustomerService.update_address(db, customer_id, address_id, payload)


# DELETE - Remover endereço (exclusão física)
@router.delete("/{customer_id}/addresses/{address_id}", status_code=204)
def remove_address(
    customer_id: int,
    address_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    CustomerService.remove_address(db, customer_id, address_id)
    return Response(status_code=204)
