import { useRef } from "react";
import type { Order, OrderItem } from "@/types";
import { formatPrice } from "@/lib/formatPrice";
import {
  silentPrint,
  buildCustomerReceiptHTML,
  buildKitchenReceiptHTML,
} from "@/lib/receiptUtils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";

interface OrderReceiptProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  type: "customer" | "kitchen";
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
  paymentBreakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
}

export function OrderReceipt({
  order,
  open,
  onClose,
  type,
  paymentMethod,
  paymentReceived,
  paymentChange,
  paymentBreakdown,
}: OrderReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  if (!order) return null;

  /* ── Datos comunes ─────────────────────────────────────── */
  const cajeroName = user?.name ?? "Cajero";
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

  const validItems = (order.order_items ?? []).filter(
    (item) => item?.products != null,
  );
  const subtotal = validItems.reduce(
    (s, i) => s + (i.unit_price ?? 0) * (i.quantity ?? 1),
    0,
  );

  /* ── Ticket # consecutivo desde la BD ── */
  const ticketNumber = order.ticket_number ?? "—";

  /* ── Imprimir ──────────────────────────────────────────── */
  const handlePrint = async () => {
    const receiptData = {
      order,
      cajeroName,
      paymentMethod,
      paymentReceived,
      paymentChange,
      paymentBreakdown,
    };

    if (type === "customer") {
      await silentPrint(
        buildCustomerReceiptHTML(receiptData),
        `Recibo - ${order.locator}`,
      );
    } else {
      // Agrupar por categoría para comandas separadas
      const items = (order.order_items ?? []).filter((i) => i.products != null);
      const categoryGroups: Record<string, OrderItem[]> = {};

      items.forEach((item) => {
        const catName = item.products?.categories?.name || "General";
        if (!categoryGroups[catName]) categoryGroups[catName] = [];
        categoryGroups[catName].push(item);
      });

      const categoryKeys = Object.keys(categoryGroups);

      // Imprimir comandas agrupadas en un único diálogo
      if (categoryKeys.length > 0) {
        const kitchenHTMLs = categoryKeys.map((catName) =>
          buildKitchenReceiptHTML(receiptData, categoryGroups[catName]),
        );

        // Combinar todos los HTMLs interconectados por un separador de salto de página
        const combinedKitchenHTML = kitchenHTMLs.join(
          '<div class="print-page-break"></div>',
        );

        await silentPrint(combinedKitchenHTML);
      }
    }
    onClose();
  };

  /* ═══════════════════════════════════════════════════════════
     RECIBO DE VENTA (customer)
     ═══════════════════════════════════════════════════════════ */
  const customerReceipt = (
    <>
      {/* Encabezado */}
      <div className="center">
        <p className="header-title">
          {order.is_delivery ? "VENTA A DOMICILIO" : "VENTA A LA MESA"}
        </p>
      </div>

      <div className="double-divider">
        <div className="row">
          <span className="bold">TIQUETE DE CONSUMO</span>
          <span className="bold">{ticketNumber}</span>
        </div>
      </div>

      <div className="row" style={{ fontSize: "10px" }}>
        <span>Fecha Hora Impr.:</span>
        <span>{printDate}</span>
      </div>
      <div className="divider" />

      <div className="row">
        <span>Fecha :</span>
        <span>{dateOnly}</span>
      </div>
      <div className="row">
        <span>Hora :</span>
        <span>{timeOnly}</span>
      </div>

      <div className="row">
        <span>{order.is_delivery ? "Domicilio No." : "Mesa No."}:</span>
        <span className="bold">{order.locator}</span>
      </div>

      {order.is_delivery && (
        <>
          <div className="row">
            <span>Cliente:</span>
            <span className="bold">{(order.delivery_name ?? "Cliente").toUpperCase()}</span>
          </div>
          {order.delivery_address && (
            <div className="row">
              <span>Dirección:</span>
              <span className="bold">{order.delivery_address.toUpperCase()}</span>
            </div>
          )}
          {order.delivery_phone && (
            <div className="row">
              <span>Teléfono:</span>
              <span className="bold">{order.delivery_phone}</span>
            </div>
          )}
        </>
      )}

      <div className="row">
        <span>Cajero :</span>
        <span className="bold">{cajeroName.toUpperCase()}</span>
      </div>

      <div className="divider" />

      {/* Tabla de productos */}
      <table>
        <thead>
          <tr>
            <th>Producto Nombre</th>
            <th>Cant.</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {validItems.map((item) => (
            <tr key={item.id}>
              <td>
                {(item.products?.name ?? "Producto").toUpperCase()}
                {item.notes && <div className="item-notes">{item.notes}</div>}
              </td>
              <td style={{ textAlign: "center" }}>{item.quantity}</td>
              <td>
                {formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="divider" />

      {/* Subtotal y Total */}
      <div className="row">
        <span>Sub Total</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {(order.delivery_fee ?? 0) > 0 && (
        <div className="row">
          <span>Costo Envío</span>
          <span>{formatPrice(order.delivery_fee)}</span>
        </div>
      )}
      <div className="row">
        <span>Descuento</span>
        <span>$0</span>
      </div>

      <div className="divider" />

      <div className="row total-row">
        <span>Total</span>
        <span className="big-total">{formatPrice(order.total ?? 0)}</span>
      </div>

      <div className="divider" />

      {/* Pago */}
      {paymentMethod && (
        <>
          <div className="row">
            <span className="bold">Entregado</span>
            <span className="bold">
              {formatPrice(paymentReceived ?? order.total ?? 0)}
            </span>
          </div>
          <div className="row">
            <span className="bold">Cambio</span>
            <span className="bold">{formatPrice(paymentChange ?? 0)}</span>
          </div>

          <div style={{ fontSize: "11px", padding: "4px 0 0" }}>
            {paymentMethod === "mixto" && paymentBreakdown ? (
              <div className="space-y-0.5">
                {paymentBreakdown.efectivo && (
                  <div className="row">
                    <span>Efectivo:</span>
                    <span>{formatPrice(paymentBreakdown.efectivo)}</span>
                  </div>
                )}
                {paymentBreakdown.tarjeta && (
                  <div className="row">
                    <span>Tarjeta:</span>
                    <span>{formatPrice(paymentBreakdown.tarjeta)}</span>
                  </div>
                )}
                {paymentBreakdown.nequi && (
                  <div className="row">
                    <span>Nequi:</span>
                    <span>{formatPrice(paymentBreakdown.nequi)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="row">
                <span>
                  {paymentMethod === "efectivo"
                    ? "Efectivo"
                    : paymentMethod === "tarjeta"
                      ? "Tarjeta"
                      : "Nequi"}
                  :
                </span>
                <span>{formatPrice(paymentReceived ?? order.total ?? 0)}</span>
              </div>
            )}
          </div>
          <div className="divider" />
        </>
      )}

      {/* Footer */}
      <div className="center" style={{ padding: "4px 0" }}>
        <p>¡Gracias por tu compra!</p>
        <p>
          Espera tu número: <span className="bold">{order.locator}</span>
        </p>
        <div className="divider" />
        <p className="bold" style={{ fontSize: "11px", paddingTop: "4px" }}>
          La 30 Perros y Hamburguesas
        </p>
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════════
     COMANDA DE COCINA (kitchen)
     ═══════════════════════════════════════════════════════════ */
  const kitchenReceipt = (
    <>
      <div className="center">
        <p className="kitchen-title">
          {order.is_delivery ? "DOMICILIO" : "PEDIDO"}
        </p>
      </div>

      <div className="row" style={{ alignItems: "baseline" }}>
        <span className="bold">
          {order.is_delivery ? "Domicilio #" : "Mesa #"}
        </span>
        <span className="kitchen-locator">{order.locator}</span>
      </div>

      {order.is_delivery && (
        <div style={{ fontSize: "14px", marginTop: "6px", border: "2px dashed #000", padding: "6px", background: "#f9f9f9" }}>
          <div><strong>CLIENTE:</strong> {(order.delivery_name ?? "Cliente").toUpperCase()}</div>
          {order.delivery_address && <div><strong>DIR:</strong> {order.delivery_address.toUpperCase()}</div>}
          {order.delivery_phone && <div><strong>TEL:</strong> {order.delivery_phone}</div>}
        </div>
      )}

      <div className="row">
        <span>Ticket Control</span>
        <span className="bold kitchen-ticket">{ticketNumber}</span>
      </div>

      <div className="center" style={{ padding: "2px 0" }}>
        <span className="kitchen-cashier">{cajeroName.toUpperCase()}</span>
      </div>

      <div className="divider" />

      <div className="row" style={{ fontSize: "10px" }}>
        <span className="bold">Cantidad</span>
        <span className="bold">Productos</span>
      </div>
      <div className="divider" />

      {validItems.map((item) => (
        <div key={item.id}>
          <p className="kitchen-item-name">
            {item.quantity} {(item.products?.name ?? "Producto").toUpperCase()}
          </p>
          {item.notes && (
            <div className="kitchen-obs">
              {item.notes.split(",").map((note, idx) => (
                <p key={idx} style={{ margin: "1px 0", paddingLeft: "4px" }}>
                  • {note.trim()}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}

      {order.notes && (
        <>
          <div className="divider" />
          <p className="bold">NOTAS DEL PEDIDO:</p>
          <p className="kitchen-obs">{order.notes}</p>
        </>
      )}

      <div className="divider" style={{ borderTopStyle: "dotted" }} />

      <div className="center kitchen-footer">
        <p>Hora: {timeOnly}</p>
        <p>{dateOnly}</p>
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b flex-row items-center justify-between">
          <DialogTitle className="font-display text-lg">
            {type === "customer"
              ? "🧾 Recibo de Venta"
              : "👨‍🍳 Comanda de Cocina"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualización previa del ticket para imprimir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            ref={printRef}
            className="font-mono text-xs space-y-1 bg-white text-black p-4 rounded-lg border shadow-inner"
            style={{ maxWidth: 280, margin: "0 auto" }}
          >
            {type === "customer" ? customerReceipt : kitchenReceipt}
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={onClose}
          >
            <X className="h-4 w-4 mr-2" /> Cerrar
          </Button>
          <Button size="touch" className="flex-2" onClick={handlePrint}>
            <Printer className="h-5 w-5 mr-2" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
