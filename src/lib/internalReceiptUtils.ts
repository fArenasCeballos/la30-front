/**
 * @module internalReceiptUtils
 *
 * Thermal-printer HTML templates (80mm) for the Consumo Interno module.
 * Uses the same `silentPrint` function from `@/lib/receiptUtils` to print.
 *
 * Templates:
 * - Internal consumption receipt (comprobante de consumo).
 * - Monthly Cuenta de Cobro (account statement / collection notice).
 */

import { formatPrice } from "@/lib/formatPrice";
import { PRINT_STYLES } from "@/lib/receiptUtils";
import type {
  InternalConsumptionWithItems,
  InternalConsumptionPayment,
  MonthlyAccountStatement,
} from "@/types";

// ─── Internal Consumption Receipt ────────────────────────────────────────────

interface InternalReceiptData {
  consumption: InternalConsumptionWithItems;
  storeName: string;
  cashierName: string;
}

/**
 * Builds an 80mm thermal receipt for a single internal consumption order.
 * Shows original prices, discounts applied, and payment status.
 */
export function buildInternalConsumptionReceiptHTML(
  data: InternalReceiptData,
): string {
  const { consumption: c, storeName, cashierName } = data;
  const items = c.internal_consumption_items ?? [];

  const dateStr = new Date(c.created_at).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const statusLabel =
    c.payment_status === "paid"
      ? "✅ PAGADO"
      : c.payment_status === "partial"
        ? "⚠️ PARCIAL"
        : "🔴 PENDIENTE";

  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td>
        <span class="bold">${item.product_name}</span>
        ${item.is_beverage ? '<span class="bold" style="font-size:11px;"> (Bebida)</span>' : ""}
        ${item.discount_percent > 0 ? `<br><span class="bold" style="font-size:11px;text-decoration:line-through;">${formatPrice(item.original_price)}</span> <b class="bold">-${item.discount_percent}%</b>` : ""}
        ${item.notes ? `<br><span class="item-notes">↳ ${item.notes}</span>` : ""}
      </td>
      <td style="text-align:center;" class="bold">${item.quantity}</td>
      <td style="text-align:right;" class="bold">${formatPrice(item.subtotal)}</td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html><head><style>${PRINT_STYLES}</style></head>
<body>
  <div class="center">
    <div class="header-title">LA 30</div>
    <div class="bold" style="font-size:12px;">CONSUMO INTERNO</div>
    <div class="bold" style="font-size:11px;">${storeName}</div>
    <div class="bold" style="font-size:11px;">${dateStr}</div>
  </div>

  <div class="double-divider"></div>

  <div class="row">
    <span class="bold">Beneficiario:</span>
    <span class="bold">${c.consumer_name}</span>
  </div>
  <div class="row">
    <span class="bold">Tipo:</span>
    <span class="bold">${c.consumer_type === "employee" ? "Empleado" : "Socio"}</span>
  </div>
  <div class="row">
    <span class="bold">Cajero:</span>
    <span class="bold">${cashierName}</span>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:center;">Cant</th>
        <th style="text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="row">
    <span class="bold">Precio Original:</span>
    <span class="bold" style="text-decoration:line-through;">${formatPrice(c.total_original)}</span>
  </div>
  <div class="row">
    <span class="bold">Descuento Empleado:</span>
    <span class="bold">-${formatPrice(c.discount_total)}</span>
  </div>

  <div class="double-divider"></div>

  <div class="row total-row">
    <span class="big-total">TOTAL:</span>
    <span class="big-total">${formatPrice(c.total)}</span>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="bold">Estado:</span>
    <span class="bold">${statusLabel}</span>
  </div>
  ${c.payment_method ? `<div class="row"><span class="bold">Método:</span><span class="bold">${c.payment_method}</span></div>` : ""}
  ${c.notes ? `<div class="bold" style="font-size:12px;margin-top:4px;">Obs: ${c.notes}</div>` : ""}

  <div class="divider"></div>
  <div class="center bold" style="font-size:11px;margin-top:4px;">
    <div>*** CONSUMO INTERNO ***</div>
    <div>No válido como factura</div>
    <div>No aplica para DIAN</div>
  </div>
</body></html>`;
}

// ─── Monthly Account Statement (Cuenta de Cobro) ────────────────────────────

/**
 * Builds a printable Cuenta de Cobro / Estado de Cuenta for a consumer
 * (employee or partner) for a given month.
 */
export function buildCuentaDeCobroHTML(
  statement: MonthlyAccountStatement,
  storeName: string,
): string {
  const monthLabel = new Date(statement.month + "-01").toLocaleDateString(
    "es-CO",
    { year: "numeric", month: "long" },
  );

  const consumptionRows = statement.consumptions
    .map((c) => {
      const dateStr = new Date(c.created_at).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
      });
      const statusIcon =
        c.payment_status === "paid"
          ? "✅"
          : c.payment_status === "partial"
            ? "⚠️"
            : "🔴";
      return `
      <tr>
        <td class="bold">${dateStr}</td>
        <td>${statusIcon}</td>
        <td style="text-align:right;" class="bold">${formatPrice(c.total)}</td>
      </tr>`;
    })
    .join("");

  const paymentRows = statement.payments
    .map((p: InternalConsumptionPayment) => {
      const dateStr = new Date(p.created_at).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
      });
      return `
      <tr>
        <td class="bold">${dateStr}</td>
        <td class="bold">${p.payment_method}</td>
        <td style="text-align:right;" class="bold">${formatPrice(p.amount)}</td>
      </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html><head><style>${PRINT_STYLES}</style></head>
<body>
  <div class="center">
    <div class="header-title">LA 30</div>
    <div class="bold" style="font-size:14px;">CUENTA DE COBRO</div>
    <div class="bold" style="font-size:11.5px;">CONSUMO INTERNO</div>
    <div class="bold" style="font-size:11px;">${storeName}</div>
  </div>

  <div class="double-divider"></div>

  <div class="row">
    <span class="bold">Nombre:</span>
    <span class="bold">${statement.consumerName}</span>
  </div>
  <div class="row">
    <span class="bold">Tipo:</span>
    <span class="bold">${statement.consumerType === "employee" ? "Empleado" : "Socio"}</span>
  </div>
  <div class="row">
    <span class="bold">Período:</span>
    <span class="bold">${monthLabel}</span>
  </div>

  <div class="divider"></div>

  <div class="bold center" style="font-size:13px;margin:4px 0;">CONSUMOS DEL MES</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Est.</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${consumptionRows || '<tr><td colspan="3" class="center bold">Sin consumos</td></tr>'}
    </tbody>
  </table>

  ${
    paymentRows
      ? `
    <div class="divider"></div>
    <div class="bold center" style="font-size:13px;margin:4px 0;">ABONOS / PAGOS</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Método</th>
          <th style="text-align:right;">Monto</th>
        </tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>
  `
      : ""
  }

  <div class="double-divider"></div>

  <div class="row">
    <span class="bold">Total Consumido:</span>
    <span class="bold">${formatPrice(statement.totalConsumed)}</span>
  </div>
  <div class="row">
    <span class="bold">Total Pagado:</span>
    <span class="bold">${formatPrice(statement.totalPaid)}</span>
  </div>

  <div class="double-divider"></div>

  <div class="row total-row">
    <span class="big-total">SALDO:</span>
    <span class="big-total">${formatPrice(statement.balance)}</span>
  </div>

  <div class="divider"></div>

  <div style="margin-top:20px;">
    <div class="bold" style="font-size:11px;">Firma de conformidad:</div>
    <div style="border-bottom:1.5px solid #000000;margin-top:25px;width:100%;"></div>
    <div class="bold" style="font-size:10px;text-align:center;margin-top:2px;">${statement.consumerName}</div>
  </div>

  <div style="margin-top:10px;">
    <div class="bold" style="font-size:11px;">Firma de la empresa:</div>
    <div style="border-bottom:1.5px solid #000000;margin-top:25px;width:100%;"></div>
    <div class="bold" style="font-size:10px;text-align:center;margin-top:2px;">La 30 — Administración</div>
  </div>

  <div class="divider" style="margin-top:10px;"></div>
  <div class="center bold" style="font-size:10px;margin-top:4px;">
    <div>Documento interno — No válido como factura</div>
    <div>Generado el ${new Date().toLocaleString("es-CO")}</div>
  </div>
</body></html>`;
}
