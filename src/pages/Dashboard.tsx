import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/formatPrice';
import { Badge } from '@/components/ui/badge';
import type { OrderRow } from '@/types';
import {
  DollarSign, Clock, CheckCircle, TrendingUp,
  BarChart3, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['hsl(24, 90%, 50%)', 'hsl(142, 72%, 40%)', 'hsl(200, 80%, 50%)', 'hsl(45, 93%, 47%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 50%)'];

export default function Dashboard() {
  // Velocidad exponencial: Usamos RPCs del backend en lugar de calcular en el cliente
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return data as {
        total_revenue: number;
        active_orders: number;
        completed_today: number;
        cancelled_today: number;
        avg_ticket: number;
      };
    },
    refetchInterval: 30000, // Cada 30 seg
  });

  const { data: productStats = [] } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc<'get_top_products'>('get_top_products', { p_limit: 6 });
      if (error) throw error;
      return data;
    },
  });

  // Query ligera para actividad reciente (solo los últimos 8 pedidos)
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const statusDistribution = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Activos', value: stats.active_orders },
      { name: 'Completados', value: stats.completed_today },
      { name: 'Cancelados', value: stats.cancelled_today },
    ];
  }, [stats]);

  const statCards = [
    { label: 'Ventas del día', value: formatPrice(stats?.total_revenue ?? 0), icon: DollarSign, color: 'text-green-500' },
    { label: 'Pedidos activos', value: stats?.active_orders ?? 0, icon: Clock, color: 'text-orange-500' },
    { label: 'Completados', value: stats?.completed_today ?? 0, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Ticket promedio', value: formatPrice(stats?.avg_ticket ?? 0), icon: TrendingUp, color: 'text-blue-500' },
  ];

  if (loadingStats) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="pos-card bg-card p-4 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="font-display text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products chart */}
        <div className="pos-card bg-card p-4 rounded-xl border shadow-sm">
          <h3 className="font-display font-bold mb-4">Productos más vendidos</h3>
          <div className="h-64">
            {productStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="product_name" width={100} fontSize={11} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                Sin datos aún
              </div>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="pos-card bg-card p-4 rounded-xl border shadow-sm">
          <h3 className="font-display font-bold mb-4">Distribución de hoy</h3>
          <div className="h-64">
            {statusDistribution.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                Sin pedidos hoy
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity activity */}
      <div className="pos-card bg-card p-4 rounded-xl border shadow-sm">
        <h3 className="font-display font-bold mb-4">Actividad reciente</h3>
        <div className="space-y-3">
          {recentOrders.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">Sin pedidos recientes</p>
          )}
          {recentOrders.map((order: OrderRow) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-accent/20 px-2 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-primary">{order.locator}</span>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground hidden sm:inline">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-bold">{formatPrice(order.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
