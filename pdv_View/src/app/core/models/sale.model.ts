import { UnitEnum } from "./product.model";

export enum SaleStatusEnum {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

export enum PaymentMethodEnum {
  CASH = 'CASH',
  CARD = 'CARD',
  PIX = 'PIX',
}

export enum OrderTypeEnum {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
}

export interface SaleItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: number;
  method: PaymentMethodEnum;
  amount: number;
  created_at: string;
}

export interface Sale {
  id: number;
  user_id: number;
  status: SaleStatusEnum;
  total_amount: number;
  opened_at: string;
  closed_at: string | null;
  items: SaleItem[];
  payments: Payment[];
  // Order details
  customer_name?: string | null;
  notes?: string | null;
  order_type?: OrderTypeEnum | null;
  delivery_time?: string | null;
  delivery_address?: string | null;
  customer_phone?: string | null;
  delivery_payment_method?: PaymentMethodEnum | null;
  is_paid?: boolean | null;
}

export interface AddItemRequest {
  sku: string;
  quantity: number;
}

export interface PaymentIn {
  method: PaymentMethodEnum;
  amount: number;
}

export interface FinalizeSaleRequest {
  payments: PaymentIn[];
}

export interface UpdateOrderDetailsRequest {
  customer_name?: string | null;
  notes?: string | null;
  order_type?: OrderTypeEnum | null;
  delivery_time?: string | null;
  delivery_address?: string | null;
  customer_phone?: string | null;
  delivery_payment_method?: PaymentMethodEnum | null;
  is_paid?: boolean | null;
}
