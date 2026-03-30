import { useMemo } from 'react';
import { useOrders } from '@/context/OrderContext';
import { formatPrice } from '@/lib/formatPrice';
import {
  DollarSign, Clock, CheckCircle, TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['hsl(24, 90%, 50%)', 'hsl(142, 72%, 40%)', 'hsl(200, 80%, 50%)', 'hsl(45, 93%, 47%)', 'hsl(0, 72%, 51%)', 'hsl(270, 60%, 50%)'];

export default function Dashboard() {
  const { orders } = useOrders();

  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter(o => o.status === 'entregado')
      .reduce((sum, o) => sum + (o.total ?? 0), 0);
    const activeOrders = orders.filter(o =>
      ['pendiente', 'confirmado', 'en_preparacion', 'listo'].includes(o.status)
    ).length;
    const completedToday = orders.filter(o => o.status === 'entregado').length;
    const cancelledToday = orders.filter(o => o.status === 'cancelado').length;
    const avgOrderValue = completedToday > 0 ? totalRevenue / completedToday : 0;
    return { totalRevenue, activeOrders, completedToday, cancelledToday, avgOrderValue };
  }, [orders]);

  const productStats = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        // Guard: ignorar items sin producto válido (join incompleto)
        if (!item?.products) return;
        const existing = map.get(item.products.id);
        if (existing) {
          existing.quantity += item.quantity ?? 0;
          existing.revenue += (item.unit_price ?? 0) * (item.quantity ?? 0);
        } else {
          map.set(item.products.id, {
            name: item.products.name ?? 'Producto',
            quantity: item.quantity ?? 0,
            revenue: (item.unit_price ?? 0) * (item.quantity ?? 0),
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [orders]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      if (!o.status) return;
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace('_', ' '),
      value: count,
    }));
  }, [orders]);

  const statCards = [
    { label: 'Ventas del día', value: formatPrice(stats.totalRevenue), icon: DollarSign, color: 'text-success' },
    { label: 'Pedidos activos', value: stats.activeOrders, icon: Clock, color: 'text-primary' },
    { label: 'Completados', value: stats.completedToday, icon: CheckCircle, color: 'text-success' },
    { label: 'Ticket promedio', value: formatPrice(stats.avgOrderValue), icon: TrendingUp, color: 'text-preparing' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="pos-card">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className="font-display text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products chart */}
        <div className="pos-card">
          <h3 className="font-display font-bold mb-4">Productos más vendidos</h3>
          <div className="h-64">
            {productStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [`${value} unidades`]}
                  />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sin datos aún
              </div>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="pos-card">
          <h3 className="font-display font-bold mb-4">Estado de pedidos</h3>
          <div className="h-64">
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {statusDistribution.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sin datos aún
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="pos-card">
        <h3 className="font-display font-bold mb-4">Actividad reciente</h3>
        <div className="space-y-3">
          {orders.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">Sin pedidos aún</p>
          )}
          {orders.slice(0, 8).map(order => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-primary">{order.locator}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {(order.status ?? '').replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {order.order_items?.length || 0} items
                </span>
                <span className="font-semibold">{formatPrice(order.total ?? 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}