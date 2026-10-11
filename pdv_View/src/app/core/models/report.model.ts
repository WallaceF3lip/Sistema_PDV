import { PaymentMethodEnum, OrderTypeFilter } from './sale.model';

/** Critério de ordenação do ranking de produtos */
export type TopProductsOrder = 'revenue' | 'quantity';

/** Canal do relatório: Balcão (COUNTER), Retirada (PICKUP) e Entrega (DELIVERY) */
export type ReportChannelType = OrderTypeFilter;

// Valores Decimal chegam da API como string; tipados como number
// (mesma convenção dos demais models) e convertidos com Number() no uso.

export interface ReportTotals {
  paid_count: number;
  gross_total: number;
  items_total: number;
  delivery_fees_total: number;
  avg_ticket: number;
}

export interface ReportCountTotal {
  count: number;
  total: number;
}

export interface ReportPaymentMethod {
  method: PaymentMethodEnum;
  amount: number;
  count: number;
}

export interface ReportChannel {
  channel: ReportChannelType;
  count: number;
  gross_total: number;
  items_total: number;
  delivery_fees_total: number;
  avg_ticket: number;
}

export interface ReportTopProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  revenue: number;
  sales_count: number;
}

export interface ReportDay {
  date: string; // YYYY-MM-DD
  count: number;
  gross_total: number;
  items_total: number;
  delivery_fees_total: number;
}

export interface ReportZone {
  zone_id: number | null;
  zone_name: string;
  count: number;
  delivery_fees_total: number;
  gross_total: number;
}

export interface ReportOperator {
  user_id: number;
  user_name: string;
  count: number;
  gross_total: number;
}

export interface SalesSummary {
  start_date: string;
  end_date: string;
  generated_at: string;
  totals: ReportTotals;
  canceled: ReportCountTotal;
  pending: ReportCountTotal;
  by_payment_method: ReportPaymentMethod[];
  by_channel: ReportChannel[];
  top_products: ReportTopProduct[];
  by_day: ReportDay[];
  by_zone: ReportZone[];
  by_operator: ReportOperator[];
}
