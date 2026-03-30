export enum MovementTypeEnum {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST = 'ADJUST',
  SALE = 'SALE',
  CANCEL = 'CANCEL',
}

export interface Stock {
  id: number;
  product_id: number;
  quantity: number;
  min_quantity: number;
  updated_at: string;
  is_low: boolean;
}

export interface StockAdjust {
  quantity: number;
  reason: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: MovementTypeEnum;
  quantity: number;
  reference: string | null;
  user_id: number;
  created_at: string;
}
