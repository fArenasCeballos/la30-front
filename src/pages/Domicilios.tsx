import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useOrders } from "@/context/OrderContext";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { toast } from "sonner";
import type {
  Order,
  OrderItem,
  OrderStatus,
  Category,
  Product,
  DeliveryZone,
} from "@/types";
import { cn } from "@/lib/utils";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { DeliveryZoneCombobox } from "@/components/DeliveryZoneCombobox";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Truck,
  Plus,
  Minus,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Clock,
  Send,
  Loader2,
  History,
  RotateCcw,
  CheckCircle,
  FileText,
  Zap,
  Edit,
  XCircle,
  DollarSign,
  Bike,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { getShiftStart } from "@/lib/shiftUtils";
import { shouldGenerateInvoice } from "@/lib/siigoService";
import { SiigoInvoiceModal } from "@/components/SiigoInvoiceModal";
import { LiquidacionDomiciliariosView } from "@/components/LiquidacionDomiciliariosView";
import { useQueryClient } from "@tanstack/react-query";

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

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

export default function Domicilios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStore } = useStore();
  const {
    orders,
    activeOrders,
    updateOrderStatus,
    dispatchOrder,
    processPayment,
    addDeliveryOrder,
  } = useOrders();
  const queryClient = useQueryClient();

  // UI state
  const [currentNavTab, setCurrentNavTab] = useState<string>("pendientes");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
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

  // New order form
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [selectedCategory, setActiveCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>();

  // Fetch categories & products for the order form
  const storeId = activeStore?.id;

  const { data: categories = [] } = useQuery({
    queryKey: ["delivery-categories", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      const filtered = (data || []).filter(
        (c: Category) => !storeId || c.store_ids?.includes(storeId),
      );
      return filtered as Category[];
    },
    enabled: !!storeId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["delivery-products", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("available", true)
        .order("sort_order");
      const filtered = (data || []).filter(
        (p: Product) => !storeId || p.store_ids?.includes(storeId),
      );
      return filtered as Product[];
    },
    enabled: !!storeId,
  });

  // Derive active category directly during render to avoid cascading updates
  const activeCategory =
    selectedCategory || (categories.length > 0 ? categories[0].id : null);

  const filteredProducts = useMemo(
    () =>
      activeCategory
        ? products.filter((p) => p.category_id === activeCategory)
        : products,
    [products, activeCategory],
  );

  // Delivery orders (from active orders in current store)
  const deliveryOrders = useMemo(
    () =>
      activeOrders
        .filter((o) => o.is_delivery)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [activeOrders],
  );

  // Completed delivery orders history
  const completedDeliveries = useMemo(
    () =>
      orders
        .filter(
          (o) => o.is_delivery && ["entregado", "cancelado"].includes(o.status),
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [orders],
  );

  // Fetch Active Drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ["delivery-drivers-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_drivers")
        .select("*")
        .eq("is_active", true)
        .order("first_name", { ascending: true });
      return (
        (data as Array<{
          id: string;
          first_name: string;
          last_name: string;
          phone: string;
          motorcycle_plate: string;
        }>) || []
      );
    },
  });

  const handleAssignDriver = async (
    orderId: string,
    driverId: string | null,
  ) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ driver_id: driverId })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Repartidor asignado");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["active-orders"] });
    } catch (err) {
      toast.error(
        `Error al asignar repartidor: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const [isClosing, setIsClosing] = useState(false);

  const handleGenerateClosing = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      const now = new Date();
      const shiftStart = getShiftStart();
      const cajeroName = user?.name ?? "Cajero Domicilios";

      // Consultar órdenes de domicilios del turno directamente desde la BD con payments incluidos
      let closingQuery = supabase
        .from("orders")
        .select(
          "*, order_items(*, products(id, name, sort_order, category_id, categories(id, name, sort_order))), payments(id, method, amount_total, amount_efectivo, amount_tarjeta, amount_nequi)",
        )
        .eq("is_delivery", true)
        .gte("created_at", shiftStart.toISOString())
        .lte("created_at", now.toISOString())
        .in("status", ["entregado", "cancelado"]);

      if (activeStore?.id) {
        closingQuery = closingQuery.eq("store_id", activeStore.id);
      }

      const { data: dbOrders, error: fetchError } = await closingQuery;

      if (fetchError) throw fetchError;

      const allCompletedDeliveries =
        dbOrders && dbOrders.length > 0
          ? (dbOrders as unknown as Order[])
          : completedDeliveries;

      // Imprimir tirilla de cierre de turno de domicilios
      if (allCompletedDeliveries.length > 0) {
        const closingHTML = buildShiftClosingReceiptHTML({
          orders: allCompletedDeliveries,
          cajeroName,
          shiftStart,
          shiftEnd: now,
          storeName: "La 30 Perros y Hamburguesas",
        });
        await silentPrint(closingHTML, "Cierre de Turno - Domicilios");
      }

      const { error } = await supabase.rpc("generate_cash_closing", {
        p_period_start: shiftStart.toISOString(),
        p_period_end: now.toISOString(),
        p_store_id: activeStore?.id,
        p_notes: `Cierre de Domicilios generado por ${user?.name || "Usuario"}`,
      });

      if (error) throw error;

      toast.success(
        "Cierre de domicilios generado correctamente. Abriendo módulo de liquidación.",
      );
      setCurrentNavTab("liquidacion");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al generar cierre: ${msg}`);
    } finally {
      setIsClosing(false);
    }
  };

  const handleDispatchClick = async (orderId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(orderId));
    try {
      await dispatchOrder(orderId);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const pendientes = useMemo(
    () => deliveryOrders.filter((o) => o.status === "pendiente"),
    [deliveryOrders],
  );

  const enCocina = useMemo(
    () =>
      deliveryOrders.filter((o) =>
        ["confirmado", "en_preparacion"].includes(o.status),
      ),
    [deliveryOrders],
  );

  const listos = useMemo(
    () =>
      deliveryOrders.filter((o) => o.status === "listo" && !o.is_dispatched),
    [deliveryOrders],
  );

  const enCamino = useMemo(
    () =>
      deliveryOrders.filter((o) => o.status === "listo" && o.is_dispatched),
    [deliveryOrders],
  );

  // Cart helpers
  const addToCart = (product: Product) => {
    const newCart = new Map(cart);
    const existing = newCart.get(product.id);
    if (existing) {
      newCart.set(product.id, { ...existing, quantity: existing.quantity + 1 });
    } else {
      newCart.set(product.id, { product, quantity: 1, notes: "" });
    }
    setCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    const newCart = new Map(cart);
    const existing = newCart.get(productId);
    if (existing && existing.quantity > 1) {
      newCart.set(productId, { ...existing, quantity: existing.quantity - 1 });
    } else {
      newCart.delete(productId);
    }
    setCart(newCart);
  };

  const cartTotal = useMemo(
    () =>
      Array.from(cart.values()).reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [cart],
  );

  const grandTotal = cartTotal + deliveryFee;

  const resetForm = () => {
    setCustomerName("");
    setCustomerAddress("");
    setCustomerPhone("");
    setDeliveryFee(0);
    setSelectedZoneId(undefined);
    setCart(new Map());
    setActiveCategory(categories[0]?.id || null);
  };

  const handleCreateOrder = async () => {
    if (
      !customerName.trim() ||
      !customerAddress.trim() ||
      !customerPhone.trim()
    ) {
      toast.error("Completa los datos del cliente");
      return;
    }
    if (cart.size === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setIsSubmitting(true);
    try {
      const items = Array.from(cart.values()).map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        notes: item.notes || undefined,
      }));

      const locator = `D${Math.floor(Math.random() * 900 + 100)}`;

      await addDeliveryOrder(
        locator,
        items,
        {
          name: customerName,
          address: customerAddress,
          phone: customerPhone,
          fee: deliveryFee,
        },
        `📍 ${customerAddress}`,
      );

      resetForm();
      setShowNewOrder(false);
    } catch {
      toast.error("Error al crear el domicilio");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(orderId));
    try {
      await updateOrderStatus(orderId, status);

      // Al confirmar un domicilio: imprimir factura (sin pago) + comandas de cocina
      if (status === "confirmado") {
        const order = [...(activeOrders ?? []), ...(orders ?? [])].find(
          (o) => o.id === orderId,
        );
        if (order) {
          const cajeroName = user?.name ?? "Cajero";
          const receiptData: ReceiptData = {
            order,
            cajeroName,
            storeName: activeStore?.name || "La 30 Perros y Hamburguesas",
            // Sin paymentMethod → la factura no muestra info de pago
          };

          // Imprimir factura del cliente (para enviar con el domiciliario)
          await silentPrint(
            buildCustomerReceiptHTML(receiptData),
            `Recibo - ${order.locator}`,
          );

          // Imprimir comandas agrupadas por categoría en una sola sesión de impresión
          const items = (order.order_items ?? []).filter(
            (i) => i.products != null,
          );
          const categoryGroups: Record<string, OrderItem[]> = {};
          items.forEach((item) => {
            const catName = item.products?.categories?.name || "General";
            if (!categoryGroups[catName]) categoryGroups[catName] = [];
            categoryGroups[catName].push(item);
          });
          const categoryKeys = Object.keys(categoryGroups);
          if (categoryKeys.length > 0) {
            const kitchenHTMLs = categoryKeys.map((catName) =>
              buildKitchenReceiptHTML(receiptData, categoryGroups[catName]),
            );
            const combinedKitchenHTML = kitchenHTMLs.join(
              '<div class="print-page-break"></div>',
            );
            await silentPrint(combinedKitchenHTML);
          }
        }
      }
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

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
    const targetStatus = isFullyPaid ? "entregado" : null;

    const success = await processPayment(
      payingOrder.id,
      method,
      received,
      breakdown,
      targetStatus,
    );

    if (success) {
      const activeOrder = payingOrder;
      const cajeroName = user?.name ?? "Cajero";

      (async () => {
        try {
          // Abrir modal de facturación electrónica Siigo si aplica
          const isFacturacionAllowed =
            user?.role === "admin" || user?.role === "caja";
          if (isFullyPaid && isFacturacionAllowed && shouldGenerateInvoice(method, breakdown)) {
            setSiigoOrder({ order: activeOrder, method, breakdown });
          }

          const receiptData: ReceiptData = {
            order: activeOrder,
            cajeroName,
            storeName: activeStore?.name || "La 30 Perros y Hamburguesas",
            paymentMethod: method,
            paymentReceived: received,
            paymentChange: change,
            paymentBreakdown: breakdown,
            sharedPayments,
          };

          // Si es pago mixto/compartido, imprimir cada comprobante individual
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

          // Auto-imprimir factura final del cliente con información de pago
          if (isFullyPaid) {
            await silentPrint(
              buildCustomerReceiptHTML(receiptData),
              `Recibo - ${activeOrder.locator}`,
            );
          }
        } catch (err) {
          console.error("Error in delivery post-payment printing pipeline:", err);
        }
      })();

      return true;
    }
    return false;
  };

  const renderDeliveryCard = (order: Order) => {
    const isUpdating = updatingIds.has(order.id);
    const validItems = (order.order_items ?? []).filter(
      (item) => item != null && item.products != null,
    );

    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="pos-card group animate-in fade-in duration-300 border-2 border-transparent hover:border-purple-500/20 transition-all shadow-md hover:shadow-xl p-2.5 lg:p-3 bg-white/80 backdrop-blur-md"
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 shadow-inner group-hover:rotate-3 transition-all duration-500 shrink-0">
              <span className="text-[7px] font-black leading-none text-purple-600/50 uppercase tracking-widest mb-0.5">
                #DOM
              </span>
              <span className="font-black text-lg tracking-tighter text-purple-700">
                {order.locator}
              </span>
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="font-black text-xs text-foreground truncate flex items-center gap-1">
                <User className="h-3 w-3 text-purple-500 shrink-0" />
                {order.delivery_name || "Cliente"}
              </p>
              <div className="flex items-center gap-1.5 text-muted-foreground/40 font-black uppercase tracking-widest text-[8px]">
                <Clock className="h-2.5 w-2.5" />
                <span>{timeAgo(order.created_at)}</span>
              </div>
              <p className="text-[8px] font-black text-purple-600/70 uppercase tracking-widest truncate">
                {order.profiles?.name
                  ? `Mesero: ${order.profiles.name}`
                  : "Kiosko"}
              </p>
            </div>
          </div>
          <StatusBadge status={order.status} className="scale-90 origin-right shrink-0" />
        </div>

        {/* Customer Address & Phone */}
        <div className="p-2 bg-purple-500/5 rounded-xl border border-purple-500/10 space-y-1 mb-2">
          <div className="flex items-start gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
            <span className="text-foreground/80 font-semibold leading-tight text-xs break-words">
              {order.delivery_address || "Sin dirección"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            <a
              href={`tel:${order.delivery_phone}`}
              className="text-purple-600 font-bold hover:underline tracking-tight"
            >
              {order.delivery_phone || "Sin teléfono"}
            </a>
          </div>
        </div>

        {/* Products List */}
        {validItems.length > 0 && (
          <div className="space-y-1 mb-2 bg-accent/5 -mx-2.5 lg:-mx-3 px-2.5 lg:px-3 py-1.5 border-y border-dashed border-accent/10">
            {validItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start text-xs gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight tracking-tight text-foreground">
                    <span className="text-purple-600 font-black mr-1">
                      {item.quantity}x
                    </span>
                    {item.products?.name ?? "Producto"}
                  </p>
                  {item.notes && (
                    <p className="text-[9px] font-medium text-muted-foreground/60 italic leading-none mt-0.5">
                      "{item.notes}"
                    </p>
                  )}
                  {item.choices && Object.keys(item.choices).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.values(item.choices).map(
                        (
                          choice: { label: string; icon?: string },
                          cIdx: number,
                        ) => (
                          <span
                            key={cIdx}
                            className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded-sm bg-white border border-accent/10 text-muted-foreground/60 shadow-sm"
                          >
                            {choice.icon} {choice.label}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <span className="font-black text-[11px] text-muted-foreground/40 tracking-tighter shrink-0 pt-0.5">
                  {formatPrice(
                    (item.unit_price ?? 0) * (item.quantity ?? 1),
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Items Count & Total */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col -space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                TOTAL
              </span>
              {(order.delivery_fee ?? 0) > 0 && (
                <span className="text-[8px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded-md">
                  Envío: {formatPrice(order.delivery_fee ?? 0)}
                </span>
              )}
            </div>
            <span className="font-black text-base lg:text-lg tracking-tighter text-purple-600 group-hover:scale-105 origin-left transition-all duration-500">
              {formatPrice(order.total)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-2 py-1 rounded-full">
            <span>{validItems.length} items</span>
          </div>
        </div>

        {/* Domiciliario Asignado / Selector */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-accent/5 rounded-xl border border-accent/10 mt-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Bike className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/60 shrink-0">
              REPARTIDOR:
            </span>
            {order.driver_id ? (
              <span className="text-[10px] font-black text-purple-700 truncate">
                {(() => {
                  const d = drivers.find((drv) => drv.id === order.driver_id);
                  return d
                    ? `${d.first_name} (${d.motorcycle_plate})`
                    : "Asignado";
                })()}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-amber-600 italic">
                Sin asignar
              </span>
            )}
          </div>

          <Select
            value={order.driver_id || "none"}
            onValueChange={(driverId) =>
              handleAssignDriver(
                order.id,
                driverId === "none" ? null : driverId,
              )
            }
          >
            <SelectTrigger className="h-7 w-28 px-2 rounded-lg border-purple-200 bg-white text-[9px] font-black uppercase tracking-wider text-purple-700 shadow-none">
              <SelectValue placeholder="Asignar" />
            </SelectTrigger>
            <SelectContent className="rounded-xl p-1">
              <SelectItem
                value="none"
                className="text-xs text-muted-foreground font-bold"
              >
                Sin asignar
              </SelectItem>
              {drivers.map((d) => (
                <SelectItem
                  key={d.id}
                  value={d.id}
                  className="text-xs font-bold"
                >
                  🛵 {d.first_name} {d.last_name} ({d.motorcycle_plate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions Bar */}
        <div className="flex gap-2 mt-1 pt-2 border-t border-accent/10 w-full">
          {order.status === "pendiente" && (
            <>
              <button
                className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-primary hover:bg-primary/90 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                onClick={() => handleStatusChange(order.id, "confirmado")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1.5" strokeWidth={3} />
                )}
                CONFIRMAR
              </button>
              <button
                className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-white border border-accent/20 hover:bg-accent/5 transition-all flex items-center justify-center disabled:opacity-50"
                onClick={() => navigate(`/kiosko?edit=${order.id}`)}
                disabled={isUpdating}
              >
                <Edit className="h-3 w-3 mr-1.5" strokeWidth={3} />
                EDITAR
              </button>
            </>
          )}

          {order.status === "confirmado" && (
            <button
              className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              onClick={() => handleStatusChange(order.id, "en_preparacion")}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                "PREPARAR"
              )}
            </button>
          )}

          {order.status === "en_preparacion" && (
            <button
              className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-green-500 hover:bg-green-600 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              onClick={() => handleStatusChange(order.id, "listo")}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1.5" strokeWidth={3} />
              )}
              LISTO
            </button>
          )}

          {order.status === "listo" && !order.is_dispatched && (
            <button
              className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              onClick={() => handleDispatchClick(order.id)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Truck className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
              DESPACHAR
            </button>
          )}

          {order.status === "listo" && order.is_dispatched && (
            <button
              className="flex-1 rounded-xl h-9 font-black uppercase tracking-widest text-[9px] bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              onClick={() => setPayingOrder(order)}
              disabled={isUpdating}
            >
              <CheckCircle className="h-3.5 w-3.5" strokeWidth={3} />
              COBRAR Y ENTREGAR
            </button>
          )}

          <button
            title="Cancelar pedido"
            className="rounded-xl h-9 w-9 text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/10 transition-all flex items-center justify-center disabled:opacity-50 shrink-0"
            onClick={() => handleStatusChange(order.id, "cancelado")}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin text-destructive" />
            ) : (
              <XCircle className="h-4 w-4" strokeWidth={3} />
            )}
          </button>
        </div>
      </motion.div>
    );
  };

  if (user && !["admin", "caja"].includes(user.role)) return null;

  const tabs = [
    {
      id: "pendientes",
      label: "PENDIENTES",
      count: pendientes.length,
      icon: Clock,
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
      id: "camino",
      label: "EN CAMINO",
      count: enCamino.length,
      icon: Truck,
    },
    {
      id: "historial",
      label: "HISTORIAL",
      count: completedDeliveries.length,
      icon: History,
    },
    {
      id: "liquidacion",
      label: "LIQUIDACIÓN",
      count: completedDeliveries.length,
      icon: DollarSign,
    },
  ];

  return (
    <ErrorBoundary>
      <div className="section-container space-y-4 lg:space-y-6 pb-32 animate-in fade-in duration-300">
        <Tabs
          value={currentNavTab}
          onValueChange={setCurrentNavTab}
          className="w-full"
        >
          <div className="bg-white/60 backdrop-blur-xl p-1 lg:p-2 rounded-2xl border-2 border-accent/20 shadow-sm mb-4 lg:mb-6 sticky top-14 lg:top-16 z-40 flex flex-col sm:flex-row items-center gap-2 lg:gap-4">
            <div className="flex-1 w-full overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent h-auto p-0 flex-nowrap w-full justify-start gap-1 lg:gap-2">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="group rounded-lg lg:rounded-xl px-4 lg:px-8 py-2 lg:py-3 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md transition-all font-black text-[9px] lg:text-[11px] uppercase tracking-widest flex items-center gap-2 lg:gap-3 border-2 data-[state=active]:border-purple-500/5 min-w-30 lg:min-w-35"
                  >
                    <tab.icon
                      className={cn(
                        "h-5 w-5 lg:h-6 lg:w-6 shrink-0 transition-all duration-200 group-hover:scale-110 group-active:scale-95",
                        tab.id === "cocina" && "animate-spin",
                      )}
                      strokeWidth={2.5}
                    />
                    {tab.label}
                    <Badge className="bg-purple-600 text-white border-none rounded-xl h-6 min-w-6 px-1.5 flex items-center justify-center font-black text-[10px] ml-auto shadow-md">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <Button
              size="sm"
              className="rounded-xl h-10 lg:h-12 px-4 lg:px-6 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] lg:text-xs shadow-md shadow-purple-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all group shrink-0"
              onClick={() => navigate("/kiosko")}
            >
              <Plus
                className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-2 group-hover:rotate-90 transition-transform duration-200"
                strokeWidth={3}
              />
              NUEVO DOMICILIO
            </Button>
          </div>

          {/* Tab: Pendientes */}
          <TabsContent
            value="pendientes"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            {pendientes.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                  Sin domicilios pendientes
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                <AnimatePresence>
                  {pendientes.map(renderDeliveryCard)}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* Tab: En Cocina */}
          <TabsContent
            value="cocina"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            {enCocina.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-muted-foreground/60 animate-spin" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                  Sin domicilios en cocina
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                <AnimatePresence>
                  {enCocina.map(renderDeliveryCard)}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* Tab: Listos en Local */}
          <TabsContent
            value="listos"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            {listos.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                  Sin domicilios listos en local
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                <AnimatePresence>
                  {listos.map(renderDeliveryCard)}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* Tab: En Camino */}
          <TabsContent
            value="camino"
            className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
          >
            {enCamino.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                  <Truck className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                  Sin domicilios en camino
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                <AnimatePresence>
                  {enCamino.map(renderDeliveryCard)}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* Tab: Historial */}
          <TabsContent
            value="historial"
            className="outline-none animate-in fade-in duration-300"
          >
            <div className="space-y-6 lg:space-y-8">
              {/* Cash Closing Section */}
              <div className="bg-linear-to-br from-purple-500/10 via-white/50 to-purple-500/5 backdrop-blur-md border-2 border-purple-500/20 p-6 lg:p-8 rounded-3xl flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8 group shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-150 transition-transform duration-1000">
                  <DollarSign
                    className="h-48 w-48 text-purple-600"
                    strokeWidth={3}
                  />
                </div>

                <div className="space-y-3 text-center lg:text-left relative z-10">
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-purple-600 font-black uppercase tracking-[0.3em] text-[10px]">
                    <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
                    ADMINISTRACIÓN DE TURNO
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-black tracking-tighter text-foreground">
                    Cierre de Domicilios Diario
                  </h3>
                  <p className="text-muted-foreground font-medium text-sm lg:text-base leading-relaxed max-w-xl">
                    Consolida todas las transacciones de domicilios del turno actual y genera el reporte oficial de ventas para administración.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setCurrentNavTab("liquidacion")}
                    className="rounded-2xl h-14 lg:h-16 px-6 border-2 border-purple-300 hover:bg-purple-50 text-purple-700 font-black text-xs uppercase tracking-widest shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
                  >
                    <Bike className="h-5 w-5 mr-2 text-purple-600" />
                    LIQUIDAR DOMICILIARIOS
                  </Button>

                  <Button
                    size="lg"
                    onClick={handleGenerateClosing}
                    disabled={isClosing || completedDeliveries.length === 0}
                    className="rounded-2xl h-14 lg:h-16 px-8 lg:px-10 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-500/25 hover:scale-[1.03] active:scale-[0.97] transition-all group shrink-0"
                  >
                    {isClosing ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-3" />
                    ) : (
                      <DollarSign
                        className="h-5 w-5 mr-3 group-hover:scale-125 transition-transform duration-200"
                        strokeWidth={3}
                      />
                    )}
                    REALIZAR CIERRE DE TURNO
                  </Button>
                </div>
              </div>

              {completedDeliveries.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-accent/20 opacity-60 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-accent/10 flex items-center justify-center">
                    <History className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-sm text-muted-foreground/60">
                    Sin historial de domicilios
                  </p>
                </div>
            ) : (
              <div className="grid gap-6">
                {completedDeliveries.map((order, idx) => {
                  const isEntregado = order.status === "entregado";
                  const hora = new Intl.DateTimeFormat("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }).format(
                    order.created_at ? new Date(order.created_at) : new Date(),
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
                  const isFacturacionAllowed =
                    user?.role === "admin" || user?.role === "caja";
                  const canGenerateInvoice =
                    order.status !== "cancelado" &&
                    isFacturacionAllowed &&
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
                  const baseRemaining = Math.max(
                    0,
                    (order.total || 0) - previouslyPaid,
                  );

                  return (
                    <div
                      key={order.id}
                      className="bg-white/40 backdrop-blur-md border-2 border-accent/10 hover:border-purple-500/20 p-4 lg:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6 group transition-all duration-200 shadow-sm hover:shadow-xl"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8 flex-1">
                        <div
                          className={cn(
                            "w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-inner transition-all duration-200 group-hover:scale-110 shrink-0",
                            isEntregado
                              ? "bg-purple-500/5 text-purple-600 border-purple-500/10"
                              : "bg-destructive/5 text-destructive border-destructive/10",
                          )}
                        >
                          <span className="text-[9px] font-black leading-none opacity-40 uppercase tracking-widest mb-1">
                            #DOM
                          </span>
                          <span className="text-2xl font-black tracking-tighter">
                            {order.locator}
                          </span>
                        </div>

                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <StatusBadge status={order.status} />
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
                              <Clock className="h-3 w-3" />
                              {hora}
                            </div>
                            <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-500/5 px-3 py-1.5 rounded-full">
                              {order.profiles?.name
                                ? `Mesero: ${order.profiles.name}`
                                : "Kiosko"}
                            </div>
                            {order.delivery_name && (
                              <div className="flex items-center gap-1 text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-500/5 px-3 py-1.5 rounded-full">
                                <User className="h-3 w-3" />
                                {order.delivery_name}
                              </div>
                            )}
                            {order.delivery_phone && (
                              <div className="text-[10px] font-bold text-muted-foreground/60">
                                Tel: {order.delivery_phone}
                              </div>
                            )}
                            {/* Invoice status badge */}
                            {hasInvoice && (
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                                <FileText className="h-3 w-3" />
                                {invoiceNumber}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="text-xl lg:text-2xl font-black tracking-tighter text-foreground">
                                {formatPrice(baseRemaining)}
                              </p>
                              {previouslyPaid > 0 && (
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  RESTANTE (Pagado:{" "}
                                  {formatPrice(previouslyPaid)})
                                </span>
                              )}
                              <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                                • {(order.order_items ?? []).length} ITEMS
                              </span>
                            </div>
                            {order.delivery_address && (
                              <span className="text-xs font-semibold text-muted-foreground/70 flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                {order.delivery_address}
                              </span>
                            )}
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
                              className="rounded-2xl h-10 border-2 border-emerald-500/20 font-black text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-emerald-50 text-emerald-600 transition-all active:scale-95 shadow-sm shrink-0"
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

                        {isEntregado &&
                          (user?.role === "admin" || user?.role === "caja") && (
                            <Button
                              variant="outline"
                              className="rounded-2xl h-10 border-2 border-accent/20 font-black text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-accent/5 transition-all active:scale-95 shadow-sm shrink-0"
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
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Liquidación de Domiciliarios */}
        <TabsContent
          value="liquidacion"
          className="animate-in fade-in slide-in-from-bottom-6 duration-300 outline-none"
        >
          <LiquidacionDomiciliariosView />
        </TabsContent>
      </Tabs>

      {/* ===== NEW ORDER SHEET ===== */}
      <Sheet open={showNewOrder} onOpenChange={setShowNewOrder}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col"
          aria-describedby={undefined}
        >
          <SheetHeader className="p-4 lg:p-6 bg-purple-600 text-white shrink-0">
            <SheetTitle className="text-white font-black text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" /> Nuevo Domicilio
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
            {/* Customer Info */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Datos del Cliente
              </h3>
              <Input
                placeholder="Nombre del cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
              />
              <Input
                placeholder="Dirección de entrega"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
              />
              <DeliveryZoneCombobox
                selectedZoneId={selectedZoneId}
                onSelect={(zone: DeliveryZone | null) => {
                  if (zone) {
                    setSelectedZoneId(zone.id);
                    setDeliveryFee(zone.price);
                  } else {
                    setSelectedZoneId(undefined);
                    setDeliveryFee(0);
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Celular"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
                />
                <Input
                  placeholder="Costo envío (manual)"
                  type="number"
                  value={deliveryFee || ""}
                  onChange={(e) => {
                    setDeliveryFee(Number(e.target.value) || 0);
                    setSelectedZoneId(undefined);
                  }}
                  className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5" /> Productos
              </h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2",
                      activeCategory === cat.id
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-muted-foreground border-accent/20 hover:border-purple-300",
                    )}
                  >
                    {cat.icon} {cat.label || cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredProducts.map((product) => {
                const inCart = cart.get(product.id);
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "rounded-xl border-2 p-3 transition-all",
                      inCart
                        ? "border-purple-500 bg-purple-50 shadow-md"
                        : "border-accent/10 bg-white hover:border-purple-200",
                    )}
                  >
                    <p className="font-bold text-xs leading-tight mb-1 line-clamp-2">
                      {product.name}
                    </p>
                    <p className="text-[10px] font-black text-purple-600 mb-2">
                      {formatPrice(product.price)}
                    </p>
                    <div className="flex items-center justify-between">
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="h-7 w-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200 transition-colors"
                          >
                            <Minus className="h-3 w-3" strokeWidth={3} />
                          </button>
                          <span className="font-black text-sm text-purple-700 w-5 text-center">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => addToCart(product)}
                            className="h-7 w-7 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                          >
                            <Plus className="h-3 w-3" strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="h-7 px-3 rounded-lg bg-accent/10 text-muted-foreground text-[9px] font-black uppercase hover:bg-purple-100 hover:text-purple-600 transition-colors"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Summary */}
            {cart.size > 0 && (
              <div className="space-y-2 bg-purple-50 rounded-2xl p-4 border-2 border-purple-200">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                  Resumen del Pedido
                </h3>
                {Array.from(cart.values()).map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="font-bold">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-purple-200 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-xs text-purple-500">
                      <span>Envío</span>
                      <span>{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-purple-700">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="p-4 lg:p-6 border-t bg-white shrink-0">
            <Button
              onClick={handleCreateOrder}
              disabled={isSubmitting || cart.size === 0}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-purple-500/20 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Crear Domicilio • {formatPrice(grandTotal)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment Calculator */}
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
        />
      )}

      {siigoOrder && (
        <SiigoInvoiceModal
          open={!!siigoOrder}
          onClose={() => setSiigoOrder(null)}
          order={siigoOrder.order}
          method={siigoOrder.method}
          breakdown={siigoOrder.breakdown}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
