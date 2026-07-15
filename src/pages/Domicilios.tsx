import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useOrders } from "@/context/OrderContext";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { toast } from "sonner";
import type { Order, OrderItem, OrderStatus, Category, Product } from "@/types";
import { cn } from "@/lib/utils";
import { PaymentCalculator } from "@/components/PaymentCalculator";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChefHat,
  Package,
  Send,
  Loader2,
  History,
  RotateCcw,
  CheckCircle,
  FileText,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderReceipt } from "@/components/OrderReceipt";
import {
  buildCustomerReceiptHTML,
  buildKitchenReceiptHTML,
  silentPrint,
} from "@/lib/receiptUtils";
import type { ReceiptData } from "@/lib/receiptUtils";
import { shouldGenerateInvoice } from "@/lib/siigoService";
import { SiigoInvoiceModal } from "@/components/SiigoInvoiceModal";

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
}

export default function Domicilios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStore } = useStore();
  const { orders, activeOrders, updateOrderStatus, dispatchOrder, processPayment, addDeliveryOrder } =
    useOrders();

  // UI state
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"todos" | "cocina" | "listos" | "camino">("todos");
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Set first category as active
  useMemo(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

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
        .filter((o) => o.is_delivery && ["entregado", "cancelado"].includes(o.status))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [orders],
  );

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

  const stats = useMemo(() => {
    const pending = deliveryOrders.filter(
      (o) => o.status === "pendiente" || o.status === "confirmado",
    ).length;
    const inPrep = deliveryOrders.filter(
      (o) => o.status === "en_preparacion",
    ).length;
    const ready = deliveryOrders.filter((o) => o.status === "listo" && !o.is_dispatched).length;
    const dispatched = deliveryOrders.filter((o) => o.status === "listo" && o.is_dispatched).length;
    return { pending, inPrep, ready, dispatched, total: deliveryOrders.length };
  }, [deliveryOrders]);

  const filteredActiveOrders = useMemo(() => {
    switch (activeSubTab) {
      case "cocina":
        return deliveryOrders.filter((o) => ["pendiente", "confirmado", "en_preparacion"].includes(o.status));
      case "listos":
        return deliveryOrders.filter((o) => o.status === "listo" && !o.is_dispatched);
      case "camino":
        return deliveryOrders.filter((o) => o.status === "listo" && o.is_dispatched);
      default:
        return deliveryOrders;
    }
  }, [deliveryOrders, activeSubTab]);

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
            // Sin paymentMethod → la factura no muestra info de pago
          };

          // Imprimir factura del cliente (sin método de pago)
          await silentPrint(
            buildCustomerReceiptHTML(receiptData),
            `Recibo - ${order.locator}`,
          );

          // Imprimir comandas agrupadas por categoría
          const items = (order.order_items ?? []).filter(
            (i) => i.products != null,
          );
          const categoryGroups: Record<string, OrderItem[]> = {};
          items.forEach((item) => {
            const catName = item.products?.categories?.name || "General";
            if (!categoryGroups[catName]) categoryGroups[catName] = [];
            categoryGroups[catName].push(item);
          });
          for (const catName of Object.keys(categoryGroups)) {
            await silentPrint(
              buildKitchenReceiptHTML(receiptData, categoryGroups[catName]),
            );
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
    method: "efectivo" | "tarjeta" | "nequi" | "mixto",
    received: number,
    breakdown?: {
      efectivo?: number;
      tarjeta?: number;
      nequi?: number;
      tarjeta_credito?: number;
      tarjeta_debito?: number;
      daviplata?: number;
    },
  ): Promise<boolean> => {
    if (!payingOrder) return false;
    const success = await processPayment(payingOrder.id, method, received, breakdown, "entregado");
    if (success) {
      // Abrir modal de facturación electrónica Siigo si aplica
      const isFacturacionAllowed = user?.role === "admin" || user?.role === "caja";
      if (isFacturacionAllowed && shouldGenerateInvoice(method, breakdown)) {
        setSiigoOrder({ order: payingOrder, method, breakdown });
      }
      setPayingOrder(null);
      return true;
    }
    return false;
  };

  const getStatusActions = (order: Order) => {
    const isUpdating = updatingIds.has(order.id);
    switch (order.status) {
      case "pendiente":
        return (
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "confirmado")}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Confirmar"
            )}
          </Button>
        );
      case "confirmado":
        return (
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "en_preparacion")}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Preparar"
            )}
          </Button>
        );
      case "en_preparacion":
        return (
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "listo")}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Listo"
            )}
          </Button>
        );
      case "listo":
        if (!order.is_dispatched) {
          return (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5"
              disabled={isUpdating}
              onClick={() => handleDispatchClick(order.id)}
            >
              <Truck className="h-3 w-3" />
              Despachar
            </Button>
          );
        } else {
          return (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5"
              disabled={isUpdating}
              onClick={() => setPayingOrder(order)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Cobrar y Entregar
            </Button>
          );
        }
      default:
        return null;
    }
  };

  if (user && !["admin", "caja"].includes(user.role)) return null;

  return (
    <div className="section-container space-y-6 lg:space-y-8 pb-32 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/10 p-2 lg:p-2.5 rounded-xl lg:rounded-2xl">
            <Truck
              className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600"
              strokeWidth={2.5}
            />
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight">
              Domicilios
            </h1>
            <p className="text-[8px] lg:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              Gestión de pedidos a domicilio
            </p>
          </div>
        </div>

        <Button
          onClick={() => navigate("/kiosko")}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl lg:rounded-2xl h-10 lg:h-12 px-4 lg:px-8 font-black text-xs lg:text-sm shadow-xl shadow-purple-500/20 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 mr-1 lg:mr-2" />
          <span className="hidden sm:inline">Nuevo Domicilio</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        {[
          {
            label: "Pendientes",
            value: stats.pending,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
          },
          {
            label: "En Cocina",
            value: stats.inPrep,
            icon: ChefHat,
            color: "text-blue-600",
            bg: "bg-blue-500/10",
          },
          {
            label: "Listos en Local",
            value: stats.ready,
            icon: Package,
            color: "text-green-600",
            bg: "bg-green-500/10",
          },
          {
            label: "En Camino",
            value: stats.dispatched,
            icon: Truck,
            color: "text-purple-600",
            bg: "bg-purple-500/10",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="pos-card p-3 lg:p-5 border-2 bg-white/60"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  s.bg,
                  s.color,
                )}
              >
                <s.icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <p className="text-[7px] lg:text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                {s.label}
              </p>
            </div>
            <p className={cn("text-xl lg:text-3xl font-black", s.color)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Delivery Tabs */}
      <Tabs defaultValue="activos" className="w-full">
        <TabsList className="bg-white/60 backdrop-blur-xl p-1 rounded-2xl border-2 border-accent/20 shadow-sm mb-6 flex w-full max-w-[320px]">
          <TabsTrigger
            value="activos"
            className="flex-1 rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-transparent data-[state=active]:border-purple-500/5"
          >
            <Truck className="h-4 w-4" strokeWidth={3} />
            Activos
            <Badge className="bg-purple-500 text-white border-none rounded-xl h-5 min-w-[20px] px-1.5 flex items-center justify-center font-black text-[9px] ml-1 shadow-md">
              {deliveryOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="historial"
            className="flex-1 rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-transparent data-[state=active]:border-purple-500/5"
          >
            <History className="h-4 w-4" strokeWidth={3} />
            Historial
            <Badge className="bg-purple-500 text-white border-none rounded-xl h-5 min-w-[20px] px-1.5 flex items-center justify-center font-black text-[9px] ml-1 shadow-md">
              {completedDeliveries.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="outline-none animate-in fade-in duration-300 space-y-6">
          {/* Sub-tabs for filtering active deliveries */}
          {deliveryOrders.length > 0 && (
            <div className="flex flex-wrap gap-2 p-1.5 bg-white/40 border border-accent/10 rounded-2xl w-fit">
              {[
                { id: "todos", label: "Todos", count: deliveryOrders.length },
                { id: "cocina", label: "En Cocina", count: stats.pending + stats.inPrep },
                { id: "listos", label: "Listos en Local", count: stats.ready },
                { id: "camino", label: "En Camino 🛵", count: stats.dispatched },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeSubTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-xl font-black text-[10px] uppercase tracking-wider px-3.5 py-2 h-8 transition-all shrink-0",
                    activeSubTab === tab.id
                      ? "bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-500/10"
                      : "text-muted-foreground hover:bg-purple-500/5 hover:text-purple-600"
                  )}
                  onClick={() => setActiveSubTab(tab.id as any)}
                >
                  {tab.label}
                  <Badge className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-black border-none shrink-0 h-4 min-w-[16px] flex items-center justify-center",
                    activeSubTab === tab.id ? "bg-white text-purple-600" : "bg-purple-100 text-purple-600"
                  )}>
                    {tab.count}
                  </Badge>
                </Button>
              ))}
            </div>
          )}

          {filteredActiveOrders.length === 0 ? (
            <div className="text-center py-20 bg-white/40 rounded-2xl border-2 border-dashed border-accent/15">
              <div className="inline-flex h-20 w-20 rounded-full bg-purple-500/5 items-center justify-center mb-4">
                <Truck className="h-10 w-10 text-purple-300" />
              </div>
              <p className="text-sm font-black text-muted-foreground/30 uppercase tracking-widest">
                {activeSubTab === "todos" 
                  ? "Sin domicilios activos" 
                  : activeSubTab === "cocina"
                  ? "Sin domicilios en cocina"
                  : activeSubTab === "listos"
                  ? "Sin domicilios listos en local"
                  : "Sin domicilios en camino"}
              </p>
              <p className="text-xs text-muted-foreground/20 mt-1">
                {activeSubTab === "todos" ? "Crea un nuevo pedido para comenzar" : "No hay pedidos en este estado en este momento"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredActiveOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="pos-card p-0 overflow-hidden border-2 border-purple-500/10 hover:border-purple-500/20 transition-all hover:shadow-lg"
                  >
                    {/* Card Header */}
                    <div className="p-4 bg-purple-500/5 border-b border-purple-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                          {order.locator}
                        </div>
                        <div>
                          <p className="font-black text-sm flex items-center gap-1.5">
                            <User className="h-3 w-3 text-purple-400" />
                            {order.delivery_name || "Cliente"}
                          </p>
                          <p className="text-[9px] text-muted-foreground/50">
                            {new Date(order.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-[8px] font-black text-purple-600/70 uppercase tracking-widest truncate max-w-[120px] mt-0.5">
                            {order.profiles?.name ? `Mesero: ${order.profiles.name}` : "Kiosko"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    {/* Customer Info */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground font-medium leading-tight">
                          {order.delivery_address || "Sin dirección"}
                        </span>
                      </div>
                      <a
                        href={`tel:${order.delivery_phone}`}
                        className="flex items-center gap-2 text-xs text-purple-600 font-bold hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {order.delivery_phone || "Sin teléfono"}
                      </a>
                    </div>

                    {/* Items & Total */}
                    <div className="px-4 pb-3 border-t border-accent/10 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                          {order.order_items?.length || 0} items
                        </span>
                        {(order.delivery_fee ?? 0) > 0 && (
                          <span className="text-[9px] font-bold text-purple-500">
                            Envío: {formatPrice(order.delivery_fee ?? 0)}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-black text-purple-600">
                        {formatPrice(order.total)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex items-center gap-2">
                      {getStatusActions(order)}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-[9px] font-black uppercase tracking-widest text-destructive border-destructive/20 hover:bg-destructive/5"
                        onClick={() => handleStatusChange(order.id, "cancelado")}
                        disabled={updatingIds.has(order.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial" className="outline-none animate-in fade-in duration-300">
          <div className="space-y-6">
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
                    order.created_at
                      ? new Date(order.created_at)
                      : new Date(),
                  );

                  // Invoice status check
                  const successInvoice = order.siigo_invoices?.find(
                    (inv) => inv.status === "success",
                  );
                  const hasInvoice = !!successInvoice || !!order.siigo_invoice_id;
                  const invoiceNumber = successInvoice?.siigo_invoice_number || order.siigo_invoice_number || "Facturado";

                  // Reconstruct breakdown from payment for eligibility check
                  const lastPayment = order.payments?.[0];
                  const paymentMethod = lastPayment?.method ?? order.payment_method;
                  const reconstructedBreakdown = lastPayment
                    ? {
                        efectivo: lastPayment.amount_efectivo ?? 0,
                        tarjeta: lastPayment.amount_tarjeta ?? 0,
                        nequi: lastPayment.amount_nequi ?? 0,
                      }
                    : undefined;
                  const isFacturacionAllowed = user?.role === "admin" || user?.role === "caja";
                  const canGenerateInvoice =
                    isFacturacionAllowed &&
                    !hasInvoice &&
                    shouldGenerateInvoice(paymentMethod ?? "efectivo", reconstructedBreakdown);

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
                              {order.profiles?.name ? `Mesero: ${order.profiles.name}` : "Kiosko"}
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
                            <div className="flex items-baseline gap-2">
                              <p className="text-xl lg:text-2xl font-black tracking-tighter text-foreground">
                                {formatPrice(order.total ?? 0)}
                              </p>
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
                            className="rounded-2xl h-10 border-2 font-black text-[10px] uppercase tracking-widest px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition-all active:scale-95 shadow-lg shadow-emerald-500/20 border-emerald-400/20"
                            onClick={() =>
                              setSiigoOrder({
                                order,
                                method: paymentMethod ?? "efectivo",
                                breakdown: reconstructedBreakdown,
                              })
                            }
                          >
                            <Zap
                              className="h-4 w-4 mr-2"
                              strokeWidth={3}
                            />
                            Generar Factura
                          </Button>
                        )}

                        {isEntregado && (user?.role === "admin" || user?.role === "caja") && (
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
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Celular"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
                />
                <Input
                  placeholder="Costo envío"
                  type="number"
                  value={deliveryFee || ""}
                  onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
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
  );
}
