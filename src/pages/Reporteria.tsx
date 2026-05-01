import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type { OrderStatus } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/formatPrice';
import { FileText, Download, Filter, CalendarIcon, DollarSign, TrendingUp, ShoppingCart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCalendarShiftRange } from '@/lib/shiftUtils';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const QUICK_RANGES = [
  { label: 'Hoy', getValue: () => ({ from: startOfDay(new Date()), to: startOfDay(new Date()) }) },
  { label: 'Ayer', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: startOfDay(subDays(new Date(), 1)) }) },
  { label: 'Últimos 7 días', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: startOfDay(new Date()) }) },
  { label: 'Este mes', getValue: () => ({ from: startOfMonth(new Date()), to: startOfDay(endOfMonth(new Date())) }) },
  { label: 'Mes pasado', getValue: () => {
    const d = subDays(startOfMonth(new Date()), 1);
    return { from: startOfMonth(d), to: startOfDay(endOfMonth(d)) };
  }},
];

interface ReportOrder {
  id: string;
  locator: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  created_by: string;
  profiles?: { name: string };
  order_items?: {
    id: string;
    quantity: number;
    products: {
      name: string;
    }
  }[];
}

export default function Reporteria() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: startOfDay(new Date()),
  });
  const [activeQuick, setActiveQuick] = useState('Hoy');

  const { data: reportOrders = [], isLoading } = useQuery({
    queryKey: ['report-orders', user?.id, dateRange],
    queryFn: async () => {
      if (!dateRange?.from) return [];
      const shift = getCalendarShiftRange(dateRange.from, dateRange.to);
      const from = shift.from.toISOString();
      const to = shift.to.toISOString();

      // Fetch orders with nested profile and items
      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles:profiles!orders_created_by_fkey(name), order_items(*, products(*))')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as ReportOrder[]) || [];
    },
    enabled: !!user && !!dateRange?.from,
  });

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return reportOrders;
    return reportOrders.filter(o => o.status === statusFilter);
  }, [reportOrders, statusFilter]);

  const summary = useMemo(() => {
    const total = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const avgTicket = filteredOrders.length > 0 ? total / filteredOrders.length : 0;
    const itemsSold = filteredOrders.reduce((sum, o) =>
      sum + (o.order_items?.reduce((s: number, i) => s + i.quantity, 0) || 0), 0
    );
    const delivered = filteredOrders.filter(o => o.status === 'entregado');
    const cancelled = filteredOrders.filter(o => o.status === 'cancelado');
    return { total, avgTicket, count: filteredOrders.length, itemsSold, delivered: delivered.length, cancelled: cancelled.length };
  }, [filteredOrders]);

  const cashSummary = useMemo(() => {
    const delivered = reportOrders.filter(o => o.status === 'entregado');
    const pending = reportOrders.filter(o => !['entregado', 'cancelado'].includes(o.status));
    const cancelled = reportOrders.filter(o => o.status === 'cancelado');
    return {
      totalSales: delivered.reduce((s, o) => s + o.total, 0),
      deliveredCount: delivered.length,
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, o) => s + o.total, 0),
      cancelledCount: cancelled.length,
      cancelledTotal: cancelled.reduce((s, o) => s + o.total, 0),
      totalOrders: reportOrders.length,
    };
  }, [reportOrders]);

  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    reportOrders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      hours[h] = (hours[h] || 0) + o.total;
    });
    return Array.from({ length: 24 }, (_, i) => ({
      hora: `${i}:00`,
      ventas: hours[i] || 0,
    })).filter(d => d.ventas > 0);
  }, [reportOrders]);

  const waiterData = useMemo(() => {
    const map: Record<string, { name: string; orders: number; total: number }> = {};
    reportOrders.forEach(o => {
      const key = o.created_by;
      const name = o.profiles?.name || 'Sistema';
      if (!map[key]) {
        map[key] = { name, orders: 0, total: 0 };
      }
      map[key].orders++;
      map[key].total += o.total;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [reportOrders]);

  const handleQuickRange = (label: string) => {
    const range = QUICK_RANGES.find(r => r.label === label);
    if (range) {
      setDateRange(range.getValue());
      setActiveQuick(label);
    }
  };

  const exportCSV = () => {
    const header = 'Localizador,Estado,Items,Total,Fecha,Creado Por\n';
    const rows = filteredOrders.map(o =>
      `${o.locator},${o.status},${o.order_items?.length || 0},${o.total},${new Date(o.created_at).toLocaleString('es-CO')},${o.profiles?.name || 'Sistema'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_la30_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl font-bold">Reportería</h1>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={isLoading || reportOrders.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Date range quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_RANGES.map(r => (
          <Button
            key={r.label}
            variant={activeQuick === r.label ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickRange(r.label)}
          >
            {r.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(!dateRange && 'text-muted-foreground')}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateRange?.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, 'dd MMM', { locale: es })} - ${format(dateRange.to, 'dd MMM', { locale: es })}`
                ) : format(dateRange.from, 'dd MMM yyyy', { locale: es })
              ) : 'Rango personalizado'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => { setDateRange(range); setActiveQuick(''); }}
              numberOfMonths={2}
              locale={es}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="en_preparacion">En preparación</SelectItem>
            <SelectItem value="listo">Listo</SelectItem>
            <SelectItem value="entregado">Entregado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="caja">Cierre de Caja</TabsTrigger>
          <TabsTrigger value="meseros">Por Mesero</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
        </TabsList>

        {/* ===== RESUMEN ===== */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Total ventas</p>
              </div>
              <p className="font-display text-xl font-bold">{formatPrice(summary.total)}</p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </div>
              <p className="font-display text-xl font-bold">{summary.count}</p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Ticket promedio</p>
              </div>
              <p className="font-display text-xl font-bold">{formatPrice(summary.avgTicket)}</p>
            </div>
            <div className="pos-card">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Items vendidos</p>
              </div>
              <p className="font-display text-xl font-bold">{summary.itemsSold}</p>
            </div>
          </div>

          <div className="pos-card">
            <h3 className="font-display font-bold mb-4">Ventas por hora</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => formatPrice(v)} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [formatPrice(value), 'Ventas']}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* ===== CIERRE DE CAJA ===== */}
        <TabsContent value="caja" className="space-y-4">
          <div className="pos-card">
            <h3 className="font-display font-bold text-lg mb-1">
              Cierre de Caja — {dateRange?.from ? format(dateRange.from, 'dd MMMM yyyy', { locale: es }) : 'Hoy'}
              {dateRange?.to && dateRange.from?.getTime() !== dateRange.to?.getTime() && ` al ${format(dateRange.to, 'dd MMMM yyyy', { locale: es })}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Resumen de operaciones del período seleccionado</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Ventas completadas</p>
                <p className="font-display text-2xl font-bold text-green-600">{formatPrice(cashSummary.totalSales)}</p>
                <p className="text-xs text-muted-foreground mt-1">{cashSummary.deliveredCount} pedidos entregados</p>
              </div>
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Pedidos en proceso</p>
                <p className="font-display text-2xl font-bold text-amber-600">{formatPrice(cashSummary.pendingTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">{cashSummary.pendingCount} pedidos pendientes</p>
              </div>
              <div className="rounded-xl border-2 border-red-500/30 bg-red-500/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Cancelados</p>
                <p className="font-display text-2xl font-bold text-red-600">{formatPrice(cashSummary.cancelledTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">{cashSummary.cancelledCount} pedidos cancelados</p>
              </div>
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <span className="font-display font-bold text-lg">Total de órdenes del período</span>
              <span className="font-display font-bold text-2xl text-primary">{cashSummary.totalOrders}</span>
            </div>
          </div>
        </TabsContent>

        {/* ===== POR MESERO ===== */}
        <TabsContent value="meseros" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiterData.map(w => (
              <div key={w.name} className="pos-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-display font-bold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.orders} pedidos</p>
                  </div>
                </div>
                <p className="font-display text-xl font-bold text-primary">{formatPrice(w.total)}</p>
              </div>
            ))}
            {waiterData.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">Sin datos en el rango seleccionado</p>
            )}
          </div>

          {waiterData.length > 0 && (
            <div className="pos-card">
              <h3 className="font-display font-bold mb-4">Ventas por operario</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waiterData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => formatPrice(v)} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number) => [formatPrice(value), 'Ventas']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== DETALLE ===== */}
        <TabsContent value="detalle">
          <div className="pos-card overflow-x-auto">
            <h3 className="font-display font-bold mb-4">Detalle de pedidos</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-semibold">Localizador</th>
                  <th className="pb-3 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold">Items</th>
                  <th className="pb-3 font-semibold text-right">Total</th>
                  <th className="pb-3 font-semibold">Creado por</th>
                  <th className="pb-3 font-semibold">Hora</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-3 font-display font-bold text-primary">{order.locator}</td>
                    <td className="py-3"><StatusBadge status={order.status} /></td>
                    <td className="py-3">{order.order_items?.reduce((s: number, i) => s + i.quantity, 0) || 0}</td>
                    <td className="py-3 text-right font-semibold">{formatPrice(order.total)}</td>
                    <td className="py-3 text-muted-foreground">{order.profiles?.name || 'Sistema'}</td>
                    <td className="py-3 text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">Sin pedidos en el rango seleccionado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
