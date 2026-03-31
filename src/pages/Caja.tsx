import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { OrderCard } from "@/components/OrderCard";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { OrderReceipt } from '@/components/OrderReceipt';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, DollarSign, Printer, Edit } from "lucide-react";
import type { Order } from "@/types";

interface ReceiptState {
  order: Order;
  type: 'customer' | 'kitchen';
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
}

export default function Caja() {
  const navigate = useNavigate();
  const { updateOrderStatus, getOrdersByStatus, processPayment } = useOrders();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  const pendientes = getOrdersByStatus("pendiente");
  const confirmados = getOrdersByStatus("confirmado");
  const enCocina = getOrdersByStatus("en_preparacion");
  const listos = getOrdersByStatus("listo");

  const handlePaymentComplete = async (method: string, received: number) => {
    if (!payingOrder) return;
    const change = Math.max(0, received - payingOrder.total);
    await processPayment(payingOrder.id, method, received);

     // Show customer receipt first
    setReceipt({
      order: payingOrder,
      type: 'customer',
      paymentMethod: method,
      paymentReceived: received,
      paymentChange: change,
    });
    setPayingOrder(null);
  };

  const handleShowKitchenReceipt = (order: Order) => {
    setReceipt({ order, type: 'kitchen' });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <h1 className="font-display text-xl sm:text-2xl font-bold">Caja</h1>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="pendientes" className="touch-target text-xs sm:text-sm">
            Pendientes ({pendientes.length})
          </TabsTrigger>
          <TabsTrigger value="confirmados" className="touch-target text-xs sm:text-sm">
            Confirmados ({confirmados.length})
          </TabsTrigger>
          <TabsTrigger value="cocina" className="touch-target text-xs sm:text-sm">
            En Cocina ({enCocina.length})
          </TabsTrigger>
          <TabsTrigger value="listos" className="touch-target text-xs sm:text-sm">
            Listos ({listos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendientes.length === 0 && <p className="text-muted-foreground col-span-full py-12 text-center">No hay pedidos pendientes</p>}
            {pendientes.map(order => (
              <OrderCard key={order.id} order={order} actions={
                <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap">
                  <Button size="touch" className="flex-1 text-xs sm:text-sm" onClick={() => updateOrderStatus(order.id, 'confirmado')}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Confirmar
                  </Button>
                  <Button size="touch" variant="outline" className="flex-1 text-xs sm:text-sm" onClick={() => navigate(`/kiosko?edit=${order.id}`)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button size="touch" variant="destructive" className="text-xs sm:text-sm" onClick={() => updateOrderStatus(order.id, 'cancelado')}>
                    Cancelar
                  </Button>
                </div>
              } />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="confirmados">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confirmados.length === 0 && <p className="text-muted-foreground col-span-full py-12 text-center">No hay pedidos confirmados</p>}
            {confirmados.map(order => (
              <OrderCard key={order.id} order={order} actions={
                <Button size="touch" className="flex-1 text-xs sm:text-sm" onClick={() => setPayingOrder(order)}>
                  <DollarSign className="h-4 w-4 mr-1" /> Cobrar y Enviar a Cocina
                </Button>
              } />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cocina">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enCocina.length === 0 && <p className="text-muted-foreground col-span-full py-12 text-center">No hay pedidos en cocina</p>}
            {enCocina.map(order => (
              <OrderCard key={order.id} order={order} compact actions={
                <Button size="touch" variant="outline" className="flex-1 text-xs sm:text-sm" onClick={() => handleShowKitchenReceipt(order)}>
                  <Printer className="h-4 w-4 mr-1" /> Reimprimir Comanda
                </Button>
              } />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="listos">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listos.length === 0 && <p className="text-muted-foreground col-span-full py-12 text-center">No hay pedidos listos</p>}
            {listos.map(order => (
              <OrderCard key={order.id} order={order} compact actions={
                <Button size="touch" variant="outline" className="flex-1 text-xs sm:text-sm" onClick={() => updateOrderStatus(order.id, 'entregado')}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Marcar Entregado
                </Button>
              } />
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

      {receipt && (
        <OrderReceipt
          order={receipt.order}
          open={!!receipt}
          onClose={() => {
            // After customer receipt, show kitchen receipt
            if (receipt.type === 'customer') {
              setReceipt({ order: receipt.order, type: 'kitchen' });
            } else {
              setReceipt(null);
            }
          }}
          type={receipt.type}
          paymentMethod={receipt.paymentMethod}
          paymentReceived={receipt.paymentReceived}
          paymentChange={receipt.paymentChange}
        />
      )}
    </div>
  );
}
