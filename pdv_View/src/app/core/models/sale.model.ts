import { UnitEnum } from "./product.model";

export enum SaleStatusEnum {
  OPEN = 'OPEN',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

export enum PaymentMethodEnum {
  CASH = 'CASH',
  CARD = 'CARD',
  PIX = 'PIX',
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
