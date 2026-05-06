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
    font-size: 22px;
    font-weight: bold;
    border: 2px solid #000;
    display: inline-block;
    padding: 2px 10px;
    margin-bottom: 4px;
  }
  .kitchen-locator {
    font-size: 48px;
    font-weight: bold;
    line-height: 1;
  }
  .kitchen-ticket {
    font-size: 16px;
  }
  .kitchen-cashier {
    font-size: 12px;
    font-weight: bold;
  }
  .kitchen-item-name {
    font-size: 18px;
    font-weight: bold;
    padding: 4px 0 1px;
    border-bottom: 1px solid #eee;
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
    <div class="row" style="font-size:10px"><span class="bold">Cant.</span><span class="bold">Producto</span></div>
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
          /* REGLA RADICAL: Todo es invisible por defecto */
          html, body {
            visibility: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #fff !important;
          }

          /* EXCEPCIÓN: El ticket y sus hijos son visibles */
          #print-mount, #print-mount * {
            visibility: visible !important;
          }

          /* POSICIONAMIENTO: El ticket manda en la página */
          #print-mount {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 99999 !important;
          }

          /* CAZA DE PORTALES: Forzar ocultación de modales, diálogos y overlays */
          #root, 
          [role="dialog"], 
          [data-radix-portal], 
          .sonner-toast, 
          .fixed, 
          .absolute {
            display: none !important;
            opacity: 0 !important;
          }

          /* Estilos del ticket */
          ${PRINT_STYLES}
        }
      </style>
      <div class="print-ticket-wrapper">
        ${bodyHTML}
      </div>
    `;

    // 3. Escuchar cuando el usuario cierra el cuadro de impresión
    const handleAfterPrint = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      mount!.innerHTML = ""; // Limpiar contenido
      setTimeout(resolve, 300);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    // 4. Lanzar impresión con un delay más largo para asegurar renderizado
    setTimeout(() => {
      window.print();
    }, 500);
  });
}
