// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SIIGO_AUTH_URL = "https://api.siigo.com/auth";
const SIIGO_API_URL = "https://api.siigo.com/v1";
const PARTNER_ID = "PosPyH";

async function getSiigoToken() {
  const username = Deno.env.get("SIIGO_USERNAME");
  const accessKey = Deno.env.get("SIIGO_ACCESS_KEY");

  if (!username || !accessKey) {
    throw new Error("Missing SIIGO_USERNAME or SIIGO_ACCESS_KEY");
  }

  const res = await fetch(SIIGO_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Partner-Id": PARTNER_ID,
    },
    body: JSON.stringify({ username, access_key: accessKey }),
  });

  if (!res.ok) throw new Error("Siigo auth failed");
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const token = await getSiigoToken();
    const res = await fetch(`${SIIGO_API_URL}/products?page=1&page_size=100`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Partner-Id": PARTNER_ID,
      },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
