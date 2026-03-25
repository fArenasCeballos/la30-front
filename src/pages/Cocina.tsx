import { useOrders } from '@/context/OrderContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { ChefHat, CheckCheck, Clock, MapPin } from 'lucide-react';

export default function Cocina() {
  const { getOrdersByStatus, updateOrderStatus } = useOrders();

  const confirmados = getOrdersByStatus('confirmado');
  const enPreparacion = getOrdersByStatus('en_preparacion');
  const listos = getOrdersByStatus('listo');

  return (
    <div className="min-h-screen bg-foreground text-background p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-6">
        <ChefHat className="h-8 w-8 text-primary" />
        <h1 className="font-display text-3xl font-bold">Cocina</h1>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> {confirmados.length} por hacer
          </span>
          <span className="flex items-center gap-1 text-preparing">
            <ChefHat className="h-4 w-4" /> {enPreparacion.length} en preparación
          </span>
          <span className="flex items-center gap-1 text-success">
            <CheckCheck className="h-4 w-4" /> {listos.length} listos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Confirmed orders - ready to prepare */}
        {confirmados.map(order => (
          <div key={order.id} className="rounded-xl border border-border/20 bg-secondary/10 p-4 animate-slide-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="font-display text-2xl font-bold">{order.locator}</span>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="space-y-2 mb-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex gap-2 text-sm">
                  <span className="font-bold text-primary">{item.quantity}x</span>
                  <span>{item.products.name}</span>
                  {item.notes && <span className="text-muted-foreground">• {item.notes}</span>}
                </div>
              ))}
            </div>
            <Button
              size="touch"
              className="w-full"
              onClick={() => updateOrderStatus(order.id, 'en_preparacion')}
            >
              <ChefHat className="h-5 w-5 mr-2" /> Preparar
            </Button>
          </div>
        ))}

        {/* In preparation */}
        {enPreparacion.map(order => (
          <div key={order.id} className="rounded-xl border-2 border-preparing bg-preparing/10 p-4 animate-pulse-glow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-preparing" />
                <span className="font-display text-2xl font-bold">{order.locator}</span>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="space-y-2 mb-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex gap-2 text-sm">
                  <span className="font-bold text-preparing">{item.quantity}x</span>
                  <span>{item.products.name}</span>
                  {item.notes && <span className="text-muted-foreground">• {item.notes}</span>}
                </div>
              ))}
            </div>
            <Button
              size="touch"
              variant="success"
              className="w-full"
              onClick={() => updateOrderStatus(order.id, 'listo')}
            >
              <CheckCheck className="h-5 w-5 mr-2" /> ¡Listo!
            </Button>
          </div>
        ))}

        {/* Ready */}
        {listos.map(order => (
          <div key={order.id} className="rounded-xl border-2 border-success bg-success/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-success" />
                <span className="font-display text-3xl font-bold">{order.locator}</span>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-center text-success font-display font-bold text-lg mt-2">
              LLAMAR CLIENTE
            </p>
          </div>
        ))}

        {confirmados.length === 0 && enPreparacion.length === 0 && listos.length === 0 && (
          <div className="col-span-full text-center py-20">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl opacity-50">Sin pedidos activos</p>
          </div>
        )}
      </div>
    </div>
  );
}
