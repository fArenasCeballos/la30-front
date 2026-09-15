import { useState, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store as StoreIcon,
  Truck,
  User,
  MapPin,
  Phone,
  FileText,
  Calendar as CalendarIcon,
  DollarSign,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import type { OrderStatus } from "@/types";

export interface ReportOrder {
  is_delivery: boolean;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  delivery_fee?: number | null;
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
    unit_price: number;
    extras_total: number;
    notes: string | null;
    selected_options: Record<string, string> | null;
    selected_extras: string[] | null;
    products: {
      name: string;
      categories: { name: string } | null;
    };
  }[];
  siigo_invoice_id?: string | null;
  siigo_invoice_number?: string | null;
  siigo_invoices?: {
    id: string;
    siigo_invoice_id: string | null;
    siigo_invoice_number: string | null;
    status: string;
    payment_method: string;
    response_payload?: { public_url?: string; [key: string]: unknown } | null;
  }[];
}

interface AuditTabProps {
  orders: ReportOrder[];
  totalOrdersCount: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  expandedDetailId: string | null;
  onToggleDetail: (orderId: string) => void;
  activeStoreName?: string;
}

export function AuditTab({
  orders,
  totalOrdersCount,
  page,
  totalPages,
  onPageChange,
  expandedDetailId,
  onToggleDetail,
  activeStoreName,
}: AuditTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      const matchLocator = order.locator?.toLowerCase().includes(term);
      const matchCustomer = order.delivery_name?.toLowerCase().includes(term);
      const matchAddress = order.delivery_address?.toLowerCase().includes(term);
      const matchUser = order.profiles?.name?.toLowerCase().includes(term);
      return matchLocator || matchCustomer || matchAddress || matchUser;
    });
  }, [orders, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Top Controls Bar: Search + Counter ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar por localizador (#ORD, #DOM), cliente, dirección u operador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 h-11 text-sm bg-slate-50/70 border-slate-200 rounded-xl focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-teal-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-200/50"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-500 shrink-0">
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
            {totalOrdersCount} órdenes totales
          </span>
          {totalPages > 1 && (
            <span className="text-slate-400">
              Pág. {page + 1} de {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Top Pagination (if multiple pages) ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-white border-slate-200 hover:bg-slate-50 active:scale-98 transition-all"
          >
            <ChevronLeft className="size-4 mr-1" />
            Anterior
          </Button>
          <span className="text-xs font-bold text-slate-600">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-white border-slate-200 hover:bg-slate-50 active:scale-98 transition-all"
          >
            Siguiente
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── 3. Orders List ── */}
      {filteredOrders.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-slate-200 shadow-sm text-center px-4">
          <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <ShoppingCart className="size-8" strokeWidth={1.75} />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="text-base font-bold text-slate-800">
              No se encontraron transacciones
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {searchTerm
                ? "No hay resultados para tu búsqueda. Intenta con otro criterio."
                : "No hay registros para los filtros o rango de fechas seleccionado."}
            </p>
          </div>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="rounded-xl mt-2 text-xs font-semibold"
            >
              Borrar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedDetailId === order.id;
            const itemCount =
              order.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;
            const formattedTime = new Date(order.created_at).toLocaleTimeString(
              "es-CO",
              { hour: "2-digit", minute: "2-digit", hour12: true }
            );
            const successInv = order.siigo_invoices?.find(
              (inv) => inv.status === "success"
            );

            return (
              <div
                key={order.id}
                className={cn(
                  "bg-white rounded-2xl transition-all duration-200 border overflow-hidden",
                  isExpanded
                    ? "border-teal-500/50 shadow-md ring-1 ring-teal-500/20"
                    : "border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
                )}
              >
                {/* ── Card Header (Clickable) ── */}
                <div
                  onClick={() => onToggleDetail(order.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                >
                  {/* Left locator + basic info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Badge locator */}
                    <div
                      className={cn(
                        "size-13 rounded-xl flex flex-col items-center justify-center shrink-0 border font-black transition-colors",
                        order.is_delivery
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-teal-50 text-teal-700 border-teal-200"
                      )}
                    >
                      <span className="text-[9px] uppercase tracking-wider font-bold opacity-75">
                        {order.is_delivery ? "DOM" : "ORD"}
                      </span>
                      <span className="text-base font-black leading-none">
                        {order.locator}
                      </span>
                    </div>

                    {/* Metadata column */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.is_delivery ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md">
                            <Truck className="size-3" />
                            Domicilio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md">
                            <StoreIcon className="size-3" />
                            Caja Local
                          </span>
                        )}

                        <StatusBadge
                          status={order.status}
                          className="scale-90 origin-left"
                        />

                        <span className="text-[11px] font-semibold text-slate-400">
                          {itemCount} {itemCount === 1 ? "artículo" : "artículos"} • {formattedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap pt-0.5">
                        <span className="text-base sm:text-lg font-black text-slate-900">
                          {formatPrice(order.total)}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <User className="size-3 text-slate-400" />
                          {order.profiles?.name || "Sistema"}
                        </span>

                        {order.is_delivery && order.delivery_name && (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 truncate max-w-[200px]">
                            {order.delivery_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Siigo quick pill + expand button */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    {successInv && (
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                            Factura Siigo
                          </span>
                          <span className="text-xs font-black text-emerald-900">
                            {successInv.siigo_invoice_number || successInv.siigo_invoice_id || "OK"}
                          </span>
                        </div>
                        {successInv.response_payload?.public_url && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(successInv.response_payload?.public_url, "_blank");
                            }}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xs transition-transform active:scale-95 min-h-[34px]"
                          >
                            <FileText className="size-3.5" />
                            PDF
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      aria-label={isExpanded ? "Contraer detalle" : "Expandir detalle"}
                      className={cn(
                        "size-9 rounded-xl flex items-center justify-center border transition-all duration-200 min-h-[44px] min-w-[44px]",
                        isExpanded
                          ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                      )}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* ── Card Expanded Detail ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden border-t border-slate-100 bg-slate-50/70"
                    >
                      <div className="p-4 sm:p-6 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Left: Items breakdown */}
                          <div className="lg:col-span-7 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="size-2 rounded-full bg-teal-600" />
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Desglose de Productos
                              </h4>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                              {order.order_items && order.order_items.length > 0 ? (
                                order.order_items.map((item) => (
                                  <div key={item.id} className="p-3.5 sm:p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-3">
                                        <span className="size-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center text-xs font-black shrink-0">
                                          {item.quantity}x
                                        </span>
                                        <div>
                                          <p className="text-sm font-bold text-slate-900 leading-snug">
                                            {item.products?.name || "Producto sin nombre"}
                                          </p>
                                          <p className="text-[11px] text-slate-400 font-medium">
                                            Unitario: {formatPrice(item.unit_price)}
                                            {item.extras_total > 0 && (
                                              <span> • Extras: +{formatPrice(item.extras_total)}</span>
                                            )}
                                          </p>
                                        </div>
                                      </div>

                                      <p className="text-sm font-black text-slate-900 shrink-0">
                                        {formatPrice(
                                          (item.unit_price + item.extras_total) * item.quantity
                                        )}
                                      </p>
                                    </div>

                                    {/* Options, extras, notes */}
                                    {(item.selected_options ||
                                      (item.selected_extras && item.selected_extras.length > 0) ||
                                      item.notes) && (
                                      <div className="ml-10 p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1.5 text-xs">
                                        {item.selected_options &&
                                          Object.entries(item.selected_options).map(([key, val]) => (
                                            <div
                                              key={key}
                                              className="flex items-center gap-1.5 text-slate-600"
                                            >
                                              <span className="font-semibold text-slate-400">
                                                {key}:
                                              </span>
                                              <span className="font-medium text-slate-800">{val}</span>
                                            </div>
                                          ))}

                                        {item.selected_extras && item.selected_extras.length > 0 && (
                                          <div className="flex items-center gap-1.5 text-slate-600">
                                            <span className="font-semibold text-slate-400">
                                              Adicionales:
                                            </span>
                                            <span className="font-medium text-slate-800">
                                              {item.selected_extras.join(", ")}
                                            </span>
                                          </div>
                                        )}

                                        {item.notes && (
                                          <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 p-1.5 rounded-md border border-amber-200">
                                            <ListChecks className="size-3.5 shrink-0" />
                                            <span className="font-medium italic">"{item.notes}"</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="p-4 text-xs text-slate-400 italic text-center">
                                  Sin detalles de artículos registrados.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Logistics + Total */}
                          <div className="lg:col-span-5 space-y-4">
                            {/* Traceability Grid */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-teal-600" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                  Trazabilidad
                                </h4>
                              </div>

                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-2 gap-3.5">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <CalendarIcon className="size-3" />
                                    Fecha
                                  </span>
                                  <p className="text-xs font-bold text-slate-800">
                                    {format(new Date(order.created_at), "dd MMM yyyy, pp", {
                                      locale: es,
                                    })}
                                  </p>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    {order.is_delivery ? (
                                      <Truck className="size-3" />
                                    ) : (
                                      <StoreIcon className="size-3" />
                                    )}
                                    Canal
                                  </span>
                                  <p className="text-xs font-bold text-slate-800">
                                    {order.is_delivery ? "Domicilio" : "Caja Local"}
                                  </p>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <User className="size-3" />
                                    Operador
                                  </span>
                                  <p className="text-xs font-bold text-slate-800">
                                    {order.profiles?.name || "Sistema"}
                                  </p>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <MapPin className="size-3" />
                                    Sede
                                  </span>
                                  <p className="text-xs font-bold text-slate-800 truncate">
                                    {activeStoreName || "General"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Delivery details if applicable */}
                            {order.is_delivery &&
                              (order.delivery_address || order.delivery_phone) && (
                                <div className="bg-purple-50/80 rounded-xl border border-purple-200 p-3.5 space-y-2 text-xs">
                                  <p className="font-bold text-purple-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                                    <Truck className="size-3.5 text-purple-600" />
                                    Datos de Entrega
                                  </p>
                                  <div className="space-y-1.5 text-slate-700">
                                    {order.delivery_address && (
                                      <p className="flex items-start gap-1.5 font-medium">
                                        <MapPin className="size-3.5 text-purple-500 shrink-0 mt-0.5" />
                                        <span>{order.delivery_address}</span>
                                      </p>
                                    )}
                                    {order.delivery_phone && (
                                      <p className="flex items-center gap-1.5 font-semibold text-purple-700">
                                        <Phone className="size-3.5 shrink-0" />
                                        <a
                                          href={`tel:${order.delivery_phone}`}
                                          className="hover:underline"
                                        >
                                          {order.delivery_phone}
                                        </a>
                                      </p>
                                    )}
                                    {(order.delivery_fee ?? 0) > 0 && (
                                      <div className="pt-1">
                                        <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[11px]">
                                          Costo de Envío: {formatPrice(order.delivery_fee ?? 0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Total Card */}
                            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Total Neto de la Orden
                                </span>
                                <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                  {formatPrice(order.total)}
                                </p>
                              </div>
                              <div className="size-12 rounded-xl bg-white/10 flex items-center justify-center text-teal-400">
                                <DollarSign className="size-6" strokeWidth={2.5} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. Bottom Pagination ── */}
      {totalPages > 1 && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onPageChange(Math.max(0, page - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page === 0}
            className="h-11 px-5 rounded-xl font-bold text-xs bg-white border-slate-200 hover:bg-slate-50 active:scale-98 transition-all min-h-[44px]"
          >
            <ChevronLeft className="size-4 mr-1" />
            Anterior
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-800">
              Página {page + 1} de {totalPages}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {totalOrdersCount} registros en total
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onPageChange(page + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={page >= totalPages - 1}
            className="h-11 px-5 rounded-xl font-bold text-xs bg-white border-slate-200 hover:bg-slate-50 active:scale-98 transition-all min-h-[44px]"
          >
            Siguiente
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
