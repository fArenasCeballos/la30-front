import { useMemo, useEffect, useContext } from "react";
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
  CheckCircle,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
  Truck,
  ShoppingBag,
} from "lucide-react";

type DashboardOrder = OrderRow & { profiles: { name: string } | null };
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

const COLORS = [
  "hsl(24, 90%, 50%)",
  "hsl(142, 72%, 40%)",
  "hsl(200, 80%, 50%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 50%)",
];

export default function Dashboard() {
  const { activeStore } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const storeId = activeStore?.id || null;

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
    [orderContext?.orders],
  );
  const loadingOrders = orderContext?.loading || false;

  // Top Products from RPC (this one is okay as it's more complex to calculate locally)
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
      ["pendiente", "confirmado", "en_preparacion", "listo"].includes(o.status),
    );
    const cancelled = shiftOrders.filter((o) => o.status === "cancelado");

    const revenue = delivered.reduce((acc, o) => acc + (o.total || 0), 0);
    const avgTicket = delivered.length > 0 ? revenue / delivered.length : 0;

    // Segregate delivery vs counter/caja orders for Domicilios store
    const deliveryDelivered = delivered.filter((o) => o.is_delivery === true);
    const cajaDelivered = delivered.filter((o) => o.is_delivery !== true);

    const deliveryRevenue = deliveryDelivered.reduce(
      (acc, o) => acc + (o.total || 0),
      0,
    );
    const cajaRevenue = cajaDelivered.reduce(
      (acc, o) => acc + (o.total || 0),
      0,
    );

    const deliveryCompletedCount = deliveryDelivered.length;
    const cajaCompletedCount = cajaDelivered.length;

    // Delivery Specific Metrics
    const dispatchedCount = shiftOrders.filter(
      (o) => o.status === "listo" && o.is_dispatched === true,
    ).length;
    const readyNotSentCount = shiftOrders.filter(
      (o) => o.status === "listo" && o.is_dispatched !== true,
    ).length;
    const deliveryFees = delivered.reduce(
      (acc, o) => acc + (o.delivery_fee || 0),
      0,
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
            if (p.method === "efectivo")
              cash += p.amount_total || p.amount || 0;
            else if (p.method === "tarjeta")
              card += p.amount_total || p.amount || 0;
            else if (p.method === "nequi")
              nequi += p.amount_total || p.amount || 0;
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
      recentOrders: shiftOrders.slice(0, 8),
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
          ]
        : [
            { name: "Activos", value: stats.activeCount },
            { name: "Completados", value: stats.completedCount },
            { name: "Cancelados", value: stats.cancelledCount },
          ],
    [stats, isDeliveryStore],
  );

  const statCards = isDeliveryStore
    ? [
        {
          label: "Ventas Domicilios",
          value: formatPrice(stats.deliveryRevenue),
          icon: DollarSign,
          color: "text-purple-500",
          loading: loadingOrders,
        },
        {
          label: "Ventas Caja",
          value: formatPrice(stats.cajaRevenue),
          icon: Banknote,
          color: "text-emerald-500",
          loading: loadingOrders,
        },
        {
          label: "Ventas Totales",
          value: formatPrice(stats.revenue),
          icon: DollarSign,
          color: "text-primary",
          loading: loadingOrders,
        },
        {
          label: "Domicilios Completados",
          value: stats.deliveryCompletedCount,
          icon: CheckCircle,
          color: "text-purple-500",
          loading: loadingOrders,
        },
        {
          label: "Completados en Caja",
          value: stats.cajaCompletedCount,
          icon: ShoppingBag,
          color: "text-emerald-500",
          loading: loadingOrders,
        },
        {
          label: "Domicilios en camino",
          value: stats.dispatchedCount,
          icon: Truck,
          color: "text-blue-500",
          loading: loadingOrders,
        },
        {
          label: "Listos por despachar",
          value: stats.readyNotSentCount,
          icon: Clock,
          color: "text-amber-500",
          loading: loadingOrders,
        },
        {
          label: "Ingreso por envíos",
          value: formatPrice(stats.deliveryFees),
          icon: TrendingUp,
          color: "text-green-500",
          loading: loadingOrders,
        },
      ]
    : [
        {
          label: "Ventas del día",
          value: formatPrice(stats.revenue),
          icon: DollarSign,
          color: "text-green-500",
          loading: loadingOrders,
        },
        {
          label: "Pedidos activos",
          value: stats.activeCount,
          icon: Clock,
          color: "text-orange-500",
          loading: loadingOrders,
        },
        {
          label: "Completados",
          value: stats.completedCount,
          icon: CheckCircle,
          color: "text-green-500",
          loading: loadingOrders,
        },
        {
          label: "Ticket promedio",
          value: formatPrice(stats.avgTicket),
          icon: TrendingUp,
          color: "text-blue-500",
          loading: loadingOrders,
        },
      ];

  const paymentCards = [
    {
      label: "Efectivo",
      value: formatPrice(stats.cash),
      icon: Banknote,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Tarjeta",
      value: formatPrice(stats.card),
      icon: CreditCard,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Nequi / Transferencia",
      value: formatPrice(stats.nequi),
      icon: Smartphone,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  if (user && user.role !== "admin") return null;

  return (
    <ErrorBoundary>
      <div className="section-container space-y-8 pb-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-[0.2em] text-[10px]">
              <div className="h-px w-8 bg-primary/30" />
              Vista General
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Panel de Control
            </h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">
              Hoy en{" "}
              <span className="text-primary">
                {activeStore?.name || "Todas las sedes"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/50 border p-1 rounded-2xl shadow-sm">
            <Badge
              variant="secondary"
              className="px-3 py-1.5 rounded-xl font-bold gap-2 bg-white shadow-sm border-primary/10"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Sincronizado
            </Badge>
            <Badge
              variant="outline"
              className="px-3 py-1.5 rounded-xl font-black gap-2 bg-white/50 text-muted-foreground border-accent/20"
            >
              v{pkg.version}
            </Badge>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="pos-card group relative overflow-hidden p-4 lg:p-6"
            >
              <card.icon
                className={`absolute -right-2 -bottom-2 w-16 h-16 lg:w-24 lg:h-24 opacity-[0.03] ${card.color} group-hover:scale-110 transition-transform duration-200`}
              />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4">
                <div
                  className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center bg-accent/50 border border-white shrink-0`}
                >
                  <card.icon
                    className={`h-5 w-5 lg:h-6 lg:w-6 ${card.color}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] lg:text-sm font-bold text-muted-foreground uppercase tracking-widest truncate">
                    {card.label}
                  </p>
                  {card.loading ? (
                    <div className="h-6 w-24 bg-accent/30 animate-pulse rounded mt-1" />
                  ) : (
                    <p className="text-base lg:text-3xl font-black mt-0.5 lg:mt-1 tracking-tight truncate">
                      {card.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Methods Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 opacity-40 px-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ingresos por método
          </h2>
          <div className="grid grid-cols-3 gap-2 lg:gap-6">
            {paymentCards.map((card) => (
              <div
                key={card.label}
                className="pos-card bg-white/40 shadow-sm p-3 lg:p-5 border-l-4"
                style={{
                  borderColor: "currentColor",
                  color: card.color.includes("emerald")
                    ? "#059669"
                    : card.color.includes("blue")
                      ? "#2563eb"
                      : "#9333ea",
                }}
              >
                <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4 text-center lg:text-left">
                  <div
                    className={`w-8 h-8 lg:w-12 lg:h-12 rounded-full flex items-center justify-center ${card.bgColor} shrink-0`}
                  >
                    <card.icon className="h-4 w-4 lg:h-6 lg:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[7px] lg:text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">
                      {card.label}
                    </p>
                    {loadingOrders ? (
                      <div className="h-5 w-20 bg-accent/20 animate-pulse rounded mt-1" />
                    ) : (
                      <p className="text-[10px] lg:text-2xl font-black truncate">
                        {card.value}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics & Activity Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="pos-card bg-white p-6 lg:p-8">
              <h3 className="text-xl font-bold mb-8">Productos más vendidos</h3>
              <div className="h-75 w-full">
                {loadingProducts ? (
                  <div className="h-full flex items-center justify-center">
                    Cargando...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productStats} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="rgba(0,0,0,0.05)"
                      />
                      <XAxis
                        type="number"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="product_name"
                        width={100}
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="quantity"
                        fill="hsl(var(--primary))"
                        radius={[0, 8, 8, 0]}
                        barSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="pos-card bg-white p-8 h-62.5">
                <h3 className="text-lg font-bold mb-4 text-center">
                  Estados de Pedido
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusDistribution.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pos-card bg-primary p-8 text-white flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Reportes Completos</h3>
                  <p className="text-sm text-white/70">
                    Consulta históricos detallados y exporta datos.
                  </p>
                </div>
                <Button
                  className="w-full bg-white text-primary font-bold mt-4 hover:bg-white/90"
                  onClick={() => navigate("/administracion?tab=reportes")}
                >
                  IR A REPORTES
                </Button>
              </div>
            </div>
          </div>

          <div className="pos-card bg-white p-6 lg:p-8 flex flex-col">
            <h3 className="text-xl font-bold mb-8 flex items-center justify-between">
              Actividad Reciente
              <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-1 rounded-full animate-pulse">
                EN VIVO
              </span>
            </h3>
            <div className="flex-1 space-y-4">
              {stats.recentOrders.map((order: DashboardOrder) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/5 transition-colors border border-transparent hover:border-accent/10"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/30 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] font-black opacity-30 leading-none">
                      LOC
                    </span>
                    <span className="font-black text-xs">{order.locator}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-xs truncate">
                        {order.profiles?.name || "Kiosko"}
                      </p>
                      <p className="text-[10px] font-black text-primary">
                        {formatPrice(order.total)}
                      </p>
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {order.status.replace("_", " ")} •{" "}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentOrders.length === 0 && (
                <div className="text-center py-20 opacity-20">
                  <Clock className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-[10px] font-black uppercase">
                    Sin actividad
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              className="mt-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
              onClick={() => navigate("/administracion?tab=reportes")}
            >
              Ver todo el historial
            </Button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
