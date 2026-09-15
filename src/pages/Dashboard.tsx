import React, { useMemo, useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import pkg from "../../package.json";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { Badge } from "@/components/ui/badge";
import type { OrderRow } from "@/types";
import { OrderContext } from "@/context/OrderContext";
import {
  DollarSign,
  Clock,
  CheckCircle2,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
  Truck,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  ChefHat,
  Monitor,
  Activity,
  ArrowRight,
} from "lucide-react";
import { AdminNewsModal } from "@/components/admin/AdminNewsModal";
import { LATEST_UPDATE_ID } from "@/data/appUpdates";
import { StatusBadge } from "@/components/StatusBadge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getShiftStart } from "@/lib/shiftUtils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardOrder = OrderRow & { profiles: { name: string } | null };

const DONUT_COLORS = [
  "#0d9488", // Teal 600
  "#3b82f6", // Blue 500
  "#f59e0b", // Amber 500
  "#ef4444", // Rose 500
  "#8b5cf6", // Purple 500
];

interface PrimaryCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  description?: string;
  loading: boolean;
}

export default function Dashboard() {
  const { activeStore } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const storeId = activeStore?.id || null;

  // News / Updates Modal State
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [isUnreadNews, setIsUnreadNews] = useState(false);

  useEffect(() => {
    try {
      const lastViewed = localStorage.getItem("la30_last_viewed_update");
      if (lastViewed !== LATEST_UPDATE_ID) {
        setIsUnreadNews(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const handleMarkAsRead = () => {
    try {
      localStorage.setItem("la30_last_viewed_update", LATEST_UPDATE_ID);
      setIsUnreadNews(false);
    } catch {
      // ignore
    }
  };

  const handleOpenNews = (updateId?: string) => {
    setSelectedUpdateId(updateId || null);
    setNewsModalOpen(true);
    handleMarkAsRead();
  };

  // Role Guard
  useEffect(() => {
    if (user && user.role !== "admin") {
      const defaultPaths: Record<string, string> = {
        caja: "/caja",
        cocina: "/cocina",
        mesero: "/kiosko",
      };
      navigate(defaultPaths[user.role] || "/", { replace: true });
    }
  }, [user, navigate]);

  const shiftStart = useMemo(() => getShiftStart().toISOString(), []);

  const orderContext = useContext(OrderContext);
  const shiftOrders = useMemo(
    () => orderContext?.orders || [],
    [orderContext?.orders]
  );
  const loadingOrders = orderContext?.loading || false;

  // Top Products from RPC
  const { data: productStats = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["top-products", storeId, shiftStart],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_products", {
        p_limit: 6,
        p_store_id: storeId,
        p_shift_start: shiftStart,
      });
      if (error) throw error;
      return (data as { product_name: string; quantity: number }[]) || [];
    },
    refetchInterval: 300000,
  });

  // Logic calculation: Only "entregado" orders count for revenue
  const stats = useMemo(() => {
    const delivered = shiftOrders.filter((o) => o.status === "entregado");
    const active = shiftOrders.filter((o) =>
      ["pendiente", "confirmado", "en_preparacion", "listo"].includes(o.status)
    );
    const cancelled = shiftOrders.filter((o) => o.status === "cancelado");

    const revenue = delivered.reduce((acc, o) => acc + (o.total || 0), 0);
    const avgTicket = delivered.length > 0 ? revenue / delivered.length : 0;

    // Segregate delivery vs counter/caja orders for Domicilios store
    const deliveryDelivered = delivered.filter((o) => o.is_delivery === true);
    const cajaDelivered = delivered.filter((o) => o.is_delivery !== true);

    const deliveryRevenue = deliveryDelivered.reduce(
      (acc, o) => acc + (o.total || 0),
      0
    );
    const cajaRevenue = cajaDelivered.reduce(
      (acc, o) => acc + (o.total || 0),
      0
    );

    const deliveryCompletedCount = deliveryDelivered.length;
    const cajaCompletedCount = cajaDelivered.length;

    // Delivery Specific Metrics
    const dispatchedCount = shiftOrders.filter(
      (o) => o.status === "listo" && o.is_dispatched === true
    ).length;
    const readyNotSentCount = shiftOrders.filter(
      (o) => o.status === "listo" && o.is_dispatched !== true
    ).length;
    const deliveryFees = delivered.reduce(
      (acc, o) => acc + (o.delivery_fee || 0),
      0
    );

    // Payment breakdown
    let cash = 0;
    let card = 0;
    let nequi = 0;

    delivered.forEach((o) => {
      if (o.payments) {
        o.payments.forEach((p) => {
          if (p.method === "mixto") {
            cash += p.amount_efectivo || 0;
            card += p.amount_tarjeta || 0;
            nequi += p.amount_nequi || 0;
          } else {
            if (p.method === "efectivo") cash += p.amount_total || 0;
            else if (p.method === "tarjeta") card += p.amount_total || 0;
            else if (p.method === "nequi") nequi += p.amount_total || 0;
          }
        });
      }
    });

    return {
      revenue,
      activeCount: active.length,
      completedCount: delivered.length,
      cancelledCount: cancelled.length,
      avgTicket,
      cash,
      card,
      nequi,
      dispatchedCount,
      readyNotSentCount,
      deliveryFees,
      deliveryRevenue,
      cajaRevenue,
      deliveryCompletedCount,
      cajaCompletedCount,
      recentOrders: shiftOrders.slice(0, 10),
    };
  }, [shiftOrders]);

  const isDeliveryStore = activeStore?.slug === "domicilios";

  const statusDistribution = useMemo(
    () =>
      isDeliveryStore
        ? [
            { name: "En Camino 🛵", value: stats.dispatchedCount },
            { name: "Listos en Local", value: stats.readyNotSentCount },
            { name: "Completados", value: stats.completedCount },
            { name: "Cancelados", value: stats.cancelledCount },
          ].filter((item) => item.value > 0)
        : [
            { name: "Activos", value: stats.activeCount },
            { name: "Completados", value: stats.completedCount },
            { name: "Cancelados", value: stats.cancelledCount },
          ].filter((item) => item.value > 0),
    [stats, isDeliveryStore]
  );

  const primaryCards: PrimaryCard[] = isDeliveryStore
    ? [
        {
          label: "Ventas Domicilios",
          value: formatPrice(stats.deliveryRevenue),
          icon: Truck,
          accent: "text-purple-600 bg-purple-50 border-purple-200",
          description: "Despachos a domicilio",
          loading: loadingOrders,
        },
        {
          label: "Ventas Caja",
          value: formatPrice(stats.cajaRevenue),
          icon: Banknote,
          accent: "text-teal-600 bg-teal-50 border-teal-200",
          description: "Ventas en mostrador",
          loading: loadingOrders,
        },
        {
          label: "Ventas Totales",
          value: formatPrice(stats.revenue),
          icon: DollarSign,
          accent: "text-emerald-600 bg-emerald-50 border-emerald-200",
          description: "Total recaudado",
          loading: loadingOrders,
        },
        {
          label: "Domicilios Entregados",
          value: stats.deliveryCompletedCount,
          icon: CheckCircle2,
          accent: "text-blue-600 bg-blue-50 border-blue-200",
          description: "Entregas completadas",
          loading: loadingOrders,
        },
      ]
    : [
        {
          label: "Ventas Netas Turno",
          value: formatPrice(stats.revenue),
          icon: DollarSign,
          accent: "text-teal-700 bg-teal-50 border-teal-200",
          description: "Órdenes entregadas hoy",
          loading: loadingOrders,
        },
        {
          label: "Comandas Activas",
          value: stats.activeCount,
          icon: Clock,
          accent: "text-amber-700 bg-amber-50 border-amber-200",
          description: "En cocina o preparación",
          loading: loadingOrders,
        },
        {
          label: "Completadas",
          value: stats.completedCount,
          icon: CheckCircle2,
          accent: "text-emerald-700 bg-emerald-50 border-emerald-200",
          description: "Despachadas con éxito",
          loading: loadingOrders,
        },
        {
          label: "Ticket Promedio",
          value: formatPrice(stats.avgTicket),
          icon: TrendingUp,
          accent: "text-blue-700 bg-blue-50 border-blue-200",
          description: "Promedio por comanda",
          loading: loadingOrders,
        },
      ];

  const totalPayments = stats.cash + stats.card + stats.nequi || 1;
  const paymentCards = [
    {
      label: "Efectivo",
      value: formatPrice(stats.cash),
      percentage: Math.round((stats.cash / totalPayments) * 100),
      icon: Banknote,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      barColor: "bg-emerald-500",
    },
    {
      label: "Datáfono / Tarjeta",
      value: formatPrice(stats.card),
      percentage: Math.round((stats.card / totalPayments) * 100),
      icon: CreditCard,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      barColor: "bg-blue-500",
    },
    {
      label: "Nequi / Transferencia",
      value: formatPrice(stats.nequi),
      percentage: Math.round((stats.nequi / totalPayments) * 100),
      icon: Smartphone,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      barColor: "bg-purple-500",
    },
  ];

  // Instagram / WhatsApp style operational stories (adaptive for desktop & mobile)
  const stories = [
    {
      id: "turno",
      label: "Turno Activo",
      sub: "4PM - 4AM",
      icon: Activity,
      ringGradient: "bg-gradient-to-tr from-emerald-500 via-teal-400 to-teal-600 animate-pulse",
      iconColor: "text-teal-600",
      bgClass: "bg-teal-50/80",
      badgeText: "EN VIVO",
      badgeColor: "bg-emerald-500",
      onClick: () => navigate("/reporteria"),
    },
    {
      id: "kiosko",
      label: "Nueva Orden",
      sub: "Kiosko",
      icon: ShoppingBag,
      ringGradient: "bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500",
      iconColor: "text-orange-600",
      bgClass: "bg-orange-50/80",
      badgeText: "+ Comanda",
      badgeColor: "bg-orange-500",
      onClick: () => navigate("/kiosko"),
    },
    {
      id: "caja",
      label: "Terminal Caja",
      sub: `${stats.completedCount} cobradas`,
      icon: Monitor,
      ringGradient: "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500",
      iconColor: "text-emerald-600",
      bgClass: "bg-emerald-50/80",
      badgeText: formatPrice(stats.revenue),
      badgeColor: "bg-teal-600",
      onClick: () => navigate("/caja"),
    },
    {
      id: "cocina",
      label: "KDS Cocina",
      sub: `${stats.activeCount} en marcha`,
      icon: ChefHat,
      ringGradient: "bg-gradient-to-tr from-rose-500 via-amber-500 to-yellow-400",
      iconColor: "text-amber-600",
      bgClass: "bg-amber-50/80",
      badgeText: stats.activeCount > 0 ? `${stats.activeCount} activas` : "Al día",
      badgeColor: stats.activeCount > 0 ? "bg-amber-500" : "bg-emerald-500",
      onClick: () => navigate("/cocina"),
    },
    {
      id: "reporteria",
      label: "Auditoría",
      sub: "Cierre & KPIs",
      icon: TrendingUp,
      ringGradient: "bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500",
      iconColor: "text-blue-600",
      bgClass: "bg-blue-50/80",
      badgeText: "Excel",
      badgeColor: "bg-blue-600",
      onClick: () => navigate("/reporteria"),
    },
    {
      id: "novedades",
      label: "Novedades",
      sub: isUnreadNews ? "¡Nueva versión!" : `v${pkg.version}`,
      icon: Sparkles,
      ringGradient: "bg-gradient-to-tr from-fuchsia-500 via-pink-500 to-rose-400",
      iconColor: "text-pink-600",
      bgClass: isUnreadNews ? "bg-pink-100" : "bg-pink-50/80",
      badgeText: isUnreadNews ? "NUEVA" : `v${pkg.version}`,
      badgeColor: isUnreadNews ? "bg-pink-600" : "bg-slate-600",
      isPulsing: isUnreadNews,
      onClick: () => handleOpenNews(),
    },
  ];

  if (user && user.role !== "admin") return null;

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 animate-in fade-in duration-200 select-none">
        {/* ── 1. Unified Operational Header & Adaptive Action Hub ── */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
          {/* Top Row: Store Identity & Turno Live Status */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border-teal-200 gap-1.5"
                >
                  <span className="size-2 rounded-full bg-teal-500 animate-pulse" />
                  Turno Activo (4:00 PM - 4:00 AM)
                </Badge>
                <Badge
                  variant="outline"
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100/90 text-slate-700 border-slate-200 shadow-2xs gap-1.5"
                >
                  {activeStore?.icon || "🏪"} {activeStore?.name || "Todas las sedes"}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Centro de Operaciones
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Monitor en tiempo real de ventas, comandas de cocina y actividad operativa.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="h-10 px-3.5 rounded-xl font-semibold text-xs gap-1.5 bg-slate-50 border-slate-200 text-slate-600"
              >
                v{pkg.version}
              </Badge>
            </div>
          </div>

          {/* Adaptive Actions: Horizontal Stories on Mobile, Executive Grid on iPad & Desktop */}
          <div className="pt-3 border-t border-slate-100">
            {/* Mobile View (< 640px): Instagram / WhatsApp Horizontal Story Circles */}
            <div className="sm:hidden flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1 px-1">
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={story.onClick}
                  className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform cursor-pointer select-none focus:outline-none"
                >
                  <div
                    className={cn(
                      "p-0.5 rounded-full transition-all duration-300 relative",
                      story.ringGradient,
                      story.isPulsing && "ring-2 ring-pink-500/80 animate-pulse"
                    )}
                  >
                    <div className="size-14 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs">
                      <div
                        className={cn(
                          "size-full rounded-full flex items-center justify-center transition-colors",
                          story.bgClass
                        )}
                      >
                        <story.icon className={cn("size-6", story.iconColor)} strokeWidth={2} />
                      </div>
                    </div>

                    {story.isPulsing && (
                      <span className="absolute top-0 right-0 flex size-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                        <span className="relative inline-flex rounded-full size-3 bg-pink-600 ring-1 ring-white" />
                      </span>
                    )}

                    {story.badgeText && (
                      <span
                        className={cn(
                          "absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 text-[8px] font-black text-white rounded-full uppercase tracking-wider shadow-xs truncate max-w-[64px] leading-tight",
                          story.badgeColor
                        )}
                      >
                        {story.badgeText}
                      </span>
                    )}
                  </div>

                  <div className="text-center max-w-[72px] mt-0.5">
                    <span className="text-xs font-black text-slate-900 tracking-tight leading-tight block truncate">
                      {story.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold block truncate leading-none mt-0.5",
                        story.isPulsing ? "text-pink-600 font-bold" : "text-slate-400"
                      )}
                    >
                      {story.sub}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop & iPad View (>= 640px): Sleek Executive 6-Column Action Grid */}
            <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={story.onClick}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 group active:scale-98 text-left cursor-pointer relative overflow-hidden",
                    story.isPulsing
                      ? "border-pink-300 bg-gradient-to-r from-pink-50/90 via-rose-50/50 to-white shadow-md shadow-pink-500/10 ring-2 ring-pink-500/50 animate-pulse hover:bg-pink-50"
                      : "border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  <div
                    className={cn(
                      "p-0.5 rounded-full transition-transform group-hover:scale-105 shrink-0 relative",
                      story.ringGradient
                    )}
                  >
                    <div className="size-10 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs">
                      <div
                        className={cn(
                          "size-full rounded-full flex items-center justify-center transition-colors",
                          story.bgClass
                        )}
                      >
                        <story.icon className={cn("size-4.5", story.iconColor)} strokeWidth={2.25} />
                      </div>
                    </div>

                    {story.isPulsing && (
                      <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2.5 bg-pink-600" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black text-slate-900 leading-snug group-hover:text-teal-700 transition-colors truncate">
                        {story.label}
                      </p>
                      {story.isPulsing && (
                        <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider bg-pink-600 text-white rounded-full leading-tight">
                          NEW
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-[10px] font-semibold truncate",
                        story.isPulsing ? "text-pink-600 font-bold" : "text-slate-400"
                      )}
                    >
                      {story.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 2. Primary Executive KPI Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
          {primaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {card.label}
                  </span>
                  <div
                    className={cn(
                      "size-8 rounded-xl flex items-center justify-center border shrink-0",
                      card.accent
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                </div>

                <div>
                  {card.loading ? (
                    <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg mt-1" />
                  ) : (
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight truncate">
                      {card.value}
                    </p>
                  )}
                  {card.description && (
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">
                      {card.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* ── 3. Payment Methods Mix ── */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-teal-500" />
              Recaudación por Método de Pago
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Total Turno: {formatPrice(stats.revenue)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {paymentCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "size-8 rounded-xl flex items-center justify-center border shrink-0",
                          card.color
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                        {card.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 shrink-0">
                      {card.percentage}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {card.value}
                    </p>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", card.barColor)}
                        style={{ width: `${Math.min(100, Math.max(4, card.percentage))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. Analytics: Top Products & Order Distribution (Balanced Desktop Grid) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Products (7 cols on desktop) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Platos Más Vendidos del Turno
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Ranking según cantidad despachada hoy
                </p>
              </div>
              <span className="text-xs font-bold text-teal-600">
                {productStats.length} productos registrados
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              {loadingProducts ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Cargando platos más vendidos...
                </div>
              ) : productStats.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <StoreIcon className="size-8 stroke-1 text-slate-300" />
                  <span>Sin registros de platos vendidos aún en este turno.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productStats} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="product_name"
                      width={130}
                      fontSize={11}
                      stroke="#64748b"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "12px",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    />
                    <Bar dataKey="quantity" fill="#0d9488" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Status Distribution Donut (5 cols on desktop) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Balance de Comandas del Turno
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Estado de la operación en cocina y servicio
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 flex-1">
              <div className="h-44 w-full flex items-center justify-center">
                {statusDistribution.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin comandas activas</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusDistribution.map((_, index) => (
                          <Cell
                            key={index}
                            fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "12px",
                          border: "none",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-2.5">
                {statusDistribution.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                      />
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900">{item.value} comandas</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. Live Recent Activity Stream (Full Width Grid on Desktop) ── */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-teal-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Comandas del Turno en Vivo
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Flujo operacional actualizado en tiempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                <span className="size-1.5 rounded-full bg-teal-500 animate-ping" />
                En Vivo
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/reporteria")}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:bg-teal-50 gap-1 hidden sm:flex cursor-pointer"
              >
                <span>Ver todo en Reportería</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Clock className="mx-auto size-8 text-slate-300 stroke-1" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sin comandas activas
              </p>
              <p className="text-[11px] text-slate-400">
                Las nuevas órdenes registradas en el turno aparecerán aquí en tiempo real.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {stats.recentOrders.map((order: DashboardOrder) => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/70 hover:border-slate-300 hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="size-9 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0 font-black">
                      <span className="text-[7px] text-slate-400 leading-none">
                        {order.is_delivery ? "DOM" : "ORD"}
                      </span>
                      <span className="text-xs text-slate-900">{order.locator}</span>
                    </div>
                    <StatusBadge status={order.status} className="scale-75 origin-right" />
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {order.profiles?.name || "Kiosko"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sm:hidden pt-2">
            <Button
              variant="outline"
              onClick={() => navigate("/reporteria")}
              className="w-full h-11 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50 transition-all gap-1.5 cursor-pointer"
            >
              <span>Ver Historial Completo en Reportería</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </section>

        {/* Modal Poster de Novedades */}
        <AdminNewsModal
          open={newsModalOpen}
          onOpenChange={setNewsModalOpen}
          selectedUpdateId={selectedUpdateId}
          onMarkAsRead={handleMarkAsRead}
        />
      </div>
    </ErrorBoundary>
  );
}
