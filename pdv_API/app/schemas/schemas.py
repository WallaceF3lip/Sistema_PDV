from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.user import RoleEnum
from app.models.product import UnitEnum
from app.models.stock import MovementTypeEnum
from app.models.sale import SaleStatusEnum, PaymentMethodEnum


# ─── Auth ────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── Users ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    role: RoleEnum = RoleEnum.OPERATOR


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[RoleEnum] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Products ────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    cost_price: Decimal = Field(gt=0, decimal_places=2)
    sale_price: Decimal = Field(gt=0, decimal_places=2)
    unit: UnitEnum = UnitEnum.UN


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    cost_price: Optional[Decimal] = Field(default=None, gt=0)
    sale_price: Optional[Decimal] = Field(default=None, gt=0)
    unit: Optional[UnitEnum] = None
    is_active: Optional[bool] = None


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    cost_price: Decimal
    sale_price: Decimal
    unit: UnitEnum
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Stock ───────────────────────────────────────────────────────────────────

class StockOut(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    min_quantity: Decimal
    updated_at: datetime
    is_low: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_is_low(self):
        self.is_low = self.quantity <= self.min_quantity
        return self


class StockAdjust(BaseModel):
    quantity: Decimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=100)


class StockMovementOut(BaseModel):
    id: int
    product_id: int
    type: MovementTypeEnum
    quantity: Decimal
    reference: Optional[str]
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Sales ───────────────────────────────────────────────────────────────────

class AddItemRequest(BaseModel):
    sku: str
    quantity: Decimal = Field(gt=0, decimal_places=3)


class PaymentIn(BaseModel):
    method: PaymentMethodEnum
    amount: Decimal = Field(gt=0, decimal_places=2)


class FinalizeSaleRequest(BaseModel):
    payments: list[PaymentIn] = Field(min_length=1)


class SaleItemOut(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: int
    method: PaymentMethodEnum
    amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class SaleOut(BaseModel):
    id: int
    user_id: int
    status: SaleStatusEnum
    total_amount: Decimal
    opened_at: datetime
    closed_at: Optional[datetime]
    items: list[SaleItemOut] = []
    payments: list[PaymentOut] = []

    model_config = {"from_attributes": True}
