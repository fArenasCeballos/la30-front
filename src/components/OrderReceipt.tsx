import { useRef } from 'react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/formatPrice';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';

interface OrderReceiptProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  type: 'customer' | 'kitchen';
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
}

/* ── Estilos para la ventana de impresión ────────────────────────── */
const PRINT_STYLES = `
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

export function OrderReceipt({
  order,
  open,
  onClose,
  type,
  paymentMethod,
  paymentReceived,
  paymentChange,
}: OrderReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  if (!order) return null;

  /* ── Datos comunes ─────────────────────────────────────── */
  const cajeroName = user?.name ?? 'Cajero';
  const now = order.created_at ? new Date(order.created_at) : new Date();
  const dateOnly = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const timeOnly = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const printDate = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
  const ticketNumber = order.ticket_number ?? '—';

  /* ── Imprimir ──────────────────────────────────────────── */
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=320,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${type === 'customer' ? 'Recibo' : 'Comanda'} - ${order.locator}</title>
        <style>${PRINT_STYLES}</style>
      </head>
      <body>${printRef.current.innerHTML}</body>
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </html>
    `);
    printWindow.document.close();
  };

  /* ═══════════════════════════════════════════════════════════
     RECIBO DE VENTA (customer)
     ═══════════════════════════════════════════════════════════ */
  const customerReceipt = (
    <>
      {/* Encabezado */}
      <div className="center">
        <p className="header-title">VENTA A LA MESA</p>
      </div>

      <div className="double-divider">
        <div className="row">
          <span className="bold">TIQUETE DE CONSUMO</span>
          <span className="bold">{ticketNumber}</span>
        </div>
      </div>

      <div className="row" style={{ fontSize: '10px' }}>
        <span>Fecha Hora Impr.:</span>
        <span>{printDate}</span>
      </div>
      <div className="divider" />

      <div className="row">
        <span>Fecha :</span>
        <span>{dateOnly}</span>
      </div>
      <div className="row">
        <span>Hora  :</span>
        <span>{timeOnly}</span>
      </div>

      <div className="row">
        <span>Mesa No.:</span>
        <span className="bold">{order.locator}</span>
      </div>

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
                {(item.products?.name ?? 'Producto').toUpperCase()}
                {item.notes && (
                  <div className="item-notes">{item.notes}</div>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td>{formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}</td>
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
            <span className="bold">
              {formatPrice(paymentChange ?? 0)}
            </span>
          </div>
          <div style={{ fontSize: '11px', padding: '4px 0 0' }}>
            {paymentMethod === 'efectivo'
              ? 'Efectivo'
              : paymentMethod === 'tarjeta'
                ? 'Tarjeta'
                : 'Nequi'}{' '}
            {formatPrice(paymentReceived ?? order.total ?? 0)}
          </div>
          <div className="divider" />
        </>
      )}

      {/* Footer */}
      <div className="center" style={{ padding: '4px 0' }}>
        <p>¡Gracias por tu compra!</p>
        <p>
          Espera tu número:{' '}
          <span className="bold">{order.locator}</span>
        </p>
        <div className="divider" />
        <p className="bold" style={{ fontSize: '11px', paddingTop: '4px' }}>
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
        <p className="kitchen-title">PEDIDO</p>
      </div>

      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="bold">Mesa #</span>
        <span className="kitchen-locator">{order.locator}</span>
      </div>

      <div className="row">
        <span>Ticket Control</span>
        <span className="bold kitchen-ticket">{ticketNumber}</span>
      </div>

      <div className="center" style={{ padding: '2px 0' }}>
        <span className="kitchen-cashier">{cajeroName.toUpperCase()}</span>
      </div>

      <div className="divider" />

      <div className="row" style={{ fontSize: '10px' }}>
        <span className="bold">Cantidad</span>
        <span className="bold">Productos</span>
      </div>
      <div className="divider" />

      {validItems.map((item) => (
        <div key={item.id}>
          <p className="kitchen-item-name">
            {item.quantity}{' '}
            {(item.products?.name ?? 'Producto').toUpperCase()}
          </p>
          {item.notes && (
            <div className="kitchen-obs">
              {item.notes.split(',').map((note, idx) => (
                <p key={idx} style={{ margin: '1px 0', paddingLeft: '4px' }}>
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

      <div className="divider" style={{ borderTopStyle: 'dotted' }} />

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
            {type === 'customer'
              ? '🧾 Recibo de Venta'
              : '👨‍🍳 Comanda de Cocina'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            ref={printRef}
            className="font-mono text-xs space-y-1 bg-white text-black p-4 rounded-lg border shadow-inner"
            style={{ maxWidth: 280, margin: '0 auto' }}
          >
            {type === 'customer' ? customerReceipt : kitchenReceipt}
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