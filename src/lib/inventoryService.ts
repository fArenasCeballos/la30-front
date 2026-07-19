/**
 * Inventory Service
 *
 * Single Responsibility: manages all inventory CRUD operations and stock
 * deduction via Supabase RPCs and table queries.
 *
 * Follows SOLID principles:
 *  - S: Only handles inventory data access (no UI logic, no order management).
 *  - O: Extensible via new methods without modifying existing ones.
 *  - L: All methods return consistent Result-like patterns.
 *  - I: Consumers import only what they need from the typed interface.
 *  - D: Depends on the supabase abstraction, not concrete HTTP calls.
 */

import { supabase } from "@/lib/supabase";
import type {
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
  RecipeWithMaterial,
  StockMovement,
  DeductStockResult,
  RawMaterialWithAlert,
} from "@/types/inventory.types";

// ─── Suppliers (Proveedores) ─────────────────────────────────────────────────

export async function getSuppliers(storeId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Error al obtener proveedores: ${error.message}`);
  return (data ?? []) as Supplier[];
}

export async function createSupplier(payload: SupplierInsert): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert([payload])
    .select()
    .single();
  if (error) throw new Error(`Error al crear proveedor: ${error.message}`);
  return data as Supplier;
}

export async function updateSupplier(id: string, payload: SupplierUpdate): Promise<void> {
  const { error } = await supabase
    .from("suppliers")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(`Error al actualizar proveedor: ${error.message}`);
}

export async function deactivateSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Error al desactivar proveedor: ${error.message}`);
}

export async function getSupplierPurchaseHistory(
  supplierId: string
): Promise<SupplierPurchaseEntry[]> {
  const { data, error } = await supabase
    .from("raw_material_entries")
    .select("*, raw_materials(name, unit)")
    .eq("supplier_id", supplierId)
    .order("entry_date", { ascending: false });
  if (error)
    throw new Error(`Error al obtener historial: ${error.message}`);
  return (data ?? []) as unknown as SupplierPurchaseEntry[];
}

// ─── Raw Material Categories ───────────────────────────────────────────────────

export async function getMaterialCategories(
  storeId: string
): Promise<RawMaterialCategory[]> {
  const { data, error } = await supabase
    .from("raw_material_categories")
    .select("*")
    .eq("store_id", storeId)
    .order("name");
  if (error) throw new Error(`Error al obtener categorías: ${error.message}`);
  return (data ?? []) as RawMaterialCategory[];
}

export async function createMaterialCategory(
  payload: RawMaterialCategoryInsert
): Promise<RawMaterialCategory> {
  const { data, error } = await supabase
    .from("raw_material_categories")
    .insert([payload])
    .select()
    .single();
  if (error) throw new Error(`Error al crear categoría: ${error.message}`);
  return data as RawMaterialCategory;
}

export async function updateMaterialCategory(
  id: string,
  payload: RawMaterialCategoryUpdate
): Promise<void> {
  const { error } = await supabase
    .from("raw_material_categories")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(`Error al actualizar categoría: ${error.message}`);
}

export async function deleteMaterialCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("raw_material_categories")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Error al eliminar categoría: ${error.message}`);
}

// ─── Raw Materials ──────────────────────────────────────────────────────────

/**
 * Fetch all active raw materials for a given store.
 */
export async function getRawMaterials(
  storeId: string,
): Promise<RawMaterial[]> {
  const { data, error } = await supabase
    .from("raw_materials")
    .select("*, raw_material_categories(name, color)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Error al obtener materiales: ${error.message}`);
  return (data ?? []) as unknown as RawMaterial[];
}

/**
 * Fetch all raw materials (including inactive) for admin management.
 */
export async function getAllRawMaterials(
  storeId: string,
): Promise<RawMaterial[]> {
  const { data, error } = await supabase
    .from("raw_materials")
    .select("*")
    .eq("store_id", storeId)
    .order("name");

  if (error) throw new Error(`Error al obtener materiales: ${error.message}`);
  return (data ?? []) as RawMaterial[];
}

/**
 * Create a new raw material.
 */
export async function createRawMaterial(
  input: RawMaterialInsert,
): Promise<RawMaterial> {
  const { data, error } = await supabase
    .from("raw_materials")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`Error al crear material: ${error.message}`);
  return data as RawMaterial;
}

/**
 * Update an existing raw material.
 */
export async function updateRawMaterial(
  id: string,
  updates: RawMaterialUpdate,
): Promise<RawMaterial> {
  const { data, error } = await supabase
    .from("raw_materials")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error)
    throw new Error(`Error al actualizar material: ${error.message}`);
  return data as RawMaterial;
}

/**
 * Soft-delete a raw material (sets is_active = false).
 */
export async function deactivateRawMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from("raw_materials")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error)
    throw new Error(`Error al desactivar material: ${error.message}`);
}

// ─── Material Entries ───────────────────────────────────────────────────────

/**
 * Register a new inventory entry (purchase).
 * The DB trigger automatically updates current_stock and creates a stock_movement.
 */
export async function addMaterialEntry(
  input: RawMaterialEntryInsert,
): Promise<RawMaterialEntry> {
  const { data, error } = await supabase
    .from("raw_material_entries")
    .insert(input)
    .select()
    .single();

  if (error)
    throw new Error(`Error al registrar entrada: ${error.message}`);
  return data as RawMaterialEntry;
}

/**
 * Get entry history for a specific material.
 */
export async function getMaterialEntries(
  rawMaterialId: string,
  limit = 50,
): Promise<RawMaterialEntry[]> {
  const { data, error } = await supabase
    .from("raw_material_entries")
    .select("*")
    .eq("raw_material_id", rawMaterialId)
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Error al obtener entradas: ${error.message}`);
  return (data ?? []) as RawMaterialEntry[];
}

// ─── Recipes ────────────────────────────────────────────────────────────────

/**
 * Get all recipes for a product, joined with material info.
 */
export async function getRecipesForProduct(
  productId: string,
): Promise<RecipeWithMaterial[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*, raw_materials(*)")
    .eq("product_id", productId);

  if (error) throw new Error(`Error al obtener recetas: ${error.message}`);
  return (data ?? []) as RecipeWithMaterial[];
}

/**
 * Upsert a recipe (create or update quantity_required).
 * Uses the UNIQUE(product_id, raw_material_id) constraint.
 */
export async function upsertRecipe(
  input: RecipeInsert,
): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .upsert(input, { onConflict: "product_id,raw_material_id" })
    .select()
    .single();

  if (error) throw new Error(`Error al guardar receta: ${error.message}`);
  return data as Recipe;
}

/**
 * Delete a specific recipe line.
 */
export async function deleteRecipe(
  productId: string,
  rawMaterialId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("product_id", productId)
    .eq("raw_material_id", rawMaterialId);

  if (error) throw new Error(`Error al eliminar receta: ${error.message}`);
}

// ─── Stock Deduction ────────────────────────────────────────────────────────

/**
 * Invoke the RPC to deduct stock from an order.
 * Idempotent: calling twice for the same order is safe.
 */
export async function deductStockFromOrder(
  orderId: string,
): Promise<DeductStockResult> {
  const { data, error } = await supabase.rpc("deduct_stock_from_order", {
    p_order_id: orderId,
  });

  if (error)
    throw new Error(`Error al descontar stock: ${error.message}`);
  return data as DeductStockResult;
}

// ─── Stock Movements (Trazabilidad) ─────────────────────────────────────────

/**
 * Get movement history for a specific material.
 */
export async function getStockMovements(
  rawMaterialId: string,
  limit = 100,
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("raw_material_id", rawMaterialId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Error al obtener movimientos: ${error.message}`);
  return (data ?? []) as StockMovement[];
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

/**
 * Get all materials with stock below their min_stock threshold.
 */
export async function getLowStockMaterials(
  storeId: string,
): Promise<RawMaterialWithAlert[]> {
  const { data, error } = await supabase
    .from("raw_materials")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("current_stock");

  if (error)
    throw new Error(`Error al obtener alertas de stock: ${error.message}`);

  return ((data ?? []) as RawMaterial[]).map((m) => ({
    ...m,
    is_low_stock: m.current_stock <= m.min_stock,
  }));
}
