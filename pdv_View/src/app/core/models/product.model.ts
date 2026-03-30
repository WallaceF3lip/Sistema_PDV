export enum UnitEnum {
  UN = 'UN',
  KG = 'KG',
  LT = 'LT',
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  cost_price: number;
  sale_price: number;
  unit: UnitEnum;
  is_active: boolean;
  created_at: string;
}

export interface ProductCreate {
  sku: string;
  name: string;
  cost_price: number;
  sale_price: number;
  unit: UnitEnum;
}

export interface ProductUpdate {
  name?: string;
  cost_price?: number;
  sale_price?: number;
  unit?: UnitEnum;
  is_active?: boolean;
}
