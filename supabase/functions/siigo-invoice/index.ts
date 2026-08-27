// @ts-nocheck — Este archivo corre en Deno (Supabase Edge Functions), no en Node
// supabase/functions/siigo-invoice/index.ts
// Supabase Edge Function: Proxy seguro para generar facturas en Siigo API
// Deno runtime — deployed via `supabase functions deploy siigo-invoice`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIIGO_AUTH_URL = "https://api.siigo.com/auth";
const SIIGO_API_URL = "https://api.siigo.com/v1";
const PARTNER_ID = "PosPyHCM";

// ─── Timeouts ──────────────────────────────────────────────
const AUTH_TIMEOUT_MS = 15_000; // 15s for auth
const INVOICE_TIMEOUT_MS = 30_000; // 30s for invoice creation

// ─── Valid Payment Methods ─────────────────────────────────
// Note: "mixto" is NOT a valid method here — the client decomposes mixed
// payments into individual method calls before invoking this Edge Function.
const VALID_METHODS = new Set([
  "efectivo",
  "tarjeta",
  "tarjeta_credito",
  "tarjeta_debito",
  "nequi",
  "daviplata",
]);

// Sandbox defaults — these IDs come from the sandbox account
// In production, these should be fetched dynamically or configured per-store
const DEFAULTS = {
  documentTypeId: Deno.env.get("SIIGO_DOCUMENT_TYPE_ID")
    ? Number(Deno.env.get("SIIGO_DOCUMENT_TYPE_ID"))
    : 2372, // "documento de ingreso" (sandbox FV)
  sellerId: Deno.env.get("SIIGO_SELLER_ID")
    ? Number(Deno.env.get("SIIGO_SELLER_ID"))
    : 15, // First active seller in sandbox
  paymentTypeEffective: 118, // "CONTADO"
  paymentTypeTarjetaCredito: 121, // "Tarjeta Crédito"
  paymentTypeTarjetaDebito: 120, // "Tarjeta Débito"
  paymentTypeNequi: 7282, // "NEQUI"
  paymentTypeTransfer: 7283, // "DAVIPLATA"
  genericCustomer: {
    person_type: "Person",
    id_type: "13", // CC - Cédula de Ciudadanía
    identification: "222222222222",
    name: ["Consumidor", "Final"],
    address: {
      address: "Calle 0 # 0-0",
      city: {
        country_code: "Co",
        state_code: "11",
        city_code: "11001",
      },
    },
    phones: [{ number: "0000000" }],
  },
};

// ─── Cached Supabase Client ────────────────────────────────
// Created once at module level instead of per-request
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// ─── Fetch with Timeout ────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Token Cache ───────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSiigoToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const username = Deno.env.get("SIIGO_USERNAME");
  const accessKey = Deno.env.get("SIIGO_ACCESS_KEY");

  if (!username || !accessKey) {
    throw new Error("Missing SIIGO_USERNAME or SIIGO_ACCESS_KEY env vars");
  }

  const authBody = JSON.stringify({ username, access_key: accessKey });
  const authHeaders = {
    "Content-Type": "application/json",
    "Partner-Id": PARTNER_ID,
  };

  // Attempt auth with 1 retry on transient failures (5xx / network)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        SIIGO_AUTH_URL,
        { method: "POST", headers: authHeaders, body: authBody },
        AUTH_TIMEOUT_MS,
      );

      if (res.ok) {
        const data = await res.json();
        cachedToken = data.access_token;
        // Refresh 5 min before expiry (token lasts 24h)
        tokenExpiresAt = now + (data.expires_in - 300) * 1000;
        return cachedToken!;
      }

      const errText = await res.text();

      // Only retry on 5xx (server errors)
      if (res.status >= 500 && attempt === 0) {
        lastError = new Error(`Siigo auth failed (${res.status}): ${errText}`);
        console.warn(`Siigo auth attempt ${attempt + 1} failed (${res.status}), retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      throw new Error(`Siigo auth failed (${res.status}): ${errText}`);
    } catch (err) {
      if (attempt === 0 && !(err instanceof Error && err.message.includes("auth failed"))) {
        // Network/timeout error on first attempt — retry
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Siigo auth attempt ${attempt + 1} network error, retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Siigo auth failed after retries");
}

// ─── Siigo Payment Type Mapping ────────────────────────────
function mapPaymentType(method: string): number {
  switch (method) {
    case "tarjeta_credito":
      return DEFAULTS.paymentTypeTarjetaCredito;
    case "tarjeta_debito":
      return DEFAULTS.paymentTypeTarjetaDebito;
    case "nequi":
      return DEFAULTS.paymentTypeNequi;
    case "daviplata":
      return DEFAULTS.paymentTypeTransfer;
    case "tarjeta":
      return DEFAULTS.paymentTypeTarjetaCredito; // fallback
    case "efectivo":
      return DEFAULTS.paymentTypeEffective;
    default:
      return DEFAULTS.paymentTypeTarjetaCredito;
  }
}

// ─── Input Validation ──────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(body: InvoiceRequest): string | null {
  // orderId must be a valid UUID
  if (!body.orderId || !UUID_RE.test(body.orderId)) {
    return "orderId must be a valid UUID";
  }

  // method must be one of the valid payment methods
  if (!body.method || !VALID_METHODS.has(body.method)) {
    return `Invalid method "${body.method}". Must be one of: ${[...VALID_METHODS].join(", ")}`;
  }

  // total must be > 0
  if (typeof body.total !== "number" || body.total <= 0) {
    return "total must be a number greater than 0";
  }

  // items must have at least one valid item
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "items must be a non-empty array";
  }

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return `items[${i}].quantity must be > 0`;
    }
    if (typeof item.unit_price !== "number" || item.unit_price < 0) {
      return `items[${i}].unit_price must be >= 0`;
    }
  }



  // Validate customer structure if provided
  if (body.customer) {
    const c = body.customer;
    if (!c.identification || typeof c.identification !== "string") {
      return "customer.identification is required and must be a string";
    }
    if (!Array.isArray(c.name) || c.name.length === 0) {
      return "customer.name must be a non-empty array";
    }
  }

  return null; // Valid
}

// ─── Build Siigo Invoice Payload ───────────────────────────
interface InvoiceRequest {
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
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    products: { name: string; id: string; siigo_code?: string | null };
  }>;
  total: number;
  locator: string;
  customer?: any;
}

function buildInvoicePayload(req: InvoiceRequest) {
  // Use Colombia Time (UTC-5)
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());

  // Build items — products are tax-exempt (Excluded)
  const items = req.items.map((item) => ({
    code:
      item.products?.siigo_code ||
      item.product_id?.substring(0, 20) ||
      "POS-ITEM",
    description: item.products?.name || "Producto POS",
    quantity: item.quantity,
    price: item.unit_price,
    discount: 0,
    taxes: [], // Exentos de IVA
  }));

  // Build payments array
  const payments: Array<{ id: number; value: number; due_date: string }> = [];

  // Single payment method per invoice
  // (mixed payments are decomposed by the client into separate calls)
  payments.push({
    id: mapPaymentType(req.method),
    value: req.total,
    due_date: today,
  });

  return {
    document: {
      id: DEFAULTS.documentTypeId,
    },
    date: today,
    customer: req.customer || DEFAULTS.genericCustomer,
    seller: DEFAULTS.sellerId,
    stamp: {
      send: true
    },
    mail: {
      send: true
    },
    observations: `Pedido #${req.locator} — La 30`,
    items,
    payments,
  };
}

// ─── Main Handler ──────────────────────────────────────────
Deno.serve(async (rawReq: Request) => {
  // CORS preflight
  if (rawReq.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body: InvoiceRequest = await rawReq.json();

    // ── 1. Exhaustive input validation (before any external call) ──
    const validationError = validateInput(body);
    if (validationError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validationError,
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    // ── 2. Duplicate invoice protection ────────────────────────────
    // Check if a successful invoice already exists for this order + method
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("siigo_invoices")
      .select("id, siigo_invoice_id, siigo_invoice_number")
      .eq("order_id", body.orderId)
      .eq("payment_method", body.method)
      .eq("status", "success")
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.warn(
        `Duplicate invoice request for order ${body.orderId} method ${body.method} — already exists (${existing.siigo_invoice_number})`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          message: `Invoice already exists for this order and method`,
          siigoDetail: {
            id: existing.siigo_invoice_id,
            name: existing.siigo_invoice_number,
          },
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    // ── 3. Get Siigo token (with retry + timeout) ──────────────────
    const token = await getSiigoToken();

    // ── 4. Build invoice payload ───────────────────────────────────
    const invoicePayload = buildInvoicePayload(body);

    // ── 5. Send to Siigo (with timeout) ────────────────────────────
    const siigoRes = await fetchWithTimeout(
      `${SIIGO_API_URL}/invoices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Partner-Id": PARTNER_ID,
        },
        body: JSON.stringify(invoicePayload),
      },
      INVOICE_TIMEOUT_MS,
    );

    const siigoData = await siigoRes.json();

    // ── 6. Save to DB ──────────────────────────────────────────────
    const isSuccess = siigoRes.ok;

    await supabase.from("siigo_invoices").insert({
      order_id: body.orderId,
      siigo_invoice_id: isSuccess ? String(siigoData.id ?? "") : null,
      siigo_invoice_number: isSuccess ? (siigoData.name ?? null) : null,
      payment_method: body.method,
      request_payload: invoicePayload,
      response_payload: siigoData,
      status: isSuccess ? "success" : "error",
      error_message: isSuccess
        ? null
        : JSON.stringify(siigoData.Errors ?? siigoData),
    });

    if (isSuccess) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          siigo_invoice_id: String(siigoData.id ?? ""),
          siigo_invoice_number: siigoData.name ?? null,
        })
        .eq("id", body.orderId);
      if (updateError) {
        console.error(
          "Error updating order with Siigo invoice details:",
          updateError,
        );
      }
    }

    if (!isSuccess) {
      console.error(
        `Siigo API error for order ${body.orderId} (${body.method}):`,
        JSON.stringify(siigoData),
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: siigoData.Errors?.[0]?.Message ?? "Siigo API error",
          details: siigoData,
        }),
        { status: 422, headers: corsHeaders },
      );
    }

    // ── 7. Return success ──────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        siigoDetail: siigoData,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
