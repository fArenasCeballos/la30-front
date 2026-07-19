/**
 * Inventory & Recipe Management Types
 *
 * Strict interfaces for the Bodega General system.
 * Zero `any` usage — all fields are explicitly typed.
 */

// ─── Suppliers (Proveedores) ────────────────────────────────────────────────

export interface Supplier {
  id: string;
  store_id: string;
  nit: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface SupplierInsert {
  store_id: string;
  nit: string;
  name: string;
  is_active?: boolean;
}

export interface SupplierUpdate {
  nit?: string;
  name?: string;
  is_active?: boolean;
}

export interface SupplierPurchaseEntry {
  id: string;
  raw_material_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  entry_date: string;
  supplier_name: string | null;
  notes: string | null;
  created_at: string;
  raw_materials: {
    name: string;
    unit: string;
  };
}

// ─── Raw Material Category ──────────────────────────────────────────────────

export interface RawMaterialCategory {
  id: string;
  store_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface RawMaterialCategoryInsert {
  store_id: string;
  name: string;
  color?: string;
}

export interface RawMaterialCategoryUpdate {
  name?: string;
  color?: string;
}

// ─── Raw Material (Materia Prima) ───────────────────────────────────────────

export interface RawMaterial {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  unit: string;
  min_stock: number;
  current_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  raw_material_categories?: { name: string; color: string } | null;
}

export interface RawMaterialInsert {
  store_id: string;
  category_id?: string | null;
  name: string;
  unit: string;
  min_stock?: number;
  current_stock?: number;
  is_active?: boolean;
}

export interface RawMaterialUpdate {
  category_id?: string | null;
  name?: string;
  unit?: string;
  min_stock?: number;
  current_stock?: number;
  is_active?: boolean;
}

// ─── Raw Material Entry (Entrada de Inventario) ─────────────────────────────

export interface RawMaterialEntry {
  id: string;
  raw_material_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  entry_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RawMaterialEntryInsert {
  raw_material_id: string;
  quantity: number;
  unit_cost: number;
  entry_date?: string;
  supplier_id?: string;
  supplier_name?: string;
  notes?: string;
  created_by?: string;
}

// ─── Recipe (Receta) ────────────────────────────────────────────────────────

export interface Recipe {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity_required: number;
  created_at: string;
}

export interface RecipeInsert {
  product_id: string;
  raw_material_id: string;
  quantity_required: number;
}

export interface RecipeUpdate {
  quantity_required: number;
}

/** Recipe joined with its raw material (for UI display) */
export interface RecipeWithMaterial extends Recipe {
  raw_materials: RawMaterial;
}

/** Recipe joined with its product info (for UI display) */
export interface RecipeWithProduct extends Recipe {
  products: {
    id: string;
    name: string;
    price: number;
  };
}

// ─── Stock Movement (Movimiento de Stock) ───────────────────────────────────

export type StockMovementType =
  | "order_deduction"
  | "entry"
  | "manual_adjustment";

export interface StockMovement {
  id: string;
  raw_material_id: string;
  order_id: string | null;
  entry_id: string | null;
  quantity: number;
  movement_type: StockMovementType;
  notes: string | null;
  created_at: string;
}

// ─── RPC Response Types ─────────────────────────────────────────────────────

export interface DeductStockResult {
  status: "success" | "already_processed" | "skipped";
  order_id?: string;
  items_in_order?: number;
  items_with_recipe?: number;
  items_without_recipe?: number;
  materials_deducted?: number;
  low_stock_alerts?: string[];
  message?: string;
}

// ─── UI Helper Types ────────────────────────────────────────────────────────

/** Material with low-stock flag for dashboard alerts */
export interface RawMaterialWithAlert extends RawMaterial {
  is_low_stock: boolean;
}
