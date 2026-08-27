import type { Order, OrderItem } from "@/types";
import { formatPrice } from "@/lib/formatPrice";

/* ── Estilos para la ventana de impresión ────────────────────────── */
export const PRINT_STYLES = `
  @page {
    margin: 0;
    size: 80mm auto;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: 'Courier New', Courier, 'Monaco', 'Consolas', monospace;
    width: 72mm;
    margin: 0 auto;
    padding: 0 1mm 4mm 1mm;
    font-size: 13px;
    font-weight: bold;
    color: #000000 !important;
    line-height: 1.2;
    background: #ffffff !important;
    -webkit-font-smoothing: none;
  }
  .center   { text-align: center; }
  .right    { text-align: right; }
  .bold     { font-weight: 900 !important; }
  .divider  { border-top: 1.5px dashed #000000; margin: 4px 0; }
  .double-divider {
    border-top: 2px solid #000000;
    border-bottom: 2px solid #000000;
    padding: 3px 0;
    margin: 4px 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 1.5px 0;
    word-break: break-word;
    font-weight: bold;
    color: #000000 !important;
  }
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 4px 0;
  }
  th {
    border-bottom: 1.5px solid #000000;
    border-top: 1.5px solid #000000;
    padding: 3px 0;
    font-size: 12.5px;
    font-weight: 900;
    text-align: left;
    color: #000000 !important;
  }
  th:last-child { text-align: right; }
  td {
    padding: 3px 0;
    vertical-align: top;
    font-size: 12.5px;
    font-weight: bold;
    color: #000000 !important;
    word-break: break-word;
  }
  td:first-child { width: 56%; }
  td:nth-child(2) { width: 14%; text-align: center; font-weight: 900; }
  td:last-child { width: 30%; text-align: right; font-weight: 900; }
  .item-notes {
    font-size: 11.5px;
    font-weight: 900;
    padding-left: 4px;
    word-break: break-word;
    color: #000000 !important;
  }
  .header-title {
    font-size: 17px;
    font-weight: 900;
    margin-bottom: 2px;
    letter-spacing: 0.5px;
  }
  .total-row {
    font-size: 16px;
    font-weight: 900;
    margin-top: 4px;
  }
  .big-total {
    font-size: 19px;
    font-weight: 900;
  }
  /* ── Comanda de cocina ───────────────────────────────────── */
  .kitchen-title {
    font-size: 28px;
    font-weight: 900;
    border: 3px solid #000000;
    display: inline-block;
    padding: 2px 14px;
    margin-bottom: 6px;
    letter-spacing: 1px;
  }
  .kitchen-locator {
    font-size: 72px;
    font-weight: 900;
    line-height: 1;
  }
  .kitchen-ticket {
    font-size: 22px;
    font-weight: 900;
  }
  .kitchen-cashier {
    font-size: 16px;
    font-weight: 900;
  }
  .kitchen-item-name {
    font-size: 28px;
    font-weight: 900;
    padding: 6px 0 2px;
    border-bottom: 2.5px solid #000000;
    word-break: break-word;
    line-height: 1.15;
  }
  .kitchen-item-notes {
    font-size: 18px;
    font-weight: 900;
    padding-left: 6px;
    margin-bottom: 8px;
    line-height: 1.25;
    word-break: break-word;
  }
  .kitchen-footer-notes {
    font-size: 18px;
    font-weight: 900;
    background: #ffffff;
    padding: 5px;
    border: 2px dashed #000000;
    margin-top: 8px;
    word-break: break-word;
  }
  .kitchen-obs {
    font-size: 13px;
    font-weight: bold;
    padding: 0 0 4px 4px;
    word-break: break-word;
  }
  .kitchen-footer {
    font-size: 13px;
    font-weight: 900;
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
  storeName?: string;
  driverName?: string;
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
  paymentBreakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
  sharedPayments?: Array<{
    method: string;
    subMethod?: string;
    amount: number;
  }>;
}

/**
 * Extrae únicamente el primer nombre de un string de nombre o nombres compuestos.
 * Ej: "Carlos Alberto" -> "Carlos", "JUAN MANUEL" -> "JUAN", "Andrés" -> "Andrés"
 */
export function extractFirstName(fullNameOrFirstName?: string | null): string {
  if (!fullNameOrFirstName) return "";
  const cleaned = fullNameOrFirstName.trim();
  if (!cleaned) return "";
  return cleaned.split(/\s+/)[0];
}

/** Genera el HTML completo de la factura del cliente */
export function buildCustomerReceiptHTML(data: ReceiptData): string {
  const { order, cajeroName, storeName = "La 30 Perros y Hamburguesas", paymentMethod, paymentReceived, paymentChange } =
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
        <span class="bold">${(item.products?.name ?? "Producto").toUpperCase()}</span>
        ${item.notes ? `<div class="item-notes">↳ ${item.notes}</div>` : ""}
      </td>
      <td style="text-align:center" class="bold">${item.quantity}</td>
      <td class="bold">${formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}</td>
    </tr>
  `,
    )
    .join("");

  let paymentSection = "";
  if (paymentMethod) {
    let breakdownDetails = "";

    // Shared payment: show individual entries
    if (
      paymentMethod === "mixto" &&
      data.sharedPayments &&
      data.sharedPayments.length > 0
    ) {
      const getLabel = (m: string, sub?: string) => {
        if (sub === "tarjeta_credito") return "T. Crédito";
        if (sub === "tarjeta_debito") return "T. Débito";
        if (sub === "daviplata") return "Daviplata";
        if (sub === "nequi") return "Nequi";
        if (m === "efectivo") return "Efectivo";
        if (m === "tarjeta") return "Tarjeta";
        return "Nequi";
      };
      breakdownDetails += `<div class="center bold" style="font-size:12px;padding:3px 0">PAGO COMPARTIDO</div>`;
      data.sharedPayments.forEach((p, idx) => {
        breakdownDetails += `<div class="row" style="font-size:11.5px"><span class="bold">Pago ${idx + 1} (${getLabel(p.method, p.subMethod)}):</span><span class="bold">${formatPrice(p.amount)}</span></div>`;
      });
    } else if (paymentMethod === "mixto" && data.paymentBreakdown) {
      // Fallback: aggregated breakdown (for reprints from DB)
      const b = data.paymentBreakdown;
      if (b.efectivo)
        breakdownDetails += `<div class="row"><span class="bold">Efectivo:</span><span class="bold">${formatPrice(b.efectivo)}</span></div>`;
      if (b.tarjeta)
        breakdownDetails += `<div class="row"><span class="bold">Tarjeta:</span><span class="bold">${formatPrice(b.tarjeta)}</span></div>`;
      if (b.nequi)
        breakdownDetails += `<div class="row"><span class="bold">Nequi:</span><span class="bold">${formatPrice(b.nequi)}</span></div>`;
    } else {
      const label =
        paymentMethod === "efectivo"
          ? "Efectivo"
          : paymentMethod === "tarjeta"
            ? "Tarjeta"
            : "Nequi";
      breakdownDetails = `<div class="row"><span class="bold">${label}:</span><span class="bold">${formatPrice(paymentReceived ?? order.total ?? 0)}</span></div>`;
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
      <div style="font-size:11.5px;padding:4px 0 0">
        ${breakdownDetails}
      </div>
      <div class="divider"></div>
    `;
  }

  const headerTitle = order.is_delivery
    ? "VENTA A DOMICILIO"
    : "VENTA A LA MESA";
  const locatorLabel = order.is_delivery ? "Domicilio No." : "Mesa No.";

  let deliveryInfo = "";
  if (order.is_delivery) {
    const rawDriverName =
      data.driverName ||
      order.delivery_drivers?.first_name ||
      order.driver?.first_name;
    const driverFirstName = extractFirstName(rawDriverName);

    deliveryInfo = `
      <div class="row"><span class="bold">Cliente:</span><span class="bold">${(order.delivery_name ?? "Cliente").toUpperCase()}</span></div>
      ${order.delivery_address ? `<div class="row"><span class="bold">Dirección:</span><span class="bold">${order.delivery_address.toUpperCase()}</span></div>` : ""}
      ${order.delivery_phone ? `<div class="row"><span class="bold">Teléfono:</span><span class="bold">${order.delivery_phone}</span></div>` : ""}
      ${driverFirstName ? `<div class="row"><span class="bold">Domiciliario:</span><span class="bold">${driverFirstName.toUpperCase()}</span></div>` : ""}
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
    <div class="row" style="font-size:11px"><span class="bold">Fecha Hora Impr.:</span><span class="bold">${printDate}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="bold">Fecha :</span><span class="bold">${dateOnly}</span></div>
    <div class="row"><span class="bold">Hora  :</span><span class="bold">${timeOnly}</span></div>
    <div class="row"><span class="bold">${locatorLabel}:</span><span class="bold">${order.locator}</span></div>
    ${deliveryInfo}
    <div class="row"><span class="bold">Cajero :</span><span class="bold">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <table>
      <thead><tr><th>Producto Nombre</th><th>Cant.</th><th>Valor</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="divider"></div>
    <div class="row"><span class="bold">Sub Total</span><span class="bold">${formatPrice(subtotal)}</span></div>
    ${(order.delivery_fee ?? 0) > 0 ? `<div class="row"><span class="bold">Costo Envío</span><span class="bold">${formatPrice(order.delivery_fee)}</span></div>` : ""}
    <div class="divider"></div>
    <div class="row total-row"><span class="bold">Total</span><span class="big-total">${formatPrice(order.total ?? 0)}</span></div>
    <div class="divider"></div>
    ${paymentSection}
    <div class="center" style="padding:4px 0">
      <p class="bold" style="font-size:14px">¡Gracias por tu compra!</p>
      <p class="bold" style="font-size:13px;margin-top:2px">Espera tu número: <span class="bold">${order.locator}</span></p>
      <div class="divider"></div>
      <p class="bold" style="font-size:12px;padding-top:4px">${storeName.toUpperCase()}</p>
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

  const renderItemHTML = (item: OrderItem) => `
    <div style="margin-bottom: 10px;">
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
                     return `<div style="margin-top:4px; color:#000000; border-top:2.5px solid #000000; padding-top:3px; font-size:19px; font-weight:900;">${trimmed.replace("Obs:", "<strong>OBS:</strong>")}</div>`;
                   }
                   return `• ${trimmed}`;
                 })
                 .join("<br>")}
             </div>`
          : ""
      }
    </div>
  `;

  let itemsHTML = "";
  if (filteredItems) {
    itemsHTML = filteredItems.map(renderItemHTML).join("");
  } else {
    // Organizado por categorías en una única comanda
    const categoryGroups: Record<string, OrderItem[]> = {};
    itemsToPrint.forEach((item) => {
      const catName = item.products?.categories?.name || "General";
      if (!categoryGroups[catName]) categoryGroups[catName] = [];
      categoryGroups[catName].push(item);
    });

    const entries = Object.entries(categoryGroups);
    const showHeader = entries.length > 1;

    itemsHTML = entries
      .map(([catName, catItems]) => {
        const header = showHeader
          ? `<div style="font-size:16px; font-weight:900; border-top:2px solid #000000; border-bottom:2px solid #000000; padding:2px 0; margin:10px 0 6px; text-transform:uppercase; text-align:center;">── ${catName} ──</div>`
          : "";
        return `${header}${catItems.map(renderItemHTML).join("")}`;
      })
      .join("");
  }

  let notesSection = "";
  const rawNotes = order.notes?.trim() || "";
  const isAddressNote =
    rawNotes.startsWith("📍") ||
    (order.delivery_address &&
      rawNotes.toLowerCase() === order.delivery_address.toLowerCase());

  if (rawNotes && !isAddressNote) {
    notesSection = `
      <div class="divider"></div>
      <div class="bold" style="font-size:15px">NOTAS DEL PEDIDO:</div>
      <div class="kitchen-footer-notes">${rawNotes.toUpperCase()}</div>
    `;
  }

  const kitchenTitle = order.is_delivery ? "DOMICILIO" : "PEDIDO";
  const locatorLabel = order.is_delivery ? "Domicilio #" : "Mesa #" ;

  let deliveryInfo = "";
  if (order.is_delivery) {
    const rawDriverName =
      data.driverName ||
      order.delivery_drivers?.first_name ||
      order.driver?.first_name;
    const driverFirstName = extractFirstName(rawDriverName);

    if (driverFirstName) {
      deliveryInfo = `
        <div style="font-size:14px; font-weight:bold; margin-top:5px; border:2px dashed #000000; padding:5px; background:#ffffff; color:#000000;">
          <div><strong>DOMICILIARIO:</strong> ${driverFirstName.toUpperCase()}</div>
        </div>
      `;
    }
  }

  return `
    <div class="center"><p class="kitchen-title">${kitchenTitle}</p></div>
    <div class="row" style="align-items:baseline">
      <span class="bold" style="font-size:16px;">${locatorLabel}</span>
      <span class="kitchen-locator">${order.locator}</span>
    </div>
    ${deliveryInfo}
    <div class="row" style="margin-top:4px;"><span class="bold">Ticket Control</span><span class="bold kitchen-ticket">${ticketNumber}</span></div>
    <div class="center" style="padding:3px 0"><span class="kitchen-cashier">${cajeroName.toUpperCase()}</span></div>
    <div class="divider"></div>
    <div class="row" style="font-size:13px"><span class="bold">Cant.</span><span class="bold">Producto</span></div>
    <div class="divider"></div>
    ${itemsHTML}
    ${notesSection}
    <div class="divider"></div>
    <div class="center kitchen-footer" style="font-size:13px; font-weight:bold; margin-top:4px;">
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
  storeName?: string;
}

/** Genera el HTML completo de la tirilla de cierre de turno */
export function buildShiftClosingReceiptHTML(data: ShiftClosingData): string {
  const { orders, cajeroName, shiftStart, shiftEnd, storeName = "La 30 Perros y Hamburguesas" } = data;

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

    if (order.payments && order.payments.length > 0) {
      order.payments.forEach((p) => {
        if (p.method === "mixto") {
          totalEfectivo += p.amount_efectivo || 0;
          totalTarjeta += p.amount_tarjeta || 0;
          totalTransferencias += p.amount_nequi || 0;
        } else {
          if (p.method === "efectivo") {
            totalEfectivo += p.amount_total || 0;
          } else if (p.method === "tarjeta") {
            totalTarjeta += p.amount_total || 0;
          } else if (p.method === "nequi") {
            totalTransferencias += p.amount_total || 0;
          }
        }
      });
    }
  });

  // Agrupar productos vendidos por categoría y luego por producto
  const categorySummary = new Map<
    string,
    {
      name: string;
      sortOrder: number;
      items: Map<
        string,
        { name: string; qty: number; total: number; sortOrder: number }
      >;
    }
  >();

  entregados.forEach((order) => {
    (order.order_items ?? []).forEach((item) => {
      if (!item.products) return;

      const category = item.products.categories;
      const categoryId =
        (item.products as unknown as { category_id?: string | null })
          .category_id ??
        category?.id ??
        "otros";
      const categoryName = category?.name ?? "Otros";
      const categorySortOrder = category?.sort_order ?? 9999;

      const productId = item.products.id;
      const name = item.products.name;
      const qty = item.quantity ?? 1;
      const total = (item.unit_price ?? 0) * qty;
      const productSortOrder = item.products.sort_order ?? 9999;

      if (!categorySummary.has(categoryId)) {
        categorySummary.set(categoryId, {
          name: categoryName,
          sortOrder: categorySortOrder,
          items: new Map(),
        });
      }
      const catSummary = categorySummary.get(categoryId)!;

      if (!catSummary.items.has(productId)) {
        catSummary.items.set(productId, {
          name,
          qty: 0,
          total: 0,
          sortOrder: productSortOrder,
        });
      }
      const existingItem = catSummary.items.get(productId)!;
      existingItem.qty += qty;
      existingItem.total += total;
    });
  });

  // Generar filas ordenando por sort_order
  const sortedCategories = Array.from(categorySummary.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const orderRows = sortedCategories
    .map((catSummary) => {
      const itemsList = Array.from(catSummary.items.values())
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => {
          return `
            <div class="row" style="font-size:12px; margin-bottom:2px; padding: 0 2px;">
              <span class="bold">${item.name.toUpperCase()}: <span class="bold">${item.qty}</span></span>
              <span class="bold">${formatPrice(item.total)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div style="margin-top: 6px; margin-bottom: 2px;">
          <div class="bold center" style="font-size:13px; border-bottom:1.5px dashed #000000; margin-bottom: 3px; padding-bottom: 2px;">
            ${catSummary.name.toUpperCase()}
          </div>
          ${itemsList}
        </div>
      `;
    })
    .join("");

  // Pedidos cancelados
  let cancelledSection = "";
  if (cancelados.length > 0) {
    const cancelledRows = cancelados
      .map((order) => {
        const ticketNumber = order.ticket_number ?? "—";
        const typeLabel = order.is_delivery ? "DOM" : "MESA";
        return `<div class="row" style="font-size:11.5px"><span class="bold">#${ticketNumber} ${typeLabel} ${order.locator}</span><span class="bold">${formatPrice(order.total ?? 0)}</span></div>`;
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
      <div class="row bold" style="font-size:12px;padding-top:2px"><span class="bold">Total Cancelado</span><span class="bold">${formatPrice(totalCancelado)}</span></div>
    `;
  }

  return `
    <div class="center"><p class="header-title">CIERRE DE TURNO</p></div>
    <div class="double-divider">
      <div class="center bold" style="font-size:14px">${storeName.toUpperCase()}</div>
    </div>

    <div class="row" style="font-size:11px"><span class="bold">Fecha Hora Impr.:</span><span class="bold">${printDate}</span></div>
    <div class="divider"></div>

    <div class="row"><span class="bold">Inicio Turno:</span><span class="bold">${dateFmt.format(shiftStart)} ${timeFmt.format(shiftStart)}</span></div>
    <div class="row"><span class="bold">Cierre Turno:</span><span class="bold">${dateFmt.format(shiftEnd)} ${timeFmt.format(shiftEnd)}</span></div>
    <div class="row"><span class="bold">Cajero:</span><span class="bold">${cajeroName.toUpperCase()}</span></div>

    <div class="double-divider">
      <div class="center bold" style="font-size:14px">PRODUCTOS VENDIDOS</div>
    </div>

    <div class="row bold" style="font-size:12px;border-bottom:1.5px solid #000000;padding-bottom:2px;margin-bottom:4px">
      <span class="bold">Pedidos Entregados: ${entregados.length}</span>
      <span class="bold">Total: ${formatPrice(grandTotal)}</span>
    </div>

    ${orderRows}

    ${cancelledSection}

    <div class="double-divider" style="margin-top:6px">
      <div class="center bold" style="font-size:14px">RESUMEN DE CAJA</div>
    </div>

    <div class="row" style="font-size:13.5px;padding:3px 0">
      <span class="bold">💵 Efectivo:</span>
      <span class="bold">${formatPrice(totalEfectivo)}</span>
    </div>
    <div class="row" style="font-size:13.5px;padding:3px 0">
      <span class="bold">💳 Tarjeta:</span>
      <span class="bold">${formatPrice(totalTarjeta)}</span>
    </div>
    <div class="row" style="font-size:13.5px;padding:3px 0">
      <span class="bold">📱 Transferencias:</span>
      <span class="bold">${formatPrice(totalTransferencias)}</span>
    </div>

    <div class="double-divider"></div>
    <div class="row total-row" style="padding:4px 0">
      <span class="bold">TOTAL EN CAJA</span>
      <span class="big-total">${formatPrice(grandTotal)}</span>
    </div>
    <div class="divider"></div>

    <div class="center" style="padding:6px 0;font-size:11.5px">
      <p class="bold">Total Pedidos: <span class="bold">${entregados.length + cancelados.length}</span></p>
      <p class="bold">Entregados: <span class="bold">${entregados.length}</span> | Cancelados: <span class="bold">${cancelados.length}</span></p>
      <div class="divider" style="margin-top:6px"></div>
      <p class="bold" style="padding-top:4px">${storeName.toUpperCase()}</p>
      <p class="bold" style="font-size:10.5px">Cierre generado automáticamente</p>
    </div>
  `;
}

/**
 * Impresión mediante la ventana principal: más compatible con PWA/Accesos directos.
 * Oculta la app momentáneamente y muestra solo el contenido a imprimir.
 */
export async function silentPrint(
  bodyHTML: string,
  _title?: string,
): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            ${PRINT_STYLES}
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          <div class="print-ticket-wrapper">
            ${bodyHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      resolve();
    };

    setTimeout(() => {
      const win = iframe.contentWindow;
      if (win) {
        win.addEventListener("afterprint", cleanup);
        setTimeout(cleanup, 10000);

        try {
          win.focus();
          win.print();
        } catch (e) {
          console.error("Error al imprimir desde iframe:", e);
          cleanup();
        }
      } else {
        cleanup();
      }
    }, 500);
  });
}

/** Genera un comprobante individual (mini recibo) para un pago parcial específico */
export function buildPartialPaymentReceiptHTML(
  data: ReceiptData,
  payment: {
    method: string;
    subMethod?: string;
    amount: number;
    items?: Partial<OrderItem>[];
  },
  index: number,
  totalPayments: number,
): string {
  const { order, cajeroName, storeName = "La 30 Perros y Hamburguesas" } = data;
  const { printDate } = getReceiptDates(order);
  const ticketNumber = order.ticket_number ?? "—";

  const getLabel = (m: string, sub?: string) => {
    if (sub === "tarjeta_credito") return "T. Crédito";
    if (sub === "tarjeta_debito") return "T. Débito";
    if (sub === "daviplata") return "Daviplata";
    if (sub === "nequi") return "Nequi";
    if (m === "efectivo") return "Efectivo";
    if (m === "tarjeta") return "Tarjeta";
    return "Nequi";
  };

  const paymentLabel = getLabel(payment.method, payment.subMethod);

  return `
    <div class="center">
      <p class="header-title">${storeName.toUpperCase()}</p>
      <p class="bold" style="font-size:13px; margin-top:2px;">COMPROBANTE DE PAGO</p>
      <p class="bold" style="font-size:11.5px;">(PAGO PARCIAL ${index} de ${totalPayments})</p>
    </div>

    <div class="double-divider">
      <div class="row">
        <span class="bold">TIQUETE DE CONSUMO</span>
        <span class="bold">${ticketNumber}</span>
      </div>
    </div>

    <div class="row" style="font-size:11px">
      <span class="bold">Fecha Hora Impr.:</span>
      <span class="bold">${printDate}</span>
    </div>
    <div class="divider"></div>

    <div class="row">
      <span class="bold">${order.is_delivery ? "Domicilio No." : "Mesa No."}:</span>
      <span class="bold">${order.locator}</span>
    </div>

    <div class="row">
      <span class="bold">Cajero :</span>
      <span class="bold">${cajeroName.toUpperCase()}</span>
    </div>

    <div class="divider"></div>

    <div class="center" style="padding:6px 0;">
      <p style="font-size:15px; font-weight:900;">${paymentLabel.toUpperCase()}</p>
      <p class="big-total" style="font-size:22px; margin-top:3px;">${formatPrice(payment.amount)}</p>
    </div>
    ${
      payment.items && payment.items.length > 0
        ? `
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <th>Desc</th>
          <th style="text-align:center">Cant</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${payment.items
          .map(
            (item) => `
        <tr>
          <td>
            <span class="bold">${(item.products?.name ?? "Producto").toUpperCase()}</span>
            ${item.notes ? `<div class="item-notes">↳ ${item.notes}</div>` : ""}
          </td>
          <td style="text-align:center" class="bold">${item.quantity}</td>
          <td class="bold">${formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}</td>
        </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
    `
        : ""
    }

    <div class="divider"></div>
    <div class="center" style="padding:4px 0;">
      <p style="font-size:12px;" class="bold">Conserve este comprobante</p>
    </div>
  `;
}

export interface DriverSettlementData {
  driverName: string;
  driverPlate?: string;
  driverPhone?: string;
  orders: Order[];
  shiftStart: Date;
  shiftEnd: Date;
  cajeroName: string;
  storeName?: string;
}

export function buildDriverSettlementReceiptHTML({
  driverName,
  driverPlate,
  driverPhone,
  orders,
  shiftStart,
  shiftEnd,
  cajeroName,
  storeName = "LA 30 BURGER",
}: DriverSettlementData): string {
  const totalDeliveries = orders.length;
  const totalDeliveryFees = orders.reduce(
    (sum, o) => sum + (o.delivery_fee ?? 0),
    0,
  );

  let totalCashCollected = 0;
  orders.forEach((o) => {
    o.payments?.forEach((p) => {
      if (p.method === "efectivo") {
        totalCashCollected += p.amount_total || 0;
      } else if (p.method === "mixto") {
        totalCashCollected += p.amount_efectivo || 0;
      }
    });
  });

  const totalOrdersAmount = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const netBalanceToCashier = totalCashCollected - totalDeliveryFees;

  const ordersRows = orders
    .map((o) => {
      const hora = new Date(o.created_at).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const paymentMethods =
        o.payments?.map((p) => p.method.toUpperCase()).join(", ") ||
        "PENDIENTE";
      const fee = o.delivery_fee ?? 0;
      return `
        <tr>
          <td style="width:60%;">
            <div class="bold" style="font-size:12.5px;">#DOM ${o.locator} (${hora})</div>
            <div class="bold" style="font-size:11px;">${o.delivery_address || "Sin dirección"}</div>
            <div class="bold" style="font-size:10.5px;">Pago: ${paymentMethods}</div>
          </td>
          <td style="width:40%; text-align:right;">
            <div class="bold" style="font-size:11px;">${formatPrice(o.total)}</div>
            <div class="bold" style="font-size:12px;">+${formatPrice(fee)}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="center">
      <div class="header-title">${storeName.toUpperCase()}</div>
      <div class="bold" style="font-size:14.5px; margin: 2px 0;">LIQUIDACIÓN DE DOMICILIARIO</div>
      <div class="bold" style="font-size:11.5px;">Módulo de Domicilios</div>
    </div>

    <div class="divider"></div>

    <div class="row">
      <span class="bold">DOMICILIARIO:</span>
      <span class="bold">${driverName.toUpperCase()}</span>
    </div>
    ${driverPlate ? `<div class="row"><span class="bold">Placa Moto:</span><span class="bold">${driverPlate.toUpperCase()}</span></div>` : ""}
    ${driverPhone ? `<div class="row"><span class="bold">Teléfono:</span><span class="bold">${driverPhone}</span></div>` : ""}
    <div class="row">
      <span class="bold">Cajero / Responsable:</span>
      <span class="bold">${cajeroName.toUpperCase()}</span>
    </div>

    <div class="divider"></div>

    <div class="row" style="font-size:11px;">
      <span class="bold">Desde:</span>
      <span class="bold">${shiftStart.toLocaleDateString("es-CO")} ${shiftStart.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
    </div>
    <div class="row" style="font-size:11px;">
      <span class="bold">Hasta:</span>
      <span class="bold">${shiftEnd.toLocaleDateString("es-CO")} ${shiftEnd.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
    </div>

    <div class="double-divider"></div>

    <div class="bold" style="font-size:13px; margin-bottom:4px;">DETALLE DE ENTREGAS (${totalDeliveries})</div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left; width:60%;">Pedido / Dirección</th>
          <th style="text-align:right; width:40%;">Total / Flete</th>
        </tr>
      </thead>
      <tbody>
        ${ordersRows}
      </tbody>
    </table>

    <div class="double-divider"></div>

    <div class="row" style="font-size:13px;">
      <span class="bold">Total Pedidos Entregados:</span>
      <span class="bold">${totalDeliveries}</span>
    </div>
    <div class="row" style="font-size:13px;">
      <span class="bold">Venta Total Pedidos:</span>
      <span class="bold">${formatPrice(totalOrdersAmount)}</span>
    </div>
    <div class="row" style="font-size:13px;">
      <span class="bold">Efectivo Cobrado en Mano:</span>
      <span class="bold">${formatPrice(totalCashCollected)}</span>
    </div>

    <div class="divider"></div>

    <div class="row total-row" style="font-size:15px; margin: 4px 0;">
      <span class="bold">A PAGAR A DOMICILIARIO:</span>
      <span class="bold big-total">${formatPrice(totalDeliveryFees)}</span>
    </div>

    <div class="divider"></div>

    <div class="row" style="font-size:14px; padding: 4px 0;">
      <span class="bold">BALANCE CON CAJA:</span>
      <span class="bold" style="font-size:15px;">
        ${netBalanceToCashier >= 0 ? `Entrega a Caja: ${formatPrice(netBalanceToCashier)}` : `Caja le paga: ${formatPrice(Math.abs(netBalanceToCashier))}`}
      </span>
    </div>

    <div class="divider" style="margin-top:20px;"></div>

    <div style="margin-top:25px;" class="center">
      <div style="border-top:1.5px solid #000000; width:80%; margin:0 auto; padding-top:4px;">
        <span style="font-size:11.5px;" class="bold">Firma Domiciliario: ${driverName}</span>
      </div>
    </div>

    <div style="margin-top:25px;" class="center">
      <div style="border-top:1.5px solid #000000; width:80%; margin:0 auto; padding-top:4px;">
        <span style="font-size:11.5px;" class="bold">Firma Cajero: ${cajeroName}</span>
      </div>
    </div>

    <div style="margin-top:15px; font-size:11px;" class="center">
      <p class="bold">Comprobante oficial de liquidación de turno</p>
    </div>
  `;
}

