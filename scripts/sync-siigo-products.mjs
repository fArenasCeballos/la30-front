#!/usr/bin/env node
/**
 * Siigo Product Sync Script
 * 
 * Creates all products from Supabase in the Siigo sandbox API.
 * For each product:
 *   1. Checks if its current siigo_code already exists in Siigo
 *   2. If the code is taken by another product, assigns a new unique code
 *   3. Creates the product in Siigo
 *   4. Updates the siigo_code in Supabase if it changed
 *   5. Logs everything to a text file
 */

import { writeFileSync, appendFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ─────────────────────────────────────────────────────────────
const SIIGO_AUTH_URL = "https://api.siigo.com/auth";
const SIIGO_API_URL  = "https://api.siigo.com/v1";
const PARTNER_ID     = "PosPyH";
const SIIGO_USERNAME = "sandbox@siigoapi.com";
const SIIGO_ACCESS_KEY = "YmEzYTcyOGYtN2JhZi00OTIzLWE5ZjktYTgxNTVhNWUxZDM2Ojc0ODllKUZrSFM=";

const SUPABASE_URL = "https://fzgnmfadswomqkrcwojc.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Z25tZmFkc3dvbXFrcmN3b2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxNTIyNCwiZXhwIjoyMDg5OTkxMjI0fQ.oWGtP5Qt1uZVf0Bf6fbC1ZxP0lOkkvZeHyCsfkZYVHI";

// Reference product config (from the already created "Sencillo" code=101)
const ACCOUNT_GROUP = 1501;
const TAX_CLASSIFICATION = "Excluded";
const PRODUCT_TYPE = "Product";
const UNIT_CODE = "94"; // unidad

const LOG_FILE = `${__dirname}/siigo-sync-log.txt`;

// ─── Logging ───────────────────────────────────────────────────────────────────
function initLog() {
  const header = [
    "═══════════════════════════════════════════════════════════════════",
    "  SIIGO PRODUCT SYNC LOG",
    `  Started: ${new Date().toISOString()}`,
    "═══════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");
  writeFileSync(LOG_FILE, header + "\n");
}

function log(msg) {
  const ts = new Date().toLocaleTimeString("es-CO");
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

function logProduct(idx, total, productName, oldCode, newCode, siigoId, status) {
  const sep = "───────────────────────────────────────────────────────────────";
  const lines = [
    sep,
    `  Producto ${idx}/${total}: ${productName}`,
    `  Código anterior en Supabase: ${oldCode}`,
    `  Código nuevo asignado:       ${newCode}${oldCode !== newCode ? " ← CAMBIÓ" : " (sin cambio)"}`,
    `  ID Siigo:                    ${siigoId}`,
    `  Estado:                      ${status}`,
    sep,
  ].join("\n");
  console.log(lines);
  appendFileSync(LOG_FILE, lines + "\n");
}

// ─── Fetch Helper with Retry on 429 and Network Errors ───────────────────────
async function fetchWithRetry(url, options, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        let sleepMs = delay;
        try {
          const cloneRes = res.clone();
          const data = await cloneRes.json();
          const msg = data?.Errors?.[0]?.Message || "";
          const match = msg.match(/Try again in (\d+) seconds/i);
          if (match) {
            sleepMs = (parseInt(match[1], 10) + 1) * 1000;
          }
        } catch {
          // Ignore JSON parse error and use default delay
        }
        
        console.log(`⚠️ Siigo rate limit hit (429). Retrying in ${sleepMs}ms...`);
        await new Promise(r => setTimeout(r, sleepMs));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`⚠️ Network error: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 1.5;
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries due to 429/network errors`);
}

// ─── Siigo API ─────────────────────────────────────────────────────────────────
async function siigoAuth() {
  const res = await fetchWithRetry(SIIGO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Partner-Id": PARTNER_ID },
    body: JSON.stringify({ username: SIIGO_USERNAME, access_key: SIIGO_ACCESS_KEY }),
  });
  if (!res.ok) throw new Error(`Siigo auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function siigoGet(token, path) {
  const res = await fetchWithRetry(`${SIIGO_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Partner-Id": PARTNER_ID },
  });
  if (!res.ok) throw new Error(`Siigo GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function siigoCheckCodeExists(token, code) {
  const data = await siigoGet(token, `/products?code=${encodeURIComponent(code)}`);
  const results = data.results || (Array.isArray(data) ? data : []);
  return results.length > 0;
}

async function siigoCreateProduct(token, code, name, price) {
  const payload = {
    code: String(code),
    name: name.substring(0, 100).trim(),
    account_group: ACCOUNT_GROUP,
    type: PRODUCT_TYPE,
    stock_control: false,
    active: true,
    tax_classification: TAX_CLASSIFICATION,
    taxes: [],
    prices: [
      {
        currency_code: "COP",
        price_list: [{ position: 1, value: price }],
      },
    ],
    unit: UNIT_CODE,
    unit_label: "unidad",
  };

  const res = await fetchWithRetry(`${SIIGO_API_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Partner-Id": PARTNER_ID,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.Errors?.[0]?.Message || JSON.stringify(data);
    throw new Error(`Siigo create failed (${res.status}): ${errMsg}`);
  }
  return data;
}

// ─── Supabase API ──────────────────────────────────────────────────────────────
const supaHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function supabaseGetProducts() {
  const res = await fetchWithRetry(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,price,siigo_code,category_id&order=siigo_code`,
    { headers: supaHeaders }
  );
  if (!res.ok) throw new Error(`Supabase GET failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function supabaseUpdateSiigoCode(productId, newCode) {
  const res = await fetchWithRetry(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`,
    {
      method: "PATCH",
      headers: { ...supaHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ siigo_code: newCode }),
    }
  );
  if (!res.ok) throw new Error(`Supabase PATCH failed (${res.status}): ${await res.text()}`);
}

// ─── Code Generation ───────────────────────────────────────────────────────────
function findNextAvailableCode(startFrom, occupiedCodes) {
  let code = startFrom;
  while (occupiedCodes.has(String(code))) {
    code++;
  }
  return code;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  initLog();

  // Step 1: Authenticate
  log("🔐 Autenticando con Siigo API...");
  const token = await siigoAuth();
  log("✅ Autenticación exitosa");

  // Step 2: Get Supabase products
  log("📦 Obteniendo productos de Supabase...");
  const allProducts = await supabaseGetProducts();
  log(`   Total productos en Supabase: ${allProducts.length}`);

  // Deduplicate: some products share the same siigo_code (same product in different categories)
  // Group by siigo_code to process unique codes
  const codeToProducts = new Map();
  for (const p of allProducts) {
    const code = p.siigo_code || "";
    if (!codeToProducts.has(code)) {
      codeToProducts.set(code, []);
    }
    codeToProducts.get(code).push(p);
  }

  // Step 3: For each unique siigo_code, check if it exists in Siigo
  const uniqueCodes = [...codeToProducts.keys()].filter(c => c !== "");
  log(`   Códigos únicos a verificar: ${uniqueCodes.length}`);
  log("");
  log("🔍 Verificando qué códigos ya existen en Siigo...");

  // Check which codes exist in Siigo and if they belong to us
  const codesToCreate = [];     // { code, products[], needsNewCode: bool }
  const alreadyInSiigo = [];    // codes that already exist as our products
  const occupiedBySomeoneElse = []; // codes taken by sandbox data

  for (const code of uniqueCodes) {
    const products = codeToProducts.get(code);
    const productName = products[0].name;

    const data = await siigoGet(token, `/products?code=${encodeURIComponent(code)}`);
    const results = data.results || [];

    if (results.length === 0) {
      // Code is free — we can create it
      codesToCreate.push({ code, products, needsNewCode: false });
      log(`   ${code} → Libre ✓ (${productName})`);
    } else {
      // Code exists — check if it's ours
      const existing = results[0];
      const existingName = existing.name || "";
      const isOurs = existingName.toLowerCase().trim() === productName.toLowerCase().trim();
      
      if (isOurs) {
        alreadyInSiigo.push(code);
        log(`   ${code} → Ya existe en Siigo como "${existingName}" ✓ (es nuestro)`);
      } else {
        // Code is taken by sandbox data — need a new code
        occupiedBySomeoneElse.push({ code, takenBy: existingName });
        codesToCreate.push({ code, products, needsNewCode: true });
        log(`   ${code} → OCUPADO por "${existingName}" ✗ → necesita nuevo código`);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  log("");
  log(`📊 Resumen de verificación:`);
  log(`   Ya existen en Siigo (nuestros): ${alreadyInSiigo.length}`);
  log(`   Códigos libres para crear:      ${codesToCreate.filter(c => !c.needsNewCode).length}`);
  log(`   Códigos ocupados (necesitan nuevo): ${occupiedBySomeoneElse.length}`);
  log("");

  if (codesToCreate.length === 0) {
    log("✅ Todos los productos ya están en Siigo. Nada que hacer.");
    return;
  }

  // Step 4: Find new codes for occupied ones
  // Build a set of ALL occupied codes (both in Siigo and in our Supabase)
  const allOccupiedCodes = new Set([...uniqueCodes]);
  
  // Also add codes we know are occupied in Siigo
  for (const item of occupiedBySomeoneElse) {
    allOccupiedCodes.add(item.code);
  }

  // For occupied codes, find new ones starting from 205 (after our last code)
  let nextCodeNum = 205;
  for (const item of codesToCreate) {
    if (item.needsNewCode) {
      // Also check if the new code exists in Siigo before assigning
      let found = false;
      while (!found) {
        const candidate = String(nextCodeNum);
        if (!allOccupiedCodes.has(candidate)) {
          // Verify in Siigo too
          const exists = await siigoCheckCodeExists(token, candidate);
          if (!exists) {
            item.newCode = candidate;
            allOccupiedCodes.add(candidate);
            found = true;
            log(`   Reasignando ${item.code} → ${candidate} para "${item.products[0].name}"`);
          }
          await new Promise(r => setTimeout(r, 300));
        }
        nextCodeNum++;
      }
    }
  }

  // Step 5: Create products in Siigo and update Supabase
  log("");
  log("🚀 Creando productos en Siigo...");
  log("");

  let successCount = 0;
  let errorCount = 0;
  const total = codesToCreate.length;

  for (let i = 0; i < codesToCreate.length; i++) {
    const item = codesToCreate[i];
    const product = item.products[0]; // Use first product as reference
    const oldCode = item.code;
    const newCode = item.newCode || item.code;

    try {
      // Create in Siigo
      const siigoResult = await siigoCreateProduct(token, newCode, product.name, product.price);
      const siigoId = siigoResult.id || "N/A";

      // Update Supabase if code changed
      if (oldCode !== newCode) {
        for (const p of item.products) {
          await supabaseUpdateSiigoCode(p.id, newCode);
        }
      }

      logProduct(i + 1, total, product.name, oldCode, newCode, siigoId, "✅ CREADO");
      successCount++;
    } catch (err) {
      logProduct(i + 1, total, product.name, oldCode, newCode, "N/A", `❌ ERROR: ${err.message}`);
      errorCount++;
    }

    // Delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  // Final summary
  const summary = [
    "",
    "═══════════════════════════════════════════════════════════════════",
    "  RESUMEN FINAL",
    "═══════════════════════════════════════════════════════════════════",
    `  Total productos en Supabase:     ${allProducts.length}`,
    `  Ya existían en Siigo:            ${alreadyInSiigo.length}`,
    `  Creados exitosamente:            ${successCount}`,
    `  Errores:                         ${errorCount}`,
    `  Códigos reasignados:             ${occupiedBySomeoneElse.length}`,
    "",
    "  Códigos reasignados (detalle):",
  ];

  for (const item of codesToCreate.filter(c => c.needsNewCode)) {
    summary.push(`    ${item.code} → ${item.newCode} (${item.products[0].name}) [ocupado por: ${occupiedBySomeoneElse.find(o => o.code === item.code)?.takenBy}]`);
  }

  summary.push("═══════════════════════════════════════════════════════════════════");
  summary.push(`  Completado: ${new Date().toISOString()}`);
  summary.push("═══════════════════════════════════════════════════════════════════");

  const summaryStr = summary.join("\n");
  console.log(summaryStr);
  appendFileSync(LOG_FILE, summaryStr + "\n");

  log(`\n📄 Log guardado en: ${LOG_FILE}`);
}

main().catch((err) => {
  log(`💀 ERROR FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
