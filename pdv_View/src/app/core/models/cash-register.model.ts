export enum CashRegisterStatusEnum {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementTypeEnum {
  OPENING = 'OPENING',
  SALE = 'SALE',
  SANGRIA = 'SANGRIA',
  SUPRIMENTO = 'SUPRIMENTO',
  CLOSING = 'CLOSING',
}

export interface CashMovement {
  id: number;
  type: CashMovementTypeEnum;
  amount: number;
  description: string | null;
  user_id: number;
  created_at: string;
}

export interface CashRegister {
  id: number;
  user_id: number;
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
