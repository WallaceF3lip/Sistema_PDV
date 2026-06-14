import { Product } from "./product.model";

export enum MovementTypeEnum {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST = 'ADJUST',
  SALE = 'SALE',
  CANCEL = 'CANCEL',
}

export interface Stock {
  id: number;
  quantity: number;
  product: Product;
  min_quantity: number;
  updated_at: string;
  limited: boolean;
  // product_id: number;
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
