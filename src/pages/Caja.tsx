import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { supabase } from "@/lib/supabase";
import { getShiftStart } from "@/lib/shiftUtils";
import { toast } from "sonner";
import { OrderCard } from "@/components/OrderCard";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { OrderReceipt } from "@/components/OrderReceipt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  Loader2,
  Clock,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

interface ReceiptState {
  order: Order;
  type: "customer" | "kitchen";
  paymentMethod?: string;
  paymentReceived?: number;
  paymentChange?: number;
  paymentBreakdown?: { efectivo?: number; tarjeta?: number; nequi?: number };
}

export default function Caja() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStore } = useStore();
  const {
    updateOrderStatus,
    getOrdersByStatus,
    getCompletedOrders,
    processPayment,
    toggleOrderItem,
  } = useOrders();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [isClosing, setIsClosing] = useState(false);

  const handleGenerateClosing = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      const now = new Date();
      const shiftStart = getShiftStart();

      const { data, error } = await supabase.rpc("generate_cash_closing", {
        p_period_start: shiftStart.toISOString(),
        p_period_end: now.toISOString(),
        p_store_id: activeStore?.id,
        p_notes: `Cierre generado desde Caja por ${user?.name || "Usuario"}`,
      });

      if (error) throw error;

      toast.success("Cierre de caja generado correctamente");
      console.log("Cierre generado:", data);
      // Opcional: navegar a reportes para ver el cierre
      navigate("/reporteria");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al generar cierre: ${msg}`);
    } finally {
      setIsClosing(false);
    }
  };

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

  const pendientes = getOrdersByStatus("pendiente");
  const confirmados = getOrdersByStatus("confirmado");
  const enCocina = getOrdersByStatus("en_preparacion");
  const listos = getOrdersByStatus("listo");
  const completados = getCompletedOrders();

  const cajeroName = user?.name ?? "Cajero";

  const handlePaymentComplete = async (
    method: string,
    received: number,
    breakdown?: { efectivo?: number; tarjeta?: number; nequi?: number },
  ) => {
    if (!payingOrder) return;
    const change = Math.max(0, received - payingOrder.total);
    await processPayment(payingOrder.id, method, received, breakdown);

    // Auto-imprimir factura del cliente
    const receiptData: ReceiptData = {
      order: payingOrder,
      cajeroName,
      paymentMethod: method,
      paymentReceived: received,
      paymentChange: change,
      paymentBreakdown: breakdown,
    };
    // Esperar a que se imprima la factura
    await silentPrint(
      buildCustomerReceiptHTML(receiptData),
      `Recibo - ${payingOrder.locator}`,
    );

    // Agrupar productos por categoría para comandas separadas
    const items = (payingOrder.order_items ?? []).filter(
      (i) => i.products != null,
    );
    const categoryGroups: Record<string, OrderItem[]> = {};

    items.forEach((item) => {
      const catName = item.products?.categories?.name || "General";
      if (!categoryGroups[catName]) categoryGroups[catName] = [];
      categoryGroups[catName].push(item);
    });

    const categoryKeys = Object.keys(categoryGroups);

    // Auto-imprimir comanda de cocina (esperando una tras otra)
    for (const catName of categoryKeys) {
      await silentPrint(
        buildKitchenReceiptHTML(receiptData, categoryGroups[catName]),
      );
    }

    // Solo cerrar el modal cuando TODO haya terminado de imprimirse
    setPayingOrder(null);
  };

  const handleShowKitchenReceipt = (order: Order) => {
    setReceipt({ order, type: "kitchen" });
  };

  const handleReprintCustomer = (order: Order) => {
    const lastPayment = order.payments?.[0];
    setReceipt({
      order,
      type: "customer",
      paymentMethod: lastPayment?.method,
      paymentReceived: lastPayment?.amount_received,
      paymentChange: lastPayment?.amount_change,
      paymentBreakdown: lastPayment
        ? {
            efectivo: lastPayment.amount_efectivo,
            tarjeta: lastPayment.amount_tarjeta,
            nequi: lastPayment.amount_nequi,
          }
        : undefined,
    });
  };

  return (
    <ErrorBoundary>
      <div className="section-container space-y-8 lg:space-y-16 pb-32 animate-in fade-in duration-700">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 bg-white/40 backdrop-blur-md p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[3.5rem] border-2 border-accent/20 shadow-soft">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-2xl">
                <DollarSign className="h-8 w-8 text-primary" strokeWidth={3} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  GESTIÓN DE PUNTO DE VENTA
                </div>
                <h1 className="text-6xl font-black tracking-tighter text-foreground">
                  Caja & Pedidos
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground font-medium text-xl leading-relaxed max-w-2xl">
              Control total del flujo de órdenes, cobros y cierres de turno en{" "}
              <span className="text-primary font-bold">
                {activeStore?.name}
              </span>
              .
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Button
              size="lg"
              className="rounded-3xl h-20 px-10 bg-primary hover:bg-primary/90 text-white font-black text-lg shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group"
              onClick={() => navigate("/kiosko")}
            >
              <Plus
                className="h-6 w-6 mr-3 group-hover:rotate-90 transition-transform duration-500"
                strokeWidth={3}
              />
              NUEVA VENTA
            </Button>
          </div>
        </div>

        <Tabs defaultValue="pendientes" className="w-full">
          <div className="bg-white/60 backdrop-blur-xl p-3 rounded-[2.5rem] border-2 border-accent/20 shadow-soft mb-12 sticky top-24 z-40 overflow-x-auto no-scrollbar">
            <TabsList className="bg-transparent h-auto p-0 flex-nowrap w-full justify-start lg:justify-between gap-3">
              {[
                {
                  id: "pendientes",
                  label: "PENDIENTES",
                  count: pendientes.length,
                  icon: Clock,
                },
                {
                  id: "confirmados",
                  label: "POR COBRAR",
                  count: confirmados.length,
                  icon: DollarSign,
                },
                {
                  id: "cocina",
                  label: "EN COCINA",
                  count: enCocina.length,
                  icon: Loader2,
                },
                {
                  id: "listos",
                  label: "LISTOS",
                  count: listos.length,
                  icon: CheckCircle,
                },
                {
                  id: "historial",
                  label: "HISTORIAL",
                  count: completados.length,
                  icon: History,
                },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-2xl px-8 py-5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-strong transition-all font-black text-[11px] uppercase tracking-widest flex items-center gap-3 border-2 border-transparent data-[state=active]:border-primary/5 min-w-[180px]"
                >
                  <tab.icon
                    className={cn(
                      "h-4 w-4",
                      tab.id === "cocina" && "animate-spin",
                    )}
                    strokeWidth={3}
                  />
                  {tab.label}
                  <Badge className="bg-primary text-white border-none rounded-xl h-6 min-w-[24px] px-1.5 flex items-center justify-center font-black text-[10px] ml-auto shadow-md">
                    {tab.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent
            value="pendientes"
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none"
          >
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {pendientes.length === 0 ? (
                <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                    <Clock className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                    Sin pedidos pendientes
                  </p>
                </div>
              ) : (
                pendientes.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    className="bg-white/60 backdrop-blur-md"
                    actions={
                      <div className="flex gap-4 w-full">
                        <Button
                          className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90 text-white shadow-strong shadow-primary/10 transition-all active:scale-95"
                          onClick={() =>
                            updateOrderStatus(order.id, "confirmado")
                          }
                          disabled={order.isOptimistic}
                        >
                          {order.isOptimistic ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle
                              className="h-4 w-4 mr-2"
                              strokeWidth={3}
                            />
                          )}
                          CONFIRMAR
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] bg-white border-2 border-accent/20 hover:bg-accent/5 transition-all"
                          onClick={() => navigate(`/kiosko?edit=${order.id}`)}
                          disabled={order.isOptimistic}
                        >
                          <Edit className="h-4 w-4 mr-2" strokeWidth={3} />{" "}
                          EDITAR
                        </Button>
                        <Button
                          variant="ghost"
                          className="rounded-2xl h-14 w-14 text-destructive hover:bg-destructive/5 border-2 border-transparent hover:border-destructive/10 transition-all"
                          onClick={() =>
                            updateOrderStatus(order.id, "cancelado")
                          }
                          disabled={order.isOptimistic}
                        >
                          <XCircle className="h-5 w-5" strokeWidth={3} />
                        </Button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="confirmados"
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none"
          >
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {confirmados.length === 0 ? (
                <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                    <DollarSign className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                    Nada por cobrar
                  </p>
                </div>
              ) : (
                confirmados.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    className="bg-white/80 backdrop-blur-md border-primary/20 shadow-xl shadow-primary/5"
                    actions={
                      <Button
                        size="lg"
                        className="w-full rounded-2xl h-16 font-black text-xs uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-strong shadow-primary/20 group relative overflow-hidden transition-all active:scale-95"
                        onClick={() => setPayingOrder(order)}
                        disabled={order.isOptimistic}
                      >
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        {order.isOptimistic ? (
                          <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                        ) : (
                          <DollarSign
                            className="h-5 w-5 mr-3 group-hover:scale-125 transition-transform duration-500"
                            strokeWidth={3}
                          />
                        )}
                        REGISTRAR PAGO & ENVIAR
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="cocina"
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none"
          >
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {enCocina.length === 0 ? (
                <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-muted-foreground/60 animate-spin" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                    La cocina está al día
                  </p>
                </div>
              ) : (
                enCocina.map((order) => {
                  const validItems = (order.order_items ?? []).filter(
                    (item) => item != null && item.products != null,
                  );
                  const allChecked =
                    validItems.length > 0 &&
                    validItems.every((item) => item.is_completed);

                  return (
                    <OrderCard
                      key={order.id}
                      order={order}
                      checkable={true}
                      onToggleItem={toggleOrderItem}
                      className="bg-white/60 backdrop-blur-md border-blue-500/10"
                      actions={
                        <div className="flex flex-col gap-4 w-full">
                          <Button
                            size="lg"
                            className={cn(
                              "w-full rounded-2xl h-16 font-black uppercase tracking-widest text-[11px] transition-all duration-500 shadow-strong active:scale-95",
                              allChecked
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                                : "bg-accent/10 text-muted-foreground/40 border-2 border-transparent cursor-not-allowed",
                            )}
                            onClick={() =>
                              handleUpdateStatus(order.id, "listo")
                            }
                            disabled={updatingIds.has(order.id) || !allChecked}
                          >
                            {updatingIds.has(order.id) ? (
                              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                            ) : (
                              <CheckCircle
                                className="h-5 w-5 mr-3"
                                strokeWidth={3}
                              />
                            )}
                            MARCAR COMO LISTO
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full rounded-2xl h-14 border-2 border-accent/20 font-black uppercase tracking-widest text-[10px] hover:bg-accent/5 transition-all"
                            onClick={() => handleShowKitchenReceipt(order)}
                          >
                            <Printer className="h-4 w-4 mr-2" strokeWidth={3} />{" "}
                            REIMPRIMIR COMANDA
                          </Button>
                        </div>
                      }
                    />
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="listos"
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none"
          >
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {listos.length === 0 ? (
                <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                    No hay pedidos listos
                  </p>
                </div>
              ) : (
                listos.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    compact
                    className="bg-white/80 backdrop-blur-md border-green-500/20 shadow-xl shadow-green-500/5"
                    actions={
                      <Button
                        size="lg"
                        className="w-full rounded-2xl h-16 font-black uppercase tracking-widest text-[11px] bg-green-500 hover:bg-green-600 text-white shadow-strong shadow-green-500/20 transition-all active:scale-95"
                        onClick={() => updateOrderStatus(order.id, "entregado")}
                      >
                        <CheckCircle className="h-5 w-5 mr-3" strokeWidth={3} />{" "}
                        ENTREGAR PEDIDO
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="historial"
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 outline-none"
          >
            <div className="space-y-12">
              {/* Cash Closing Section */}
              <div className="bg-linear-to-br from-primary/5 via-white/40 to-accent/20 backdrop-blur-md border-2 border-primary/20 p-12 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-12 group shadow-strong relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-150 transition-transform duration-1000">
                  <DollarSign
                    className="h-48 w-48 text-primary"
                    strokeWidth={3}
                  />
                </div>

                <div className="space-y-4 text-center lg:text-left relative z-10">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px] mb-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    ADMINISTRACIÓN DE TURNO
                  </div>
                  <h3 className="text-4xl font-black tracking-tighter text-foreground">
                    Cierre de Caja Diario
                  </h3>
                  <p className="text-muted-foreground font-medium text-xl leading-relaxed max-w-xl">
                    Consolida todas las transacciones del turno actual y genera
                    el reporte oficial de ventas para administración.
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={handleGenerateClosing}
                  disabled={isClosing || completados.length === 0}
                  className="rounded-3xl h-20 px-12 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all relative z-10 group"
                >
                  {isClosing ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-4" />
                  ) : (
                    <DollarSign
                      className="h-6 w-6 mr-4 group-hover:scale-125 transition-transform duration-500"
                      strokeWidth={3}
                    />
                  )}
                  REALIZAR CIERRE DE TURNO
                </Button>
              </div>

              <div className="grid gap-6">
                {completados.length === 0 ? (
                  <div className="py-40 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                    <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                      <History className="h-10 w-10 text-muted-foreground/60" />
                    </div>
                    <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                      Sin historial en este turno
                    </p>
                  </div>
                ) : (
                  completados.map((order, idx) => {
                    const isEntregado = order.status === "entregado";
                    const hora = new Intl.DateTimeFormat("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }).format(
                      order.created_at
                        ? new Date(order.created_at)
                        : new Date(),
                    );

                    return (
                      <div
                        key={order.id}
                        className="bg-white/40 backdrop-blur-md border-2 border-accent/10 hover:border-primary/20 p-8 rounded-[2.5rem] flex flex-col sm:flex-row sm:items-center justify-between gap-8 group transition-all duration-500 shadow-soft hover:shadow-xl"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center gap-8">
                          <div
                            className={cn(
                              "w-20 h-20 rounded-3xl flex flex-col items-center justify-center border-2 shadow-inner transition-all duration-500 group-hover:scale-110",
                              isEntregado
                                ? "bg-accent/10 text-primary border-primary/5"
                                : "bg-destructive/5 text-destructive border-destructive/10",
                            )}
                          >
                            <span className="text-[9px] font-black leading-none opacity-40 uppercase tracking-widest mb-1">
                              #LOC
                            </span>
                            <span className="text-2xl font-black tracking-tighter">
                              {order.locator}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <StatusBadge status={order.status} />
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
                                <Clock className="h-3 w-3" />
                                {hora}
                              </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-3xl font-black tracking-tighter text-foreground">
                                {formatPrice(order.total ?? 0)}
                              </p>
                              <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                                • {(order.order_items ?? []).length} ITEMS
                              </span>
                            </div>
                          </div>
                        </div>

                        {isEntregado && (
                          <Button
                            variant="outline"
                            className="rounded-2xl h-14 border-2 border-accent/20 font-black text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-accent/5 transition-all active:scale-95 shadow-soft"
                            onClick={() => handleReprintCustomer(order)}
                          >
                            <RotateCcw
                              className="h-4 w-4 mr-3"
                              strokeWidth={3}
                            />{" "}
                            REIMPRIMIR FACTURA
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
          paymentBreakdown={receipt.paymentBreakdown}
        />
      )}
    </ErrorBoundary>
  );
}
