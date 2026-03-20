import type { Product, Order, User } from "@/types";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Perro Clásico",
    category: "perros",
    price: 8000,
    available: true,
  },
  {
    id: "2",
    name: "Perro Especial La 30",
    category: "perros",
    price: 12000,
    available: true,
  },
  {
    id: "3",
    name: "Perro Hawaiano",
    category: "perros",
    price: 10000,
    available: true,
  },
  {
    id: "4",
    name: "Perro Ranchero",
    category: "perros",
    price: 11000,
    available: true,
  },
  {
    id: "5",
    name: "Hamburguesa Clásica",
    category: "hamburguesas",
    price: 15000,
    available: true,
  },
  {
    id: "6",
    name: "Hamburguesa Doble",
    category: "hamburguesas",
    price: 20000,
    available: true,
  },
  {
    id: "7",
    name: "Hamburguesa BBQ",
    category: "hamburguesas",
    price: 18000,
    available: true,
  },
  {
    id: "8",
    name: "Hamburguesa La 30",
    category: "hamburguesas",
    price: 22000,
    available: true,
  },
  {
    id: "9",
    name: "Gaseosa",
    category: "bebidas",
    price: 3000,
    available: true,
  },
  {
    id: "10",
    name: "Jugo Natural",
    category: "bebidas",
    price: 5000,
    available: true,
  },
  { id: "11", name: "Agua", category: "bebidas", price: 2000, available: true },
  {
    id: "12",
    name: "Papas Fritas",
    category: "extras",
    price: 6000,
    available: true,
  },
  {
    id: "13",
    name: "Aros de Cebolla",
    category: "extras",
    price: 7000,
    available: true,
  },
  {
    id: "14",
    name: "Salchipapa",
    category: "extras",
    price: 9000,
    available: true,
  },
];

export const MOCK_USERS: User[] = [
  {
    id: "1",
    name: "Admin",
    email: "admin@la30.com",
    role: "admin",
    token: "mock-jwt-admin",
  },
  {
    id: "2",
    name: "Carlos Caja",
    email: "caja@la30.com",
    role: "caja",
    token: "mock-jwt-caja",
  },
  {
    id: "3",
    name: "María Mesera",
    email: "mesero@la30.com",
    role: "mesero",
    token: "mock-jwt-mesero",
  },
  {
    id: "4",
    name: "Pedro Cocina",
    email: "cocina@la30.com",
    role: "cocina",
    token: "mock-jwt-cocina",
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: "ord-001",
    locator: "A-12",
    items: [
      {
        id: "i1",
        product: MOCK_PRODUCTS[1],
        quantity: 2,
        notes: "Sin cebolla",
      },
      { id: "i2", product: MOCK_PRODUCTS[8], quantity: 2 },
    ],
    status: "confirmado",
    total: 30000,
    createdAt: new Date(Date.now() - 600000),
    updatedAt: new Date(Date.now() - 300000),
    createdBy: "mesero",
  },
  {
    id: "ord-002",
    locator: "B-05",
    items: [
      { id: "i3", product: MOCK_PRODUCTS[5], quantity: 1 },
      { id: "i4", product: MOCK_PRODUCTS[11], quantity: 1 },
      { id: "i5", product: MOCK_PRODUCTS[9], quantity: 1 },
    ],
    status: "en_preparacion",
    total: 31000,
    createdAt: new Date(Date.now() - 900000),
    updatedAt: new Date(Date.now() - 200000),
    createdBy: "mesero",
  },
  {
    id: "ord-003",
    locator: "C-08",
    items: [
      { id: "i6", product: MOCK_PRODUCTS[0], quantity: 3 },
      { id: "i7", product: MOCK_PRODUCTS[8], quantity: 3 },
    ],
    status: "pendiente",
    total: 33000,
    createdAt: new Date(Date.now() - 120000),
    updatedAt: new Date(Date.now() - 120000),
    createdBy: "mesero",
  },
];

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(price);
}
