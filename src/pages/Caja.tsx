import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { OrderCard } from "@/components/OrderCard";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { OrderReceipt } from "@/components/OrderReceipt";
import {
  buildCustomerReceiptHTML,
  buildKitchenReceiptHTML,
  silentPrint,
} from "@/lib/receiptUtils";
import type { ReceiptData } from "@/lib/receiptUtils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  DollarSign,
  Printer,
  Edit,
  Plus,
  History,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import type { Order } from "@/types";

interface ReceiptState {
  order: Order;
  type: "customer" | "kitchen";
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
}

export default function Caja() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    updateOrderStatus,
    getOrdersByStatus,
    getCompletedOrders,
    processPayment,
  } = useOrders();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  const pendientes = getOrdersByStatus("pendiente");
  const confirmados = getOrdersByStatus("confirmado");
  const enCocina = getOrdersByStatus("en_preparacion");
  const listos = getOrdersByStatus("listo");
  const completados = getCompletedOrders();

  const cajeroName = user?.name ?? "Cajero";

  const handlePaymentComplete = async (method: string, received: number) => {
    if (!payingOrder) return;
    const change = Math.max(0, received - payingOrder.total);
    await processPayment(payingOrder.id, method, received);

    // Auto-imprimir factura del cliente
    const receiptData: ReceiptData = {
      order: payingOrder,
      cajeroName,
      paymentMethod: method,
      paymentReceived: received,
      paymentChange: change,
    };
    silentPrint(
      buildCustomerReceiptHTML(receiptData),
      `Recibo - ${payingOrder.locator}`
    );

    // Auto-imprimir comanda de cocina (con un pequeño delay para que el navegador procese la primera)
    setTimeout(() => {
      silentPrint(
        buildKitchenReceiptHTML(receiptData),
        `Comanda - ${payingOrder.locator}`
      );
    }, 800);

    setPayingOrder(null);
  };

  const handleShowKitchenReceipt = (order: Order) => {
    setReceipt({ order, type: "kitchen" });
  };

  const handleReprintCustomer = (order: Order) => {
    setReceipt({ order, type: "customer" });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl sm:text-2xl font-bold">Caja</h1>
        <Button
          size="touch"
          variant="default"
          className="shadow-sm"
          onClick={() => navigate("/kiosko")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger
            value="pendientes"
            className="touch-target text-xs sm:text-sm"
          >
            Pendientes ({pendientes.length})
          </TabsTrigger>
          <TabsTrigger
            value="confirmados"
            className="touch-target text-xs sm:text-sm"
          >
            Confirmados ({confirmados.length})
          </TabsTrigger>
          <TabsTrigger
            value="cocina"
            className="touch-target text-xs sm:text-sm"
          >
            En Cocina ({enCocina.length})
          </TabsTrigger>
          <TabsTrigger
            value="listos"
            className="touch-target text-xs sm:text-sm"
          >
            Listos ({listos.length})
          </TabsTrigger>
          <TabsTrigger
            value="historial"
            className="touch-target text-xs sm:text-sm"
          >
            <History className="h-3.5 w-3.5 mr-1" />
            Historial ({completados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap">
                    <Button
                      size="touch"
                      className="flex-1 text-xs sm:text-sm"
                      onClick={() =>
                        updateOrderStatus(order.id, "confirmado")
                      }
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Confirmar
                    </Button>
                    <Button
                      size="touch"
                      variant="outline"
                      className="flex-1 text-xs sm:text-sm"
                      onClick={() => navigate(`/kiosko?edit=${order.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button
                      size="touch"
                      variant="destructive"
                      className="text-xs sm:text-sm"
                      onClick={() =>
                        updateOrderStatus(order.id, "cancelado")
                      }
                    >
                      Cancelar
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="confirmados">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="flex-1 text-xs sm:text-sm"
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
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enCocina.length === 0 && (
              <p className="text-muted-foreground col-span-full py-12 text-center">
                No hay pedidos en cocina
              </p>
            )}
            {enCocina.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                compact
                actions={
                  <Button
                    size="touch"
                    variant="outline"
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => handleShowKitchenReceipt(order)}
                  >
                    <Printer className="h-4 w-4 mr-1" /> Reimprimir Comanda
                  </Button>
                }
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="listos">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() =>
                      updateOrderStatus(order.id, "entregado")
                    }
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Marcar
                    Entregado
                  </Button>
                }
              />
            ))}
          </div>
        </TabsContent>

        {/* ── HISTORIAL DEL DÍA ──────────────────────────── */}
        <TabsContent value="historial">
          <div className="space-y-3">
            {completados.length === 0 && (
              <p className="text-muted-foreground py-12 text-center">
                No hay pedidos completados en este turno
              </p>
            )}
            {completados.map((order) => {
              const total = order.total ?? 0;
              const itemCount = (order.order_items ?? []).length;
              const isEntregado = order.status === "entregado";
              const createdAt = order.created_at
                ? new Date(order.created_at)
                : new Date();
              const hora = new Intl.DateTimeFormat("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }).format(createdAt);

              return (
                <div
                  key={order.id}
                  className="pos-card flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl font-bold font-display">
                        #{order.locator}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {hora}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isEntregado ? "default" : "destructive"}
                          className="text-[10px] h-5"
                        >
                          {isEntregado ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Entregado
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancelado
                            </>
                          )}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {itemCount}{" "}
                          {itemCount === 1 ? "producto" : "productos"}
                        </span>
                      </div>
                      <p className="text-lg font-bold mt-1">
                        {formatPrice(total)}
                      </p>
                    </div>
                  </div>

                  {isEntregado && (
                    <Button
                      size="touch"
                      variant="outline"
                      className="shrink-0 text-xs sm:text-sm"
                      onClick={() => handleReprintCustomer(order)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Reimprimir
                    </Button>
                  )}
                </div>
              );
            })}
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
          onClose={() => setReceipt(null)}
          type={receipt.type}
          paymentMethod={receipt.paymentMethod}
          paymentReceived={receipt.paymentReceived}
          paymentChange={receipt.paymentChange}
        />
      )}
    </div>
  );
}
