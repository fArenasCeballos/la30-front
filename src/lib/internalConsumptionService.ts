/**
 * @module internalConsumptionService
 *
 * Service layer for the Consumo Interno (Internal Consumption) module.
 *
 * Responsibilities:
 * - Detecting beverage categories (no discount) vs. non-beverage (50% discount).
 * - CRUD for internal partners (socios).
 * - Creating internal consumption records with automatic discount calculation.
 * - Fetching monthly statements per employee or partner.
 * - Registering payments / settling accounts (cuentas de cobro).
 */

import { supabase } from "@/lib/supabase";
import type {
  InternalPartner,
  InternalConsumption,
  InternalConsumptionWithItems,
  InternalConsumptionPayment,
  InternalConsumerType,
  InternalPaymentStatus,
  MonthlyAccountStatement,
} from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Discount percentage applied to non-beverage products for internal consumption.
 * Beverages are charged at 100% (0% discount).
 */
export const INTERNAL_DISCOUNT_PERCENT = 50;

/**
 * Category name patterns (lowercased) that are treated as beverages.
 * These products receive NO discount in internal consumption.
 */
const BEVERAGE_CATEGORY_PATTERNS: readonly string[] = [
  "bebida",
  "bebidas",
  "gaseosa",
  "gaseosas",
  "jugo",
  "jugos",
  "cerveza",
  "cervezas",
  "licor",
  "licores",
  "malteada",
  "malteadas",
  "limonada",
  "limonadas",
] as const;

/**
 * Product name patterns (lowercased) that are treated as beverages,
 * used as a fallback when the category name does not match.
 */
const BEVERAGE_PRODUCT_NAME_PATTERNS: readonly string[] = [
  "gaseosa",
  "coca-cola",
  "coca cola",
  "sprite",
  "fanta",
  "pepsi",
  "jugo",
  "cerveza",
  "limonada",
  "agua",
  "malteada",
  "mr. tea",
  "mr tea",
  "speed max",
  "hatsu",
  "red bull",
] as const;

// ─── Pure Helper Functions ───────────────────────────────────────────────────

/**
 * Determines whether a product should be classified as a beverage based on
 * its category name and/or product name. Beverages receive NO discount.
 *
 * @param categoryName - The product's category name (nullable).
 * @param productName  - The product's display name.
 * @returns `true` if the product is a beverage; `false` otherwise.
 */
export function isBeverageProduct(
  categoryName: string | null | undefined,
  productName: string,
): boolean {
  const normalizedCategory = (categoryName ?? "").toLowerCase().trim();
  const normalizedProduct = productName.toLowerCase().trim();

  // Check category name first (most reliable)
  if (
    normalizedCategory !== "" &&
    BEVERAGE_CATEGORY_PATTERNS.some((pattern) =>
      normalizedCategory.includes(pattern),
    )
  ) {
    return true;
  }

  // Fallback to product name matching
  return BEVERAGE_PRODUCT_NAME_PATTERNS.some((pattern) =>
    normalizedProduct.includes(pattern),
  );
}

/**
 * Calculates the discounted unit price for a product in internal consumption.
 *
 * @param originalPrice - Original price in integer COP (e.g. 25000).
 * @param isBeverage    - Whether the product is a beverage (no discount).
 * @returns The price after applying the internal discount rule.
 */
export function calculateInternalPrice(
  originalPrice: number,
  isBeverage: boolean,
): number {
  if (isBeverage) return originalPrice;
  return Math.round(originalPrice * (1 - INTERNAL_DISCOUNT_PERCENT / 100));
}

// ─── Partner CRUD ────────────────────────────────────────────────────────────

/** Fetches all active internal partners, ordered by name. */
export async function fetchPartners(): Promise<InternalPartner[]> {
  const { data, error } = await supabase
    .from("internal_partners" as never)
    .select("*")
    .order("name");

  if (error) throw new Error(`Error al cargar socios: ${error.message}`);
  return (data ?? []) as unknown as InternalPartner[];
}

/** Creates a new internal partner. */
export async function createPartner(
  partner: Pick<InternalPartner, "name" | "document_id" | "phone" | "email">,
): Promise<InternalPartner> {
  const { data, error } = await supabase
    .from("internal_partners" as never)
    .insert(partner as never)
    .select()
    .single();

  if (error) throw new Error(`Error al crear socio: ${error.message}`);
  return data as unknown as InternalPartner;
}

/** Updates an existing internal partner. */
export async function updatePartner(
  id: string,
  updates: Partial<Pick<InternalPartner, "name" | "document_id" | "phone" | "email" | "is_active">>,
): Promise<InternalPartner> {
  const { data, error } = await supabase
    .from("internal_partners" as never)
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, id as never)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar socio: ${error.message}`);
  return data as unknown as InternalPartner;
}

// ─── Internal Consumption Creation ───────────────────────────────────────────

export interface CreateConsumptionInput {
  storeId: string;
  consumerType: InternalConsumerType;
  employeeId?: string;
  partnerId?: string;
  consumerName: string;
  items: {
    productId: string;
    productName: string;
    categoryName: string | null;
    quantity: number;
    originalPrice: number;
    notes?: string;
  }[];
  paymentStatus: InternalPaymentStatus;
  paymentMethod?: string;
  notes?: string;
}

/**
 * Creates an internal consumption order with automatic discount calculation.
 * This is an atomic client-side operation (insert header + items in sequence).
 *
 * @returns The created consumption ID.
 */
export async function createInternalConsumption(
  input: CreateConsumptionInput,
): Promise<string> {
  // ── 1. Compute totals ──────────────────────────────────────────────────────
  const processedItems = input.items.map((item) => {
    const beverage = isBeverageProduct(item.categoryName, item.productName);
    const discountPercent = beverage ? 0 : INTERNAL_DISCOUNT_PERCENT;
    const unitPrice = calculateInternalPrice(item.originalPrice, beverage);
    const subtotal = unitPrice * item.quantity;

    return {
      product_id: item.productId,
      product_name: item.productName,
      category_name: item.categoryName,
      is_beverage: beverage,
      quantity: item.quantity,
      original_price: item.originalPrice,
      discount_percent: discountPercent,
      unit_price: unitPrice,
      subtotal,
      notes: item.notes ?? null,
    };
  });

  const totalOriginal = processedItems.reduce(
    (sum, item) => sum + item.original_price * item.quantity,
    0,
  );
  const total = processedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = totalOriginal - total;

  // ── 2. Insert header ──────────────────────────────────────────────────────
  const { data: consumption, error: headerError } = await supabase
    .from("internal_consumptions" as never)
    .insert({
      store_id: input.storeId,
      consumer_type: input.consumerType,
      employee_id: input.employeeId ?? null,
      partner_id: input.partnerId ?? null,
      consumer_name: input.consumerName,
      total_original: totalOriginal,
      discount_total: discountTotal,
      total,
      payment_status: input.paymentStatus,
      payment_method: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      paid_at: input.paymentStatus === "paid" ? new Date().toISOString() : null,
    } as never)
    .select("id")
    .single();

  if (headerError)
    throw new Error(
      `Error al crear consumo interno: ${headerError.message}`,
    );

  const consumptionId = (consumption as unknown as { id: string }).id;

  // ── 3. Insert items ───────────────────────────────────────────────────────
  const itemsToInsert = processedItems.map((item) => ({
    ...item,
    consumption_id: consumptionId,
  }));

  const { error: itemsError } = await supabase
    .from("internal_consumption_items" as never)
    .insert(itemsToInsert as never);

  if (itemsError)
    throw new Error(
      `Consumo creado pero error al guardar ítems: ${itemsError.message}`,
    );

  return consumptionId;
}

// ─── Consumption Queries ─────────────────────────────────────────────────────

/** Fetches consumptions for a given period, optionally filtered. */
export async function fetchConsumptions(filters: {
  storeId?: string;
  monthStart: string; // ISO date
  monthEnd: string;   // ISO date
  consumerType?: InternalConsumerType;
  paymentStatus?: InternalPaymentStatus;
}): Promise<InternalConsumptionWithItems[]> {
  let query = supabase
    .from("internal_consumptions" as never)
    .select("*, internal_consumption_items(*)" as never)
    .gte("created_at" as never, filters.monthStart as never)
    .lte("created_at" as never, filters.monthEnd as never)
    .order("created_at" as never, { ascending: false });

  if (filters.storeId) {
    query = query.eq("store_id" as never, filters.storeId as never);
  }
  if (filters.consumerType) {
    query = query.eq("consumer_type" as never, filters.consumerType as never);
  }
  if (filters.paymentStatus) {
    query = query.eq("payment_status" as never, filters.paymentStatus as never);
  }

  const { data, error } = await query;
  if (error)
    throw new Error(`Error al cargar consumos internos: ${error.message}`);
  return (data ?? []) as unknown as InternalConsumptionWithItems[];
}

/** Fetches all payments within a given period. */
export async function fetchPayments(filters: {
  monthStart: string;
  monthEnd: string;
  consumerType?: InternalConsumerType;
  employeeId?: string;
  partnerId?: string;
}): Promise<InternalConsumptionPayment[]> {
  let query = supabase
    .from("internal_consumption_payments" as never)
    .select("*" as never)
    .gte("created_at" as never, filters.monthStart as never)
    .lte("created_at" as never, filters.monthEnd as never)
    .order("created_at" as never, { ascending: false });

  if (filters.consumerType) {
    query = query.eq("consumer_type" as never, filters.consumerType as never);
  }
  if (filters.employeeId) {
    query = query.eq("employee_id" as never, filters.employeeId as never);
  }
  if (filters.partnerId) {
    query = query.eq("partner_id" as never, filters.partnerId as never);
  }

  const { data, error } = await query;
  if (error)
    throw new Error(`Error al cargar pagos internos: ${error.message}`);
  return (data ?? []) as unknown as InternalConsumptionPayment[];
}

// ─── Monthly Statement Builder ───────────────────────────────────────────────

/**
 * Builds a monthly account statement for a specific consumer by aggregating
 * their consumptions and payments within a month.
 */
export function buildMonthlyStatement(
  consumerId: string,
  consumerName: string,
  consumerType: InternalConsumerType,
  month: string,
  consumptions: InternalConsumptionWithItems[],
  payments: InternalConsumptionPayment[],
): MonthlyAccountStatement {
  const totalConsumed = consumptions.reduce((sum, c) => sum + c.total, 0);
  const totalPaid =
    consumptions
      .filter((c) => c.payment_status === "paid")
      .reduce((sum, c) => sum + c.total, 0) +
    payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, totalConsumed - totalPaid);

  return {
    consumerId,
    consumerName,
    consumerType,
    month,
    totalConsumed,
    totalPaid,
    balance,
    consumptions,
    payments,
  };
}

// ─── Payment Registration ────────────────────────────────────────────────────

export interface RegisterPaymentInput {
  consumptionId?: string;
  consumerType: InternalConsumerType;
  employeeId?: string;
  partnerId?: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}

/**
 * Registers a payment or partial payment against an internal consumption.
 * If a specific consumption ID is provided and the payment fully covers the
 * remaining balance, the consumption status is updated to 'paid'.
 */
export async function registerInternalPayment(
  input: RegisterPaymentInput,
): Promise<void> {
  // Insert payment record
  const { error: payError } = await supabase
    .from("internal_consumption_payments" as never)
    .insert({
      consumption_id: input.consumptionId ?? null,
      consumer_type: input.consumerType,
      employee_id: input.employeeId ?? null,
      partner_id: input.partnerId ?? null,
      amount: input.amount,
      payment_method: input.paymentMethod,
      notes: input.notes ?? null,
    } as never);

  if (payError)
    throw new Error(`Error al registrar pago: ${payError.message}`);

  // If tied to a specific consumption, check if we should mark it as paid
  if (input.consumptionId) {
    const { data: consumption } = await supabase
      .from("internal_consumptions" as never)
      .select("total, payment_status" as never)
      .eq("id" as never, input.consumptionId as never)
      .single();

    if (consumption) {
      const c = consumption as unknown as InternalConsumption;

      // Sum all payments for this consumption
      const { data: payments } = await supabase
        .from("internal_consumption_payments" as never)
        .select("amount" as never)
        .eq("consumption_id" as never, input.consumptionId as never);

      const totalPaid = (payments ?? []).reduce(
        (sum: number, p: unknown) =>
          sum + ((p as { amount: number }).amount ?? 0),
        0,
      );

      let newStatus: InternalPaymentStatus = "pending";
      if (totalPaid >= c.total) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partial";
      }

      if (newStatus !== c.payment_status) {
        await supabase
          .from("internal_consumptions" as never)
          .update({
            payment_status: newStatus,
            paid_at:
              newStatus === "paid" ? new Date().toISOString() : null,
          } as never)
          .eq("id" as never, input.consumptionId as never);
      }
    }
  }
}

/**
 * Marks a single consumption as fully paid, updating its status and paid_at timestamp.
 */
export async function settleConsumption(
  consumptionId: string,
  paymentMethod: string,
): Promise<void> {
  const { data: consumption } = await supabase
    .from("internal_consumptions" as never)
    .select("total" as never)
    .eq("id" as never, consumptionId as never)
    .single();

  if (!consumption) throw new Error("Consumo no encontrado");

  const c = consumption as unknown as { total: number };

  // Calculate how much has already been paid
  const { data: existingPayments } = await supabase
    .from("internal_consumption_payments" as never)
    .select("amount" as never)
    .eq("consumption_id" as never, consumptionId as never);

  const alreadyPaid = (existingPayments ?? []).reduce(
    (sum: number, p: unknown) =>
      sum + ((p as { amount: number }).amount ?? 0),
    0,
  );

  const remaining = Math.max(0, c.total - alreadyPaid);

  if (remaining > 0) {
    await registerInternalPayment({
      consumptionId,
      consumerType: "employee", // will be ignored for the payment record context
      amount: remaining,
      paymentMethod,
      notes: "Liquidación completa",
    });
  }

  // Ensure status is paid
  await supabase
    .from("internal_consumptions" as never)
    .update({
      payment_status: "paid" as never,
      payment_method: paymentMethod as never,
      paid_at: new Date().toISOString() as never,
    } as never)
    .eq("id" as never, consumptionId as never);
}

// ─── Admin Operations (Consultas Module) ─────────────────────────────────────

/**
 * Deletes an internal consumption record along with its items and payments.
 * This is an irreversible admin-only operation.
 */
export async function deleteConsumption(consumptionId: string): Promise<void> {
  // 1. Delete line items
  const { error: itemsError } = await supabase
    .from("internal_consumption_items" as never)
    .delete()
    .eq("consumption_id" as never, consumptionId as never);

  if (itemsError)
    throw new Error(`Error al eliminar ítems: ${itemsError.message}`);

  // 2. Delete associated payments
  const { error: paymentsError } = await supabase
    .from("internal_consumption_payments" as never)
    .delete()
    .eq("consumption_id" as never, consumptionId as never);

  if (paymentsError)
    throw new Error(`Error al eliminar pagos: ${paymentsError.message}`);

  // 3. Delete the header
  const { error: headerError } = await supabase
    .from("internal_consumptions" as never)
    .delete()
    .eq("id" as never, consumptionId as never);

  if (headerError)
    throw new Error(`Error al eliminar consumo: ${headerError.message}`);
}

/**
 * Updates the payment status of an internal consumption.
 * Used by admins from the Consultas module to manually change status.
 */
export async function updateConsumptionPaymentStatus(
  consumptionId: string,
  newStatus: InternalPaymentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("internal_consumptions" as never)
    .update({
      payment_status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    } as never)
    .eq("id" as never, consumptionId as never);

  if (error)
    throw new Error(`Error al actualizar estado de pago: ${error.message}`);
}

