import type { Order, OrderItem } from "@/types";
import { formatPrice } from "@/lib/formatPrice";

/* ── Estilos para la ventana de impresión ────────────────────────── */
export const PRINT_STYLES = `
  @page {
    margin: 0;
    size: 80mm auto;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    width: 80mm;
    padding: 0 2mm 2mm 2mm;
    font-size: 13px;
    color: #000;
    line-height: 1.1;
    background: #fff;
  }
  .center   { text-align: center; }
  .right    { text-align: right; }
  .bold     { font-weight: bold; }
  .divider  { border-top: 1px dashed #000; margin: 4px 0; }
  .double-divider {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 1px 0;
    margin: 4px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
  }
  th {
    border-bottom: 1px solid #000;
    border-top: 1px solid #000;
    padding: 2px 0;
    font-size: 12px;
    text-align: left;
  }
  th:last-child { text-align: right; }
  td {
    padding: 2px 0;
    vertical-align: top;
    font-size: 12px;
  }
  td:first-child { width: 60%; }
  td:nth-child(2) { width: 10%; text-align: center; }
  td:last-child { text-align: right; }
  .item-notes {
    font-size: 11px;
    padding-left: 4px;
  }
  .header-title {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  .total-row {
    font-size: 15px;
    font-weight: bold;
    margin-top: 4px;
  }
  .big-total {
    font-size: 18px;
    font-weight: bold;
  }
  /* ── Comanda de cocina ───────────────────────────────────── */
  .kitchen-title {
    font-size: 28px;
    font-weight: bold;
    border: 3px solid #000;
    display: inline-block;
    padding: 2px 12px;
    margin-bottom: 6px;
  }
  .kitchen-locator {
    font-size: 75px;
    font-weight: bold;
    line-height: 1;
  }
  .kitchen-ticket {
    font-size: 20px;
  }
  .kitchen-cashier {
    font-size: 16px;
    font-weight: bold;
  }
  .kitchen-item-name {
    font-size: 32px;
    font-weight: bold;
    padding: 6px 0 2px;
    border-bottom: 3px solid #000;
  }
  .kitchen-item-notes {
    font-size: 19px;
    font-weight: bold;
    padding-left: 10px;
    margin-bottom: 10px;
    line-height: 1.3;
  }
  .kitchen-footer-notes {
    font-size: 20px;
    font-weight: bold;
    background: #eee;
    padding: 6px;
    border: 2px dashed #000;
    margin-top: 10px;
  }
  .kitchen-obs {
    font-size: 12px;
    padding: 0 0 6px 4px;
    word-break: break-word;
  }
  .kitchen-footer {
    font-size: 12px;
    margin-top: 6px;
  }
  .print-page-break {
    page-break-after: always !important;
    break-after: page !important;
    height: 0 !important;
    overflow: hidden !important;
  }
`;

/* ── Datos comunes helpers ────────────────────────────────── */
function getReceiptDates(order: Order) {
  const now = order.created_at ? new Date(order.created_at) : new Date();
  const dateOnly = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const timeOnly = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const printDate = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  return { dateOnly, timeOnly, printDate };
}

function getValidItems(order: Order): OrderItem[] {
  return (order.order_items ?? []).filter((item) => item?.products != null);
}

/* ══════════════════════════════════════════════════════════════
   FUNCIONES DE GENERACIÓN DE HTML
   ══════════════════════════════════════════════════════════════ */

export interface ReceiptData {
  order: Order;
  cajeroName: string;
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
  paymentBreakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
}

/** Genera el HTML completo de la factura del cliente */
export function buildCustomerReceiptHTML(data: ReceiptData): string {
  const { order, cajeroName, paymentMethod, paymentReceived, paymentChange } =
    data;
  const { dateOnly, timeOnly, printDate } = getReceiptDates(order);
  const validItems = getValidItems(order);
  const subtotal = validItems.reduce(
    (s, i) => s + (i.unit_price ?? 0) * (i.quantity ?? 1),
    0,
  );
  const ticketNumber = order.ticket_number ?? "—";

  const itemsRows = validItems
    .map(
      (item) => `
    <tr>
      <td>
        ${(item.products?.name ?? "Producto").toUpperCase()}
        ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ""}
      </td>
      <td style="text-align:center">${item.quantity}</td>
      <td>${formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}</td>
    </tr>
  `,
    )
    .join("");

  let paymentSection = "";
  if (paymentMethod) {
    let breakdownDetails = "";
    if (paymentMethod === "mixto" && data.paymentBreakdown) {
      const b = data.paymentBreakdown;
      if (b.efectivo)
        breakdownDetails += `<div class="row"><span>Efectivo:</span><span>${formatPrice(b.efectivo)}</span></div>`;
      if (b.tarjeta)
        breakdownDetails += `<div class="row"><span>Tarjeta:</span><span>${formatPrice(b.tarjeta)}</span></div>`;
      if (b.nequi)
        breakdownDetails += `<div class="row"><span>Nequi:</span><span>${formatPrice(b.nequi)}</span></div>`;
    } else {
      const label =
        paymentMethod === "efectivo"
          ? "Efectivo"
          : paymentMethod === "tarjeta"
            ? "Tarjeta"
            : "Nequi";
      breakdownDetails = `<div class="row"><span>${label}:</span><span>${formatPrice(paymentReceived ?? order.total ?? 0)}</span></div>`;
    }

    paymentSection = `
      <div class="row">
        <span class="bold">Entregado</span>
        <span class="bold">${formatPrice(paymentReceived ?? order.total ?? 0)}</span>
      </div>
      <div class="row">
        <span class="bold">Cambio</span>
        <span class="bold">${formatPrice(paymentChange ?? 0)}</span>
      </div>
      <div style="font-size:11px;padding:4px 0 0">
        ${breakdownDetails}
      </div>
      <div class="divider"></div>
    `;
  }

  const headerTitle = order.is_delivery ? "VENTA A DOMICILIO" : "VENTA A LA MESA";
  const locatorLabel = order.is_delivery ? "Domicilio No." : "Mesa No.";

  let deliveryInfo = "";
  if (order.is_delivery) {
    deliveryInfo = `
      <div class="row"><span>Cliente:</span><span class="bold">${(order.delivery_name ?? "Cliente").toUpperCase()}</span></div>
      ${order.delivery_address ? `<div class="row"><span>Dirección:</span><span class="bold">${order.delivery_address.toUpperCase()}</span></div>` : ""}
      ${order.delivery_phone ? `<div class="row"><span>Teléfono:</span><span class="bold">${order.delivery_phone}</span></div>` : ""}
    `;
  }

  return `
    <div class="center"><p class="header-title">${headerTitle}</p></div>
    <div class="double-divider">
      <div class="row">
        <span class="bold">TIQUETE DE CONSUMO</span>
        <span class="bold">${ticketNumber}</span>
      </div>
    </div>
    <div class="row" style="font-size:10px"><span>Fecha Hora Impr.:</span><span>${printDate}</span></div>
    <div class="divider"></div>
    <div class="row"><span>Fecha :</span><span>${dateOnly}</span></div>
    <div class="row"><span>Hora  :</span><span>${timeOnly}</span></div>
    <div class="row"><span>${locatorLabel}:</span><span class="bold">${order.locator}</span></div>
    ${deliveryInfo}
    <div class="row"><span>Cajero :</span><span class="bold">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <table>
      <thead><tr><th>Producto Nombre</th><th>Cant.</th><th>Valor</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="divider"></div>
    <div class="row"><span>Sub Total</span><span>${formatPrice(subtotal)}</span></div>
    ${(order.delivery_fee ?? 0) > 0 ? `<div class="row"><span>Costo Envío</span><span>${formatPrice(order.delivery_fee)}</span></div>` : ""}
    <div class="row"><span>Descuento</span><span>$0</span></div>
    <div class="divider"></div>
    <div class="row total-row"><span>Total</span><span class="big-total">${formatPrice(order.total ?? 0)}</span></div>
    <div class="divider"></div>
    ${paymentSection}
    <div class="center" style="padding:4px 0">
      <p>¡Gracias por tu compra!</p>
      <p>Espera tu número: <span class="bold">${order.locator}</span></p>
      <div class="divider"></div>
      <p class="bold" style="font-size:11px;padding-top:4px">La 30 Perros y Hamburguesas</p>
    </div>
  `;
}

/** Genera el HTML completo de la comanda de cocina (soporta filtrado por categoría) */
export function buildKitchenReceiptHTML(
  data: ReceiptData,
  filteredItems?: OrderItem[],
): string {
  const { order, cajeroName } = data;
  const { dateOnly, timeOnly } = getReceiptDates(order);
  const itemsToPrint = filteredItems ?? getValidItems(order);
  const ticketNumber = order.ticket_number ?? "—";

  const itemsHTML = itemsToPrint
    .map(
      (item) => `
    <div style="margin-bottom: 12px;">
      <div class="kitchen-item-name">
        ${item.quantity} ${item.products?.name?.toUpperCase() ?? "PRODUCTO"}
      </div>
      ${
        item.notes
          ? `<div class="kitchen-item-notes">
               ${item.notes
                 .split(",")
                 .map((n) => {
                   const trimmed = n.trim();
                   if (trimmed.startsWith("Obs:")) {
                     return `<div style="margin-top:6px; color:#000; border-top:2px solid #000; padding-top:4px; font-size:20px;">${trimmed.replace("Obs:", "<strong>OBS:</strong>")}</div>`;
                   }
                   return `• ${trimmed}`;
                 })
                 .join("<br>")}
             </div>`
          : ""
      }
    </div>
  `,
    )
    .join("");

  let notesSection = "";
  if (order.notes) {
    notesSection = `
      <div class="divider"></div>
      <div class="bold" style="font-size:14px">NOTAS DEL PEDIDO:</div>
      <div class="kitchen-footer-notes">${order.notes.toUpperCase()}</div>
    `;
  }

  const kitchenTitle = order.is_delivery ? "DOMICILIO" : "PEDIDO";
  const locatorLabel = order.is_delivery ? "Domicilio #" : "Mesa #";

  let deliveryInfo = "";
  if (order.is_delivery) {
    deliveryInfo = `
      <div style="font-size:14px; margin-top:6px; border:2px dashed #000; padding:6px; background:#f9f9f9;">
        <div><strong>CLIENTE:</strong> ${(order.delivery_name ?? "Cliente").toUpperCase()}</div>
        ${order.delivery_address ? `<div><strong>DIR:</strong> ${order.delivery_address.toUpperCase()}</div>` : ""}
        ${order.delivery_phone ? `<div><strong>TEL:</strong> ${order.delivery_phone}</div>` : ""}
      </div>
    `;
  }

  return `
    <div class="center"><p class="kitchen-title">${kitchenTitle}</p></div>
    <div class="row" style="align-items:baseline">
      <span class="bold">${locatorLabel}</span>
      <span class="kitchen-locator">${order.locator}</span>
    </div>
    ${deliveryInfo}
    <div class="row"><span>Ticket Control</span><span class="bold kitchen-ticket">${ticketNumber}</span></div>
    <div class="center" style="padding:2px 0"><span class="kitchen-cashier">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <div class="row" style="font-size:10px"><span class="bold">Cant.</span><span class="bold">Producto</span></div>
    <div class="divider"></div>
    ${itemsHTML}
    ${notesSection}
    <div class="divider"></div>
    <div class="center" style="font-size:12px;margin-top:4px">
      Hora: ${timeOnly}<br>
      ${dateOnly}
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════════
   CIERRE DE TURNO – RECEIPT
   ══════════════════════════════════════════════════════════════ */

export interface ShiftClosingData {
  orders: Order[];
  cajeroName: string;
  shiftStart: Date;
  shiftEnd: Date;
}

/** Genera el HTML completo de la tirilla de cierre de turno */
export function buildShiftClosingReceiptHTML(data: ShiftClosingData): string {
  const { orders, cajeroName, shiftStart, shiftEnd } = data;

  const dateFmt = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const printDate = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  // Solo órdenes entregadas (no canceladas)
  const entregados = orders.filter((o) => o.status === "entregado");
  const cancelados = orders.filter((o) => o.status === "cancelado");

  // Totales por método de pago
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencias = 0;
  let grandTotal = 0;

  entregados.forEach((order) => {
    const orderTotal = order.total ?? 0;
    grandTotal += orderTotal;

    const payment = order.payments?.[0];
    if (payment) {
      totalEfectivo += payment.amount_efectivo ?? 0;
      totalTarjeta += payment.amount_tarjeta ?? 0;
      totalTransferencias += payment.amount_nequi ?? 0;
    } else {
      // Si no hay registro de pago, asumimos efectivo
      totalEfectivo += orderTotal;
    }
  });

  // Agrupar productos vendidos
  const itemSummary = new Map<
    string,
    { name: string; qty: number; total: number }
  >();

  entregados.forEach((order) => {
    (order.order_items ?? []).forEach((item) => {
      if (!item.products) return;

      const productId = item.products.id;
      const name = item.products.name;
      const qty = item.quantity ?? 1;
      const total = (item.unit_price ?? 0) * qty;

      if (!itemSummary.has(productId)) {
        itemSummary.set(productId, { name, qty: 0, total: 0 });
      }
      const existing = itemSummary.get(productId)!;
      existing.qty += qty;
      existing.total += total;
    });
  });

  // Generar filas de productos agrupados
  const orderRows = Array.from(itemSummary.values())
    .sort((a, b) => b.qty - a.qty) // Ordenar por cantidad vendida (mayor a menor)
    .map((item) => {
      return `
        <div class="row" style="font-size:12px; margin-bottom:2px;">
          <span>${item.name.toUpperCase()}: <span class="bold">${item.qty}</span></span>
          <span class="bold">${formatPrice(item.total)}</span>
        </div>
      `;
    })
    .join('<div style="border-top:1px dotted #eee;margin:2px 0"></div>');

  // Pedidos cancelados
  let cancelledSection = "";
  if (cancelados.length > 0) {
    const cancelledRows = cancelados
      .map((order) => {
        const ticketNumber = order.ticket_number ?? "—";
        const typeLabel = order.is_delivery ? "DOM" : "MESA";
        return `<div class="row" style="font-size:11px"><span>#${ticketNumber} ${typeLabel} ${order.locator}</span><span>${formatPrice(order.total ?? 0)}</span></div>`;
      })
      .join("");

    const totalCancelado = cancelados.reduce(
      (sum, o) => sum + (o.total ?? 0),
      0,
    );

    cancelledSection = `
      <div class="divider"></div>
      <div class="bold" style="font-size:13px;padding:4px 0 2px">PEDIDOS CANCELADOS (${cancelados.length})</div>
      ${cancelledRows}
      <div class="row bold" style="font-size:12px;padding-top:2px"><span>Total Cancelado</span><span>${formatPrice(totalCancelado)}</span></div>
    `;
  }

  return `
    <div class="center"><p class="header-title">CIERRE DE TURNO</p></div>
    <div class="double-divider">
      <div class="center bold" style="font-size:13px">La 30 Perros y Hamburguesas</div>
    </div>

    <div class="row" style="font-size:10px"><span>Fecha Hora Impr.:</span><span>${printDate}</span></div>
    <div class="divider"></div>

    <div class="row"><span>Inicio Turno:</span><span class="bold">${dateFmt.format(shiftStart)} ${timeFmt.format(shiftStart)}</span></div>
    <div class="row"><span>Cierre Turno:</span><span class="bold">${dateFmt.format(shiftEnd)} ${timeFmt.format(shiftEnd)}</span></div>
    <div class="row"><span>Cajero:</span><span class="bold">${cajeroName.toUpperCase()}</span></div>

    <div class="double-divider">
      <div class="center bold" style="font-size:13px">PRODUCTOS VENDIDOS</div>
    </div>

    <div class="row bold" style="font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:4px">
      <span>Pedidos Entregados: ${entregados.length}</span>
      <span>Total: ${formatPrice(grandTotal)}</span>
    </div>

    ${orderRows}

    ${cancelledSection}

    <div class="double-divider" style="margin-top:6px">
      <div class="center bold" style="font-size:14px">RESUMEN DE CAJA</div>
    </div>

    <div class="row" style="font-size:13px;padding:3px 0">
      <span class="bold">💵 Efectivo:</span>
      <span class="bold">${formatPrice(totalEfectivo)}</span>
    </div>
    <div class="row" style="font-size:13px;padding:3px 0">
      <span class="bold">💳 Tarjeta:</span>
      <span class="bold">${formatPrice(totalTarjeta)}</span>
    </div>
    <div class="row" style="font-size:13px;padding:3px 0">
      <span class="bold">📱 Transferencias:</span>
      <span class="bold">${formatPrice(totalTransferencias)}</span>
    </div>

    <div class="double-divider"></div>
    <div class="row total-row" style="padding:4px 0">
      <span>TOTAL EN CAJA</span>
      <span class="big-total">${formatPrice(grandTotal)}</span>
    </div>
    <div class="divider"></div>

    <div class="center" style="padding:6px 0;font-size:11px">
      <p>Total Pedidos: <span class="bold">${entregados.length + cancelados.length}</span></p>
      <p>Entregados: <span class="bold">${entregados.length}</span> | Cancelados: <span class="bold">${cancelados.length}</span></p>
      <div class="divider" style="margin-top:6px"></div>
      <p class="bold" style="padding-top:4px">La 30 Perros y Hamburguesas</p>
      <p style="font-size:10px">Cierre generado automáticamente</p>
    </div>
  `;
}

/** 
 * Impresión mediante la ventana principal: más compatible con PWA/Accesos directos.
 * Oculta la app momentáneamente y muestra solo el contenido a imprimir.
 */
export async function silentPrint(bodyHTML: string, _title?: string): Promise<void> {
  return new Promise((resolve) => {
    // 1. Crear o recuperar el contenedor de montaje
    let mount = document.getElementById("print-mount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "print-mount";
      document.body.appendChild(mount);
    }

    // 2. Inyectar estilos de impresión y el contenido
    mount.innerHTML = `
      <style>
        @media screen {
          #print-mount { display: none !important; }
        }

        @media print {
          /* REGLA MAESTRA: Ocultar todo lo que sea hijo directo del body excepto el mount */
          body > *:not(#print-mount) {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
          }

          /* Asegurar que html y body no tengan scroll ni márgenes extraños */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #fff !important;
          }

          /* El contenedor de impresión debe ser visible y ocupar el ancho */
          #print-mount {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
          }

          #print-mount * {
            visibility: visible !important;
          }

          /* Estilos específicos del ticket */
          ${PRINT_STYLES}
        }
      </style>
      <div class="print-ticket-wrapper">
        ${bodyHTML}
      </div>
    `;

    let resolved = false;

    // 3. Escuchar cuando el usuario cierra el cuadro de impresión
    const handleAfterPrint = () => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("afterprint", handleAfterPrint);
      if (timeoutId) clearTimeout(timeoutId);
      mount!.innerHTML = ""; // Limpiar contenido
      setTimeout(resolve, 300);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    // Timeout de seguridad de 10 segundos para evitar que la UI quede congelada si afterprint no se dispara
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn("silentPrint: window.afterprint event timed out, resolving manually.");
        handleAfterPrint();
      }
    }, 10000);

    // 4. Lanzar impresión con un delay para asegurar renderizado de fuentes y estilos
    setTimeout(() => {
      window.print();
    }, 800);
  });
}
