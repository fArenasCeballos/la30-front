import { useState } from 'react';
import { useOrders } from '@/context/OrderContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { ChefHat, CheckCheck, Clock, MapPin, Loader2, CheckCircle } from 'lucide-react';
import type { OrderStatus } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { cn } from '@/lib/utils';

export default function Cocina() {
  const { getOrdersByStatus, updateOrderStatus, toggleOrderItem } = useOrders();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const confirmados = getOrdersByStatus('confirmado') || [];
  const enPreparacion = getOrdersByStatus('en_preparacion') || [];
  const listos = getOrdersByStatus('listo') || [];

  // ... handleUpdateStatus ...
  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    if (updatingIds.has(orderId)) return;

    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });

    try {
      await updateOrderStatus(orderId, status);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

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

      <ErrorBoundary>
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
                {(order.order_items || []).map((item) => (
                  <div key={item.id} className="flex gap-2 text-sm">
                    <span className="font-bold text-primary">{item.quantity}x</span>
                    <span>{item.products?.name || "Producto desconocido"}</span>
                    {item.notes && <span className="text-muted-foreground">• {item.notes}</span>}
                  </div>
                ))}
              </div>
              <Button
                size="touch"
                className="w-full"
                onClick={() => handleUpdateStatus(order.id, 'en_preparacion')}
                disabled={updatingIds.has(order.id)}
              >
                {updatingIds.has(order.id) ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <ChefHat className="h-5 w-5 mr-2" />
                )}
                Preparar
              </Button>
            </div>
          ))}

          {/* In preparation */}
          {enPreparacion.map(order => {
            const validItems = (order.order_items ?? []).filter(item => item != null && item.products != null);
            const allChecked = validItems.length > 0 && validItems.every(item => item.is_completed);

            return (
            <div key={order.id} className="rounded-xl border-2 border-preparing bg-preparing/10 p-4 animate-pulse-glow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-preparing" />
                  <span className="font-display text-2xl font-bold">{order.locator}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="space-y-2 mb-4">
                {validItems.map((item) => (
                  <div key={item.id} className="flex gap-2 text-sm items-center">
                    <input
                      type="checkbox"
                      checked={!!item.is_completed}
                      onChange={(e) => toggleOrderItem(item.id, e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-preparing focus:ring-preparing shrink-0 cursor-pointer"
                    />
                    <div className={cn("flex-1", item.is_completed && "line-through text-muted-foreground opacity-70")}>
                      <span className="font-bold text-preparing mr-2">{item.quantity}x</span>
                      <span>{item.products?.name || "Producto desconocido"}</span>
                      {item.notes && <span className="text-muted-foreground ml-1">• {item.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                size="touch"
                variant="success"
                className="w-full"
                onClick={() => handleUpdateStatus(order.id, 'listo')}
                disabled={updatingIds.has(order.id) || !allChecked}
              >
                {updatingIds.has(order.id) ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <CheckCheck className="h-5 w-5 mr-2" />
                )}
                ¡Listo!
              </Button>
            </div>
            );
          })}

          {/* Ready */}
          {listos.map(order => (
            <div key={order.id} className="rounded-xl border-2 border-success bg-success/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-success" />
                  <span className="font-display text-3xl font-bold">{order.locator}</span>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="space-y-3">
                <p className="text-center text-success font-display font-bold text-lg">
                  LLAMAR CLIENTE
                </p>
                <Button
                  size="touch"
                  variant="outline"
                  className="w-full border-success text-success hover:bg-success hover:text-white"
                  onClick={() => handleUpdateStatus(order.id, 'entregado')}
                  disabled={updatingIds.has(order.id)}
                >
                  {updatingIds.has(order.id) ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  )}
                  Marcar Entregado
                </Button>
              </div>
            </div>
          ))}

          {confirmados.length === 0 && enPreparacion.length === 0 && listos.length === 0 && (
            <div className="col-span-full text-center py-20">
              <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-xl opacity-50">Sin pedidos activos</p>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
