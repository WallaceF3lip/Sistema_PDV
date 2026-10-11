"""
CustomerService — cadastro de clientes e endereços.
Regras de endereço padrão:
  - o primeiro endereço do cliente vira padrão;
  - criar/editar com is_default=True zera os demais;
  - remover o padrão promove o endereço restante de menor id.
"""
import re

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.customer import Customer, CustomerAddress
from app.services.delivery_zone_service import validate_active_zone
from app.schemas.schemas import (
    CustomerAddressCreate,
    CustomerAddressUpdate,
    CustomerCreate,
    CustomerUpdate,
)

MAX_LIMIT = 200


class CustomerService:

    # ─── Clientes ────────────────────────────────────────────────────────────

    @staticmethod
    def search(
        db: Session,
        q: str | None = None,
        active_only: bool = True,
        limit: int = 50,
    ) -> list[Customer]:
        limit = max(1, min(limit, MAX_LIMIT))
        query = db.query(Customer).options(
            selectinload(Customer.addresses).selectinload(CustomerAddress.delivery_zone)
        )

        if active_only:
            query = query.filter(Customer.is_active == True)  # noqa: E712

        term = (q or "").strip()
        if term:
            conditions = [Customer.name.ilike(f"%{term}%")]
            digits = re.sub(r"\D", "", term)
            if len(digits) >= 2:
                conditions.append(Customer.phone.like(f"%{digits}%"))
            query = query.filter(or_(*conditions))

        return query.order_by(Customer.name).limit(limit).all()

    @staticmethod
    def get_or_404(db: Session, customer_id: int) -> Customer:
        customer = (
            db.query(Customer)
            .options(
            selectinload(Customer.addresses).selectinload(CustomerAddress.delivery_zone)
        )
            .filter(Customer.id == customer_id)
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        return customer

    @classmethod
    def create(cls, db: Session, payload: CustomerCreate) -> Customer:
        customer = Customer(
            name=payload.name.strip(),
            phone=payload.phone,
            notes=payload.notes,
            is_active=True,
        )

        # Endereços iniciais: no máximo um padrão; se nenhum marcado, o primeiro
        addresses = payload.addresses
        default_index = next(
            (i for i, a in enumerate(addresses) if a.is_default), 0
        )
        for addr in addresses:
            if addr.delivery_zone_id is not None:
                validate_active_zone(db, addr.delivery_zone_id)
        for i, addr in enumerate(addresses):
            data = addr.model_dump()
            data["is_default"] = i == default_index
            customer.addresses.append(CustomerAddress(**data))

        db.add(customer)
        db.commit()
        return cls.get_or_404(db, customer.id)

    @classmethod
    def update(cls, db: Session, customer_id: int, payload: CustomerUpdate) -> Customer:
        customer = cls.get_or_404(db, customer_id)

        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            # name e is_active não aceitam null; phone/notes null limpam o campo
            if field in ("name", "is_active") and value is None:
                continue
            if field == "name":
                value = value.strip()
            setattr(customer, field, value)

        db.commit()
        return cls.get_or_404(db, customer.id)

    @classmethod
    def deactivate(cls, db: Session, customer_id: int) -> Customer:
        customer = cls.get_or_404(db, customer_id)
        customer.is_active = False
        db.commit()
        return cls.get_or_404(db, customer.id)

    # ─── Endereços ───────────────────────────────────────────────────────────

    @staticmethod
    def _get_address_or_404(
        db: Session, customer_id: int, address_id: int
    ) -> CustomerAddress:
        address = (
            db.query(CustomerAddress)
            .filter(
                CustomerAddress.id == address_id,
                CustomerAddress.customer_id == customer_id,
            )
            .first()
        )
        if not address:
            raise HTTPException(status_code=404, detail="Endereço não encontrado")
        return address

    @staticmethod
    def _clear_other_defaults(db: Session, customer_id: int, keep_id: int | None) -> None:
        query = db.query(CustomerAddress).filter(
            CustomerAddress.customer_id == customer_id,
            CustomerAddress.is_default == True,  # noqa: E712
        )
        if keep_id is not None:
            query = query.filter(CustomerAddress.id != keep_id)
        query.update({CustomerAddress.is_default: False}, synchronize_session="fetch")

    @classmethod
    def add_address(
        cls, db: Session, customer_id: int, payload: CustomerAddressCreate
    ) -> CustomerAddress:
        cls.get_or_404(db, customer_id)
        if payload.delivery_zone_id is not None:
            validate_active_zone(db, payload.delivery_zone_id)

        has_addresses = (
            db.query(CustomerAddress.id)
            .filter(CustomerAddress.customer_id == customer_id)
            .first()
            is not None
        )
        data = payload.model_dump()
        data["is_default"] = bool(data.get("is_default")) or not has_addresses

        address = CustomerAddress(customer_id=customer_id, **data)
        db.add(address)
        db.flush()

        if address.is_default:
            cls._clear_other_defaults(db, customer_id, keep_id=address.id)

        db.commit()
        db.refresh(address)
        return address

    @classmethod
    def update_address(
        cls,
        db: Session,
        customer_id: int,
        address_id: int,
        payload: CustomerAddressUpdate,
    ) -> CustomerAddress:
        cls.get_or_404(db, customer_id)
        address = cls._get_address_or_404(db, customer_id, address_id)

        data = payload.model_dump(exclude_unset=True)
        # delivery_zone_id: null explícito remove o vínculo; valor é validado.
        # Valida antes de alterar qualquer campo (erro não altera o endereço).
        zone_id = data.get("delivery_zone_id")
        if zone_id is not None and zone_id != address.delivery_zone_id:
            validate_active_zone(db, zone_id)
        for field, value in data.items():
            # street, neighborhood e is_default não aceitam null
            if field in ("street", "neighborhood", "is_default") and value is None:
                continue
            setattr(address, field, value)

        if data.get("is_default") is True:
            db.flush()
            cls._clear_other_defaults(db, customer_id, keep_id=address.id)

        db.commit()
        db.refresh(address)
        return address

    @classmethod
    def remove_address(cls, db: Session, customer_id: int, address_id: int) -> None:
        cls.get_or_404(db, customer_id)
        address = cls._get_address_or_404(db, customer_id, address_id)
        was_default = address.is_default

        db.delete(address)
        db.flush()

        if was_default:
            next_address = (
                db.query(CustomerAddress)
                .filter(CustomerAddress.customer_id == customer_id)
                .order_by(CustomerAddress.id)
                .first()
            )
            if next_address:
                next_address.is_default = True

        db.commit()
