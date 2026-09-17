import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useOrders } from "@/context/OrderContext";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ShieldCheck,
  History,
  Eye,
  CheckCircle2,
  AlertOctagon,
  UserCheck,
  Building2,
  Loader2,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type {
  Order,
  OrderStatus,
  OrderItem,
  ProductWithCategory,
  InternalConsumptionWithItems,
  InternalPaymentStatus,
  OrderStatusLog,
} from "@/types";
import { getCurrentShiftDate, getCalendarShiftRange } from "@/lib/shiftUtils";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buildCustomerReceiptHTML, silentPrint } from "@/lib/receiptUtils";
import { buildInternalConsumptionReceiptHTML } from "@/lib/internalReceiptUtils";
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
  const queryClient = useQueryClient();

  // ─── Tab State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    "orders" | "consumptions" | "audit"
  >("orders");

  // ─── Orders State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ─── Status Change Modal State ─────────────────────────────────────────────
  const [statusModal, setStatusModal] = useState<{
    order: Order;
    targetStatus: OrderStatus;
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // ─── Consumption State ─────────────────────────────────────────────────────
  const [cSearchQuery, setCSearchQuery] = useState("");
  const [foundConsumptions, setFoundConsumptions] = useState<
    InternalConsumptionWithItems[]
  >([]);
  const [isCSearching, setIsCSearching] = useState(false);
  const [isCActionLoading, setIsCActionLoading] = useState(false);
  const [selectedConsumption, setSelectedConsumption] =
    useState<InternalConsumptionWithItems | null>(null);

  // ─── Shift Audit State (Admin Exclusive) ──────────────────────────────────
  const [shiftPreset, setShiftPreset] = useState<
    "current" | "previous" | "custom"
  >("current");
  const [customAuditDateRange, setCustomAuditDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [auditStoreId, setAuditStoreId] = useState<string>("all");
  const [auditUserId, setAuditUserId] = useState<string>("all");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  const auditShiftRange = useMemo(() => {
    if (shiftPreset === "current") {
      const shiftDate = getCurrentShiftDate();
      return getCalendarShiftRange(shiftDate, shiftDate);
    }
    if (shiftPreset === "previous") {
      const shiftDate = subDays(getCurrentShiftDate(), 1);
      return getCalendarShiftRange(shiftDate, shiftDate);
    }
    if (customAuditDateRange?.from) {
      return getCalendarShiftRange(
        customAuditDateRange.from,
        customAuditDateRange.to,
      );
    }
    const today = getCurrentShiftDate();
    return getCalendarShiftRange(today, today);
  }, [shiftPreset, customAuditDateRange]);

  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    refetch: refetchAuditLogs,
  } = useQuery({
    queryKey: [
      "order-status-shift-logs",
      auditShiftRange.from.toISOString(),
      auditShiftRange.to.toISOString(),
      auditStoreId,
      auditUserId,
    ],
    queryFn: async () => {
      let query = supabase
        .from("order_status_logs" as never)
        .select(
          "*, orders(id, locator, ticket_number, total, is_delivery), profiles:changed_by(name, role), stores(id, name, icon)" as never,
        )
        .gte("created_at" as never, auditShiftRange.from.toISOString())
        .lte("created_at" as never, auditShiftRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (auditStoreId !== "all") {
        query = query.eq("store_id" as never, auditStoreId);
      }
      if (auditUserId !== "all") {
        query = query.eq("changed_by" as never, auditUserId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching audit logs:", error);
        return [];
      }
      return (data || []) as unknown as OrderStatusLog[];
    },
    enabled: user?.role === "admin" && activeTab === "audit",
  });

  const {
    data: selectedOrderLogs = [],
    isLoading: isLoadingSelectedOrderLogs,
  } = useQuery({
    queryKey: ["order-audit-history", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      const { data, error } = await supabase
        .from("order_status_logs" as never)
        .select("*, profiles:changed_by(name, role)" as never)
        .eq("order_id" as never, selectedOrder.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data || []) as unknown as OrderStatusLog[];
    },
    enabled: user?.role === "admin" && !!selectedOrder?.id,
  });

  // ─── Shared Filters ────────────────────────────────────────────────────────
  const [storeId, setStoreId] = useState<string>(() => {
    if (user?.role === "caja" && activeStore?.id) {
      return activeStore.id;
    }
    return "all";
  });

  useEffect(() => {
    if (user?.role === "caja" && activeStore?.id) {
      setStoreId(activeStore.id);
    }
  }, [user?.role, activeStore?.id]);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [cStatusFilter, setCStatusFilter] = useState<
    InternalPaymentStatus | "all"
  >("all");
  const [cTypeFilter, setCTypeFilter] = useState<string>("all");
  const [waiterId, setWaiterId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [cDateRange, setCDateRange] = useState<DateRange | undefined>(
    undefined,
  );
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
    if (user?.role === "admin" || user?.role === "caja") fetchProfiles();
  }, [user]);

  // Reset selections when changing tabs
  useEffect(() => {
    setSelectedOrder(null);
    setSelectedConsumption(null);
  }, [activeTab]);

  // Security check
  if (user?.role !== "admin" && user?.role !== "caja") {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-16 w-16 text-destructive opacity-20" />
        <h1 className="text-2xl font-black tracking-tight">
          Acceso Restringido
        </h1>
        <p className="text-muted-foreground">
          Solo administradores y personal de caja pueden acceder a este módulo.
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
      const companyStoreIds = stores.map((s) => s.id);
      if (storeId !== "all") {
        query = query.eq("store_id", storeId);
      } else if (companyStoreIds.length > 0) {
        query = query.in("store_id", companyStoreIds);
      } else {
        query = query.eq("store_id", "00000000-0000-0000-0000-000000000000");
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
    reason?: string,
  ) => {
    setIsActionLoading(true);
    setIsSubmittingStatus(true);

    try {
      const ok = await updateOrderStatus(orderId, newStatus, reason);
      if (!ok) return;
      // Refresh local view
      setFoundOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: newStatus } : null,
        );
      }
      refreshOrders();
      queryClient.invalidateQueries({
        queryKey: ["order-audit-history", orderId],
      });
      queryClient.invalidateQueries({ queryKey: ["order-status-shift-logs"] });
      toast.success(
        user?.role === "caja"
          ? "Estado actualizado y notificado a administración"
          : "Estado del pedido actualizado correctamente",
      );
      setStatusModal(null);
      setStatusReason("");
    } catch (err) {
      toast.error("Error al actualizar el estado");
    } finally {
      setIsActionLoading(false);
      setIsSubmittingStatus(false);
    }
  };

  const handleInspectOrderFromAudit = async (
    orderId: string,
    locator?: string | null,
  ) => {
    setActiveTab("orders");
    setSearchQuery(locator || orderId);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, order_items(*, products(*, categories(*))), profiles(*), payments(*), delivery_drivers(id, first_name, last_name)",
        )
        .eq("id", orderId)
        .single();
      if (!error && data) {
        const ord = data as unknown as Order;
        setFoundOrders([ord]);
        setSelectedOrder(ord);
        toast.success(`Orden #${ord.locator || ord.ticket_number} cargada`);
      }
    } catch (err) {
      console.error(err);
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
        .select("*, internal_consumption_items(*)" as never);

      // Text search
      if (trimmedQuery) {
        if (isUUID) {
          query = query.eq("id" as never, trimmedQuery as never);
        } else {
          query = query.ilike(
            "consumer_name" as never,
            `%${trimmedQuery}%` as never,
          );
        }
      }

      // Store filter
      const cCompanyStoreIds = stores.map((s) => s.id);
      if (storeId !== "all") {
        query = query.eq("store_id" as never, storeId as never);
      } else if (cCompanyStoreIds.length > 0) {
        query = query.in("store_id" as never, cCompanyStoreIds as never);
      } else {
        query = query.eq(
          "store_id" as never,
          "00000000-0000-0000-0000-000000000000" as never,
        );
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
          query = query.lte(
            "created_at" as never,
            endOfDay(cDateRange.to).toISOString() as never,
          );
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
      setFoundConsumptions((prev) =>
        prev.filter((c) => c.id !== consumptionId),
      );
      if (selectedConsumption?.id === consumptionId)
        setSelectedConsumption(null);
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
        setSelectedConsumption({
          ...selectedConsumption,
          payment_status: newStatus,
        });
      }
      toast.success("Estado de pago actualizado");
    } catch (err) {
      toast.error("Error al actualizar el estado");
    } finally {
      setIsCActionLoading(false);
    }
  };

  const handlePrintConsumption = async (
    consumption: InternalConsumptionWithItems,
  ) => {
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
              {user?.role === "caja"
                ? "Punto de Venta & Caja • Control de Pedidos"
                : "Administración Central • Búsqueda Quirúrgica & Auditoría"}
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-accent/10 p-1.5 rounded-2xl w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
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
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
              activeTab === "consumptions"
                ? "bg-white text-primary shadow-soft"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
          >
            <UtensilsCrossed className="h-4 w-4" />
            Consumo Interno
          </button>
          {user?.role === "admin" && (
            <button
              onClick={() => setActiveTab("audit")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                activeTab === "audit"
                  ? "bg-white text-emerald-700 shadow-soft"
                  : "text-muted-foreground/50 hover:text-muted-foreground",
              )}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Auditoría de Turno
            </button>
          )}
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
                        <span className="hidden sm:inline lg:hidden">
                          BUSCAR
                        </span>
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
                                  {format(dateRange.from, "dd LLL", {
                                    locale: es,
                                  })}{" "}
                                  -{" "}
                                  {format(dateRange.to, "dd LLL", {
                                    locale: es,
                                  })}
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
                      {format(new Date(order.created_at), "PPp", {
                        locale: es,
                      })}
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
                            {format(
                              new Date(selectedOrder.created_at),
                              "PPP pp",
                              {
                                locale: es,
                              },
                            )}
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

                      {user?.role === "admin" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              className="rounded-xl h-12 px-6 font-black shadow-lg shadow-destructive/10 cursor-pointer"
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
                              <AlertDialogCancel className="rounded-2xl h-12 font-black cursor-pointer">
                                CANCELAR
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleDeleteOrder(selectedOrder.id)
                                }
                                className="rounded-2xl h-12 font-black bg-destructive hover:bg-destructive/90 cursor-pointer"
                              >
                                SÍ, ELIMINAR TODO
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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
                            onValueChange={(val) => {
                              if (val !== selectedOrder.status) {
                                setStatusModal({
                                  order: selectedOrder,
                                  targetStatus: val as OrderStatus,
                                });
                                setStatusReason("");
                              }
                            }}
                          >
                            <SelectTrigger className="h-12 rounded-xl font-black text-xs tracking-widest uppercase bg-white/50 border-2 border-primary/10 cursor-pointer">
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
                                  className="font-black text-[10px] tracking-widest uppercase py-3 cursor-pointer"
                                >
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground/60 leading-relaxed italic">
                          {user?.role === "caja"
                            ? "* Como cajero, al cambiar el estado se solicitará una justificación y se alertará al administrador."
                            : '* Mover un pedido a "Entregado" lo sacará de la vista activa de Caja y Cocina.'}
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

                    {/* Admin Exclusive: Order Modification Audit History */}
                    {user?.role === "admin" && (
                      <div className="md:col-span-2 pt-6 border-t border-slate-200/80 space-y-4 no-print">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Historial de Modificaciones del Pedido
                            {selectedOrderLogs.length > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-black ml-1">
                                {selectedOrderLogs.length} cambio(s)
                              </Badge>
                            )}
                          </h3>
                        </div>

                        {isLoadingSelectedOrderLogs ? (
                          <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 animate-pulse text-xs text-muted-foreground">
                            Cargando historial de cambios...
                          </div>
                        ) : selectedOrderLogs.length === 0 ? (
                          <div className="p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-xs text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span>
                              No se registran cambios manuales para este pedido.
                              Siguió el flujo estándar.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {selectedOrderLogs.map((log) => (
                              <div
                                key={log.id}
                                className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                                    <User className="size-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">
                                        {log.changed_by_name || "Usuario"}
                                      </span>
                                      <Badge
                                        className={cn(
                                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                                          log.changed_by_role === "admin"
                                            ? "bg-teal-100 text-teal-800 border-teal-300"
                                            : "bg-amber-100 text-amber-800 border-amber-300",
                                        )}
                                      >
                                        {log.changed_by_role === "caja"
                                          ? "Cajero/a"
                                          : log.changed_by_role}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {format(
                                        new Date(log.created_at),
                                        "dd 'de' MMMM, yyyy • hh:mm a",
                                        { locale: es },
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <StatusBadge status={log.previous_status} />
                                    <ArrowRight className="size-3 text-muted-foreground" />
                                    <StatusBadge status={log.new_status} />
                                  </div>
                                  {log.reason && (
                                    <div
                                      className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 text-[11px] font-medium text-slate-700 italic max-w-xs truncate"
                                      title={log.reason}
                                    >
                                      "{log.reason}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                        <span className="hidden sm:inline lg:hidden">
                          BUSCAR
                        </span>
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

                    {/* Payment Status Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <Tag className="h-3 w-3" /> Estado de Pago
                      </label>
                      <Select
                        value={cStatusFilter}
                        onValueChange={(val) =>
                          setCStatusFilter(val as InternalPaymentStatus | "all")
                        }
                      >
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Cualquier estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">
                            Todos los Estados
                          </SelectItem>
                          <SelectItem value="paid" className="font-bold">
                            ✅ Pagado
                          </SelectItem>
                          <SelectItem value="pending" className="font-bold">
                            🔴 Pendiente
                          </SelectItem>
                          <SelectItem value="partial" className="font-bold">
                            ⚠️ Parcial
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Consumer Type Filter */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
                        <User className="h-3 w-3" /> Tipo de Consumidor
                      </label>
                      <Select
                        value={cTypeFilter}
                        onValueChange={setCTypeFilter}
                      >
                        <SelectTrigger className="rounded-xl border-2 border-primary/5 bg-accent/5 font-bold">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-strong">
                          <SelectItem value="all" className="font-bold">
                            Todos
                          </SelectItem>
                          <SelectItem value="employee" className="font-bold">
                            👤 Empleado
                          </SelectItem>
                          <SelectItem value="partner" className="font-bold">
                            🤝 Socio
                          </SelectItem>
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
                                  {format(cDateRange.from, "dd LLL", {
                                    locale: es,
                                  })}{" "}
                                  -{" "}
                                  {format(cDateRange.to, "dd LLL", {
                                    locale: es,
                                  })}
                                </>
                              ) : (
                                format(cDateRange.from, "dd LLL", {
                                  locale: es,
                                })
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
                        <Badge
                          className={cn(
                            "text-[9px] font-black uppercase gap-1",
                            statusCfg.className,
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-black">{c.consumer_name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground mb-2">
                        {c.consumer_type === "employee" ? "Empleado" : "Socio"}{" "}
                        ·{" "}
                        {format(new Date(c.created_at), "PPp", { locale: es })}
                      </p>
                      <p className="text-lg font-black text-amber-600">
                        {formatPrice(c.total)}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-[9px] font-bold text-muted-foreground/50 uppercase">
                        <span>
                          {c.internal_consumption_items?.length || 0} items
                        </span>
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
                          <Badge
                            className={cn(
                              "text-[9px] font-black uppercase gap-1",
                              PAYMENT_STATUS_CONFIG[
                                selectedConsumption.payment_status
                              ].className,
                            )}
                          >
                            {(() => {
                              const Ic =
                                PAYMENT_STATUS_CONFIG[
                                  selectedConsumption.payment_status
                                ].icon;
                              return <Ic className="h-3 w-3" />;
                            })()}
                            {
                              PAYMENT_STATUS_CONFIG[
                                selectedConsumption.payment_status
                              ].label
                            }
                          </Badge>
                        </h2>
                        <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {format(
                              new Date(selectedConsumption.created_at),
                              "PPP pp",
                              { locale: es },
                            )}
                          </span>
                          <span className="text-xs font-bold">
                            {selectedConsumption.consumer_type === "employee"
                              ? "👤 Empleado"
                              : "🤝 Socio"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-12 w-12 border-2 hover:bg-white transition-all"
                        onClick={() =>
                          handlePrintConsumption(selectedConsumption)
                        }
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
                              Esta acción es irreversible. Se eliminarán los
                              registros de consumo, ítems y pagos asociados a{" "}
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
                              onClick={() =>
                                handleDeleteConsumption(selectedConsumption.id)
                              }
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
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">
                              ID Único
                            </p>
                            <p className="text-xs font-mono font-bold truncate">
                              {selectedConsumption.id}
                            </p>
                          </div>
                          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black opacity-30 uppercase mb-1">
                              Tipo
                            </p>
                            <p className="text-xs font-bold">
                              {selectedConsumption.consumer_type === "employee"
                                ? "👤 Empleado"
                                : "🤝 Socio"}
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
                              <SelectItem
                                value="pending"
                                className="font-black text-[10px] tracking-widest uppercase py-3"
                              >
                                🔴 Pendiente
                              </SelectItem>
                              <SelectItem
                                value="partial"
                                className="font-black text-[10px] tracking-widest uppercase py-3"
                              >
                                ⚠️ Parcial
                              </SelectItem>
                              <SelectItem
                                value="paid"
                                className="font-black text-[10px] tracking-widest uppercase py-3"
                              >
                                ✅ Pagado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground/60 leading-relaxed italic">
                          * Cambiar a "Pagado" marcará el consumo como
                          liquidado.
                        </p>
                      </div>
                    </div>

                    {/* Right: Items */}
                    <div className="space-y-6">
                      <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-500/10">
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center justify-between">
                          Contenido del Consumo
                          <span className="bg-amber-500/10 px-2 py-0.5 rounded-lg">
                            {selectedConsumption.internal_consumption_items
                              ?.length || 0}{" "}
                            ITEMS
                          </span>
                        </h3>
                        <div className="space-y-3">
                          {(
                            selectedConsumption.internal_consumption_items ?? []
                          ).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-4"
                            >
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
                            <span className="line-through">
                              {formatPrice(selectedConsumption.total_original)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-green-600">
                            <span>Descuento</span>
                            <span>
                              -{formatPrice(selectedConsumption.discount_total)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                            <p className="text-xs font-black text-amber-600 uppercase">
                              Total
                            </p>
                            <p className="text-xl font-black text-amber-600">
                              {formatPrice(selectedConsumption.total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : cSearchQuery &&
              !isCSearching &&
              foundConsumptions.length === 0 ? (
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AUDIT BY SHIFT TAB (ADMIN EXCLUSIVE) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "audit" && user?.role === "admin" && (
        <div className="space-y-6 no-print">
          {/* Shift & Filter Controls Header */}
          <div className="bg-white p-5 lg:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-600" />
                  <h2 className="text-lg lg:text-xl font-black tracking-tight text-slate-900">
                    Auditoría de Modificaciones por Turno
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Supervisión y control inmutable de cambios de estado
                  realizados por cajeros y personal de turno.
                </p>
              </div>

              {/* Shift Presets */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setShiftPreset("current")}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    shiftPreset === "current"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  Turno en Curso
                </button>
                <button
                  type="button"
                  onClick={() => setShiftPreset("previous")}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    shiftPreset === "previous"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  Turno Anterior
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShiftPreset("custom")}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                        shiftPreset === "custom"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      <CalendarIcon className="size-3.5" />
                      <span>
                        {customAuditDateRange?.from
                          ? format(customAuditDateRange.from, "dd/MM/yy") +
                            (customAuditDateRange.to
                              ? ` - ${format(customAuditDateRange.to, "dd/MM/yy")}`
                              : "")
                          : "Calendario"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 rounded-3xl"
                    align="end"
                  >
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customAuditDateRange?.from || new Date()}
                      selected={customAuditDateRange}
                      onSelect={(range) => {
                        setCustomAuditDateRange(range);
                        setShiftPreset("custom");
                      }}
                      numberOfMonths={2}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sub-Filters: Store, Cashier, Text search */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Store Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Sede / Tienda
                </label>
                <Select value={auditStoreId} onValueChange={setAuditStoreId}>
                  <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Todas las tiendas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all" className="font-bold text-xs">
                      Todas las Sedes
                    </SelectItem>
                    {stores.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className="font-bold text-xs"
                      >
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cashier / User Filter */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Responsable
                </label>
                <Select value={auditUserId} onValueChange={setAuditUserId}>
                  <SelectTrigger className="h-10 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Todos los usuarios" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all" className="font-bold text-xs">
                      Todos los Responsables
                    </SelectItem>
                    {profiles.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        className="font-bold text-xs"
                      >
                        {p.name || "Sin nombre"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Text Search inside audit */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                  Filtrar en vivo
                </label>
                <div className="relative">
                  <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="Filtrar por localizador, ticket o motivo..."
                    className="h-10 pl-9 rounded-xl text-xs font-bold bg-slate-50 border-slate-200"
                  />
                  {auditSearchQuery && (
                    <button
                      onClick={() => setAuditSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Shift Window Indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-medium">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-emerald-600" />
                <span>
                  Ventana de Turno:{" "}
                  <strong className="text-slate-800">
                    {format(auditShiftRange.from, "dd MMM yyyy, hh:mm a", {
                      locale: es,
                    })}
                  </strong>{" "}
                  ➔{" "}
                  <strong className="text-slate-800">
                    {format(auditShiftRange.to, "dd MMM yyyy, hh:mm a", {
                      locale: es,
                    })}
                  </strong>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchAuditLogs()}
                className="h-7 px-2.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <RefreshCcw className="size-3 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white p-4 lg:p-5 rounded-2xl lg:rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] lg:text-xs font-black uppercase tracking-wider text-slate-500">
                  Total Cambios
                </span>
                <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <History className="size-4" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-black text-slate-900 mt-2 tabular-nums">
                {auditLogs.length}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Registros en este turno
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl lg:rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] lg:text-xs font-black uppercase tracking-wider text-amber-600">
                  Por Cajeros
                </span>
                <div className="size-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <UserCheck className="size-4" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-black text-amber-600 mt-2 tabular-nums">
                {auditLogs.filter((l) => l.changed_by_role === "caja").length}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Operaciones supervisadas
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl lg:rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] lg:text-xs font-black uppercase tracking-wider text-rose-600">
                  Cancelaciones
                </span>
                <div className="size-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                  <AlertOctagon className="size-4" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-black text-rose-600 mt-2 tabular-nums">
                {auditLogs.filter((l) => l.new_status === "cancelado").length}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Órdenes canceladas
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl lg:rounded-3xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] lg:text-xs font-black uppercase tracking-wider text-teal-600">
                  Órdenes Únicas
                </span>
                <div className="size-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                  <ShoppingCart className="size-4" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-black text-teal-700 mt-2 tabular-nums">
                {new Set(auditLogs.map((l) => l.order_id)).size}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Afectadas en el turno
              </p>
            </div>
          </div>

          {/* Audit Records List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 lg:p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <History className="size-4 text-primary" />
                <span>
                  Bitácora Cronológica de Eventos ({auditLogs.length})
                </span>
              </h3>
            </div>

            {isAuditLoading ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="size-8 text-primary animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Consultando bitácora del turno...
                </p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-4">
                <div className="size-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
                  <ShieldCheck className="size-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-slate-800">
                    Sin modificaciones en este turno
                  </h4>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                    No se han registrado modificaciones manuales de estado
                    durante la jornada seleccionada.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs
                  .filter((log) => {
                    if (!auditSearchQuery.trim()) return true;
                    const q = auditSearchQuery.toLowerCase().trim();
                    const loc = (log.orders?.locator || "").toLowerCase();
                    const reason = (log.reason || "").toLowerCase();
                    const user = (log.changed_by_name || "").toLowerCase();
                    return (
                      loc.includes(q) || reason.includes(q) || user.includes(q)
                    );
                  })
                  .map((log) => {
                    const isCaja = log.changed_by_role === "caja";
                    const isCancel = log.new_status === "cancelado";

                    return (
                      <div
                        key={log.id}
                        className={cn(
                          "p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors",
                          isCancel && "bg-rose-50/20",
                        )}
                      >
                        {/* Col 1: Time & Date */}
                        <div className="flex items-center gap-3 min-w-44 shrink-0">
                          <div
                            className={cn(
                              "size-10 rounded-2xl flex items-center justify-center font-bold shrink-0",
                              isCaja
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-teal-100 text-teal-800 border border-teal-200",
                            )}
                          >
                            {isCaja ? (
                              <User className="size-5" />
                            ) : (
                              <ShieldCheck className="size-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tabular-nums">
                              {format(new Date(log.created_at), "hh:mm:ss a")}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                              {format(new Date(log.created_at), "dd MMM yyyy", {
                                locale: es,
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Col 2: Order Info & Store */}
                        <div className="min-w-48 shrink-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              #{log.orders?.locator || log.order_id.slice(0, 8)}
                            </span>
                            {log.orders?.is_delivery && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[9px] font-bold">
                                Domicilio
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <Building2 className="size-3 text-slate-400" />
                            <span>{log.stores?.name || "Tienda Central"}</span>
                          </p>
                        </div>

                        {/* Col 3: Responsible User */}
                        <div className="min-w-44 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-800">
                              {log.changed_by_name || "Usuario"}
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1",
                              isCaja
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-teal-100 text-teal-800 border-teal-300",
                            )}
                          >
                            {isCaja
                              ? "Cajero/a"
                              : log.changed_by_role || "Admin"}
                          </Badge>
                        </div>

                        {/* Col 4: State Transition Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={log.previous_status} />
                          <ArrowRight className="size-3.5 text-slate-400" />
                          <StatusBadge status={log.new_status} />
                        </div>

                        {/* Col 5: Reason */}
                        <div className="flex-1 min-w-0">
                          {log.reason ? (
                            <div className="bg-slate-100/90 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 italic">
                              "{log.reason}"
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Sin motivo documentado
                            </span>
                          )}
                        </div>

                        {/* Col 6: Inspect Action */}
                        <div className="shrink-0 flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleInspectOrderFromAudit(
                                log.order_id,
                                log.orders?.locator,
                              )
                            }
                            className="rounded-xl h-9 px-3 font-bold text-xs text-slate-700 hover:text-primary hover:border-primary/40 cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <Eye className="size-3.5" />
                            <span>Ver Orden</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STATUS CHANGE CONFIRMATION & REASON MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!statusModal}
        onOpenChange={(open) => {
          if (!open) {
            setStatusModal(null);
            setStatusReason("");
          }
        }}
      >
        <DialogContent className="rounded-3xl border-none shadow-strong max-w-lg p-6 sm:p-8">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <RefreshCcw className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                  Confirmar Cambio de Estado
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Orden #
                  {statusModal?.order.locator ||
                    statusModal?.order.ticket_number}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Visual State Transition */}
            {statusModal && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-center gap-3">
                <StatusBadge status={statusModal.order.status} />
                <ArrowRight className="size-4 text-slate-400 shrink-0" />
                <StatusBadge status={statusModal.targetStatus} />
              </div>
            )}

            {/* Notification alert banner */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Aviso de Auditoría y Supervisión</p>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  {user?.role === "caja"
                    ? "Esta modificación se notificará en tiempo real al Administrador y quedará registrada en el log de auditoría del turno actual."
                    : "Esta modificación quedará registrada con tu usuario en la auditoría del turno actual."}
                </p>
              </div>
            </div>

            {/* Reason / Justification Field */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Motivo / Justificación del Cambio
              </label>

              {/* Quick Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  "Solicitud del cliente",
                  "Error en digitación",
                  "Cancelación autorizada",
                  "Cobrado por fuera",
                  "Mesa reubicada",
                  "Entregado directamente",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setStatusReason(pill)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                      statusReason === pill
                        ? "bg-primary text-white border-primary shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-slate-50",
                    )}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <Textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Escribe una observación o selecciona una opción rápida..."
                className="rounded-2xl border-slate-200 text-xs font-medium focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatusModal(null);
                setStatusReason("");
              }}
              className="rounded-xl h-11 px-5 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmittingStatus}
              onClick={() => {
                if (statusModal) {
                  handleStatusChange(
                    statusModal.order.id,
                    statusModal.targetStatus,
                    statusReason,
                  );
                }
              }}
              className="rounded-xl h-11 px-6 font-black text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 cursor-pointer flex items-center gap-2"
            >
              {isSubmittingStatus ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Confirmar Cambio</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
