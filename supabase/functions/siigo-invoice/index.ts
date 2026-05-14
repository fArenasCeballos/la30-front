// @ts-nocheck — Este archivo corre en Deno (Supabase Edge Functions), no en Node
// supabase/functions/siigo-invoice/index.ts
// Supabase Edge Function: Proxy seguro para generar facturas en Siigo API
// Deno runtime — deployed via `supabase functions deploy siigo-invoice`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIIGO_AUTH_URL = "https://api.siigo.com/auth";
const SIIGO_API_URL = "https://api.siigo.com/v1";
const PARTNER_ID = "TUULAPP";

// Sandbox defaults — these IDs come from the sandbox account
// In production, these should be fetched dynamically or configured per-store
const DEFAULTS = {
  documentTypeId: 2372, // "documento de ingreso" (sandbox FV)
  sellerId: 906, // First active seller in sandbox
  paymentTypeEffective: 8147, // "Efectivo"
  paymentTypeTarjeta: 8003, // "Contado" (for card payments)
  paymentTypeNequi: 8026, // "Nequi"
  paymentTypeTransfer: 10883, // "Trasferencia"
  genericCustomer: {
    person_type: "Person",
    id_type: "13", // CC - Cédula de Ciudadanía
    identification: "222222222",
    name: ["Consumidor Final"],
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

  const res = await fetch(SIIGO_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Partner-Id": PARTNER_ID,
    },
    body: JSON.stringify({ username, access_key: accessKey }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Siigo auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh 5 min before expiry (token lasts 24h)
  tokenExpiresAt = now + (data.expires_in - 300) * 1000;

  return cachedToken!;
}

// ─── Siigo Payment Type Mapping ────────────────────────────
function mapPaymentType(method: string): number {
  switch (method) {
    case "tarjeta":
      return DEFAULTS.paymentTypeTarjeta;
    case "nequi":
      return DEFAULTS.paymentTypeNequi;
    case "efectivo":
      return DEFAULTS.paymentTypeEffective;
    default:
      return DEFAULTS.paymentTypeTarjeta;
  }
}

// ─── Build Siigo Invoice Payload ───────────────────────────
interface InvoiceRequest {
  orderId: string;
  method: string;
  breakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    products: { name: string; id: string };
  }>;
  total: number;
  locator: string;
}

function buildInvoicePayload(req: InvoiceRequest) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Build items — products are tax-exempt (Excluded)
  const items = req.items.map((item) => ({
    code: item.product_id?.substring(0, 20) || "POS-ITEM",
    description: item.products?.name || "Producto POS",
    quantity: item.quantity,
    price: item.unit_price,
    discount: 0,
    taxes: [], // Exentos de IVA
  }));

  // Build payments array
  // For mixed payments, we send the non-cash portion as the payment
  const payments: Array<{ id: number; value: number; due_date: string }> = [];

  if (req.method === "mixto" && req.breakdown) {
    // For mixed, include each non-cash method
    if ((req.breakdown.tarjeta ?? 0) > 0) {
      payments.push({
        id: mapPaymentType("tarjeta"),
        value: req.breakdown.tarjeta!,
        due_date: today,
      });
    }
    if ((req.breakdown.nequi ?? 0) > 0) {
      payments.push({
        id: mapPaymentType("nequi"),
        value: req.breakdown.nequi!,
        due_date: today,
      });
    }
    // Also include cash portion if present
    if ((req.breakdown.efectivo ?? 0) > 0) {
      payments.push({
        id: mapPaymentType("efectivo"),
        value: req.breakdown.efectivo!,
        due_date: today,
      });
    }
  } else {
    // Single payment method
    payments.push({
      id: mapPaymentType(req.method),
      value: req.total,
      due_date: today,
    });
  }

  return {
    document: {
      id: DEFAULTS.documentTypeId,
    },
    date: today,
    customer: DEFAULTS.genericCustomer,
    seller: DEFAULTS.sellerId,
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

    // Validate required fields
    if (!body.orderId || !body.method || !body.items?.length || !body.total) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: orderId, method, items, total",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    // 1. Get Siigo token
    const token = await getSiigoToken();

    // 2. Build invoice payload
    const invoicePayload = buildInvoicePayload(body);

    // 3. Send to Siigo
    const siigoRes = await fetch(`${SIIGO_API_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Partner-Id": PARTNER_ID,
      },
      body: JSON.stringify(invoicePayload),
    });

    const siigoData = await siigoRes.json();

    // 4. Save to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (!isSuccess) {
      console.error("Siigo API error:", JSON.stringify(siigoData));
      return new Response(
        JSON.stringify({
          success: false,
          error: siigoData.Errors?.[0]?.Message ?? "Siigo API error",
          details: siigoData,
        }),
        { status: 422, headers: corsHeaders },
      );
    }

    // 5. Return success
    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: siigoData.id,
        invoiceNumber: siigoData.name,
        date: siigoData.date,
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
