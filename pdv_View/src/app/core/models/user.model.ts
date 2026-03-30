export enum RoleEnum {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: RoleEnum;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: RoleEnum;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role?: RoleEnum;
}
