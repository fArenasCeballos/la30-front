import {
  DollarSign,
  ShoppingCart,
  Award,
  ShoppingBag,
  Truck,
  Store as StoreIcon,
  Clock,
  Banknote,
  CreditCard,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";

interface SummaryTabProps {
  summary: {
    total: number;
    count: number;
    avgTicket: number;
    itemsSold: number;
  };
  isDomiciliosStore: boolean;
  reportStats: {
    caja_total?: number;
    delivery_total?: number;
    delivery_pending?: number;
    top_products?: { product_name: string; quantity: number }[];
  };
  paymentSummary: {
    efectivo: number;
    tarjeta: number;
    nequi: number;
    total: number;
  };
  hourlyData: { hora?: string; date?: string; ventas: number }[];
  isMultiDay: boolean;
}

export function SummaryTab({
  summary,
  isDomiciliosStore,
  reportStats,
  paymentSummary,
  hourlyData,
  isMultiDay,
}: SummaryTabProps) {
  const topProducts = reportStats.top_products || [];
  const maxProductQty = Math.max(...topProducts.map((p) => p.quantity), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. KPI Metric Cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5">
        {/* KPI 1: Ventas Netas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-5 sm:size-5.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
              Ventas Netas
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {formatPrice(summary.total)}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Ingresos del período
            </p>
          </div>
        </div>

        {/* KPI 2: Órdenes */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="size-5 sm:size-5.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
              Órdenes
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {summary.count}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Comandas procesadas
            </p>
          </div>
        </div>

        {/* KPI 3: Ticket Promedio */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="size-5 sm:size-5.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Ticket Promedio
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {formatPrice(summary.avgTicket)}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Promedio por orden
            </p>
          </div>
        </div>

        {/* KPI 4: Ítems Vendidos */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-purple-50 border border-purple-200/60 text-purple-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="size-5 sm:size-5.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
              Unidades
            </span>
          </div>
          <div className="mt-3 sm:mt-4">
            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {summary.itemsSold}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Platos y bebidas
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Channel Breakdown Banner (Mostrador vs Domicilios) ── */}
      {isDomiciliosStore && (
        <section className="bg-linear-to-r from-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                <Truck className="size-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                  Desglose por Canal: Caja vs Domicilios
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Separación de ventas de mostrador frente a entregas a domicilio
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Caja / Mostrador */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-blue-400">
                <span className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <StoreIcon className="size-3.5" /> Ventas en Caja
                </span>
                <span className="text-xs font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  {summary.total > 0
                    ? Math.round(((reportStats.caja_total ?? 0) / summary.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight pt-1">
                {formatPrice(reportStats.caja_total ?? 0)}
              </p>
            </div>

            {/* Domicilios */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-purple-400">
                <span className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <Truck className="size-3.5" /> Ventas Domicilios
                </span>
                <span className="text-xs font-black bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                  {summary.total > 0
                    ? Math.round(((reportStats.delivery_total ?? 0) / summary.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight pt-1">
                {formatPrice(reportStats.delivery_total ?? 0)}
              </p>
            </div>

            {/* Domicilios Pendientes */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <Clock className="size-3.5" /> Domicilios en Ruta
                </span>
              </div>
              <p className="text-2xl font-black text-amber-300 tracking-tight pt-1">
                {formatPrice(reportStats.delivery_pending ?? 0)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Payment Mix & Hourly Sales Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods */}
        <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Mix de Medios de Pago
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              Total: {formatPrice(paymentSummary.total)}
            </span>
          </div>

          <div className="space-y-3.5">
            {[
              {
                label: "Efectivo",
                amount: paymentSummary.efectivo,
                icon: Banknote,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                barColor: "bg-emerald-500",
              },
              {
                label: "Datáfono / Tarjeta",
                amount: paymentSummary.tarjeta,
                icon: CreditCard,
                color: "text-blue-600",
                bg: "bg-blue-50",
                barColor: "bg-blue-500",
              },
              {
                label: "Digital / Nequi / Transf.",
                amount: paymentSummary.nequi,
                icon: Smartphone,
                color: "text-purple-600",
                bg: "bg-purple-50",
                barColor: "bg-purple-500",
              },
            ].map((p) => {
              const Icon = p.icon;
              const percent =
                paymentSummary.total > 0
                  ? Math.round((p.amount / paymentSummary.total) * 100)
                  : 0;
              return (
                <div
                  key={p.label}
                  className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "size-8 rounded-xl flex items-center justify-center shrink-0",
                          p.bg,
                          p.color
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                          {p.label}
                        </p>
                        <p className="text-sm font-black text-slate-900 leading-tight">
                          {formatPrice(p.amount)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                      {percent}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", p.barColor)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Hourly / Daily Chart */}
        <section className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <TrendingUp className="size-4 text-teal-600" />
                {isMultiDay ? "Evolución Diaria de Ventas" : "Distribución Horaria de Ventas"}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {isMultiDay ? "Comparativa por fechas del período" : "Comportamiento hora a hora del turno"}
              </p>
            </div>
            <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full border border-teal-200/60">
              En Vivo
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey={isMultiDay ? "date" : "hora"}
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "16px",
                      border: "none",
                      color: "#fff",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                    formatter={(value: number) => [formatPrice(value), "Ventas"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#0d9488"
                    strokeWidth={3}
                    dot={{ fill: "#0d9488", r: 4, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#0f766e" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                Sin movimientos registrados en este rango de tiempo
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── 4. Top 10 Sold Products ── */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Top Productos Más Vendidos
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Platos con mayor volumen de pedidos en el período
            </p>
          </div>
          <span className="text-xs font-bold text-teal-600">
            {topProducts.length} productos destacados
          </span>
        </div>

        {topProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topProducts.slice(0, 10).map((prod, idx) => {
              const share = Math.round((prod.quantity / maxProductQty) * 100);
              const isPodium = idx < 3;
              return (
                <div
                  key={prod.product_name}
                  className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5 flex items-center gap-3"
                >
                  <div
                    className={cn(
                      "size-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                      idx === 0
                        ? "bg-amber-400 text-slate-900 shadow-xs"
                        : idx === 1
                          ? "bg-slate-300 text-slate-800"
                          : idx === 2
                            ? "bg-amber-700/20 text-amber-800"
                            : "bg-white text-slate-500 border border-slate-200"
                    )}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {prod.product_name}
                      </p>
                      <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full shrink-0">
                        {prod.quantity} uds
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPodium ? "bg-teal-600" : "bg-slate-400"
                        )}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-medium">
            No se registraron ventas de productos en este período
          </div>
        )}
      </section>
    </div>
  );
}
