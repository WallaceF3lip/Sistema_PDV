import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Optional

import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

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


# ─── Delivery Zones ──────────────────────────────────────────────────────────

# Taxa de entrega: >= 0, máx. 9999.99, 2 casas decimais
FeeDecimal = Annotated[Decimal, Field(ge=0, le=Decimal("9999.99"), decimal_places=2)]

class DeliveryZoneCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    fee: FeeDecimal

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class DeliveryZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    fee: Optional[FeeDecimal] = None
    is_active: Optional[bool] = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class DeliveryZoneOut(BaseModel):
    id: int
    name: str
    fee: Decimal
    is_active: bool

    model_config = {"from_attributes": True}


class DeliveryZoneBrief(BaseModel):
    id: int
    name: str
    fee: Decimal
    is_active: bool

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


class SettleSaleRequest(BaseModel):
    """Quitação de pedido PENDING: 1 a 3 pagamentos, soma == total_amount."""
    payments: list[PaymentIn] = Field(min_length=1, max_length=3)


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
    # Vínculo opcional com cliente; null explícito desvincula
    customer_id: Optional[int] = None
    # Taxa de entrega (somente DELIVERY; Balcão/Retirada são zerados no backend)
    delivery_zone_id: Optional[int] = None
    delivery_fee: Optional[FeeDecimal] = None

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
    # Nome atual do produto (não é snapshot)
    product_name: Optional[str] = None
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
    customer_id: Optional[int] = None
    # Totais: total_amount = items_total + delivery_fee
    items_total: Decimal = Decimal("0")
    delivery_fee: Decimal = Decimal("0")
    delivery_zone_id: Optional[int] = None
    delivery_zone_name: Optional[str] = None
    # Caixa que recebeu a venda (nulo em vendas OPEN e anteriores ao caixa único)
    cash_register_id: Optional[int] = None
    # Número do pedido no dia de operação (nulo em OPEN e vendas antigas)
    daily_number: Optional[int] = None
    business_date: Optional[date] = None
    # Momento do recebimento (finalização PAID ou quitação)
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class OrderTypeFilterEnum(str, enum.Enum):
    """Filtro de tipo de pedido (Python-only). COUNTER ⇔ order_type nulo (Balcão)."""
    COUNTER = "COUNTER"
    PICKUP = "PICKUP"
    DELIVERY = "DELIVERY"


class BoardStatusCount(BaseModel):
    status: SaleStatusEnum
    count: int = 0
    total: Decimal = Decimal("0")


class BoardTypeCount(BaseModel):
    order_type: OrderTypeFilterEnum
    count: int = 0
    pending_count: int = 0


class SalesBoardOut(BaseModel):
    business_date: date
    generated_at: datetime
    status_counts: list[BoardStatusCount] = []
    type_counts: list[BoardTypeCount] = []
    orders: list[SaleOut] = []


# ─── Customers ───────────────────────────────────────────────────────────────

def _normalize_phone(value: Optional[str]) -> Optional[str]:
    """Remove não-dígitos; vazio → None; exige 10 ou 11 dígitos."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    if len(digits) not in (10, 11):
        raise ValueError("Telefone inválido")
    return digits


class CustomerAddressCreate(BaseModel):
    street: str = Field(min_length=1, max_length=255)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=100)
    neighborhood: str = Field(min_length=1, max_length=100)
    reference: Optional[str] = Field(None, max_length=255)
    is_default: bool = False
    delivery_zone_id: Optional[int] = None


class CustomerAddressUpdate(BaseModel):
    street: Optional[str] = Field(None, min_length=1, max_length=255)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=100)
    neighborhood: Optional[str] = Field(None, min_length=1, max_length=100)
    reference: Optional[str] = Field(None, max_length=255)
    is_default: Optional[bool] = None
    # null explícito remove o vínculo com a zona
    delivery_zone_id: Optional[int] = None


class CustomerAddressOut(BaseModel):
    id: int
    customer_id: int
    street: str
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: str
    reference: Optional[str] = None
    is_default: bool
    delivery_zone_id: Optional[int] = None
    delivery_zone: Optional[DeliveryZoneBrief] = None

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    addresses: list[CustomerAddressCreate] = []

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return _normalize_phone(v)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return _normalize_phone(v)


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    addresses: list[CustomerAddressOut] = []

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
    payment_method: Optional[PaymentMethodEnum] = None
    sale_id: Optional[int] = None
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CashRegisterOut(BaseModel):
    id: int
    user_id: int
    closed_by_user_id: Optional[int] = None
    opened_by_name: Optional[str] = None
    closed_by_name: Optional[str] = None
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
        """
        Saldo de gaveta (somente dinheiro) pela regra única do serviço e,
        se fechado, diferença entre contagem e saldo esperado.
        """
        from app.services.cash_register_service import CashRegisterService

        balance = CashRegisterService.get_cash_balance(self)
        self.current_balance = balance

        if self.status == CashRegisterStatusEnum.CLOSED and self.closing_amount is not None:
            self.expected_balance = balance
            self.difference = self.closing_amount - balance

        return self


class SalesChannelEnum(str, enum.Enum):
    """Canal de venda derivado de Sale.order_type (Python-only, sem tipo no banco)."""
    COUNTER = "COUNTER"    # Balcão (order_type nulo)
    DELIVERY = "DELIVERY"  # Retirada (PICKUP) + Entrega (DELIVERY)


class PaymentMethodTotal(BaseModel):
    method: PaymentMethodEnum
    amount: Decimal = Decimal("0")


class ChannelSummary(BaseModel):
    channel: SalesChannelEnum
    sales_count: int = 0
    net_total: Decimal = Decimal("0")
    delivery_fees_total: Decimal = Decimal("0")
    by_payment_method: list[PaymentMethodTotal] = []


class CashRegisterSummaryOut(BaseModel):
    register_id: int
    status: CashRegisterStatusEnum
    opened_at: datetime
    closed_at: Optional[datetime] = None
    opened_by_name: Optional[str] = None
    closed_by_name: Optional[str] = None
    opening_amount: Decimal
    suprimentos_total: Decimal = Decimal("0")
    sangrias_total: Decimal = Decimal("0")
    gross_total: Decimal = Decimal("0")
    cancellations_total: Decimal = Decimal("0")
    net_total: Decimal = Decimal("0")
    by_payment_method: list[PaymentMethodTotal] = []
    by_channel: list[ChannelSummary] = []
    delivery_fees_total: Decimal = Decimal("0")
    sales_count: int = 0
    canceled_count: int = 0
    pending_count: int = 0
    pending_total: Decimal = Decimal("0")
    expected_cash: Decimal = Decimal("0")
    closing_amount: Optional[Decimal] = None
    difference: Optional[Decimal] = None


class CashRegisterListItem(BaseModel):
    id: int
    status: CashRegisterStatusEnum
    opened_at: datetime
    closed_at: Optional[datetime] = None
    opened_by_name: Optional[str] = None
    closed_by_name: Optional[str] = None
    opening_amount: Decimal
    closing_amount: Optional[Decimal] = None
    expected_balance: Decimal = Decimal("0")
    difference: Optional[Decimal] = None


class CashRegisterPage(BaseModel):
    items: list[CashRegisterListItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


# ─── Reports ─────────────────────────────────────────────────────────────────

class TopProductsOrderEnum(str, enum.Enum):
    """Critério de ordenação de `top_products`."""
    REVENUE = "revenue"
    QUANTITY = "quantity"


class ReportTotals(BaseModel):
    paid_count: int = 0
    gross_total: Decimal = Decimal("0.00")
    items_total: Decimal = Decimal("0.00")
    delivery_fees_total: Decimal = Decimal("0.00")
    avg_ticket: Decimal = Decimal("0.00")


class ReportCountTotal(BaseModel):
    count: int = 0
    total: Decimal = Decimal("0.00")


class ReportPaymentMethod(BaseModel):
    method: PaymentMethodEnum
    amount: Decimal = Decimal("0.00")
    count: int = 0


class ReportChannel(BaseModel):
    channel: OrderTypeFilterEnum
    count: int = 0
    gross_total: Decimal = Decimal("0.00")
    items_total: Decimal = Decimal("0.00")
    delivery_fees_total: Decimal = Decimal("0.00")
    avg_ticket: Decimal = Decimal("0.00")


class ReportTopProduct(BaseModel):
    product_id: int
    product_name: str
    quantity: Decimal = Decimal("0.000")
    revenue: Decimal = Decimal("0.00")
    sales_count: int = 0


class ReportDay(BaseModel):
    date: date
    count: int = 0
    gross_total: Decimal = Decimal("0.00")
    items_total: Decimal = Decimal("0.00")
    delivery_fees_total: Decimal = Decimal("0.00")


class ReportZone(BaseModel):
    zone_id: Optional[int] = None
    zone_name: str
    count: int = 0
    delivery_fees_total: Decimal = Decimal("0.00")
    gross_total: Decimal = Decimal("0.00")


class ReportOperator(BaseModel):
    user_id: int
    user_name: str
    count: int = 0
    gross_total: Decimal = Decimal("0.00")


class SalesSummaryOut(BaseModel):
    start_date: date
    end_date: date
    generated_at: datetime
    totals: ReportTotals
    canceled: ReportCountTotal
    pending: ReportCountTotal
    by_payment_method: list[ReportPaymentMethod] = []
    by_channel: list[ReportChannel] = []
    top_products: list[ReportTopProduct] = []
    by_day: list[ReportDay] = []
    by_zone: list[ReportZone] = []
    by_operator: list[ReportOperator] = []
