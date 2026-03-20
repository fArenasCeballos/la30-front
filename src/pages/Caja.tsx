import { useState } from "react";
import { useOrders } from "@/context/OrderContext";
import { OrderCard } from "@/components/OrderCard";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, DollarSign } from "lucide-react";
import type { Order } from "@/types";

export default function Caja() {
  const { updateOrderStatus, getOrdersByStatus } = useOrders();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const pendientes = getOrdersByStatus("pendiente");
  const confirmados = getOrdersByStatus("confirmado");
  const enCocina = getOrdersByStatus("en_preparacion");
  const listos = getOrdersByStatus("listo");

  const handlePaymentComplete = () => {
    if (!payingOrder) return;
    updateOrderStatus(payingOrder.id, "en_preparacion");
    setPayingOrder(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Caja</h1>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="pendientes" className="touch-target">
            Pendientes ({pendientes.length})
          </TabsTrigger>
          <TabsTrigger value="confirmados" className="touch-target">
            Confirmados ({confirmados.length})
          </TabsTrigger>
          <TabsTrigger value="cocina" className="touch-target">
            En Cocina ({enCocina.length})
          </TabsTrigger>
          <TabsTrigger value="listos" className="touch-target">
            Listos ({listos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendientes.length === 0 && (
              <p className="text-muted-foreground col-span-full py-12 text-center">
                No hay pedidos pendientes
              </p>
            )}
            {pendientes.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <>
                    <Button
                      size="touch"
                      className="flex-1"
                      onClick={() => updateOrderStatus(order.id, "confirmado")}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Confirmar
                    </Button>
                    <Button
                      size="touch"
                      variant="destructive"
                      onClick={() => updateOrderStatus(order.id, "cancelado")}
                    >
                      Cancelar
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="confirmados">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confirmados.length === 0 && (
              <p className="text-muted-foreground col-span-full py-12 text-center">
                No hay pedidos confirmados
              </p>
            )}
            {confirmados.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <Button
                    size="touch"
                    className="flex-1"
                    onClick={() => setPayingOrder(order)}
                  >
                    <DollarSign className="h-4 w-4 mr-1" /> Cobrar y Enviar a
                    Cocina
                  </Button>
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cocina">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enCocina.length === 0 && (
              <p className="text-muted-foreground col-span-full py-12 text-center">
                No hay pedidos en cocina
              </p>
            )}
            {enCocina.map((order) => (
              <OrderCard key={order.id} order={order} compact />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="listos">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listos.length === 0 && (
              <p className="text-muted-foreground col-span-full py-12 text-center">
                No hay pedidos listos
              </p>
            )}
            {listos.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                compact
                actions={
                  <Button
                    size="touch"
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, "entregado")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Marcar Entregado
                  </Button>
                }
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {payingOrder && (
        <PaymentCalculator
          order={payingOrder}
          open={!!payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </div>
  );
}
