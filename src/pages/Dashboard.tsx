import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { Badge } from "@/components/ui/badge";
import type { OrderRow } from "@/types";
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  Package,
} from "lucide-react";
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
  const navigate = useNavigate();
  const storeId = activeStore?.id || null;

  // Velocidad exponencial: Usamos RPCs del backend en lugar de calcular en el cliente
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", storeId, getShiftStart().toISOString()],
    queryFn: async () => {
      const shiftStart = getShiftStart().toISOString();
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_store_id: storeId,
        p_shift_start: shiftStart,
      });
      if (error) throw error;
      return data as {
        total_revenue: number;
        active_orders: number;
        completed_today: number;
        cancelled_today: number;
        avg_ticket: number;
        cash_total: number;
        card_total: number;
        nequi_total: number;
      };
    },
    refetchInterval: 30000, // Cada 30 seg
  });

  const { data: productStats = [] } = useQuery({
    queryKey: ["top-products", storeId, getShiftStart().toISOString()],
    queryFn: async () => {
      const shiftStart = getShiftStart().toISOString();
      const { data, error } = await supabase.rpc("get_top_products", {
        p_limit: 6,
        p_store_id: storeId,
        p_shift_start: shiftStart,
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Sincronizar con el resto de los stats
  });

  // Query ligera para actividad reciente (solo los del turno actual)
  const { data: recentOrders = [] } = useQuery({
    queryKey: ["recent-activity", storeId],
    queryFn: async () => {
      const shiftStart = getShiftStart().toISOString();
      let query = supabase
        .from("orders")
        .select("*")
        .gte("created_at", shiftStart)
        .order("created_at", { ascending: false })
        .limit(8);
      if (storeId) query = query.eq("store_id", storeId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const statusDistribution = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Activos", value: stats.active_orders },
      { name: "Completados", value: stats.completed_today },
      { name: "Cancelados", value: stats.cancelled_today },
    ];
  }, [stats]);

  const statCards = [
    {
      label: "Ventas del día",
      value: formatPrice(stats?.total_revenue ?? 0),
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Pedidos activos",
      value: stats?.active_orders ?? 0,
      icon: Clock,
      color: "text-orange-500",
    },
    {
      label: "Completados",
      value: stats?.completed_today ?? 0,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      label: "Ticket promedio",
      value: formatPrice(stats?.avg_ticket ?? 0),
      icon: TrendingUp,
      color: "text-blue-500",
    },
  ];

  const paymentCards = [
    {
      label: "Efectivo",
      value: formatPrice(stats?.cash_total ?? 0),
      icon: Banknote,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    {
      label: "Tarjeta",
      value: formatPrice(stats?.card_total ?? 0),
      icon: CreditCard,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Nequi / Transferencia",
      value: formatPrice(stats?.nequi_total ?? 0),
      icon: Smartphone,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
    },
  ];

  if (loadingStats) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Panel de Control</h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">
              Bienvenido de nuevo, esto es lo que está pasando hoy en <span className="text-primary">{activeStore?.name}</span>.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/50 border p-1 rounded-2xl shadow-sm">
             <Badge variant="secondary" className="px-3 py-1.5 rounded-xl font-bold gap-2 bg-white shadow-sm border-primary/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Sincronizado en tiempo real
             </Badge>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, idx) => (
            <div
              key={card.label}
              className="pos-card pos-card-hover group relative overflow-hidden"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Decorative Background Icon */}
              <card.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] ${card.color} group-hover:scale-110 transition-transform duration-500`} />
              
              <div className="relative z-10 space-y-3 sm:space-y-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center bg-accent/50 border border-white transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                  <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">{card.label}</p>
                  <p className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Methods Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 opacity-70">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Resumen de Ingresos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {paymentCards.map((card, idx) => (
              <div
                key={card.label}
                className={`pos-card pos-card-hover border-transparent bg-white/40 backdrop-blur-sm shadow-soft group`}
                style={{ 
                  animationDelay: `${(idx + 4) * 100}ms`,
                  borderLeft: `4px solid ${card.color.replace('text-', '')}` 
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${card.bgColor} ${card.color} transition-all duration-500 group-hover:rotate-360`}>
                    <card.icon className="h-5 w-5 sm:h-7 sm:w-7" />
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{card.label}</p>
                    <p className={`text-xl sm:text-2xl font-black ${card.color}`}>{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics & Activity Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Chart Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="pos-card bg-white p-8">
               <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Rendimiento de Productos</h3>
                  <p className="text-sm text-muted-foreground">Top 6 artículos con mayor demanda</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              
              <div className="h-[350px] w-full">
                {productStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productStats} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis type="number" fontSize={11} fontWeight={600} axisLine={false} tickLine={false} tick={{ fill: 'rgba(0,0,0,0.3)' }} />
                      <YAxis
                        type="category"
                        dataKey="product_name"
                        width={120}
                        fontSize={11}
                        fontWeight={700}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(0,0,0,0.6)' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '16px',
                          border: 'none',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                          padding: '12px 16px'
                        }}
                      />
                      <Bar
                        dataKey="quantity"
                        fill="hsl(var(--primary))"
                        radius={[0, 12, 12, 0]}
                        barSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                    <Package className="h-12 w-12" />
                    <p className="text-sm font-bold uppercase tracking-widest">Sin datos suficientes</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
               <div className="pos-card bg-white p-8">
                <h3 className="text-lg font-bold mb-6">Distribución de Estados</h3>
                <div className="h-[200px] relative">
                  {statusDistribution.some((s) => s.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {statusDistribution.map((_, index) => (
                            <Cell 
                              key={index} 
                              fill={COLORS[index % COLORS.length]} 
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-40">
                      Sin pedidos hoy
                    </div>
                  )}
                  {/* Central Statistic */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-none">Total</p>
                    <p className="text-2xl font-black leading-tight">
                      {statusDistribution.reduce((acc, curr) => acc + curr.value, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pos-card bg-primary p-8 text-white relative overflow-hidden group">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                <div className="relative z-10 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Crecimiento Diario</h3>
                    <p className="text-sm text-white/70">Mantén el ritmo, las ventas van por buen camino.</p>
                  </div>
                  <div className="pt-4">
                    <Button 
                      variant="secondary" 
                      className="w-full bg-white text-primary font-bold rounded-xl hover:scale-105 transition-transform"
                      onClick={() => navigate("/reporteria")}
                    >
                      Ver Reporte Detallado
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Column */}
          <div className="space-y-6">
            <div className="pos-card bg-white p-8 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight">Actividad</h3>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none font-black text-[10px]">EN VIVO</Badge>
              </div>
              
              <div className="flex-1 space-y-6 overflow-y-auto pr-2 no-scrollbar">
                {recentOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-30 space-y-4">
                    <Clock className="h-12 w-12" />
                    <p className="text-sm font-bold uppercase tracking-widest">Sin actividad</p>
                  </div>
                )}
                {recentOrders.map((order: OrderRow, idx: number) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 group animate-in fade-in slide-in-from-right-4"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-accent/50 border border-white flex flex-col items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                      <span className="text-[10px] font-black text-primary group-hover:text-white leading-none">LOC</span>
                      <span className="font-display font-black text-sm group-hover:text-white">{order.locator}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm truncate">Pedido #{order.id.slice(0, 4)}</span>
                        <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                         <div className={`w-1.5 h-1.5 rounded-full ${
                           order.status === 'entregado' ? 'bg-green-500' : 
                           order.status === 'en_preparacion' ? 'bg-blue-500' : 'bg-orange-500'
                         }`} />
                         <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                           {order.status.replace("_", " ")} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t">
                <Button 
                  variant="outline" 
                  className="w-full border-2 font-bold rounded-xl hover:bg-accent hover:border-primary/20 transition-all"
                  onClick={() => navigate("/reporteria")}
                >
                  Ver Historial Completo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
