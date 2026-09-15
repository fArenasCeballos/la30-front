import {
  Banknote,
  CreditCard,
  Smartphone,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Store as StoreIcon,
  Truck,
} from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";

interface CashTabProps {
  cashSummary: {
    totalSales: number;
    deliveredCount: number;
    pendingCount: number;
    pendingTotal: number;
    cancelledCount: number;
    totalOrders: number;
  };
  paymentSummary: {
    efectivo: number;
    tarjeta: number;
    nequi: number;
    total: number;
  };
  isDomiciliosStore: boolean;
  reportStats: {
    caja_total?: number;
    delivery_total?: number;
  };
}

export function CashTab({
  cashSummary,
  paymentSummary,
  isDomiciliosStore,
  reportStats,
}: CashTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Hero Grand Total Card ── */}
      <section className="bg-linear-to-br from-teal-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Banknote className="size-3.5" />
              Cuadre & Arqueo de Caja
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              {formatPrice(cashSummary.totalSales)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Ventas totales recaudadas en el período seleccionado
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 shrink-0">
            <div className="size-11 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-md">
              <DollarSign className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-teal-200 uppercase tracking-wider">
                Total de Comandas
              </p>
              <p className="text-xl font-black text-white">
                {cashSummary.totalOrders} órdenes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Payment Methods Recaudation ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
          Liquidación por Medio de Pago
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4.5">
          {/* Efectivo */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                  <Banknote className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Efectivo en Gaveta</h4>
                  <p className="text-[11px] text-slate-400">Recaudo físico</p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {paymentSummary.total > 0
                  ? Math.round((paymentSummary.efectivo / paymentSummary.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-600 tracking-tight pt-1">
              {formatPrice(paymentSummary.efectivo)}
            </p>
          </div>

          {/* Datáfono */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Datáfono / Tarjeta</h4>
                  <p className="text-[11px] text-slate-400">Vouchers comprobante</p>
                </div>
              </div>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {paymentSummary.total > 0
                  ? Math.round((paymentSummary.tarjeta / paymentSummary.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-blue-600 tracking-tight pt-1">
              {formatPrice(paymentSummary.tarjeta)}
            </p>
          </div>

          {/* Digital / Nequi */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Digital / Nequi / Transf.</h4>
                  <p className="text-[11px] text-slate-400">Pagos electrónicos</p>
                </div>
              </div>
              <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                {paymentSummary.total > 0
                  ? Math.round((paymentSummary.nequi / paymentSummary.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-purple-600 tracking-tight pt-1">
              {formatPrice(paymentSummary.nequi)}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Operative & Channel Balance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operative Balance */}
        <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Balance Operativo de Comandas
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Estado de resolución de pedidos en el período
            </p>
          </div>

          <div className="space-y-3">
            {/* Entregados */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">Pedidos Entregados</p>
                  <p className="text-[11px] text-emerald-700">Completados y cobrados</p>
                </div>
              </div>
              <span className="text-base font-black text-emerald-800 bg-white px-3 py-1 rounded-xl shadow-2xs">
                {cashSummary.deliveredCount}
              </span>
            </div>

            {/* Pendientes / En Proceso */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100">
              <div className="flex items-center gap-2.5">
                <Clock className="size-5 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Pedidos En Proceso / Pendientes</p>
                  <p className="text-[11px] text-amber-700">En preparación o en ruta</p>
                </div>
              </div>
              <span className="text-base font-black text-amber-800 bg-white px-3 py-1 rounded-xl shadow-2xs">
                {cashSummary.pendingCount}
              </span>
            </div>

            {/* Cancelados */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
              <div className="flex items-center gap-2.5">
                <XCircle className="size-5 text-rose-600" />
                <div>
                  <p className="text-xs font-bold text-rose-900">Pedidos Cancelados</p>
                  <p className="text-[11px] text-rose-700">Anulados sin recaudación</p>
                </div>
              </div>
              <span className="text-base font-black text-rose-800 bg-white px-3 py-1 rounded-xl shadow-2xs">
                {cashSummary.cancelledCount}
              </span>
            </div>
          </div>
        </section>

        {/* Channel Summary (if applicable) */}
        <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Resumen de Cierre Financiero
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Totales consolidados para entrega de turno
            </p>
          </div>

          <div className="space-y-3">
            {isDomiciliosStore && (
              <>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <StoreIcon className="size-4 text-blue-600" />
                    Ventas Mostrador / Caja
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {formatPrice(reportStats.caja_total ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Truck className="size-4 text-purple-600" />
                    Ventas Servicio Domicilio
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {formatPrice(reportStats.delivery_total ?? 0)}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-50 border border-teal-200/80">
              <div>
                <p className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <TrendingUp className="size-4 text-teal-700" />
                  Total Liquidado
                </p>
                <p className="text-[11px] text-teal-700">Listo para cierre contable</p>
              </div>
              <span className="text-xl font-black text-teal-800">
                {formatPrice(cashSummary.totalSales)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
