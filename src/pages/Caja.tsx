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
  buildShiftClosingReceiptHTML,
  buildPartialPaymentReceiptHTML,
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
  FileText,
  Zap,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { shouldGenerateInvoice } from "@/lib/siigoService";
import { SiigoInvoiceModal } from "@/components/SiigoInvoiceModal";

interface ReceiptState {
  order: Order;
  type: "customer" | "kitchen";
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

export default function Caja() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStore } = useStore();
  const {
    orders,
    updateOrderStatus,
    getOrdersByStatus,
    getCompletedOrders,
    processPayment,
    toggleOrderItem,
    refreshOrders,
  } = useOrders();
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [isClosing, setIsClosing] = useState(false);
  const [siigoOrder, setSiigoOrder] = useState<{
    order: Order;
    method: string;
    breakdown?: {
      efectivo?: number;
      tarjeta?: number;
      nequi?: number;
      tarjeta_credito?: number;
      tarjeta_debito?: number;
      daviplata?: number;
    };
  } | null>(null);

  const handleGenerateClosing = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      const now = new Date();
      const shiftStart = getShiftStart();

      // Obtener TODOS los pedidos completados del turno (mesa + domicilios)
      const allCompletedOrders = orders.filter((o) =>
        ["entregado", "cancelado"].includes(o.status),
      );

      // Imprimir tirilla de cierre de turno
      if (allCompletedOrders.length > 0) {
        const closingHTML = buildShiftClosingReceiptHTML({
          orders: allCompletedOrders,
          cajeroName,
          shiftStart,
          shiftEnd: now,
        });
        await silentPrint(closingHTML, "Cierre de Turno");
      }

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
      navigate("/administracion?tab=reportes");
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

  const pendientes = getOrdersByStatus("pendiente").filter(
    (o) => !o.is_delivery,
  );
  const confirmados = getOrdersByStatus("confirmado").filter(
    (o) => !o.is_delivery,
  );
  const enCocina = getOrdersByStatus("en_preparacion").filter(
    (o) => !o.is_delivery,
  );
  const listos = getOrdersByStatus("listo").filter((o) => !o.is_delivery);
  const completados = getCompletedOrders().filter((o) => !o.is_delivery);

  const cajeroName = user?.name ?? "Cajero";

  const handlePaymentComplete = async (
    method: string,
    received: number,
    breakdown?: {
      efectivo?: number;
      tarjeta?: number;
      nequi?: number;
      tarjeta_credito?: number;
      tarjeta_debito?: number;
      daviplata?: number;
    },
    sharedPayments?: Array<{
      method: string;
      subMethod?: string;
      amount: number;
    }>,
  ): Promise<boolean> => {
    if (!payingOrder) return false;
    const change = Math.max(0, received - payingOrder.total);
    const success = await processPayment(
      payingOrder.id,
      method,
      received,
      breakdown,
    );
    if (!success) return false;

    // Ejecutar tareas de Siigo y de Impresión en segundo plano sin bloquear el calculador
    (async () => {
      try {
        const activeOrder = payingOrder;

        // Abrir modal de facturación electrónica Siigo si aplica
        if (shouldGenerateInvoice(method, breakdown)) {
          setSiigoOrder({ order: activeOrder, method, breakdown });
        }

        // Auto-imprimir factura del cliente
        const receiptData: ReceiptData = {
          order: activeOrder,
          cajeroName,
          paymentMethod: method,
          paymentReceived: received,
          paymentChange: change,
          paymentBreakdown: breakdown,
          sharedPayments,
        };

        // Si es pago mixto/compartido, imprimir primero cada voucher individual
        if (method === "mixto" && sharedPayments && sharedPayments.length > 0) {
          for (let i = 0; i < sharedPayments.length; i++) {
            const p = sharedPayments[i];
            await silentPrint(
              buildPartialPaymentReceiptHTML(receiptData, p, i + 1, sharedPayments.length),
              `Voucher Parcial ${i + 1} - ${activeOrder.locator}`
            );
          }
        }

        // Luego imprimir factura completa del cliente
        await silentPrint(
          buildCustomerReceiptHTML(receiptData),
          `Recibo - ${activeOrder.locator}`,
        );

        // Agrupar productos por categoría para comandas separadas
        const items = (activeOrder.order_items ?? []).filter(
          (i) => i.products != null,
        );

        const categoryGroups: Record<string, OrderItem[]> = {};

        items.forEach((item) => {
          const catName = item.products?.categories?.name || "General";
          if (!categoryGroups[catName]) categoryGroups[catName] = [];
          categoryGroups[catName].push(item);
        });

        const categoryKeys = Object.keys(categoryGroups);

        // Auto-imprimir comanda de cocina agrupada en un único diálogo
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
      } catch (err) {
        console.error("Error in post-payment printing/Siigo pipeline:", err);
      }
    })();

    return true;
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
      <div className="section-container space-y-4 lg:space-y-6 pb-10 animate-in fade-in duration-300">
        <Tabs defaultValue="pendientes" className="w-full">
          <div className="bg-white/60 backdrop-blur-xl p-1 lg:p-2 rounded-2xl border-2 border-accent/20 shadow-sm mb-4 lg:mb-6 sticky top-14 lg:top-16 z-40 flex flex-col sm:flex-row items-center gap-2 lg:gap-4">
            <div className="flex-1 w-full overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent h-auto p-0 flex-nowrap w-full justify-start gap-1 lg:gap-2">
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
                    className="group rounded-lg lg:rounded-xl px-4 lg:px-8 py-2 lg:py-3 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-black text-[9px] lg:text-[11px] uppercase tracking-widest flex items-center gap-2 lg:gap-3 border-2 data-[state=active]:border-primary/5 min-w-30 lg:min-w-35"
                  >
                    <tab.icon
                      className={cn(
                        "h-5 w-5 lg:h-6 lg:w-6 shrink-0 transition-all duration-200 group-hover:scale-110 group-active:scale-95",
                        tab.id === "cocina" && "animate-spin",
                      )}
                      strokeWidth={2.5}
                    />
                    {tab.label}
                    <Badge className="bg-primary text-white border-none rounded-xl h-6 min-w-6 px-1.5 flex items-center justify-center font-black text-[10px] ml-auto shadow-md">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <Button
              size="sm"
              className="rounded-xl h-10 lg:h-12 px-4 lg:px-6 bg-primary hover:bg-primary/90 text-white font-black text-[10px] lg:text-xs shadow-md shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group shrink-0"
              onClick={() => navigate("/kiosko")}
            >
              <Plus
                className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-2 group-hover:rotate-90 transition-transform duration-200"
                strokeWidth={3}
              />
              NUEVA VENTA
            </Button>
          </div>

          <TabsContent
            value="pendientes"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
              {pendientes.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
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
                      <div className="flex gap-2 w-full">
                        <button
                          className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                          onClick={() =>
                            handleUpdateStatus(order.id, "confirmado")
                          }
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                        >
                          {order.isOptimistic || updatingIds.has(order.id) ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle
                              className="h-3 w-3 mr-1.5"
                              strokeWidth={3}
                            />
                          )}
                          CONFIRMAR
                        </button>
                        <button
                          className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-white border border-accent/20 hover:bg-accent/5 transition-all flex items-center justify-center disabled:opacity-50"
                          onClick={() => navigate(`/kiosko?edit=${order.id}`)}
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                        >
                          <Edit className="h-3 w-3 mr-1.5" strokeWidth={3} />{" "}
                          EDITAR
                        </button>
                        <button
                          className="rounded-xl h-9 w-9 text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/10 transition-all flex items-center justify-center disabled:opacity-50"
                          onClick={() =>
                            handleUpdateStatus(order.id, "cancelado")
                          }
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                        >
                          {updatingIds.has(order.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                          ) : (
                            <XCircle className="h-4 w-4" strokeWidth={3} />
                          )}
                        </button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="confirmados"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
              {confirmados.length === 0 ? (
                <div className="col-span-full py-10 lg:py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
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
                      <button
                        className="w-full rounded-xl h-10 font-black text-[10px] uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-sm group relative overflow-hidden transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                        onClick={() => setPayingOrder(order)}
                        disabled={order.isOptimistic}
                      >
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        {order.isOptimistic ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <DollarSign
                            className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform duration-200"
                            strokeWidth={3}
                          />
                        )}
                        COBRAR Y ENVIAR
                      </button>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="cocina"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
              {enCocina.length === 0 ? (
                <div className="col-span-full py-10 lg:py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
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
                        <div className="flex flex-col gap-2 w-full">
                          <button
                            className={cn(
                              "w-full rounded-xl h-10 font-black uppercase tracking-widest text-[10px] transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center",
                              allChecked
                                ? "bg-green-500 hover:bg-green-600 text-white"
                                : "bg-accent/10 text-muted-foreground/40 cursor-not-allowed",
                            )}
                            onClick={() =>
                              handleUpdateStatus(order.id, "listo")
                            }
                            disabled={updatingIds.has(order.id) || !allChecked}
                          >
                            {updatingIds.has(order.id) ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle
                                className="h-4 w-4 mr-2"
                                strokeWidth={3}
                              />
                            )}
                            LISTO
                          </button>
                          <button
                            className="w-full rounded-xl h-8 border border-accent/20 font-black uppercase tracking-widest text-[8px] hover:bg-accent/5 transition-all flex items-center justify-center"
                            onClick={() => handleShowKitchenReceipt(order)}
                          >
                            <Printer
                              className="h-3 w-3 mr-1.5"
                              strokeWidth={3}
                            />{" "}
                            REIMPRIMIR
                          </button>
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
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
              {listos.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
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
                      <button
                        className="w-full rounded-xl h-10 font-black uppercase tracking-widest text-[10px] bg-green-500 hover:bg-green-600 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                        onClick={() =>
                          handleUpdateStatus(order.id, "entregado")
                        }
                        disabled={updatingIds.has(order.id)}
                      >
                        {updatingIds.has(order.id) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle
                            className="h-4 w-4 mr-2"
                            strokeWidth={3}
                          />
                        )}
                        ENTREGAR
                      </button>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="historial"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            <div className="space-y-6 lg:space-y-8">
              {/* Cash Closing Section */}
              <div className="bg-linear-to-br from-primary/5 via-white/40 to-accent/20 backdrop-blur-md border-2 border-primary/20 p-6 lg:p-8 rounded-3xl flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8 group shadow-md relative overflow-hidden">
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
                  <h3 className="text-2xl lg:text-3xl font-black tracking-tighter text-foreground">
                    Cierre de Caja Diario
                  </h3>
                  <p className="text-muted-foreground font-medium text-base lg:text-lg leading-relaxed max-w-xl">
                    Consolida todas las transacciones del turno actual y genera
                    el reporte oficial de ventas para administración.
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={handleGenerateClosing}
                  disabled={isClosing || completados.length === 0}
                  className="rounded-2xl h-14 lg:h-16 px-8 lg:px-10 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-md shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all relative z-10 group"
                >
                  {isClosing ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-4" />
                  ) : (
                    <DollarSign
                      className="h-6 w-6 mr-4 group-hover:scale-125 transition-transform duration-200"
                      strokeWidth={3}
                    />
                  )}
                  REALIZAR CIERRE DE TURNO
                </Button>
              </div>

              <div className="grid gap-6">
                {completados.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
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

                    // Invoice status check
                    const successInvoice = order.siigo_invoices?.find(
                      (inv) => inv.status === "success",
                    );
                    const hasInvoice =
                      !!successInvoice || !!order.siigo_invoice_id;
                    const invoiceNumber =
                      successInvoice?.siigo_invoice_number ||
                      order.siigo_invoice_number ||
                      "Facturado";

                    // Reconstruct breakdown from payment for eligibility check
                    const lastPayment = order.payments?.[0];
                    const paymentMethod =
                      lastPayment?.method ?? order.payment_method;
                    const reconstructedBreakdown = lastPayment
                      ? {
                          efectivo: lastPayment.amount_efectivo ?? 0,
                          tarjeta: lastPayment.amount_tarjeta ?? 0,
                          nequi: lastPayment.amount_nequi ?? 0,
                        }
                      : undefined;
                    const canGenerateInvoice =
                      order.status !== "cancelado" &&
                      !hasInvoice &&
                      shouldGenerateInvoice(
                        paymentMethod ?? "efectivo",
                        reconstructedBreakdown,
                      );

                    return (
                      <div
                        key={order.id}
                        className="bg-white/40 backdrop-blur-md border-2 border-accent/10 hover:border-primary/20 p-4 lg:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6 group transition-all duration-200 shadow-sm hover:shadow-xl"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center gap-8">
                          <div
                            className={cn(
                              "w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-inner transition-all duration-200 group-hover:scale-110",
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
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusBadge status={order.status} />
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
                                <Clock className="h-3 w-3" />
                                {hora}
                              </div>
                              <div className="text-[10px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-full">
                                {order.profiles?.name
                                  ? `Mesero: ${order.profiles.name}`
                                  : "Kiosko"}
                              </div>
                              {/* Invoice status badge */}
                              {hasInvoice && (
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                                  <FileText className="h-3 w-3" />
                                  {invoiceNumber}
                                </div>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-xl lg:text-2xl font-black tracking-tighter text-foreground">
                                {formatPrice(order.total ?? 0)}
                              </p>
                              <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                                • {(order.order_items ?? []).length} ITEMS
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Generate Invoice button */}
                          {canGenerateInvoice && (
                            <Button
                              className="rounded-2xl h-10 border-2 font-black text-[10px] uppercase tracking-widest px-6 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/20 border-emerald-400/20"
                              onClick={() =>
                                setSiigoOrder({
                                  order,
                                  method: paymentMethod ?? "efectivo",
                                  breakdown: reconstructedBreakdown,
                                })
                              }
                            >
                              <Zap className="h-4 w-4 mr-2" strokeWidth={3} />
                              Generar Factura
                            </Button>
                          )}

                          {successInvoice &&
                            !!(successInvoice.response_payload
                              ?.public_url as string) && (
                              <Button
                                variant="outline"
                                className="rounded-2xl h-10 border-2 border-emerald-500/20 font-black text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-emerald-50 text-emerald-600 transition-all active:scale-95 shadow-sm"
                                onClick={() =>
                                  window.open(
                                    successInvoice.response_payload
                                      ?.public_url as string,
                                    "_blank",
                                  )
                                }
                              >
                                <FileText
                                  className="h-4 w-4 mr-2"
                                  strokeWidth={3}
                                />
                                PDF Siigo
                              </Button>
                            )}

                          {isEntregado && (
                            <Button
                              variant="outline"
                              className="rounded-2xl h-10 border-2 border-accent/20 font-black text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-accent/5 transition-all active:scale-95 shadow-sm"
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

      {siigoOrder && (
        <SiigoInvoiceModal
          open={!!siigoOrder}
          onClose={() => {
            setSiigoOrder(null);
            refreshOrders();
          }}
          order={siigoOrder.order}
          method={siigoOrder.method}
          breakdown={siigoOrder.breakdown}
        />
      )}
    </ErrorBoundary>
  );
}
