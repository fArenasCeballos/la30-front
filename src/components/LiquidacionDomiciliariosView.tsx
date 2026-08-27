import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/formatPrice";
import {
  Bike,
  Printer,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  UserCheck,
  RotateCw,
  TrendingUp,
  Receipt,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  getShiftStart,
  getShiftEnd,
  getCalendarShiftRange,
  getCurrentShiftDate,
} from "@/lib/shiftUtils";
import {
  buildDriverSettlementReceiptHTML,
  buildShiftClosingReceiptHTML,
  silentPrint,
} from "@/lib/receiptUtils";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  motorcycle_plate: string;
  is_active: boolean;
}

export function LiquidacionDomiciliariosView() {
  const { user } = useAuth();
  const { activeStore } = useStore();
  const queryClient = useQueryClient();

  // Shift / Date selection (Turno activo de 12:00 PM a 12:00 PM)
  const [activeQuick, setActiveQuick] = useState<string>("Hoy");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const shiftDate = getCurrentShiftDate();
    return {
      from: shiftDate,
      to: shiftDate,
    };
  });

  // Calculate shift start and end (12:00 PM a 12:00 PM)
  const shiftRange = useMemo(() => {
    if (!dateRange?.from) {
      const now = new Date();
      return { from: getShiftStart(now), to: getShiftEnd(now) };
    }
    return getCalendarShiftRange(dateRange.from, dateRange.to);
  }, [dateRange]);

  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [assigningDriverOrderId, setAssigningDriverOrderId] = useState<
    string | null
  >(null);

  // Fetch Drivers
  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["delivery-drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data as Driver[]) || [];
    },
  });

  // Fetch Delivered Orders for the Shift Window
  const {
    data: shiftOrders = [],
    isLoading,
    refetch,
  } = useQuery<Order[]>({
    queryKey: [
      "shift-delivery-orders",
      shiftRange.from.toISOString(),
      shiftRange.to.toISOString(),
      activeStore?.id,
    ],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "*, order_items(*, products(id, name, sort_order, category_id, categories(id, name, sort_order))), payments(id, method, amount_total, amount_efectivo, amount_tarjeta, amount_nequi), profiles(id, name)",
        )
        .eq("is_delivery", true)
        .gte("created_at", shiftRange.from.toISOString())
        .lte("created_at", shiftRange.to.toISOString())
        .in("status", ["entregado", "cancelado"])
        .order("created_at", { ascending: true });

      if (activeStore?.id) {
        query = query.eq("store_id", activeStore.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Order[]) || [];
    },
  });

  const handleQuickShift = (label: string) => {
    setActiveQuick(label);
    const currentShift = getCurrentShiftDate();
    if (label === "Hoy") {
      setDateRange({ from: currentShift, to: currentShift });
    } else if (label === "Ayer") {
      const yesterdayShift = subDays(currentShift, 1);
      setDateRange({
        from: yesterdayShift,
        to: yesterdayShift,
      });
    }
  };

  // Group Delivered Orders by Driver
  const {
    deliveredOrders,
    driverGroups,
    unassignedOrders,
    grandTotalFees,
    grandTotalCash,
    grandTotalOrdersSales,
  } = useMemo(() => {
    const delivered = shiftOrders.filter((o) => o.status === "entregado");

    const groups = new Map<
      string,
      {
        driver: Driver | null;
        orders: Order[];
        totalFee: number;
        cashCollected: number;
        totalSales: number;
      }
    >();

    const unassigned: Order[] = [];

    let totalFees = 0;
    let totalCash = 0;
    let totalSales = 0;

    delivered.forEach((order) => {
      const fee = order.delivery_fee ?? 0;
      totalFees += fee;
      totalSales += order.total ?? 0;

      // Calculate cash
      let cash = 0;
      order.payments?.forEach((p) => {
        if (p.method === "efectivo") {
          cash += p.amount_total || 0;
        } else if (p.method === "mixto") {
          cash += p.amount_efectivo || 0;
        }
      });
      totalCash += cash;

      if (!order.driver_id) {
        unassigned.push(order);
      } else {
        const driver = drivers.find((d) => d.id === order.driver_id) || null;
        const current = groups.get(order.driver_id) || {
          driver,
          orders: [],
          totalFee: 0,
          cashCollected: 0,
          totalSales: 0,
        };
        current.orders.push(order);
        current.totalFee += fee;
        current.cashCollected += cash;
        current.totalSales += order.total ?? 0;
        groups.set(order.driver_id, current);
      }
    });

    return {
      deliveredOrders: delivered,
      driverGroups: Array.from(groups.values()),
      unassignedOrders: unassigned,
      grandTotalFees: totalFees,
      grandTotalCash: totalCash,
      grandTotalOrdersSales: totalSales,
    };
  }, [shiftOrders, drivers]);

  // Assign Driver to an order on the fly
  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      setAssigningDriverOrderId(orderId);
      const { error } = await supabase
        .from("orders")
        .update({ driver_id: driverId })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Domiciliario asignado exitosamente");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast.error(
        `Error al asignar domiciliario: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAssigningDriverOrderId(null);
    }
  };

  // Print Driver Settlement Receipt
  const handlePrintDriverSettlement = async (
    driver: Driver,
    orders: Order[],
  ) => {
    try {
      const cajeroName = user?.name || "Cajero Domicilios";
      const html = buildDriverSettlementReceiptHTML({
        driverName: `${driver.first_name} ${driver.last_name}`,
        driverPlate: driver.motorcycle_plate,
        driverPhone: driver.phone,
        orders,
        shiftStart: shiftRange.from,
        shiftEnd: shiftRange.to,
        cajeroName,
        storeName: activeStore?.name || "LA 30 BURGER",
      });
      await silentPrint(
        html,
        `Liquidacion-${driver.first_name}-${driver.motorcycle_plate}`,
      );
      toast.success(
        `Tirilla de liquidación enviada a impresión para ${driver.first_name}`,
      );
    } catch (err) {
      toast.error(
        `Error al imprimir: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  // Print Consolidated Shift Closing Receipt
  const handlePrintConsolidatedShift = async () => {
    if (deliveredOrders.length === 0) {
      toast.error("No hay pedidos entregados en este turno para imprimir");
      return;
    }
    try {
      const cajeroName = user?.name || "Cajero Domicilios";
      const closingHTML = buildShiftClosingReceiptHTML({
        orders: deliveredOrders,
        cajeroName,
        shiftStart: shiftRange.from,
        shiftEnd: shiftRange.to,
      });
      await silentPrint(closingHTML, "Cierre de Turno - Domicilios");
      toast.success("Tirilla de Cierre de Domicilios enviada a impresión");
    } catch (err) {
      toast.error(
        `Error al imprimir: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Header & Controls Bar */}
      <div className="bg-white/80 backdrop-blur-xl p-5 lg:p-7 rounded-3xl lg:rounded-[2rem] border-2 border-purple-500/20 shadow-lg shadow-purple-500/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/30 shrink-0">
              <Bike className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black tracking-tight text-foreground uppercase">
                  Liquidación de Domiciliarios
                </h2>
                <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 font-black text-[9px] uppercase tracking-wider">
                  Turno 12 PM - 12 PM
                </Badge>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3 text-purple-600" />
                Período:{" "}
                <span className="text-foreground/80 font-black">
                  {format(shiftRange.from, "dd MMM, hh:mm a", { locale: es })}
                </span>{" "}
                a{" "}
                <span className="text-foreground/80 font-black">
                  {format(shiftRange.to, "dd MMM, hh:mm a", { locale: es })}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-xl h-10 px-3 border-accent/20 hover:bg-accent/10 font-black text-[10px] uppercase tracking-widest shrink-0"
              disabled={isLoading}
            >
              <RotateCw
                className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")}
              />
              Actualizar
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handlePrintConsolidatedShift}
              disabled={deliveredOrders.length === 0}
              className="rounded-xl h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase tracking-widest shadow-md shadow-purple-500/20 shrink-0"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Imprimir Cierre General
            </Button>
          </div>
        </div>

        {/* Date / Shift Filter Row */}
        <div className="flex items-center gap-2 pt-3 border-t border-accent/10 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 bg-accent/5 p-1 rounded-2xl border border-accent/10 shrink-0">
            {["Hoy", "Ayer"].map((label) => (
              <button
                key={label}
                onClick={() => handleQuickShift(label)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                  activeQuick === label
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground/60 hover:text-purple-600",
                )}
              >
                {label}
              </button>
            ))}

            <div className="w-px h-4 bg-accent/20 mx-1" />

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white rounded-xl transition-all group whitespace-nowrap">
                  <CalendarIcon className="h-3.5 w-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-900">
                    {dateRange?.from
                      ? format(dateRange.from, "dd MMM yyyy", { locale: es })
                      : "Fecha Específica"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 rounded-3xl border-none shadow-2xl"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dateRange?.from}
                  onSelect={(date) => {
                    if (date) {
                      setDateRange({ from: date, to: date });
                      setActiveQuick("");
                    }
                  }}
                  locale={es}
                  className="p-4"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* KPI Cards: Consolidated Shift Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          {
            label: "TOTAL ENTREGAS",
            value: deliveredOrders.length,
            icon: Bike,
            color: "text-purple-600",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
          },
          {
            label: "FLETES A DOMICILIARIOS",
            value: formatPrice(grandTotalFees),
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
          },
          {
            label: "EFECTIVO EN MANO",
            value: formatPrice(grandTotalCash),
            icon: TrendingUp,
            color: "text-blue-600",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
          },
          {
            label: "VENTAS DOMICILIOS",
            value: formatPrice(grandTotalOrdersSales),
            icon: CheckCircle2,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
          },
        ].map((card, i) => (
          <div
            key={i}
            className={cn(
              "bg-white/80 backdrop-blur-md p-4 lg:p-5 rounded-2xl lg:rounded-3xl border-2 shadow-sm space-y-2",
              card.border,
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                  card.bg,
                  card.color,
                )}
              >
                <card.icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <p className="text-[8px] lg:text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 leading-tight">
                {card.label}
              </p>
            </div>
            <p
              className={cn(
                "text-lg lg:text-2xl font-black tracking-tight",
                card.color,
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Alert: Unassigned Deliveries (If any) */}
      {unassignedOrders.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 lg:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm lg:text-base font-black text-amber-900 uppercase">
                  Pedidos sin Domiciliario Asignado ({unassignedOrders.length})
                </h3>
                <p className="text-[10px] font-bold text-amber-700/80">
                  Asigna el repartidor correspondiente para calcular su
                  liquidación correctamente.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-purple-700 text-sm">
                    #DOM {order.locator}
                  </span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Flete: {formatPrice(order.delivery_fee ?? 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground/80 space-y-0.5">
                  <p className="font-bold text-foreground">
                    {order.delivery_name || "Cliente"}
                  </p>
                  <p className="truncate text-[11px]">
                    📍 {order.delivery_address || "Sin dirección"}
                  </p>
                </div>
                <div className="pt-1">
                  <Select
                    disabled={assigningDriverOrderId === order.id}
                    onValueChange={(driverId) =>
                      handleAssignDriver(order.id, driverId)
                    }
                  >
                    <SelectTrigger className="w-full h-9 rounded-xl border-amber-300 bg-amber-50/50 text-[10px] font-black uppercase tracking-wider text-amber-900">
                      <SelectValue placeholder="Asignar Domiciliario" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl p-1">
                      {drivers.map((d) => (
                        <SelectItem
                          key={d.id}
                          value={d.id}
                          className="font-bold text-xs py-2"
                        >
                          🛵 {d.first_name} {d.last_name} ({d.motorcycle_plate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver Settlement Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-purple-600" />
            <h3 className="text-xs lg:text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
              Desglose Individual de Domiciliarios ({driverGroups.length})
            </h3>
          </div>
        </div>

        {driverGroups.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center bg-white/40 rounded-3xl border-2 border-dashed border-accent/20 space-y-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Bike className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="font-black uppercase tracking-widest text-sm text-foreground/70">
                No hay liquidaciones en este turno
              </p>
              <p className="text-xs text-muted-foreground/60 max-w-sm">
                No se registraron entregas de domicilios con repartidor en el
                período seleccionado.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {driverGroups.map((group) => {
              if (!group.driver) return null;
              const isExpanded = expandedDriverId === group.driver.id;
              const driver = group.driver;
              const netBalance = group.cashCollected - group.totalFee;

              return (
                <div
                  key={driver.id}
                  className="bg-white/90 backdrop-blur-md rounded-3xl border-2 border-purple-500/15 shadow-md overflow-hidden transition-all duration-300 hover:border-purple-500/30"
                >
                  {/* Card Header — Summary and Print Action */}
                  <div className="p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
                        <Bike className="h-7 w-7" strokeWidth={2.5} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base lg:text-lg font-black text-foreground uppercase tracking-tight">
                            {driver.first_name} {driver.last_name}
                          </h4>
                          <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 font-black text-[9px] uppercase tracking-wider">
                            🛵 {driver.motorcycle_plate}
                          </Badge>
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-black text-[9px] uppercase tracking-wider">
                            {group.orders.length} Entregas
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground/60 flex items-center gap-2">
                          <Phone className="h-3 w-3 text-purple-500" />
                          {driver.phone}
                        </p>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-accent/10">
                      {/* Fletes / Valor Domicilios */}
                      <div className="text-left lg:text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">
                          VALOR DOMICILIOS A PAGAR
                        </p>
                        <p className="text-xl font-black text-emerald-600 tracking-tight">
                          {formatPrice(group.totalFee)}
                        </p>
                      </div>

                      {/* Efectivo Recaudado */}
                      <div className="text-left lg:text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">
                          EFECTIVO COBRADO
                        </p>
                        <p className="text-xl font-black text-blue-600 tracking-tight">
                          {formatPrice(group.cashCollected)}
                        </p>
                      </div>

                      {/* Balance con Caja */}
                      <div className="text-left lg:text-right px-3 py-1.5 rounded-xl bg-accent/5 border border-accent/10">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">
                          {netBalance >= 0 ? "ENTREGA A CAJA" : "CAJA LE PAGA"}
                        </p>
                        <p
                          className={cn(
                            "text-lg font-black tracking-tight",
                            netBalance >= 0
                              ? "text-purple-700"
                              : "text-emerald-600",
                          )}
                        >
                          {formatPrice(Math.abs(netBalance))}
                        </p>
                      </div>

                      {/* Print and Expand Buttons */}
                      <div className="flex items-center gap-2 ml-auto">
                        <Button
                          size="sm"
                          onClick={() =>
                            handlePrintDriverSettlement(driver, group.orders)
                          }
                          className="h-10 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase tracking-widest shadow-sm shadow-purple-500/20"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1.5" />
                          Tirilla
                        </Button>

                        <button
                          onClick={() =>
                            setExpandedDriverId((prev) =>
                              prev === driver.id ? null : driver.id,
                            )
                          }
                          className="h-10 w-10 rounded-xl bg-accent/5 hover:bg-accent/10 flex items-center justify-center text-muted-foreground transition-all"
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 transition-transform duration-300",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Order Breakdown Table */}
                  {isExpanded && (
                    <div className="p-5 lg:p-6 bg-accent/5 border-t-2 border-dashed border-accent/20 space-y-3">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-2">
                        <span>Detalle de Pedidos Entregados</span>
                        <span>Total Pedidos: {group.orders.length}</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-accent/10 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">
                              <th className="pb-2">Localizador</th>
                              <th className="pb-2">Hora</th>
                              <th className="pb-2">Cliente / Dirección</th>
                              <th className="pb-2">Medio Pago</th>
                              <th className="pb-2 text-right">Total Pedido</th>
                              <th className="pb-2 text-right">
                                Valor Domicilio (Flete)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/10 font-medium">
                            {group.orders.map((order) => {
                              const hora = new Date(
                                order.created_at,
                              ).toLocaleTimeString("es-CO", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              });
                              const payments =
                                order.payments
                                  ?.map((p) => p.method.toUpperCase())
                                  .join(", ") || "PENDIENTE";

                              return (
                                <tr
                                  key={order.id}
                                  className="hover:bg-white/50"
                                >
                                  <td className="py-2.5 font-black text-purple-700">
                                    #DOM {order.locator}
                                  </td>
                                  <td className="py-2.5 text-muted-foreground">
                                    {hora}
                                  </td>
                                  <td className="py-2.5">
                                    <p className="font-bold text-foreground">
                                      {order.delivery_name || "Cliente"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/80 truncate max-w-xs">
                                      📍{" "}
                                      {order.delivery_address ||
                                        "Sin dirección"}
                                    </p>
                                  </td>
                                  <td className="py-2.5">
                                    <Badge
                                      variant="outline"
                                      className="font-bold text-[9px] uppercase"
                                    >
                                      {payments}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-foreground">
                                    {formatPrice(order.total)}
                                  </td>
                                  <td className="py-2.5 text-right font-black text-emerald-600">
                                    +{formatPrice(order.delivery_fee ?? 0)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
