import { User, Award, ShoppingCart, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";

interface StaffTabProps {
  waiterData: { name: string; orders: number; total: number }[];
}

export function StaffTab({ waiterData }: StaffTabProps) {
  const sortedStaff = [...waiterData].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Staff Performance Cards Grid ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Rendimiento por Colaborador
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Ventas acumuladas y comandas despachadas en el período
            </p>
          </div>
          <span className="text-xs font-bold text-teal-600">
            {sortedStaff.length} colaboradores activos
          </span>
        </div>

        {sortedStaff.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4.5">
            {sortedStaff.map((w, idx) => {
              const avgTicket = w.orders > 0 ? Math.round(w.total / w.orders) : 0;
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              return (
                <div
                  key={w.name}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative overflow-hidden"
                >
                  {/* Top Badge for Podium */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "size-11 rounded-2xl flex items-center justify-center font-black text-base shadow-xs shrink-0",
                          isFirst
                            ? "bg-amber-400 text-slate-950 shadow-amber-400/30"
                            : isSecond
                              ? "bg-slate-300 text-slate-800"
                              : isThird
                                ? "bg-amber-700/20 text-amber-800"
                                : "bg-teal-50 text-teal-700 border border-teal-200/60"
                        )}
                      >
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {w.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                          <ShoppingCart className="size-3 text-slate-400" />
                          {w.orders} comandas
                        </span>
                      </div>
                    </div>

                    {isFirst && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                        <Award className="size-3 text-amber-600" />
                        Top 1
                      </span>
                    )}
                  </div>

                  {/* Financial Stats */}
                  <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Ventas
                    </p>
                    <p className="text-xl font-black text-teal-700 tracking-tight">
                      {formatPrice(w.total)}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                      <span>Promedio / orden:</span>
                      <span className="font-bold text-slate-700">{formatPrice(avgTicket)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-3 bg-white border border-slate-200/80 rounded-3xl p-8">
            <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <User className="size-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">
              Sin registros de colaboradores
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No se detectaron órdenes asignadas a personal en este rango de fechas.
            </p>
          </div>
        )}
      </section>

      {/* ── 2. Comparative Bar Chart ── */}
      {sortedStaff.length > 0 && (
        <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <BarChart3 className="size-4 text-teal-600" />
                Comparativa de Ventas por Personal
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Distribución del recaudo generado por cada integrante del equipo
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedStaff} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
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
                <Bar
                  dataKey="total"
                  fill="#0d9488"
                  radius={[8, 8, 0, 0]}
                  barSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
