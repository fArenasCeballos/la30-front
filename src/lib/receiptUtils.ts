import type { Order } from "@/types";
import { formatPrice } from "@/lib/formatPrice";

/* ── Estilos para la ventana de impresión ────────────────────────── */
export const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Lucida Console', monospace;
    width: 280px;
    padding: 10px;
    font-size: 12px;
    color: #000;
    line-height: 1.4;
  }
  .center   { text-align: center; }
  .right    { text-align: right; }
  .bold     { font-weight: bold; }
  .divider  { border-top: 1px dashed #000; margin: 6px 0; }
  .double-divider {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 2px 0;
    margin: 6px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
  }
  .row-indent { padding-left: 8px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
  }
  th {
    border-bottom: 1px solid #000;
    border-top: 1px solid #000;
    padding: 3px 0;
    font-size: 11px;
    text-align: left;
  }
  th:last-child { text-align: right; }
  td {
    padding: 2px 0;
    vertical-align: top;
    font-size: 11px;
  }
  td:first-child { width: 50%; }
  td:nth-child(2) { width: 15%; text-align: center; }
  td:last-child { text-align: right; }
  .item-notes {
    font-size: 10px;
    color: #333;
    padding-left: 8px;
    font-style: italic;
  }
  .header-title {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .total-row {
    font-size: 14px;
    font-weight: bold;
  }
  .big-total {
    font-size: 16px;
    font-weight: bold;
  }
  /* ── Comanda de cocina ───────────────────────────────────── */
  .kitchen-title {
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 2px;
  }
  .kitchen-locator {
    font-size: 40px;
    font-weight: bold;
    letter-spacing: 4px;
    line-height: 1.1;
  }
  .kitchen-ticket {
    font-size: 14px;
  }
  .kitchen-cashier {
    font-size: 12px;
    font-weight: bold;
  }
  .kitchen-item-name {
    font-size: 16px;
    font-weight: bold;
    padding: 6px 0 2px;
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

function getValidItems(order: Order) {
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

  const paymentSection = paymentMethod
    ? `
    <div class="row">
      <span class="bold">Entregado</span>
      <span class="bold">${formatPrice(paymentReceived ?? order.total ?? 0)}</span>
    </div>
    <div class="row">
      <span class="bold">Cambio</span>
      <span class="bold">${formatPrice(paymentChange ?? 0)}</span>
    </div>
    <div style="font-size:11px;padding:4px 0 0">
      ${paymentMethod === "efectivo" ? "Efectivo" : paymentMethod === "tarjeta" ? "Tarjeta" : "Nequi"} ${formatPrice(paymentReceived ?? order.total ?? 0)}
    </div>
    <div class="divider"></div>
  `
    : "";

  return `
    <div class="center"><p class="header-title">VENTA A LA MESA</p></div>
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
    <div class="row"><span>Mesa No.:</span><span class="bold">${order.locator}</span></div>
    <div class="row"><span>Cajero :</span><span class="bold">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <table>
      <thead><tr><th>Producto Nombre</th><th>Cant.</th><th>Valor</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="divider"></div>
    <div class="row"><span>Sub Total</span><span>${formatPrice(subtotal)}</span></div>
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

/** Genera el HTML completo de la comanda de cocina */
export function buildKitchenReceiptHTML(data: ReceiptData): string {
  const { order, cajeroName } = data;
  const { dateOnly, timeOnly } = getReceiptDates(order);
  const validItems = getValidItems(order);
  const ticketNumber = order.ticket_number ?? "—";

  const itemsHTML = validItems
    .map((item) => {
      const notesHTML = item.notes
        ? `<div class="kitchen-obs">${item.notes
            .split(",")
            .map(
              (note: string) =>
                `<p style="margin:1px 0;padding-left:4px">• ${note.trim()}</p>`,
            )
            .join("")}</div>`
        : "";
      return `
      <div>
        <p class="kitchen-item-name">${item.quantity} ${(item.products?.name ?? "Producto").toUpperCase()}</p>
        ${notesHTML}
      </div>
    `;
    })
    .join("");

  const orderNotesHTML = order.notes
    ? `
    <div class="divider"></div>
    <p class="bold">NOTAS DEL PEDIDO:</p>
    <p class="kitchen-obs">${order.notes}</p>
  `
    : "";

  return `
    <div class="center"><p class="kitchen-title">PEDIDO</p></div>
    <div class="row" style="align-items:baseline">
      <span class="bold">Mesa #</span>
      <span class="kitchen-locator">${order.locator}</span>
    </div>
    <div class="row"><span>Ticket Control</span><span class="bold kitchen-ticket">${ticketNumber}</span></div>
    <div class="center" style="padding:2px 0"><span class="kitchen-cashier">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <div class="row" style="font-size:10px"><span class="bold">Cantidad</span><span class="bold">Productos</span></div>
    <div class="divider"></div>
    ${itemsHTML}
    ${orderNotesHTML}
    <div class="divider" style="border-top-style:dotted"></div>
    <div class="center kitchen-footer">
      <p>Hora: ${timeOnly}</p>
      <p>${dateOnly}</p>
    </div>
  `;
}

/** Impresión silenciosa: abre ventana y lanza window.print() automáticamente */
export function silentPrint(bodyHTML: string, title = "Recibo") {
  const printWindow = window.open("", "_blank", "width=320,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>${bodyHTML}</body>
    <script>window.onload = () => { window.print(); window.close(); }</script>
    </html>
  `);
  printWindow.document.close();
}
