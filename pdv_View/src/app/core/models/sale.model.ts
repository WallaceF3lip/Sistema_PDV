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
  /** Nome atual do produto (não é snapshot) */
  product_name?: string | null;
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
  customer_id?: number | null;
  // Totais: total_amount = items_total + delivery_fee
  items_total?: number;
  delivery_fee?: number;
  delivery_zone_id?: number | null;
  delivery_zone_name?: string | null;
  /** Caixa que recebeu a venda (nulo em vendas OPEN e antigas) */
  cash_register_id: number | null;
  /** Número do pedido no dia de operação (nulo em OPEN e vendas antigas) */
  daily_number?: number | null;
  /** Dia de operação (YYYY-MM-DD) */
  business_date?: string | null;
  /** Momento do recebimento (finalização paga ou quitação) */
  paid_at?: string | null;
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

/** Quitação de pedido PENDING: 1 a 3 pagamentos, soma == total_amount */
export interface SettleSaleRequest {
  payments: PaymentIn[];
}

/** Filtro de tipo de pedido. COUNTER = Balcão (order_type nulo) */
export type OrderTypeFilter = 'COUNTER' | 'PICKUP' | 'DELIVERY';

export interface BoardStatusCount {
  status: SaleStatusEnum;
  count: number;
  total: number;
}

export interface BoardTypeCount {
  order_type: OrderTypeFilter;
  count: number;
  pending_count: number;
}

/** Resposta de GET /sales/board */
export interface SalesBoard {
  business_date: string;
  generated_at: string;
  status_counts: BoardStatusCount[];
  type_counts: BoardTypeCount[];
  orders: Sale[];
}

/** Filtros opcionais de GET /sales */
export interface SaleListFilters {
  status?: SaleStatusEnum;
  order_type?: OrderTypeFilter;
}

/** Entrada editável de pagamento (valor digitado; pode exceder o total em dinheiro) */
export interface PaymentEntry {
  method: PaymentMethodEnum;
  amount: number;
}

/** Estado emitido por app-payment-entry */
export interface PaymentEntryState {
  /** Pagamentos normalizados (troco descontado do dinheiro; soma == total) */
  payments: PaymentIn[];
  valid: boolean;
  remaining: number;
  change: number;
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
  customer_id?: number | null;
  /** Somente Entrega; null = sem zona (taxa manual) */
  delivery_zone_id?: number | null;
  /** Somente Entrega; Balcão/Retirada são zerados pelo backend */
  delivery_fee?: number | null;
}
