/**
 * Siigo Invoice Service
 *
 * Handles the logic to determine when an electronic invoice should be generated
 * and communicates with the Supabase Edge Function that proxies the Siigo API.
 *
 * Invoices are generated for:
 *  - tarjeta (card) payments
 *  - nequi (transfer) payments
 *  - mixto (mixed) payments that include tarjeta or nequi
 *
 * Cash-only payments do NOT generate an invoice.
 */

import { supabase } from "@/lib/supabase";
import type { OrderItem } from "@/types";

// Untyped reference for tables not yet in generated DB types (siigo_customers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Customer Types ────────────────────────────────────────────────────────────

export interface SiigoCustomer {
  person_type: "Person" | "Company";
  id_type: string;
  identification: string;
  name: string[];
  address: {
    address: string;
    city: {
      country_code: string;
      state_code: string;
      city_code: string;
    };
  };
  phones: Array<{ number: string }>;
  email?: string;
}

export interface SiigoCustomerRecord {
  identification: string;
  id_type: string;
  person_type: string;
  name: unknown; // JSONB
  address: unknown; // JSONB
  phones: unknown; // JSONB
  email: string | null;
}

// ─── Invoice Types ─────────────────────────────────────────────────────────────

export interface SiigoInvoiceParams {
  orderId: string;
  method: string;
  breakdown?: {
    efectivo?: number;
    tarjeta?: number;
    nequi?: number;
    tarjeta_credito?: number;
    tarjeta_debito?: number;
    daviplata?: number;
  };
  items: OrderItem[];
  total: number;
  locator: string;
  customer?: SiigoCustomer;
  /** Override the invoice total (for proportional split invoices) */
  invoiceTotal?: number;
  /** Override the payment method sent to Siigo (e.g., force "tarjeta" for split) */
  overrideMethod?: string;
  /** Optional delivery fee to add to the invoice as a product item */
  deliveryFee?: number;
}

export interface SiigoInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceId?: string;
  fullResponse?: any;
  error?: string;
}

// ─── Customer Persistence ──────────────────────────────────────────────────────

/**
 * Fetch a previously saved Siigo customer from Supabase by identification.
 * Uses direct query for maximum speed.
 */
export async function fetchSiigoCustomer(
  identification: string,
): Promise<SiigoCustomer | null> {
  if (!identification || identification.length < 3) return null;

  const { data, error } = await db
    .from("siigo_customers")
    .select("*")
    .eq("identification", identification.trim())
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    person_type: (row.person_type as string) as "Person" | "Company",
    id_type: row.id_type as string,
    identification: row.identification as string,
    name: row.name as string[],
    address: row.address as SiigoCustomer["address"],
    phones: row.phones as Array<{ number: string }>,
    email: (row.email as string) || undefined,
  };
}

/**
 * Save or update a Siigo customer in the local database for future autocomplete.
 * Uses upsert for speed (single round-trip).
 */
export async function saveSiigoCustomer(
  customer: SiigoCustomer,
): Promise<void> {
  await db.from("siigo_customers").upsert(
    {
      identification: customer.identification.trim(),
      id_type: customer.id_type,
      person_type: customer.person_type,
      name: customer.name,
      address: customer.address,
      phones: customer.phones,
      email: customer.email || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "identification" },
  );
}

// ─── Invoice Logic ─────────────────────────────────────────────────────────────

/**
 * Determines whether a payment method requires an electronic invoice.
 *
 * Rules:
 *  - "tarjeta" → yes
 *  - "nequi" → yes
 *  - "mixto" → yes if breakdown includes any tarjeta/nequi/daviplata > 0
 *  - "efectivo" → no
 */
export function shouldGenerateInvoice(
  method: string,
  breakdown?: {
    efectivo?: number;
    tarjeta?: number;
    nequi?: number;
    tarjeta_credito?: number;
    tarjeta_debito?: number;
    daviplata?: number;
  },
): boolean {
  if (method === "tarjeta" || method === "nequi") return true;
  if (method === "mixto" && breakdown) {
    return (
      (breakdown.tarjeta ?? 0) > 0 ||
      (breakdown.nequi ?? 0) > 0 ||
      (breakdown.tarjeta_credito ?? 0) > 0 ||
      (breakdown.tarjeta_debito ?? 0) > 0 ||
      (breakdown.daviplata ?? 0) > 0
    );
  }
  return false;
}

/**
 * Determines how many invoices need to be generated and their configurations.
 *
 * Returns an array of invoice configs:
 *  - Pure tarjeta/nequi → 1 invoice at full total
 *  - Mixto with only tarjeta or only nequi → 1 invoice at that amount
 *  - Mixto with both tarjeta AND nequi → 2 invoices, one per method
 */
export function getInvoiceConfigs(
  method: string,
  total: number,
  breakdown?: {
    efectivo?: number;
    tarjeta?: number;
    nequi?: number;
    tarjeta_credito?: number;
    tarjeta_debito?: number;
    daviplata?: number;
  },
): Array<{ method: string; amount: number }> {
  if (method === "tarjeta") {
    if (breakdown?.tarjeta_credito) return [{ method: "tarjeta_credito", amount: total }];
    if (breakdown?.tarjeta_debito) return [{ method: "tarjeta_debito", amount: total }];
    return [{ method: "tarjeta", amount: total }];
  }
  if (method === "nequi") {
    if (breakdown?.daviplata) return [{ method: "daviplata", amount: total }];
    if (breakdown?.nequi) return [{ method: "nequi", amount: total }];
    return [{ method: "nequi", amount: total }];
  }

  if (method === "mixto" && breakdown) {
    const configs: Array<{ method: string; amount: number }> = [];
    if ((breakdown.tarjeta_credito ?? 0) > 0) {
      configs.push({ method: "tarjeta_credito", amount: breakdown.tarjeta_credito! });
    }
    if ((breakdown.tarjeta_debito ?? 0) > 0) {
      configs.push({ method: "tarjeta_debito", amount: breakdown.tarjeta_debito! });
    }
    if ((breakdown.tarjeta ?? 0) > 0) {
      configs.push({ method: "tarjeta", amount: breakdown.tarjeta! });
    }
    if ((breakdown.nequi ?? 0) > 0) {
      configs.push({ method: "nequi", amount: breakdown.nequi! });
    }
    if ((breakdown.daviplata ?? 0) > 0) {
      configs.push({ method: "daviplata", amount: breakdown.daviplata! });
    }
    return configs;
  }

  return [];
}

export interface MappedInvoiceItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: {
    name: string;
    id: string;
    siigo_code: string | null;
  };
}

/**
 * Distributes a target total amount among mapped invoice items,
 * adjusting unit prices and splitting lines if necessary to ensure
 * the sum of (price * quantity) matches the target total exactly.
 */
export function distributeTotalAmongItems(
  items: MappedInvoiceItem[],
  targetTotal: number,
): MappedInvoiceItem[] {
  const result = items.map((item) => ({
    ...item,
    products: { ...item.products },
  }));

  if (result.length === 0) return result;

  let diff = targetTotal - result.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  if (diff !== 0) {
    // Distribute major chunk using integer division
    for (let i = 0; i < result.length && diff !== 0; i++) {
      const item = result[i];
      const qty = item.quantity;
      const adj = Math.trunc(diff / qty);
      if (adj !== 0) {
        item.unit_price += adj;
        diff -= adj * qty;
      }
    }

    // If there's still a remainder, split items that have quantity > 1
    if (diff !== 0) {
      const itemsToProcess = [...result];
      result.length = 0; // Rebuild the array

      for (const item of itemsToProcess) {
        if (diff !== 0 && item.quantity > 1) {
          const absDiff = Math.abs(diff);
          const sign = Math.sign(diff);

          // Push Line A (original price)
          result.push({
            ...item,
            quantity: item.quantity - absDiff,
          });

          // Push Line B (adjusted price)
          result.push({
            ...item,
            id: `${item.id}-adj`,
            quantity: absDiff,
            unit_price: item.unit_price + sign,
          });

          diff = 0;
        } else {
          result.push(item);
        }
      }
    }

    // If diff is still not 0 (e.g. all items have quantity = 1, or remainder couldn't be split),
    // absorb the remaining difference in the first item's unit price as a fallback
    if (diff !== 0) {
      result[0].unit_price += diff;
    }
  }

  return result;
}

/**
 * Calls the Supabase Edge Function to generate a Siigo invoice.
 * Supports optional customer data and proportional pricing.
 */
export async function generateSiigoInvoice(
  params: SiigoInvoiceParams,
): Promise<SiigoInvoiceResult> {
  try {
    const effectiveTotal = params.invoiceTotal ?? params.total;
    const ratio = params.total > 0 ? effectiveTotal / params.total : 1;

    // Map order items to the shape expected by the Edge Function
    // Apply proportional scaling to prices when invoicing a partial amount
    const mappedItems = params.items
      .filter((item) => item.products != null)
      .map((item) => ({
        id: item.id,
        product_id: item.products?.siigo_code || item.product_id || item.products?.id || "unknown",
        quantity: item.quantity,
        unit_price: Math.round(item.unit_price * ratio),
        products: {
          name: item.products?.name ?? "Producto",
          id: item.products?.id ?? "unknown",
          siigo_code: item.products?.siigo_code ?? null,
        },
      }));

    // Distribute delivery fee and rounding errors to guarantee 100% exact total match
    const items = distributeTotalAmongItems(mappedItems, effectiveTotal);

    const body: Record<string, unknown> = {
      orderId: params.orderId,
      method: params.overrideMethod ?? params.method,
      items,
      total: effectiveTotal,
      locator: params.locator,
    };

    // If a custom customer is provided, send it to the Edge Function
    if (params.customer) {
      body.customer = params.customer;
    }

    // For proportional invoices, send a clean breakdown with just the invoiced amount
    if (params.invoiceTotal && params.overrideMethod) {
      body.breakdown = { [params.overrideMethod]: params.invoiceTotal };
    } else if (params.breakdown) {
      body.breakdown = params.breakdown;
    }

    const { data, error } = await supabase.functions.invoke("siigo-invoice", {
      body,
    });

    if (error) {
      console.error("[Siigo] Edge function error:", error);

      // supabase.functions.invoke wraps non-2xx responses in a FunctionsHttpError.
      // The actual JSON body with {success, error, details} is inside error.context.
      // Try to extract the real Siigo error message from the response.
      let realMessage =
        error.message ?? "Error de conexión con el servicio de facturación";

      try {
        // The context property contains the original Response object
        const context = (error as Record<string, unknown>).context;
        if (context && typeof context === "object" && "json" in context) {
          const responseBody = await (context as Response).json();
          if (responseBody?.error) {
            realMessage = responseBody.error;
          }
          // If Siigo returned details, include them
          if (responseBody?.details?.Errors?.[0]?.Message) {
            realMessage = responseBody.details.Errors[0].Message;
          }
        }
      } catch {
        // Could not parse error body, use default message
      }

      return {
        success: false,
        error: realMessage,
      };
    }

    if (!data?.success) {
      console.error("[Siigo] Invoice creation failed:", data?.error);
      return {
        success: false,
        error: data?.error ?? "Error al generar factura en Siigo",
      };
    }

    return {
      success: true,
      invoiceNumber: data.siigoDetail?.name || data.name,
      invoiceId: data.siigoDetail?.id || data.id,
      fullResponse: data.siigoDetail || data,
    };
  } catch (err) {
    console.error("[Siigo] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}
