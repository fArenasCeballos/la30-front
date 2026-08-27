import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useOrders } from "@/context/OrderContext";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Trash2,
  RefreshCcw,
  Clock,
  User,
  Hash,
  AlertCircle,
  Printer,
  X,
  ArrowRight,
  Calendar as CalendarIcon,
  Filter,
  ChevronDown,
  MapPin,
  Tag,
  UtensilsCrossed,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type {
  Order,
  OrderStatus,
  OrderItem,
  ProductWithCategory,
  InternalConsumptionWithItems,
  InternalPaymentStatus,
} from "@/types";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  buildCustomerReceiptHTML,
  silentPrint,
} from "@/lib/receiptUtils";
import {
  buildInternalConsumptionReceiptHTML,
} from "@/lib/internalReceiptUtils";
import {
  deleteConsumption,
  updateConsumptionPaymentStatus,
} from "@/lib/internalConsumptionService";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AnimatePresence, motion } from "framer-motion";

// ─── Payment Status Config ─────────────────────────────────────────────────────
const PAYMENT_STATUS_CONFIG: Record<
  InternalPaymentStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  paid: {
    label: "Pagado",
    icon: CheckCircle,
    className: "bg-green-100 text-green-700 border-green-300",
  },
  pending: {
    label: "Pendiente",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 border-red-300",
  },
  partial: {
    label: "Parcial",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
};

function CartItemImage({ product }: { product: ProductWithCategory }) {
  if (!product?.image_url) {
    return (
      <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-muted/30 shrink-0">
        <span className="text-lg">{product?.categories?.icon || "📦"}</span>
      </div>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(product.image_url, 80)}
      alt={product.name}
      className="w-10 h-10 rounded-xl object-cover border shrink-0 shadow-sm"
    />
  );
}

export default function Consultas() {
  const { user } = useAuth();
  const { stores, activeStore } = useStore();
  const { updateOrderStatus, refreshOrders } = useOrders();

  // ─── Tab State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"orders" | "consumptions">("orders");

  // ─── Orders State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ─── Consumption State ─────────────────────────────────────────────────────
  const [cSearchQuery, setCSearchQuery] = useState("");
  const [foundConsumptions, setFoundConsumptions] = useState<InternalConsumptionWithItems[]>([]);
  const [isCSearching, setIsCSearching] = useState(false);
  const [isCActionLoading, setIsCActionLoading] = useState(false);
  const [selectedConsumption, setSelectedConsumption] = useState<InternalConsumptionWithItems | null>(null);

  // ─── Shared Filters ────────────────────────────────────────────────────────
  const [storeId, setStoreId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [cStatusFilter, setCStatusFilter] = useState<InternalPaymentStatus | "all">("all");
  const [cTypeFilter, setCTypeFilter] = useState<string>("all");
  const [waiterId, setWaiterId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [cDateRange, setCDateRange] = useState<DateRange | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [showCFilters, setShowCFilters] = useState(false);
  const [profiles, setProfiles] = useState<
    { id: string; name: string | null }[]
  >([]);

  // Fetch profiles for filtering
  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");
      if (data) setProfiles(data);
    }
    if (user?.role === "admin") fetchProfiles();
  }, [user]);

  // Reset selections when changing tabs
  useEffect(() => {
    setSelectedOrder(null);
    setSelectedConsumption(null);
  }, [activeTab]);

  // Security check
  if (user?.role !== "admin") {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-16 w-16 text-destructive opacity-20" />
        <h1 className="text-2xl font-black tracking-tight">
          Acceso Restringido
        </h1>
        <p className="text-muted-foreground">
          Solo los administradores pueden acceder a este módulo.
        </p>
      </div>
    );
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Allow searching if there's a query OR if filters are applied
    const hasFilters =
      storeId !== "all" ||
      statusFilter !== "all" ||
      waiterId !== "all" ||
      dateRange?.from;
    if (!searchQuery.trim() && !hasFilters) {
      toast.error("Ingresa un término de búsqueda o aplica un filtro");
      return;
    }

    setIsSearching(true);
    setSelectedOrder(null);
    try {
      const trimmedQuery = searchQuery.trim();
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trimmedQuery,
        );

      let query = supabase
        .from("orders")
        .select(
          "*, order_items(*, products(*, categories(*))), profiles(*), payments(*), delivery_drivers(id, first_name, last_name)",
        );

      // 1. Text Search (Locator, ID, Notes)
      if (trimmedQuery) {
        let filter = `locator.eq.${trimmedQuery},notes.ilike.%${trimmedQuery}%`;
        if (isUUID) {
          filter += `,id.eq.${trimmedQuery}`;
        }
        query = query.or(filter);
      }

      // 2. Store Filter
      if (storeId !== "all") {
        query = query.eq("store_id", storeId);
      }

      // 3. Status Filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // 4. Waiter Filter
      if (waiterId !== "all") {
        query = query.eq("user_id", waiterId);
      }

      // 5. Date Range Filter
      if (dateRange?.from) {
        query = query.gte(
          "created_at",
          startOfDay(dateRange.from).toISOString(),
        );
        if (dateRange.to) {
          query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
        } else {
          query = query.lte(
            "created_at",
            endOfDay(dateRange.from).toISOString(),
          );
        }
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(trimmedQuery ? 20 : 50);

      if (error) {
        toast.error("Error en la búsqueda");
        setFoundOrders([]);
      } else if (!data || data.length === 0) {
        toast.error("No se encontraron resultados");
        setFoundOrders([]);
      } else {
        const results = data as unknown as Order[];
        setFoundOrders(results);
        if (results.length === 1) {
          setSelectedOrder(results[0]);
        }
        toast.success(`${results.length} registro(s) encontrado(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al buscar");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setIsActionLoading(true);

    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Pedido eliminado permanentemente");
      setFoundOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      refreshOrders();
    } catch (err) {
      const error = err as Error;
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    setIsActionLoading(true);

    try {
      await updateOrderStatus(orderId, newStatus);
      // Refresh local view
      setFoundOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      refreshOrders();
    } catch (err) {
      toast.error("Error al actualizar el estado");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePrintReceipt = async (order: Order) => {
    try {
      const payment = order.payments?.[0];
      const receiptHTML = buildCustomerReceiptHTML({
        order,
        cajeroName: order.profiles?.name || "Administrador",
        paymentMethod: payment?.method,
        paymentReceived: payment?.amount_received,
        paymentChange: payment?.amount_change,
        paymentBreakdown: payment
          ? {
              efectivo: payment.amount_efectivo,
              tarjeta: payment.amount_tarjeta,
              nequi: payment.amount_nequi,
            }
          : undefined,
      });

      await silentPrint(receiptHTML);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar la factura");
    }
  };

  // ─── Consumption Search ───────────────────────────────────────────────────
  const handleConsumptionSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const hasFilters =
      storeId !== "all" ||
      cStatusFilter !== "all" ||
      cTypeFilter !== "all" ||
      cDateRange?.from;
    if (!cSearchQuery.trim() && !hasFilters) {
      toast.error("Ingresa un término de búsqueda o aplica un filtro");
      return;
    }

    setIsCSearching(true);
    setSelectedConsumption(null);
    try {
      const trimmedQuery = cSearchQuery.trim();
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trimmedQuery,
        );

      let query = supabase
        .from("internal_consumptions" as never)
        .select(
          "*, internal_consumption_items(*)" as never,
        );

      // Text search
      if (trimmedQuery) {
        if (isUUID) {
          query = query.eq("id" as never, trimmedQuery as never);
        } else {
          query = query.ilike("consumer_name" as never, `%${trimmedQuery}%` as never);
        }
      }

      // Store filter
      if (storeId !== "all") {
        query = query.eq("store_id" as never, storeId as never);
      }

      // Payment status filter
      if (cStatusFilter !== "all") {
        query = query.eq("payment_status" as never, cStatusFilter as never);
      }

      // Consumer type filter
      if (cTypeFilter !== "all") {
        query = query.eq("consumer_type" as never, cTypeFilter as never);
      }

      // Date range filter
      if (cDateRange?.from) {
        query = query.gte(
          "created_at" as never,
          startOfDay(cDateRange.from).toISOString() as never,
        );
        if (cDateRange.to) {
          query = query.lte("created_at" as never, endOfDay(cDateRange.to).toISOString() as never);
        } else {
          query = query.lte(
            "created_at" as never,
            endOfDay(cDateRange.from).toISOString() as never,
          );
        }
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(trimmedQuery ? 20 : 50);

      if (error) {
        toast.error("Error en la búsqueda");
        setFoundConsumptions([]);
      } else if (!data || data.length === 0) {
        toast.error("No se encontraron resultados");
        setFoundConsumptions([]);
      } else {
        const results = data as unknown as InternalConsumptionWithItems[];
        setFoundConsumptions(results);
        if (results.length === 1) {
          setSelectedConsumption(results[0]);
        }
        toast.success(`${results.length} registro(s) encontrado(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al buscar");
    } finally {
      setIsCSearching(false);
    }
  };

  const handleDeleteConsumption = async (consumptionId: string) => {
    setIsCActionLoading(true);
    try {
      await deleteConsumption(consumptionId);
      toast.success("Consumo interno eliminado permanentemente");
      setFoundConsumptions((prev) => prev.filter((c) => c.id !== consumptionId));
      if (selectedConsumption?.id === consumptionId) setSelectedConsumption(null);
    } catch (err) {
      const error = err as Error;
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsCActionLoading(false);
    }
  };

  const handleConsumptionStatusChange = async (
    consumptionId: string,
    newStatus: InternalPaymentStatus,
  ) => {
    setIsCActionLoading(true);
    try {
      await updateConsumptionPaymentStatus(consumptionId, newStatus);
      setFoundConsumptions((prev) =>
        prev.map((c) =>
          c.id === consumptionId ? { ...c, payment_status: newStatus } : c,
        ),
      );
      if (selectedConsumption?.id === consumptionId) {
        setSelectedConsumption({ ...selectedConsumption, payment_status: newStatus });
      }
      toast.success("Estado de pago actualizado");
    } catch (err) {
      toast.error("Error al actualizar el estado");
    } finally {
      setIsCActionLoading(false);
    }
  };

  const handlePrintConsumption = async (consumption: InternalConsumptionWithItems) => {
    try {
      const html = buildInternalConsumptionReceiptHTML({
        consumption,
        storeName: activeStore?.name ?? "La 30",
        cashierName: user?.name ?? "Administrador",
      });
      await silentPrint(html, "Consumo Interno");
    } catch {
      toast.error("Error al reimprimir tirilla");
    }
  };

  return (
    <div className="section-container space-y-8 animate-in fade-in duration-500 pb-32">
      {/* Header */}
      <div className="space-y-1 lg:space-y-2 no-print">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 lg:p-2.5 rounded-xl lg:rounded-2xl">
            <Search
              className="h-5 w-5 lg:h-6 lg:w-6 text-primary"
              strokeWidth={2.5}
            />
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-black tracking-tight">
              Consultas de Control
            </h1>
            <p className="text-[8px] lg:text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5 lg:mt-1">
              Administración Central • Búsqueda Quirúrgica
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-accent/10 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === "orders"
                ? "bg-white text-primary shadow-soft"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </button>
          <button
            onClick={() => setActiveTab("consumptions")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === "consumptions"
                ? "bg-white text-primary shadow-soft"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            <UtensilsCrossed className="h-4 w-4" />
            Consumo Interno
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ORDERS TAB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <>
          {/* Search Form & Filters */}
          <form
            onSubmit={handleSearch}
            className="max-w-4xl mx-auto mb-12 space-y-4 no-print"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-linear-to-r from-primary/20 to-orange-500/20 rounded-4xl lg:rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-white rounded-3xl lg:rounded-4xl border-2 border-primary/10 shadow-strong overflow-hidden p-1.5 lg:p-2 pr-3 lg:pr-4 transition-all focus-within:border-primary/30">
                <div className="pl-4 lg:pl-6 pr-2 lg:pr-4">
                  <Search className="h-5 w-5 lg:h-6 lg:w-6 text-primary animate-pulse" />
                </div>
                <Input
                  type="text"
                  placeholder="Localizador, ID o Notas..."
                  className="border-none shadow-none text-base lg:text-xl font-black h-10 lg:h-14 focus-visible:ring-0 placeholder:text-muted-foreground/30 px-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "rounded-2xl h-10 lg:h-14 px-3 lg:px-4 font-black transition-all",
                      showFilters
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <Filter className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span className="hidden sm:inline ml-2">FILTROS</span>
                    <ChevronDown
                      className={cn(
                        "hidden sm:inline h-3 w-3 lg:h-4 lg:w-4 ml-2 transition-transform",
                        showFilters && "rotate-180",
                      )}
                    />
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSearching}
                    className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-10 lg:h-14 px-4 lg:px-10 font-black text-sm lg:text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all"
                  >
                    {isSearching ? (
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 lg:hidden" />
                        <span className="hidden lg:inline">BUSCAR</span>
                        <span className="hidden sm:inline lg:hidden">BUSCAR</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pos-card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-2 border-primary/5">
                    {/* Store Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <MapPin className="h-3 w-3" /> Punto de Venta
                      </label>
                      <Select value={storeId} onValueChange={setStoreId}>
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Todas las tiendas" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">
                            Todos los Puntos
                          </SelectItem>
                          {stores.map((s) => (
                            <SelectItem
                              key={s.id}
                              value={s.id}
                              className="font-bold"
                            >
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <Tag className="h-3 w-3" /> Estado
                      </label>
                      <Select
                        value={statusFilter}
                        onValueChange={(val) =>
                          setStatusFilter(val as OrderStatus | "all")
                        }
                      >
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Cualquier estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">
                            Todos los Estados
                          </SelectItem>
                          {[
                            "pendiente",
                            "confirmado",
                            "en_preparacion",
                            "listo",
                            "entregado",
                            "cancelado",
                          ].map((s) => (
                            <SelectItem
                              key={s}
                              value={s}
                              className="font-bold capitalize"
                            >
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Waiter Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <User className="h-3 w-3" /> Mesero / Usuario
                      </label>
                      <Select value={waiterId} onValueChange={setWaiterId}>
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Todos los usuarios" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">
                            Todos los Meseros
                          </SelectItem>
                          {profiles.map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              className="font-bold"
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Picker */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <CalendarIcon className="h-3 w-3" /> Rango de Fechas
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-bold rounded-xl border-2 border-primary/5 bg-accent/5",
                              !dateRange && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "dd LLL", { locale: es })}{" "}
                                  - {format(dateRange.to, "dd LLL", { locale: es })}
                                </>
                              ) : (
                                format(dateRange.from, "dd LLL", { locale: es })
                              )
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 rounded-3xl border-none shadow-strong"
                          align="end"
                        >
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-4">
              Busca cualquier pedido histórico o activo usando los filtros
              superiores
            </p>
          </form>

          {/* Result Area */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Results List (if multiple or single but not selected) */}
            {foundOrders.length >= 1 && !selectedOrder && (
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 no-print">
                {foundOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="pos-card p-6 cursor-pointer hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white border-2 border-primary/10 flex items-center justify-center font-black text-primary group-hover:border-primary/30 transition-all">
                        {order.locator}
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                      {format(new Date(order.created_at), "PPp", { locale: es })}
                    </p>
                    <p className="text-lg font-black text-primary">
                      {formatPrice(order.total)}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-muted-foreground/50 uppercase">
                      <span>{order.order_items?.length || 0} items</span>
                      <div className="flex items-center gap-1">
                        Ver Detalles <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Order Detail */}
            {selectedOrder ? (
              <div className="lg:col-span-12 space-y-4 animate-in zoom-in duration-300">
                {foundOrders.length >= 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrder(null)}
                    className="font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary no-print"
                  >
                    <X className="h-3 w-3 mr-2" />
                    Volver a la lista
                  </Button>
                )}

                <div className="pos-card p-0 overflow-hidden border-2 border-primary/10 shadow-strong print-only">
                  {/* Card Header */}
                  <div className="p-6 lg:p-8 bg-accent/5 border-b border-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-primary/20 shadow-soft flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-black opacity-30 leading-none mb-1">
                          LOC
                        </span>
                        <span className="text-2xl font-black text-primary">
                          {selectedOrder.locator}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                          Pedido Detectado
                          <StatusBadge status={selectedOrder.status} />
                        </h2>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(selectedOrder.created_at), "PPP pp", {
                              locale: es,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-12 w-12 border-2 hover:bg-white transition-all"
                        onClick={() => handlePrintReceipt(selectedOrder)}
                      >
                        <Printer className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-12 w-12 border-2 hover:text-destructive hover:border-destructive transition-all"
                        onClick={() => {
                          if (foundOrders.length > 1) {
                            setSelectedOrder(null);
                          } else {
                            setFoundOrders([]);
                            setSearchQuery("");
                          }
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="rounded-xl h-12 px-6 font-black shadow-lg shadow-destructive/10"
                            disabled={isActionLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            ELIMINAR
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-none shadow-strong">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black tracking-tight">
                              ¿Eliminar definitivamente?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="font-medium text-muted-foreground text-base">
                              Esta acción es irreversible. Se eliminarán los
                              registros de venta, pagos e ítems asociados al
                              localizador{" "}
                              <span className="text-primary font-black">
                                {selectedOrder.locator}
                              </span>
                              .
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6">
                            <AlertDialogCancel className="rounded-2xl h-12 font-black">
                              CANCELAR
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteOrder(selectedOrder.id)}
                              className="rounded-2xl h-12 font-black bg-destructive hover:bg-destructive/90"
                            >
                              SÍ, ELIMINAR TODO
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 lg:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Left Column: Data */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 border-b pb-2 flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5" />
                          Detalles del Registro
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">
                              ID Único
                            </p>
                            <p className="text-xs font-mono font-bold truncate">
                              {selectedOrder.id}
                            </p>
                          </div>
                          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">
                              Vendedor
                            </p>
                            <p className="text-xs font-bold flex items-center gap-1.5">
                              <User className="h-3 w-3 text-primary" />
                              {selectedOrder.profiles?.name || "Desconocido"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 no-print">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 border-b pb-2 flex items-center gap-2">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Cambio de Estado Manual
                        </h3>
                        <div className="flex items-center gap-3">
                          <Select
                            value={selectedOrder.status}
                            onValueChange={(val) =>
                              handleStatusChange(
                                selectedOrder.id,
                                val as OrderStatus,
                              )
                            }
                          >
                            <SelectTrigger className="h-12 rounded-xl font-black text-xs tracking-widest uppercase bg-white/50 border-2 border-primary/10">
                              <SelectValue placeholder="Cambiar Estado" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-strong">
                              {[
                                "pendiente",
                                "confirmado",
                                "en_preparacion",
                                "listo",
                                "entregado",
                                "cancelado",
                              ].map((s) => (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  className="font-black text-[10px] tracking-widest uppercase py-3"
                                >
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground/60 leading-relaxed italic">
                          * Mover un pedido a "Entregado" lo sacará de la vista
                          activa de Caja y Cocina.
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Order Content */}
                    <div className="space-y-6">
                      <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center justify-between">
                          Contenido del Pedido
                          <span className="bg-primary/10 px-2 py-0.5 rounded-lg">
                            {selectedOrder.order_items?.length || 0} ITEMS
                          </span>
                        </h3>
                        <div className="space-y-4">
                          {selectedOrder.order_items?.map(
                            (item: OrderItem, i: number) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-4 group/item"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="relative">
                                    <CartItemImage product={item.products} />
                                    <div className="absolute -top-2 -right-2 h-5 w-5 rounded-lg bg-primary text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-soft">
                                      {item.quantity}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-black leading-tight group-hover/item:text-primary transition-colors">
                                      {item.products?.name}
                                    </p>
                                    <p className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-tighter">
                                      {item.products?.categories?.name}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-xs font-bold tabular-nums text-muted-foreground">
                                  {formatPrice(item.unit_price * item.quantity)}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-dashed border-primary/20 flex items-center justify-between">
                          <p className="text-xs font-black text-primary uppercase">
                            Total Facturado
                          </p>
                          <p className="text-xl font-black text-primary">
                            {formatPrice(selectedOrder.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : searchQuery && !isSearching && foundOrders.length === 0 ? (
              <div className="lg:col-span-12 text-center py-20 space-y-6 opacity-30">
                <div className="h-24 w-24 rounded-4xl border-4 border-dashed border-primary mx-auto flex items-center justify-center">
                  <Search className="h-10 w-10 text-primary" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm">
                  Sin resultados para tu búsqueda
                </p>
              </div>
            ) : (
              !isSearching &&
              foundOrders.length === 0 && (
                <div className="lg:col-span-12 h-[40vh] flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                  <AlertCircle className="h-20 w-20" />
                  <div className="space-y-1">
                    <p className="font-black text-lg uppercase tracking-widest">
                      Esperando Búsqueda
                    </p>
                    <p className="font-medium max-w-xs">
                      Ingresa filtros o un código para iniciar la consulta.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CONSUMO INTERNO TAB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "consumptions" && (
        <>
          {/* Search Form & Filters */}
          <form
            onSubmit={handleConsumptionSearch}
            className="max-w-4xl mx-auto mb-12 space-y-4 no-print"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-linear-to-r from-amber-500/20 to-orange-500/20 rounded-4xl lg:rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-white rounded-3xl lg:rounded-4xl border-2 border-amber-500/10 shadow-strong overflow-hidden p-1.5 lg:p-2 pr-3 lg:pr-4 transition-all focus-within:border-amber-500/30">
                <div className="pl-4 lg:pl-6 pr-2 lg:pr-4">
                  <UtensilsCrossed className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600 animate-pulse" />
                </div>
                <Input
                  type="text"
                  placeholder="Nombre del consumidor o ID..."
                  className="border-none shadow-none text-base lg:text-xl font-black h-10 lg:h-14 focus-visible:ring-0 placeholder:text-muted-foreground/30 px-0"
                  value={cSearchQuery}
                  onChange={(e) => setCSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCFilters(!showCFilters)}
                    className={cn(
                      "rounded-2xl h-10 lg:h-14 px-3 lg:px-4 font-black transition-all",
                      showCFilters
                        ? "bg-amber-500/10 text-amber-600"
                        : "text-muted-foreground",
                    )}
                  >
                    <Filter className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span className="hidden sm:inline ml-2">FILTROS</span>
                    <ChevronDown
                      className={cn(
                        "hidden sm:inline h-3 w-3 lg:h-4 lg:w-4 ml-2 transition-transform",
                        showCFilters && "rotate-180",
                      )}
                    />
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCSearching}
                    className="bg-amber-600 hover:bg-amber-600/90 text-white rounded-2xl h-10 lg:h-14 px-4 lg:px-10 font-black text-sm lg:text-lg shadow-xl shadow-amber-600/20 active:scale-95 transition-all"
                  >
                    {isCSearching ? (
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 lg:hidden" />
                        <span className="hidden lg:inline">BUSCAR</span>
                        <span className="hidden sm:inline lg:hidden">BUSCAR</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showCFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pos-card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-2 border-amber-500/5">
                    {/* Store Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <MapPin className="h-3 w-3" /> Punto de Venta
                      </label>
                      <Select value={storeId} onValueChange={setStoreId}>
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Todas las tiendas" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">Todos los Puntos</SelectItem>
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Status Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <Tag className="h-3 w-3" /> Estado de Pago
                      </label>
                      <Select
                        value={cStatusFilter}
                        onValueChange={(val) => setCStatusFilter(val as InternalPaymentStatus | "all")}
                      >
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Cualquier estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">Todos los Estados</SelectItem>
                          <SelectItem value="paid" className="font-bold">✅ Pagado</SelectItem>
                          <SelectItem value="pending" className="font-bold">🔴 Pendiente</SelectItem>
                          <SelectItem value="partial" className="font-bold">⚠️ Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Consumer Type Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <User className="h-3 w-3" /> Tipo de Consumidor
                      </label>
                      <Select value={cTypeFilter} onValueChange={setCTypeFilter}>
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">Todos</SelectItem>
                          <SelectItem value="employee" className="font-bold">👤 Empleado</SelectItem>
                          <SelectItem value="partner" className="font-bold">🤝 Socio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Picker */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <CalendarIcon className="h-3 w-3" /> Rango de Fechas
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-bold rounded-xl border-2 border-primary/5 bg-accent/5",
                              !cDateRange && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {cDateRange?.from ? (
                              cDateRange.to ? (
                                <>
                                  {format(cDateRange.from, "dd LLL", { locale: es })}{" "}
                                  - {format(cDateRange.to, "dd LLL", { locale: es })}
                                </>
                              ) : (
                                format(cDateRange.from, "dd LLL", { locale: es })
                              )
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-strong" align="end">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={cDateRange?.from}
                            selected={cDateRange}
                            onSelect={setCDateRange}
                            numberOfMonths={2}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-4">
              Busca consumos internos por nombre de consumidor o aplica filtros
            </p>
          </form>

          {/* Consumption Results */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Results List */}
            {foundConsumptions.length >= 1 && !selectedConsumption && (
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 no-print">
                {foundConsumptions.map((c) => {
                  const statusCfg = PAYMENT_STATUS_CONFIG[c.payment_status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConsumption(c)}
                      className="pos-card p-6 cursor-pointer hover:border-amber-500/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 border-2 border-amber-500/10 flex items-center justify-center group-hover:border-amber-500/30 transition-all">
                          <UtensilsCrossed className="h-5 w-5 text-amber-600" />
                        </div>
                        <Badge className={cn("text-[9px] font-black uppercase gap-1", statusCfg.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-black">{c.consumer_name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground mb-2">
                        {c.consumer_type === "employee" ? "Empleado" : "Socio"} ·{" "}
                        {format(new Date(c.created_at), "PPp", { locale: es })}
                      </p>
                      <p className="text-lg font-black text-amber-600">
                        {formatPrice(c.total)}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-muted-foreground/50 uppercase">
                        <span>{c.internal_consumption_items?.length || 0} items</span>
                        <div className="flex items-center gap-1">
                          Ver Detalles <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Consumption Detail */}
            {selectedConsumption ? (
              <div className="lg:col-span-12 space-y-4 animate-in zoom-in duration-300">
                {foundConsumptions.length >= 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedConsumption(null)}
                    className="font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:text-amber-600 no-print"
                  >
                    <X className="h-3 w-3 mr-2" />
                    Volver a la lista
                  </Button>
                )}

                <div className="pos-card p-0 overflow-hidden border-2 border-amber-500/10 shadow-strong">
                  {/* Header */}
                  <div className="p-6 lg:p-8 bg-amber-50/50 border-b border-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-amber-500/20 shadow-soft flex items-center justify-center shrink-0">
                        <UtensilsCrossed className="h-7 w-7 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                          {selectedConsumption.consumer_name}
                          <Badge className={cn("text-[9px] font-black uppercase gap-1", PAYMENT_STATUS_CONFIG[selectedConsumption.payment_status].className)}>
                            {(() => { const Ic = PAYMENT_STATUS_CONFIG[selectedConsumption.payment_status].icon; return <Ic className="h-3 w-3" />; })()}
                            {PAYMENT_STATUS_CONFIG[selectedConsumption.payment_status].label}
                          </Badge>
                        </h2>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(selectedConsumption.created_at), "PPP pp", { locale: es })}
                          </span>
                          <span className="text-xs font-bold">
                            {selectedConsumption.consumer_type === "employee" ? "👤 Empleado" : "🤝 Socio"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-12 w-12 border-2 hover:bg-white transition-all"
                        onClick={() => handlePrintConsumption(selectedConsumption)}
                      >
                        <Printer className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-12 w-12 border-2 hover:text-destructive hover:border-destructive transition-all"
                        onClick={() => {
                          if (foundConsumptions.length > 1) {
                            setSelectedConsumption(null);
                          } else {
                            setFoundConsumptions([]);
                            setCSearchQuery("");
                          }
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="rounded-xl h-12 px-6 font-black shadow-lg shadow-destructive/10"
                            disabled={isCActionLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            ELIMINAR
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-none shadow-strong">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black tracking-tight">
                              ¿Eliminar consumo interno?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="font-medium text-muted-foreground text-base">
                              Esta acción es irreversible. Se eliminarán los registros de consumo,
                              ítems y pagos asociados a{" "}
                              <span className="text-amber-600 font-black">
                                {selectedConsumption.consumer_name}
                              </span>
                              .
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6">
                            <AlertDialogCancel className="rounded-2xl h-12 font-black">
                              CANCELAR
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteConsumption(selectedConsumption.id)}
                              className="rounded-2xl h-12 font-black bg-destructive hover:bg-destructive/90"
                            >
                              SÍ, ELIMINAR TODO
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 lg:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Left: Data & Status */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 border-b pb-2 flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5" />
                          Detalles del Registro
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">ID Único</p>
                            <p className="text-xs font-mono font-bold truncate">{selectedConsumption.id}</p>
                          </div>
                          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">Tipo</p>
                            <p className="text-xs font-bold">
                              {selectedConsumption.consumer_type === "employee" ? "👤 Empleado" : "🤝 Socio"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 no-print">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 border-b pb-2 flex items-center gap-2">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Cambio de Estado de Pago
                        </h3>
                        <div className="flex items-center gap-3">
                          <Select
                            value={selectedConsumption.payment_status}
                            onValueChange={(val) =>
                              handleConsumptionStatusChange(
                                selectedConsumption.id,
                                val as InternalPaymentStatus,
                              )
                            }
                          >
                            <SelectTrigger className="h-12 rounded-xl font-black text-xs tracking-widest uppercase bg-white/50 border-2 border-amber-500/10">
                              <SelectValue placeholder="Cambiar Estado" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-strong">
                              <SelectItem value="pending" className="font-black text-[10px] tracking-widest uppercase py-3">
                                🔴 Pendiente
                              </SelectItem>
                              <SelectItem value="partial" className="font-black text-[10px] tracking-widest uppercase py-3">
                                ⚠️ Parcial
                              </SelectItem>
                              <SelectItem value="paid" className="font-black text-[10px] tracking-widest uppercase py-3">
                                ✅ Pagado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground/60 leading-relaxed italic">
                          * Cambiar a "Pagado" marcará el consumo como liquidado.
                        </p>
                      </div>
                    </div>

                    {/* Right: Items */}
                    <div className="space-y-6">
                      <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-500/10">
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center justify-between">
                          Contenido del Consumo
                          <span className="bg-amber-500/10 px-2 py-0.5 rounded-lg">
                            {selectedConsumption.internal_consumption_items?.length || 0} ITEMS
                          </span>
                        </h3>
                        <div className="space-y-3">
                          {(selectedConsumption.internal_consumption_items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs font-black leading-tight">
                                  {item.quantity}x {item.product_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.is_beverage && (
                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                                      Bebida
                                    </span>
                                  )}
                                  {item.discount_percent > 0 && (
                                    <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                      -{item.discount_percent}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs font-bold tabular-nums text-muted-foreground">
                                {formatPrice(item.subtotal)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-dashed border-amber-500/20 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Original</span>
                            <span className="line-through">{formatPrice(selectedConsumption.total_original)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-green-600">
                            <span>Descuento</span>
                            <span>-{formatPrice(selectedConsumption.discount_total)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                            <p className="text-xs font-black text-amber-600 uppercase">Total</p>
                            <p className="text-xl font-black text-amber-600">{formatPrice(selectedConsumption.total)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : cSearchQuery && !isCSearching && foundConsumptions.length === 0 ? (
              <div className="lg:col-span-12 text-center py-20 space-y-6 opacity-30">
                <div className="h-24 w-24 rounded-4xl border-4 border-dashed border-amber-500 mx-auto flex items-center justify-center">
                  <UtensilsCrossed className="h-10 w-10 text-amber-600" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm">
                  Sin resultados para tu búsqueda
                </p>
              </div>
            ) : (
              !isCSearching &&
              foundConsumptions.length === 0 && (
                <div className="lg:col-span-12 h-[40vh] flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                  <UtensilsCrossed className="h-20 w-20" />
                  <div className="space-y-1">
                    <p className="font-black text-lg uppercase tracking-widest">
                      Esperando Búsqueda
                    </p>
                    <p className="font-medium max-w-xs">
                      Busca consumos internos por nombre o aplica filtros.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
