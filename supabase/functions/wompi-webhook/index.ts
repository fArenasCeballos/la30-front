// @ts-nocheck — Runs in Deno (Supabase Edge Functions)
// supabase/functions/wompi-webhook/index.ts
// Webhook listener para recibir confirmaciones de pago de Wompi

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (rawReq: Request) => {
  if (rawReq.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const eventData = await rawReq.json();
    console.log("[Wompi Webhook] Event received:", JSON.stringify(eventData));

    const transaction = eventData?.data?.transaction;
    if (!transaction) {
      return new Response(JSON.stringify({ success: true, message: "Event ignored" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const reference = transaction.reference;
    const status = transaction.status; // 'APPROVED', 'DECLINED', 'VOIDED'

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (status === "APPROVED") {
      // Find app_payment by reference
      const { data: paymentData } = await supabase
        .from("app_payments")
        .select("id, order_id")
        .eq("wompi_reference", reference)
        .maybeSingle();

      if (paymentData) {
        // Update app_payments
        await supabase
          .from("app_payments")
          .update({
            status: "approved",
            wompi_transaction_id: transaction.id,
            webhook_payload: eventData,
          })
          .eq("id", paymentData.id);

        // Update order status to 'pendiente' for kitchen realtime
        await supabase
          .from("orders")
          .update({
            status: "pendiente",
            is_prepaid: true,
          })
          .eq("id", paymentData.order_id);

        console.log(`[Wompi Webhook] Order ${paymentData.order_id} marked as APPROVED and sent to kitchen.`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Wompi webhook error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
