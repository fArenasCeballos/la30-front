export type UserRole = "admin" | "caja" | "mesero" | "cocina";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token: string;
}

export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export interface Product {
  id: string;
  name: string;
  category: "perros" | "hamburguesas" | "bebidas" | "extras";
  price: number;
  image?: string;
  available: boolean;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  locator: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  notes?: string;
}
