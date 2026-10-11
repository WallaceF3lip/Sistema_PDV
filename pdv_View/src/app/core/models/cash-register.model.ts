import { PaymentMethodEnum } from './sale.model';

export enum CashRegisterStatusEnum {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementTypeEnum {
  OPENING = 'OPENING',
  SALE = 'SALE',
  SALE_CANCEL = 'SALE_CANCEL',
  SANGRIA = 'SANGRIA',
  SUPRIMENTO = 'SUPRIMENTO',
  CLOSING = 'CLOSING',
}

export interface CashMovement {
  id: number;
  type: CashMovementTypeEnum;
  amount: number;
  description: string | null;
  /** Preenchido apenas em SALE / SALE_CANCEL */
  payment_method: PaymentMethodEnum | null;
  sale_id: number | null;
  user_id: number;
  created_at: string;
}

export interface CashRegister {
  id: number;
  /** Quem abriu */
  user_id: number;
  closed_by_user_id: number | null;
  opened_by_name: string | null;
  closed_by_name: string | null;
  status: CashRegisterStatusEnum;
  opening_amount: number;
  closing_amount: number | null;
  current_balance: number;
  expected_balance: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  movements: CashMovement[];
}

export interface CashRegisterOpen {
  opening_amount: number;
  notes?: string;
}

export interface CashMovementCreate {
  amount: number;
  description: string;
}

export interface CashRegisterClose {
  closing_amount: number;
  notes?: string;
}

/** Canal derivado do tipo de pedido: Balcão vs Delivery (Retirada + Entrega) */
export type SalesChannel = 'COUNTER' | 'DELIVERY';

export interface PaymentMethodTotal {
  method: PaymentMethodEnum;
  amount: number;
}

export interface ChannelSummary {
  channel: SalesChannel;
  sales_count: number;
  net_total: number;
  delivery_fees_total: number;
  by_payment_method: PaymentMethodTotal[];
}

export interface CashRegisterSummary {
  register_id: number;
  status: CashRegisterStatusEnum;
  opened_at: string;
  closed_at: string | null;
  opened_by_name: string | null;
  closed_by_name: string | null;
  opening_amount: number;
  suprimentos_total: number;
  sangrias_total: number;
  gross_total: number;
  cancellations_total: number;
  net_total: number;
  by_payment_method: PaymentMethodTotal[];
  by_channel: ChannelSummary[];
  delivery_fees_total: number;
  sales_count: number;
  canceled_count: number;
  pending_count: number;
  pending_total: number;
  expected_cash: number;
  closing_amount: number | null;
  difference: number | null;
}

export interface CashRegisterListItem {
  id: number;
  status: CashRegisterStatusEnum;
  opened_at: string;
  closed_at: string | null;
  opened_by_name: string | null;
  closed_by_name: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_balance: number;
  difference: number | null;
}

export interface CashRegisterPage {
  items: CashRegisterListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CashRegisterListParams {
  /** YYYY-MM-DD (data de abertura, inclusiva) */
  start_date?: string;
  end_date?: string;
  status?: CashRegisterStatusEnum;
  page?: number;
  page_size?: number;
}
