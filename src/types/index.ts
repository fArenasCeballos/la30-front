import type { Tables, Enums } from "./database.types";

// Re-export database enums as convenient types
export type UserRole = Enums<"user_role">;
export type OrderStatus = Enums<"order_status">;
export type PaymentMethod = Enums<"payment_method">;

// Row types from DB
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
  categories: Category;
}

// Order item with joined product (and product's category)
export interface OrderItem extends OrderItemRow {
  products: ProductWithCategory;
}

// Order with joined items (each item includes its product)
export interface Order extends OrderRow {
  order_items: OrderItem[];
}

// Custom option with its choices (for ProductCustomizer)
export interface CustomOptionWithChoices extends ProductCustomOption {
  product_custom_choices: ProductCustomChoice[];
}

// User type kept for backward compat in auth context
export type User = Profile;
