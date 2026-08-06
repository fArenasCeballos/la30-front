// @ts-nocheck — Runs in Deno (Supabase Edge Functions)
// supabase/functions/wompi-create-transaction/index.ts
// Proxy seguro para iniciar transacciones de cobro en Wompi API Colombia

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WOMPI_API_URL = "https://sandbox.wompi.co/v1";

Deno.serve(async (rawReq: Request) => {
  // CORS Preflight
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
    const body = await rawReq.json();
    const { orderId, locator, amount, email, phone } = body;

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing orderId or amount" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const pubKey = Deno.env.get("WOMPI_PUBLIC_KEY") || "pub_test_Q5y1F3g56A4958197779";
    const amountInCents = Math.round(amount * 100); // Wompi expects cents
    const reference = `LA30-${locator || "APP"}-${Date.now()}`;

    // Return transaction metadata & payment link for mobile webview
    return new Response(
      JSON.stringify({
        success: true,
        reference,
        amountInCents,
        publicKey: pubKey,
        currency: "COP",
        redirectUrl: `https://checkout.wompi.co/p/?public-key=${pubKey}&currency=COP&amount-in-cents=${amountInCents}&reference=${reference}`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Wompi transaction error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
