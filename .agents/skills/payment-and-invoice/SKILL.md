---
name: payment-and-invoice
description: Implementar cambios en el flujo de pagos, métodos de pago, facturación electrónica Siigo y cierres de caja. Entiende el pipeline completo desde el cobro hasta la generación de factura.
---

# Skill: Payment & Invoice Flow

## Cuándo usar este skill
- Agregar o modificar métodos de pago.
- Cambiar lógica de facturación Siigo.
- Modificar el flujo de cierre de caja.
- Ajustar el desglose de pagos mixtos.
- Modificar la tirilla de recibo (impresión térmica 80mm).

## Pipeline de Pago (Flujo completo)

```
1. Usuario selecciona método de pago en PaymentCalculator.tsx
2. PaymentCalculator invoca OrderContext.processPayment()
3. processPayment() → RPC process_payment (DB)
4. Si targetStatus = "en_preparacion" → RPC update_order_status
5. Fire-and-forget: deductStockFromOrder() (inventario)
6. Si Siigo habilitado:
   a. getInvoiceConfigs() determina cuántas facturas generar
   b. Por cada config → generateSiigoInvoice() → Edge Function siigo-invoice
   c. Edge Function → API Siigo → Guarda en siigo_invoices
7. Toast de confirmación
```

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `src/components/PaymentCalculator.tsx` | UI de cobro (70KB, componente más grande) |
| `src/context/OrderContext.tsx` | `processPayment()`, `addOrder()` |
| `src/lib/siigoService.ts` | Lógica de facturación (cuándo/cuántas facturas) |
| `src/components/SiigoInvoiceModal.tsx` | Modal para ver/generar facturas |
| `src/components/OrderReceipt.tsx` | Vista de tirilla para imprimir |
| `src/lib/receiptUtils.ts` | Generación HTML de tirilla térmica (80mm) |
| `supabase/functions/siigo-invoice/index.ts` | Edge Function proxy Siigo |

## Métodos de Pago — Mapping

### Frontend → DB
| UI Label | Clave `method` | En `payments.method` |
|----------|---------------|---------------------|
| Efectivo | `efectivo` | `efectivo` |
| Tarjeta Crédito | `tarjeta_credito` | `tarjeta` (agrupado) |
| Tarjeta Débito | `tarjeta_debito` | `tarjeta` (agrupado) |
| Nequi | `nequi` | `nequi` |
| Daviplata | `daviplata` | `nequi` (agrupado) |
| Mixto | `mixto` | `mixto` |

### DB → Siigo Payment Type IDs
| Método | Siigo ID |
|--------|----------|
| efectivo | 118 (CONTADO) |
| tarjeta_credito | 121 |
| tarjeta_debito | 120 |
| nequi | 7282 |
| daviplata | 7283 |

## Pagos Mixtos — Lógica de desglose

En `processPayment()`:
```typescript
const cardAmt = (breakdown.tarjeta || 0) + (breakdown.tarjeta_credito || 0) + (breakdown.tarjeta_debito || 0);
const transferAmt = (breakdown.nequi || 0) + (breakdown.daviplata || 0);

// RPC recibe totales agrupados:
p_amt_tarjeta = cardAmt
p_amt_nequi = transferAmt
p_amt_efectivo = breakdown.efectivo || 0
```

## Facturas Siigo — Reglas

1. **Toda venta genera factura** (incluyendo efectivo).
2. `getInvoiceConfigs()` retorna un array de configs:
   - Pago puro → 1 config con el total completo.
   - Mixto → N configs, una por método con su monto proporcional.
3. `distributeTotalAmongItems()` ajusta precios unitarios para que la suma exacta de `price * qty` coincida con el total de la factura.
4. Facturas se almacenan en `siigo_invoices` con status `success` o `error`.

## Tirilla de Impresión

- Formato: 80mm térmico (POS printer).
- Se abre en ventana emergente (`window.open`) con CSS de impresión.
- `PRINT_STYLES` en `receiptUtils.ts` define el layout.
- Fuente monoespaciada: Monaco/Consolas/Courier.
- Auto-print: `window.print()` al cargar.

## Para agregar un nuevo método de pago

1. Agregar al enum `payment_method` en PostgreSQL.
2. Actualizar `database.types.ts` (regenerar tipos).
3. Actualizar `PaymentCalculator.tsx` (botones y lógica de UI).
4. Actualizar `processPayment()` en `OrderContext.tsx` (desglose).
5. Actualizar `mapPaymentType()` en Edge Function `siigo-invoice`.
6. Actualizar `getInvoiceConfigs()` en `siigoService.ts`.
7. Actualizar tirilla en `receiptUtils.ts` si aplica.
8. Actualizar RPCs de dashboard/reportería que desglosan por método.
