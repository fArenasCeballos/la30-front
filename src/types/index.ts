import type { Tables, Enums } from "./database.types";

// Re-export database enums as convenient types
export type UserRole = Enums<"user_role">;
export type OrderStatus = Enums<"order_status">;
export type PaymentMethod = Enums<"payment_method">;

// Row types from DB
export type Store = Tables<"stores">;
export type Profile = Tables<"profiles">;
export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type Payment = Tables<"payments">;
export type Notification = Tables<"notifications">;
export type ProductCustomOption = Tables<"product_custom_options">;
export type ProductCustomChoice = Tables<"product_custom_choices">;
export type ProductExtra = Tables<"product_extras">;

// Product with joined category
export interface ProductWithCategory extends Product {
  categories: Category | null;
}

// Order item with joined product (and product's category)
export interface OrderItem extends OrderItemRow {
  choices: Record<string, { label: string; icon?: string }>;
  products: ProductWithCategory;
}

// Siigo invoice record (from siigo_invoices table join)
export interface SiigoInvoiceRecord {
  id: string;
  order_id: string | null;
  siigo_invoice_id: string | null;
  siigo_invoice_number: string | null;
  payment_method: string;
  status: string;
  error_message: string | null;
  response_payload?: Record<string, unknown> | null;
  created_at: string;
}

// Order with joined items (each item includes its product)
export interface Order extends OrderRow {
  profiles: Profile | null;
  ticket_number: string;
  order_items: OrderItem[];
  total: number;
  payments?: Payment[];
  siigo_invoices?: SiigoInvoiceRecord[];
  isOptimistic?: boolean;
  isOfflinePending?: boolean;
  payment_method?: PaymentMethod;
}

// Custom option with its choices (for ProductCustomizer)
export interface CustomOptionWithChoices extends ProductCustomOption {
  product_custom_choices: ProductCustomChoice[];
}

// User type kept for backward compat in auth context
export type User = Profile;

// Inventory & Recipe types
export type {
  Supplier,
  SupplierInsert,
  SupplierUpdate,
  SupplierPurchaseEntry,
  RawMaterialCategory,
  RawMaterialCategoryInsert,
  RawMaterialCategoryUpdate,
  RawMaterial,
  RawMaterialInsert,
  RawMaterialUpdate,
  RawMaterialEntry,
  RawMaterialEntryInsert,
  Recipe,
  RecipeInsert,
  RecipeUpdate,
  RecipeWithMaterial,
  RecipeWithProduct,
  StockMovement,
  StockMovementType,
  DeductStockResult,
  RawMaterialWithAlert,
} from "./inventory.types";
