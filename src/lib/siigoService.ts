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

interface SiigoInvoiceParams {
  orderId: string;
  method: string;
  breakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
  items: OrderItem[];
  total: number;
  locator: string;
}

interface SiigoInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceId?: string;
  error?: string;
}

/**
 * Determines whether a payment method requires an electronic invoice.
 *
 * Rules:
 *  - "tarjeta" → yes
 *  - "nequi" → yes
 *  - "mixto" → yes if breakdown includes tarjeta or nequi > 0
 *  - "efectivo" → no
 */
export function shouldGenerateInvoice(
  method: string,
  breakdown?: { efectivo?: number; tarjeta?: number; nequi?: number },
): boolean {
  if (method === "tarjeta" || method === "nequi") return true;
  if (method === "mixto" && breakdown) {
    return (breakdown.tarjeta ?? 0) > 0 || (breakdown.nequi ?? 0) > 0;
  }
  return false;
}

/**
 * Calls the Supabase Edge Function to generate a Siigo invoice.
 * This runs in background (fire-and-forget with toast feedback)
 * and should NEVER block the payment flow.
 */
export async function generateSiigoInvoice(
  params: SiigoInvoiceParams,
): Promise<SiigoInvoiceResult> {
  try {
    // Map order items to the shape expected by the Edge Function
    const items = params.items
      .filter((item) => item.products != null)
      .map((item) => ({
        id: item.id,
        product_id: item.product_id ?? item.products?.id ?? "unknown",
        quantity: item.quantity,
        unit_price: item.unit_price,
        products: {
          name: item.products?.name ?? "Producto",
          id: item.products?.id ?? "unknown",
        },
      }));

    const { data, error } = await supabase.functions.invoke("siigo-invoice", {
      body: {
        orderId: params.orderId,
        method: params.method,
        breakdown: params.breakdown,
        items,
        total: params.total,
        locator: params.locator,
      },
    });

    if (error) {
      console.error("[Siigo] Edge function error:", error);
      return {
        success: false,
        error: error.message ?? "Error de conexión con el servicio de facturación",
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
      invoiceNumber: data.invoiceNumber,
      invoiceId: data.invoiceId,
    };
  } catch (err) {
    console.error("[Siigo] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}
