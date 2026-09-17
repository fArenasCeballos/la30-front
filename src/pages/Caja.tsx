import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useCompany } from "@/context/CompanyContext";
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
  Check,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { shouldGenerateInvoice } from "@/lib/siigoService";
import { SiigoInvoiceModal } from "@/components/SiigoInvoiceModal";
import { deductStockFromOrder } from "@/lib/inventoryService";

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
  driverName?: string;
}

export default function Caja() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStore } = useStore();
  const { activeCompany } = useCompany();
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
  const [activeTab, setActiveTab] = useState<string>("pendientes");
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

      // Consultar órdenes del turno directamente desde la BD con payments incluidos
      // para garantizar que el efectivo de la tirilla coincida con la reportería.
      let closingQuery = supabase
        .from("orders")
        .select(
          "*, order_items(*, products(id, name, price, sort_order, category_id, categories(id, name, sort_order))), payments(id, method, amount_total, amount_efectivo, amount_tarjeta, amount_nequi)",
        )
        .gte("created_at", shiftStart.toISOString())
        .lte("created_at", now.toISOString())
        .in("status", ["entregado", "cancelado"]);

      if (activeStore?.id) {
        closingQuery = closingQuery.eq("store_id", activeStore.id);
      }

      const { data: dbOrders, error: fetchError } = await closingQuery;

      if (fetchError) throw fetchError;

      // Fallback al estado en memoria si la consulta no devuelve resultados
      const allCompletedOrders =
        dbOrders && dbOrders.length > 0
          ? (dbOrders as unknown as Order[])
          : orders.filter((o) =>
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
      if (status === "confirmado") {
        toast.success("Pedido confirmado. Pasando a Cobro...");
        setActiveTab("confirmados");
      }
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

    const previouslyPaid =
      payingOrder.payments?.reduce(
        (sum, p) =>
          sum +
          (Number(p.amount_total) ||
            (Number(p.amount_efectivo) || 0) +
              (Number(p.amount_tarjeta) || 0) +
              (Number(p.amount_nequi) || 0) ||
            0),
        0,
      ) || 0;
    const baseRemaining = Math.max(0, payingOrder.total - previouslyPaid);
    const change = Math.max(0, received - baseRemaining);
    const isFullyPaid = received >= baseRemaining;

    const targetStatus = isFullyPaid
      ? payingOrder.status === "pendiente" ||
        payingOrder.status === "confirmado"
        ? "en_preparacion"
        : payingOrder.status
      : null;

    const success = await processPayment(
      payingOrder.id,
      method,
      received,
      breakdown,
      targetStatus,
    );
    if (!success) return false;

    if (targetStatus === "en_preparacion") {
      setActiveTab("cocina");
    }

    // Ejecutar tareas de Siigo y de Impresión en segundo plano sin bloquear el calculador
    (async () => {
      try {
        const activeOrder = payingOrder;

        // Abrir modal de facturación electrónica Siigo si aplica
        if (activeCompany?.siigo_enabled && shouldGenerateInvoice(method, breakdown)) {
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
              buildPartialPaymentReceiptHTML(
                receiptData,
                p,
                i + 1,
                sharedPayments.length,
              ),
              `Voucher Parcial ${i + 1} - ${activeOrder.locator}`,
            );
          }
        }

        if (isFullyPaid) {
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
      <div className="section-container space-y-4 sm:space-y-6 pb-12 animate-in fade-in duration-300">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          {/* Barra Superior Vidriada y Pegajosa para Celular, iPad y PC */}
          <div className="bg-white/80 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs mb-4 sm:mb-6 sticky top-14 sm:top-16 z-30 flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex-1 w-full overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent h-auto p-0 flex-nowrap w-full justify-start gap-1 sm:gap-1.5">
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
                    className="group rounded-xl sm:rounded-2xl px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs transition-all font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 border border-transparent data-[state=active]:border-slate-200/90 shrink-0 min-h-10 sm:min-h-11 cursor-pointer select-none"
                  >
                    <tab.icon
                      className={cn(
                        "size-3.5 sm:size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                        tab.id === "cocina" && "animate-spin",
                      )}
                    />
                    <span>{tab.label}</span>
                    <Badge className="bg-primary text-white border-none rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center font-black text-[9px] sm:text-[10px] ml-1 shadow-2xs">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <Button
              size="sm"
              className="rounded-xl sm:rounded-2xl h-10 sm:h-11 px-3 sm:px-4.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
              onClick={() => navigate("/kiosko")}
            >
              <Plus className="size-4 group-hover:rotate-90 transition-transform duration-200" />
              <span className="hidden sm:inline">NUEVA VENTA</span>
              <span className="sm:hidden text-[11px]">VENTA</span>
            </Button>
          </div>

          {/* TAB 1: PENDIENTES */}
          <TabsContent
            value="pendientes"
            className="animate-in fade-in slide-in-from-bottom-3 duration-300 outline-none"
          >
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 items-start">
              {pendientes.length === 0 ? (
                <div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 text-center p-6 space-y-3">
                  <div className="size-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400">
                    <Clock className="size-8 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-base sm:text-lg font-black text-slate-800 tracking-tight">
                      Sin pedidos pendientes
                    </h4>
                    <p className="text-xs text-slate-400 font-medium max-w-sm">
                      Los pedidos creados desde Kiosko o comandas de mesero aparecerán aquí en tiempo real.
                    </p>
                  </div>
                </div>
              ) : (
                pendientes.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    actions={
                      <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl h-10 font-bold uppercase tracking-wider text-[11px] bg-primary hover:bg-primary/90 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                          onClick={() =>
                            handleUpdateStatus(order.id, "confirmado")
                          }
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                        >
                          {order.isOptimistic || updatingIds.has(order.id) ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle className="size-3.5 mr-1.5" />
                          )}
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-xl h-10 font-bold uppercase tracking-wider text-[11px] bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                          onClick={() => navigate(`/kiosko?edit=${order.id}`)}
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                        >
                          <Edit className="size-3.5 mr-1.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl size-10 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all flex items-center justify-center cursor-pointer shrink-0"
                          onClick={() =>
                            handleUpdateStatus(order.id, "cancelado")
                          }
                          disabled={
                            order.isOptimistic || updatingIds.has(order.id)
                          }
                          title="Cancelar pedido"
                        >
                          {updatingIds.has(order.id) ? (
                            <Loader2 className="size-4 animate-spin text-red-500" />
                          ) : (
                            <XCircle className="size-4.5" />
                          )}
                        </Button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 2: POR COBRAR */}
          <TabsContent
            value="confirmados"
            className="animate-in fade-in slide-in-from-bottom-3 duration-300 outline-none"
          >
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 items-start">
              {confirmados.length === 0 ? (
                <div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 text-center p-6 space-y-3">
                  <div className="size-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400">
                    <DollarSign className="size-8 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-base sm:text-lg font-black text-slate-800 tracking-tight">
                      Nada pendiente por cobrar
                    </h4>
                    <p className="text-xs text-slate-400 font-medium max-w-sm">
                      Todos los pedidos confirmados han sido cobrados o despachados a cocina.
                    </p>
                  </div>
                </div>
              ) : (
                confirmados.map((order) => {
                  const previouslyPaid =
                    order.payments?.reduce(
                      (sum, p) =>
                        sum +
                        (Number(p.amount_total) ||
                          (Number(p.amount_efectivo) || 0) +
                            (Number(p.amount_tarjeta) || 0) +
                            (Number(p.amount_nequi) || 0) ||
                          0),
                      0,
                    ) || 0;
                  const isFullyPaid = previouslyPaid >= (order.total || 0);

                  return (
                    <OrderCard
                      key={order.id}
                      order={order}
                      actions={
                        isFullyPaid ? (
                          <Button
                            className="w-full rounded-xl h-10 font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                            onClick={async () => {
                              try {
                                await supabase.rpc("update_order_status", {
                                  p_order_id: order.id,
                                  p_status: "en_preparacion",
                                });
                                deductStockFromOrder(order.id).catch(
                                  console.warn,
                                );
                                toast.success("Enviado a cocina");
                                setActiveTab("cocina");

                                const pMethod =
                                  order.payments?.[0]?.method || "efectivo";
                                const pBreakdown = order.payments?.[0]
                                  ? {
                                      efectivo:
                                        order.payments[0].amount_efectivo || 0,
                                      tarjeta:
                                        order.payments[0].amount_tarjeta || 0,
                                      nequi:
                                        order.payments[0].amount_nequi || 0,
                                    }
                                  : undefined;

                                if (
                                  activeCompany?.siigo_enabled &&
                                  shouldGenerateInvoice(pMethod, pBreakdown)
                                ) {
                                  setSiigoOrder({
                                    order,
                                    method: pMethod,
                                    breakdown: pBreakdown,
                                  });
                                }

                                const receiptData: ReceiptData = {
                                  order,
                                  cajeroName,
                                  paymentMethod: pMethod,
                                  paymentReceived: order.total || 0,
                                  paymentChange: 0,
                                  paymentBreakdown: pBreakdown,
                                };

                                await silentPrint(
                                  buildCustomerReceiptHTML(receiptData),
                                  `Recibo - ${order.locator}`,
                                );

                                const items = (order.order_items ?? []).filter(
                                  (i) => i.products != null,
                                );
                                const categoryGroups: Record<
                                  string,
                                  OrderItem[]
                                > = {};
                                items.forEach((item) => {
                                  const catName =
                                    item.products?.categories?.name ||
                                    "General";
                                  if (!categoryGroups[catName])
                                    categoryGroups[catName] = [];
                                  categoryGroups[catName].push(item);
                                });

                                for (const [
                                  catName,
                                  catItems,
                                ] of Object.entries(categoryGroups)) {
                                  await silentPrint(
                                    buildKitchenReceiptHTML(
                                      receiptData,
                                      catItems,
                                    ),
                                    `Comanda ${catName} - ${order.locator}`,
                                  );
                                }
                              } catch (err) {
                                console.error(err);
                                toast.error("Error al enviar a cocina");
                              }
                            }}
                            disabled={order.isOptimistic}
                          >
                            {order.isOptimistic ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="size-4 mr-2" />
                            )}
                            ENVIAR A COCINA
                          </Button>
                        ) : (
                          <Button
                            className="w-full rounded-xl h-10 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 transition-all active:scale-95 flex items-center justify-center cursor-pointer group"
                            onClick={() => setPayingOrder(order)}
                            disabled={order.isOptimistic}
                          >
                            {order.isOptimistic ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <DollarSign className="size-4 mr-1.5 group-hover:scale-110 transition-transform" />
                            )}
                            COBRAR Y ENVIAR
                          </Button>
                        )
                      }
                    />
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* TAB 3: EN COCINA */}
          <TabsContent
            value="cocina"
            className="animate-in fade-in slide-in-from-bottom-3 duration-300 outline-none"
          >
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 items-start">
              {enCocina.length === 0 ? (
                <div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 text-center p-6 space-y-3">
                  <div className="size-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400">
                    <Loader2 className="size-8 text-slate-400 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-base sm:text-lg font-black text-slate-800 tracking-tight">
                      La cocina está al día
                    </h4>
                    <p className="text-xs text-slate-400 font-medium max-w-sm">
                      No hay pedidos en preparación en este momento.
                    </p>
                  </div>
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
                      actions={
                        <div className="flex flex-col gap-1.5 w-full">
                          <Button
                            className={cn(
                              "w-full rounded-xl h-10 font-bold uppercase tracking-wider text-xs transition-all shadow-xs flex items-center justify-center cursor-pointer",
                              allChecked
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed",
                            )}
                            onClick={() =>
                              handleUpdateStatus(order.id, "listo")
                            }
                            disabled={updatingIds.has(order.id) || !allChecked}
                          >
                            {updatingIds.has(order.id) ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="size-4 mr-1.5" />
                            )}
                            LISTO PARA ENTREGA
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl h-8 border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] hover:bg-slate-50 transition-all cursor-pointer"
                            onClick={() => handleShowKitchenReceipt(order)}
                          >
                            <Printer className="size-3.5 mr-1.5 text-slate-400" />
                            Reimprimir Comanda
                          </Button>
                        </div>
                      }
                    />
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* TAB 4: LISTOS */}
          <TabsContent
            value="listos"
            className="animate-in fade-in slide-in-from-bottom-3 duration-300 outline-none"
          >
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 items-start">
              {listos.length === 0 ? (
                <div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 text-center p-6 space-y-3">
                  <div className="size-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400">
                    <CheckCircle className="size-8 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-base sm:text-lg font-black text-slate-800 tracking-tight">
                      No hay pedidos listos
                    </h4>
                    <p className="text-xs text-slate-400 font-medium max-w-sm">
                      Los pedidos completados por cocina aparecerán aquí para entrega al cliente.
                    </p>
                  </div>
                </div>
              ) : (
                listos.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    compact
                    actions={
                      <Button
                        className="w-full rounded-xl h-10 font-bold uppercase tracking-wider text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                        onClick={() =>
                          handleUpdateStatus(order.id, "entregado")
                        }
                        disabled={updatingIds.has(order.id)}
                      >
                        {updatingIds.has(order.id) ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="size-4 mr-2" />
                        )}
                        ENTREGAR AL CLIENTE
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 5: HISTORIAL Y CIERRE */}
          <TabsContent
            value="historial"
            className="animate-in fade-in slide-in-from-bottom-3 duration-300 outline-none"
          >
            <div className="space-y-4 sm:space-y-6">
              {/* Banner de Cierre de Caja Diario */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-4 text-center md:text-left">
                  <div className="size-12 sm:size-14 rounded-2xl bg-orange-50 border border-orange-200/80 text-orange-600 flex items-center justify-center shrink-0">
                    <DollarSign className="size-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center md:justify-start gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>ADMINISTRACIÓN DE TURNO</span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Cierre de Caja Diario
                    </h3>
                    <p className="text-xs text-slate-400 font-medium max-w-lg">
                      Consolida todas las transacciones del turno actual y genera la tirilla oficial de ventas para administración.
                    </p>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={handleGenerateClosing}
                  disabled={isClosing || completados.length === 0}
                  className="rounded-2xl h-11 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                >
                  {isClosing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span>GENERANDO...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-4" />
                      <span>REALIZAR CIERRE DE TURNO</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Lista de Pedidos Completados */}
              <div className="grid gap-3 sm:gap-4">
                {completados.length === 0 ? (
                  <div className="py-12 sm:py-16 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200 text-center p-6 space-y-3">
                    <div className="size-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400">
                      <History className="size-8 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-display text-base sm:text-lg font-black text-slate-800 tracking-tight">
                        Sin historial en este turno
                      </h4>
                      <p className="text-xs text-slate-400 font-medium max-w-sm">
                        Los pedidos entregados o cancelados se listarán aquí durante el turno activo.
                      </p>
                    </div>
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

                    const successInvoice = order.siigo_invoices?.find(
                      (inv) => inv.status === "success",
                    );
                    const hasInvoice =
                      !!successInvoice || !!order.siigo_invoice_id;
                    const invoiceNumber =
                      successInvoice?.siigo_invoice_number ||
                      order.siigo_invoice_number ||
                      "Facturado";

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
                      (activeCompany?.siigo_enabled ?? false) &&
                      order.status !== "cancelado" &&
                      !hasInvoice &&
                      shouldGenerateInvoice(
                        paymentMethod ?? "efectivo",
                        reconstructedBreakdown,
                      );

                    const previouslyPaid =
                      order.payments?.reduce(
                        (sum, p) =>
                          sum +
                          (Number(p.amount_total) ||
                            (Number(p.amount_efectivo) || 0) +
                              (Number(p.amount_tarjeta) || 0) +
                              (Number(p.amount_nequi) || 0) ||
                            0),
                        0,
                      ) || 0;
                    const orderTotal = Number(order.total) || Number(order.total_amount) || 0;
                    const baseRemaining = Math.max(0, orderTotal - previouslyPaid);
                    const isPartiallyPaid = previouslyPaid > 0 && baseRemaining > 0;

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-slate-200/90 hover:border-slate-300 p-4 sm:p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-2xs hover:shadow-md"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                          <div
                            className={cn(
                              "size-12 sm:size-14 rounded-2xl flex flex-col items-center justify-center shadow-xs shrink-0",
                              isEntregado
                                ? "bg-slate-900 text-white"
                                : "bg-red-50 text-red-600 border border-red-200/80",
                            )}
                          >
                            <span className="text-[7px] font-black leading-none opacity-50 uppercase tracking-widest mb-0.5">
                              #LOC
                            </span>
                            <span className="font-display font-black text-lg sm:text-xl tracking-tight">
                              {order.locator}
                            </span>
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={order.status} />
                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                <Clock className="size-3" />
                                <span>{hora}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full truncate max-w-36">
                                {order.profiles?.name
                                  ? `Mesero: ${order.profiles.name}`
                                  : "Kiosko"}
                              </span>
                              {hasInvoice && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                  <FileText className="size-3" />
                                  <span>{invoiceNumber}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="font-display font-black text-lg sm:text-xl tracking-tight text-slate-900">
                                {formatPrice(
                                  isPartiallyPaid
                                    ? baseRemaining
                                    : orderTotal > 0
                                      ? orderTotal
                                      : previouslyPaid,
                                )}
                              </p>
                              {isPartiallyPaid && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                  Abonado: {formatPrice(previouslyPaid)}
                                </span>
                              )}
                              <span className="text-xs font-medium text-slate-400">
                                · {(order.order_items ?? []).length} items
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botones de acción en fila de historial */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {canGenerateInvoice && (
                            <Button
                              size="sm"
                              className="rounded-xl h-9.5 px-4 font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                              onClick={() =>
                                setSiigoOrder({
                                  order,
                                  method: paymentMethod ?? "efectivo",
                                  breakdown: reconstructedBreakdown,
                                })
                              }
                            >
                              <Zap className="size-3.5" />
                              <span>Facturar</span>
                            </Button>
                          )}

                          {successInvoice &&
                            !!(successInvoice.response_payload
                              ?.public_url as string) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl h-9.5 px-4 border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
                                onClick={() =>
                                  window.open(
                                    successInvoice.response_payload
                                      ?.public_url as string,
                                    "_blank",
                                  )
                                }
                              >
                                <FileText className="size-3.5 text-slate-400" />
                                <span>PDF Siigo</span>
                              </Button>
                            )}

                          {isEntregado && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl h-9.5 px-4 border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
                              onClick={() => handleReprintCustomer(order)}
                            >
                              <RotateCcw className="size-3.5 text-slate-400" />
                              <span>Reimprimir</span>
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
          sharedPayments={receipt.sharedPayments}
          driverName={receipt.driverName}
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
