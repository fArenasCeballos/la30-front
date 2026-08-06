---
name: supabase-edge-function
description: Crear o modificar Edge Functions de Supabase (Deno runtime) para la30-front. Se usan como proxy seguro para APIs externas como Siigo, Wompi, y lógica de servidor sensible.
---

# Skill: Supabase Edge Functions

## Cuándo usar este skill
- Integrar APIs externas (pasarelas de pago, facturación, notificaciones).
- Lógica que requiere secrets del servidor (API keys, service role key).
- Webhooks que reciben datos de terceros.
- Cualquier operación que NO debe exponer credenciales al frontend.

## Estructura de una Edge Function

```
supabase/functions/
└── mi-funcion/
    ├── deno.json       # Configuración de Deno (imports)
    └── index.ts        # Handler principal
```

### deno.json
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

### index.ts — Template
```typescript
// @ts-nocheck — Este archivo corre en Deno (Supabase Edge Functions), no en Node
// supabase/functions/mi-funcion/index.ts
// Descripción breve de qué hace esta función

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Constantes ────────────────────────────────────────────
const API_URL = "https://api.servicio-externo.com";

// ─── Token Cache (si aplica) ───────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }
  
  const credential = Deno.env.get("MI_API_KEY");
  if (!credential) throw new Error("Missing MI_API_KEY env var");
  
  // ... obtener token ...
  
  cachedToken = token;
  tokenExpiresAt = now + (expiresIn - 300) * 1000; // Renovar 5 min antes
  return cachedToken!;
}

// ─── Types ─────────────────────────────────────────────────
interface RequestBody {
  orderId: string;
  // ... campos requeridos
}

// ─── Main Handler ──────────────────────────────────────────
Deno.serve(async (rawReq: Request) => {
  // CORS preflight (obligatorio)
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
    const body: RequestBody = await rawReq.json();

    // Validar campos requeridos
    if (!body.orderId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing orderId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Lógica principal...

    // Crear cliente Supabase con service role (para operaciones internas)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Guardar resultado en DB
    await supabase.from("mi_tabla").insert({ /* ... */ });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

## Patrones del Proyecto

### Invocación desde el frontend
```typescript
// En src/lib/[servicio]Service.ts
const { data, error } = await supabase.functions.invoke("mi-funcion", {
  body: {
    orderId: "...",
    method: "...",
    // ...
  },
});

if (error) {
  // Extraer error real del contexto de Supabase
  let realMessage = error.message ?? "Error de conexión";
  try {
    const context = (error as Record<string, unknown>).context;
    if (context && typeof context === "object" && "json" in context) {
      const responseBody = await (context as Response).json();
      if (responseBody?.error) realMessage = responseBody.error;
    }
  } catch { /* fallback al mensaje por defecto */ }
  
  return { success: false, error: realMessage };
}
```

### Deploy
```bash
supabase functions deploy mi-funcion
```

### Variables de entorno
Se configuran en el dashboard de Supabase → Edge Functions → Secrets.
Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente.

## Edge Functions existentes

| Función            | Propósito                              |
|--------------------|----------------------------------------|
| `siigo-invoice`    | Proxy para API de Siigo (facturación)  |
| `siigo-get-products` | Obtener productos de Siigo           |
