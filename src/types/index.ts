import type { Tables, Enums, Json } from "./database.types";
export type { Json };

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

// Delivery zone coordinate point
export interface LatLngPoint {
  lat: number;
  lng: number;
}

// Delivery zone with polygon and price
export interface DeliveryZone {
  id: string;
  name: string;
  price: number;
  polygon: LatLngPoint[][];
  color: string;
  is_active: boolean;
  created_at: string;
}

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

// Mobile App Types
export interface AppCustomer {
  id: string;
  auth_user_id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  avatar_url?: string | null;
  is_verified: boolean;
  push_token?: string | null;
  default_address_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppCustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  address_text: string;
  lat: number;
  lng: number;
  delivery_zone_id?: string | null;
  additional_info?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Combo {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  combo_price: number;
  original_price: number;
  store_ids: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_total?: number;
  max_uses?: number | null;
  uses_count: number;
  max_uses_per_customer?: number;
  valid_from: string;
  valid_until?: string | null;
  is_active: boolean;
  store_ids?: string[];
  created_at: string;
}

export interface AppPayment {
  id: string;
  order_id: string;
  customer_id: string;
  wompi_transaction_id?: string | null;
  wompi_reference?: string | null;
  method: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "declined" | "voided" | "error";
  webhook_payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface StoreOperatingHour {
  id: string;
  store_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
  created_at: string;
}

// Internal Consumption (Consumo Interno) types
export type {
  InternalConsumerType,
  InternalPaymentStatus,
  InternalPartner,
  InternalConsumption,
  InternalConsumptionWithItems,
  InternalConsumptionItem,
  InternalConsumptionPayment,
  MonthlyAccountStatement,
} from "./internalConsumption.types";
