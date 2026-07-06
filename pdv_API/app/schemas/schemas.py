from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.user import RoleEnum
from app.models.product import UnitEnum
from app.models.stock import MovementTypeEnum
from app.models.sale import SaleStatusEnum, PaymentMethodEnum, OrderTypeEnum


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
    quantity: Decimal
    product: ProductOut
    min_quantity: Decimal
    updated_at: datetime

    model_config = {"from_attributes": True}

    # @model_validator(mode="after")
    # def compute_is_low(self):
    #     self.product.is_active = self.quantity <= self.min_quantity
    #     return self


class StockAdjust(BaseModel):
    quantity: Decimal = Field(gt=0)
    min_quantity: Decimal # = Field(gt=0)
    reason: str = Field(max_length=100)


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

class UpdateItemRequest(BaseModel):
    quantity: Decimal = Field(gt=0, decimal_places=3)


class PaymentIn(BaseModel):
    method: PaymentMethodEnum
    amount: Decimal = Field(gt=0, decimal_places=2)


class FinalizeSaleRequest(BaseModel):
    payments: list[PaymentIn] = []


class UpdateOrderDetailsRequest(BaseModel):
    customer_name: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)
    order_type: Optional[OrderTypeEnum] = None
    # Delivery-specific (required when order_type == DELIVERY)
    delivery_time: Optional[str] = Field(None, max_length=50)
    delivery_address: Optional[str] = Field(None, max_length=500)
    customer_phone: Optional[str] = Field(None, max_length=30)
    delivery_payment_method: Optional[PaymentMethodEnum] = None
    is_paid: Optional[bool] = None

    @model_validator(mode="after")
    def validate_delivery_fields(self):
        if self.order_type == OrderTypeEnum.DELIVERY:
            missing = []
            if not self.delivery_time:
                missing.append("delivery_time")
            if not self.delivery_address:
                missing.append("delivery_address")
            if not self.customer_phone:
                missing.append("customer_phone")
            if missing:
                raise ValueError(
                    f"Campos obrigatórios para entrega: {', '.join(missing)}"
                )
        return self


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
    # Order details
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    order_type: Optional[OrderTypeEnum] = None
    delivery_time: Optional[str] = None
    delivery_address: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_payment_method: Optional[PaymentMethodEnum] = None
    is_paid: Optional[bool] = None

    model_config = {"from_attributes": True}


# ─── Cash Register ───────────────────────────────────────────────────────────

from app.models.cash_register import CashRegisterStatusEnum, CashMovementTypeEnum


class CashRegisterOpen(BaseModel):
    opening_amount: Decimal = Field(ge=0, decimal_places=2)
    notes: Optional[str] = Field(None, max_length=255)


class CashMovementCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    description: str = Field(min_length=3, max_length=255)


class CashRegisterClose(BaseModel):
    closing_amount: Decimal = Field(ge=0, decimal_places=2)
    notes: Optional[str] = Field(None, max_length=255)


class CashMovementOut(BaseModel):
    id: int
    type: CashMovementTypeEnum
    amount: Decimal
    description: Optional[str]
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CashRegisterOut(BaseModel):
    id: int
    user_id: int
    status: CashRegisterStatusEnum
    opening_amount: Decimal
    closing_amount: Optional[Decimal]
    current_balance: Decimal = Decimal("0")
    expected_balance: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    opened_at: datetime
    closed_at: Optional[datetime]
    notes: Optional[str]
    movements: list[CashMovementOut] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def compute_balance(self):
        """Calcula saldo corrente e, se fechado, diferença entre contagem e sistema."""
        balance = Decimal("0")
        inflows = {CashMovementTypeEnum.OPENING, CashMovementTypeEnum.SALE, CashMovementTypeEnum.SUPRIMENTO}
        outflows = {CashMovementTypeEnum.SANGRIA}
        for m in self.movements:
            if m.type in inflows:
                balance += m.amount
            elif m.type in outflows:
                balance -= m.amount
            # CLOSING é apenas registro da contagem física — não afeta saldo
        self.current_balance = balance

        if self.status == CashRegisterStatusEnum.CLOSED and self.closing_amount is not None:
            self.expected_balance = balance
            self.difference = self.closing_amount - balance

        return self

