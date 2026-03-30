import { useRef } from 'react';
import type { Order } from '@/types';
import { formatPrice } from '@/lib/formatPrice';
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

export function OrderReceipt({ order, open, onClose, type, paymentMethod, paymentReceived, paymentChange }: OrderReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${type === 'customer' ? 'Recibo' : 'Comanda'} - ${order.locator}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; width: 280px; padding: 12px; font-size: 12px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .item-notes { font-size: 10px; color: #555; padding-left: 16px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin-bottom: 2px; }
          .big { font-size: 24px; font-weight: bold; }
          .locator { font-size: 32px; font-weight: bold; letter-spacing: 2px; }
          .kitchen-item { font-size: 14px; font-weight: bold; padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .kitchen-notes { font-size: 12px; padding: 2px 0 4px 8px; font-style: italic; }
        </style>
      </head>
      <body>${printRef.current.innerHTML}</body>
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </html>
    `);
    printWindow.document.close();
  };

  // Guard: created_at puede llegar vacío en el instante post-creación
  const dateStr = order.created_at
    ? new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(order.created_at))
    : '--';

  // Solo items con producto válido
  const validItems = (order.order_items ?? []).filter(item => item?.products != null);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b flex-row items-center justify-between">
          <DialogTitle className="font-display text-lg">
            {type === 'customer' ? '🧾 Recibo del Cliente' : '👨‍🍳 Comanda de Cocina'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div ref={printRef} className="font-mono text-xs space-y-2 bg-white text-black p-3 rounded-lg border">
            {type === 'customer' ? (
              <>
                <div className="center">
                  <h1>🔥 LA 30</h1>
                  <p>Perros y Hamburguesas</p>
                  <div className="divider" />
                  <p className="bold">RECIBO DE VENTA</p>
                  <p>{dateStr}</p>
                </div>
                <div className="divider" />
                <div className="row">
                  <span className="bold">Localizador:</span>
                  <span className="bold">{order.locator}</span>
                </div>
                <div className="divider" />
                {validItems.map((item) => (
                  <div key={item.id}>
                    <div className="row">
                      <span>{item.quantity}x {item.products?.name ?? 'Producto'}</span>
                      <span>{formatPrice((item.unit_price ?? 0) * (item.quantity ?? 1))}</span>
                    </div>
                    {item.notes && <p className="item-notes">↳ {item.notes}</p>}
                  </div>
                ))}
                <div className="divider" />
                <div className="row bold" style={{ fontSize: '14px' }}>
                  <span>TOTAL</span>
                  <span>{formatPrice(order.total ?? 0)}</span>
                </div>
                {paymentMethod && (
                  <>
                    <div className="divider" />
                    <div className="row">
                      <span>Método:</span>
                      <span className="bold">
                        {paymentMethod === 'efectivo' ? 'Efectivo' : paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Nequi'}
                      </span>
                    </div>
                    {paymentMethod === 'efectivo' && paymentReceived && (
                      <>
                        <div className="row">
                          <span>Recibido:</span>
                          <span>{formatPrice(paymentReceived)}</span>
                        </div>
                        <div className="row bold">
                          <span>Cambio:</span>
                          <span>{formatPrice(paymentChange || 0)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="divider" />
                <div className="center">
                  <p>¡Gracias por tu compra!</p>
                  <p>Espera tu número: <span className="bold">{order.locator}</span></p>
                </div>
              </>
            ) : (
              <>
                <div className="center">
                  <p className="bold">COMANDA - COCINA</p>
                  <p>{dateStr}</p>
                  <div className="divider" />
                  <p className="locator">{order.locator}</p>
                </div>
                <div className="divider" />
                {validItems.map((item) => (
                  <div key={item.id}>
                    <p className="kitchen-item">
                      {item.quantity}x {item.products?.name ?? 'Producto'}
                    </p>
                    {item.notes && <p className="kitchen-notes">⚠️ {item.notes}</p>}
                  </div>
                ))}
                <div className="divider" />
                <div className="center">
                  <p className="bold">
                    Items: {validItems.reduce((s, i) => s + (i.quantity ?? 0), 0)}
                  </p>
                </div>
                {order.notes && (
                  <>
                    <div className="divider" />
                    <p className="bold">NOTAS: {order.notes}</p>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" size="touch" className="flex-1" onClick={onClose}>
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