import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";
import {
  fetchConsumptions,
  fetchPayments,
  buildMonthlyStatement,
} from "@/lib/internalConsumptionService";
import { buildCuentaDeCobroHTML } from "@/lib/internalReceiptUtils";
import { silentPrint } from "@/lib/receiptUtils";
import { SettlePaymentModal } from "@/components/consumo-interno/SettlePaymentModal";
import type {
  Profile,
  InternalConsumptionWithItems,
  InternalConsumptionPayment,
  MonthlyAccountStatement,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Printer,
  Banknote,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatMonthLabel(monthStr: string): string {
  const date = new Date(monthStr + "-01");
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
}

function navigateMonth(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmployeeAccountsView() {
  const { activeStore } = useStore();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEmployee, setSelectedEmployee] =
    useState<MonthlyAccountStatement | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{
    consumerId: string;
    consumerName: string;
    balance: number;
    consumptionId?: string;
  } | null>(null);

  const { start, end } = getMonthRange(selectedMonth);

  // ── Data Queries ───────────────────────────────────────────────────────────

  const { data: employees = [] } = useQuery<Profile[]>({
    queryKey: ["employee-accounts-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: consumptions = [],
    isLoading: loadingConsumptions,
    refetch: refetchConsumptions,
  } = useQuery<InternalConsumptionWithItems[]>({
    queryKey: ["employee-consumptions", selectedMonth, activeStore?.id],
    queryFn: () =>
      fetchConsumptions({
        storeId: activeStore?.id,
        monthStart: start,
        monthEnd: end,
        consumerType: "employee",
      }),
    staleTime: 60 * 1000,
  });

  const {
    data: payments = [],
    refetch: refetchPayments,
  } = useQuery<InternalConsumptionPayment[]>({
    queryKey: ["employee-payments", selectedMonth],
    queryFn: () =>
      fetchPayments({
        monthStart: start,
        monthEnd: end,
        consumerType: "employee",
      }),
    staleTime: 60 * 1000,
  });

  // ── Build Statements ───────────────────────────────────────────────────────

  const statements: MonthlyAccountStatement[] = useMemo(() => {
    const employeesWithConsumptions = new Map<
      string,
      {
        name: string;
        consumptions: InternalConsumptionWithItems[];
        payments: InternalConsumptionPayment[];
      }
    >();

    // Group consumptions by employee
    for (const c of consumptions) {
      if (!c.employee_id) continue;
      const existing = employeesWithConsumptions.get(c.employee_id);
      if (existing) {
        existing.consumptions.push(c);
      } else {
        employeesWithConsumptions.set(c.employee_id, {
          name: c.consumer_name,
          consumptions: [c],
          payments: [],
        });
      }
    }

    // Group payments by employee
    for (const p of payments) {
      if (!p.employee_id) continue;
      const existing = employeesWithConsumptions.get(p.employee_id);
      if (existing) {
        existing.payments.push(p);
      } else {
        // Find employee name from profiles
        const emp = employees.find((e) => e.id === p.employee_id);
        employeesWithConsumptions.set(p.employee_id, {
          name: emp?.name ?? "Desconocido",
          consumptions: [],
          payments: [p],
        });
      }
    }

    return Array.from(employeesWithConsumptions.entries())
      .map(([id, data]) =>
        buildMonthlyStatement(
          id,
          data.name,
          "employee",
          selectedMonth,
          data.consumptions,
          data.payments,
        ),
      )
      .sort((a, b) => b.balance - a.balance || a.consumerName.localeCompare(b.consumerName));
  }, [consumptions, payments, employees, selectedMonth]);

  // ── Aggregated Metrics ─────────────────────────────────────────────────────

  const totalConsumed = statements.reduce(
    (sum, s) => sum + s.totalConsumed,
    0,
  );
  const totalPaid = statements.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalBalance = statements.reduce((sum, s) => sum + s.balance, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePrintCuentaDeCobro = async (
    statement: MonthlyAccountStatement,
  ) => {
    try {
      const html = buildCuentaDeCobroHTML(
        statement,
        activeStore?.name ?? "La 30",
      );
      await silentPrint(html, "Cuenta de Cobro");
      toast.success(`Cuenta de cobro impresa para ${statement.consumerName}`);
    } catch {
      toast.error("Error al imprimir la cuenta de cobro");
    }
  };

  const handleSettle = (statement: MonthlyAccountStatement) => {
    setSettleTarget({
      consumerId: statement.consumerId,
      consumerName: statement.consumerName,
      balance: statement.balance,
    });
    setShowSettleModal(true);
  };

  const refreshAll = () => {
    refetchConsumptions();
    refetchPayments();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setSelectedMonth(navigateMonth(selectedMonth, -1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-black capitalize">
            {formatMonthLabel(selectedMonth)}
          </p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Estado de Cuentas — Empleados
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => setSelectedMonth(navigateMonth(selectedMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4">
        <div className="bg-white rounded-2xl border-2 border-accent/20 p-5 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            Total Consumido
          </p>
          <p className="text-2xl font-black">{formatPrice(totalConsumed)}</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-green-400/20 p-5 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-600/60">
            Total Pagado
          </p>
          <p className="text-2xl font-black text-green-600">
            {formatPrice(totalPaid)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border-2 p-5 space-y-1",
            totalBalance > 0
              ? "bg-red-50 border-red-300/30"
              : "bg-green-50 border-green-300/30",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              totalBalance > 0
                ? "text-red-600/60"
                : "text-green-600/60",
            )}
          >
            Saldo Pendiente
          </p>
          <p
            className={cn(
              "text-2xl font-black",
              totalBalance > 0 ? "text-red-600" : "text-green-600",
            )}
          >
            {formatPrice(totalBalance)}
          </p>
        </div>
      </div>

      {/* Employee List */}
      {loadingConsumptions ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-black uppercase tracking-[0.2em] text-[10px]">
            Cargando datos...
          </p>
        </div>
      ) : statements.length === 0 ? (
        <div className="py-20 text-center space-y-4 opacity-20">
          <Users className="h-16 w-16 mx-auto" />
          <p className="font-black uppercase tracking-[0.3em] text-sm">
            Sin consumos en este mes
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {statements.map((s) => (
            <div
              key={s.consumerId}
              className="bg-white rounded-2xl border-2 border-accent/20 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-primary/20 transition-all"
            >
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                  {s.consumerName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black truncate">
                    {s.consumerName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {s.consumptions.length} consumo
                    {s.consumptions.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Amounts */}
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-[9px] font-bold uppercase text-muted-foreground/60">
                    Consumido
                  </p>
                  <p className="text-sm font-black">
                    {formatPrice(s.totalConsumed)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-muted-foreground/60">
                    Pagado
                  </p>
                  <p className="text-sm font-black text-green-600">
                    {formatPrice(s.totalPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-muted-foreground/60">
                    Saldo
                  </p>
                  {s.balance > 0 ? (
                    <Badge
                      variant="destructive"
                      className="font-black text-xs"
                    >
                      {formatPrice(s.balance)}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 font-black text-xs border-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Al día
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-[10px] font-black gap-1"
                  onClick={() => setSelectedEmployee(s)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Detalle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-[10px] font-black gap-1"
                  onClick={() => handlePrintCuentaDeCobro(s)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cobro
                </Button>
                {s.balance > 0 && (
                  <Button
                    size="sm"
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black gap-1"
                    onClick={() => handleSettle(s)}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Pagar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedEmployee}
        onOpenChange={(open) => !open && setSelectedEmployee(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3rem] p-10 border-none shadow-strong">
          <DialogHeader className="space-y-2 mb-6">
            <DialogTitle className="text-2xl font-black tracking-tight">
              {selectedEmployee?.consumerName}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
              Detalle de Consumos ·{" "}
              {formatMonthLabel(selectedMonth)}
            </p>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-4">
              {selectedEmployee.consumptions.map((c) => {
                const date = new Date(c.created_at).toLocaleDateString(
                  "es-CO",
                  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
                );
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border-2 border-accent/20 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">
                        {date}
                      </span>
                      <Badge
                        variant={
                          c.payment_status === "paid"
                            ? "default"
                            : "destructive"
                        }
                        className="text-[9px] font-black uppercase"
                      >
                        {c.payment_status === "paid" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Pagado
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pendiente
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {(c.internal_consumption_items ?? []).map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-xs"
                        >
                          <span>
                            {item.quantity}x {item.product_name}
                            {item.is_beverage && (
                              <span className="text-amber-600 ml-1">
                                (Bebida)
                              </span>
                            )}
                          </span>
                          <span className="font-black">
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm font-black pt-2 border-t border-accent/10">
                      <span>Total:</span>
                      <span>{formatPrice(c.total)}</span>
                    </div>
                  </div>
                );
              })}

              {selectedEmployee.consumptions.length === 0 && (
                <div className="text-center py-10 text-muted-foreground/30">
                  <p className="font-bold">Sin consumos este mes</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settle Payment Modal */}
      {settleTarget && (
        <SettlePaymentModal
          open={showSettleModal}
          onOpenChange={setShowSettleModal}
          consumerType="employee"
          consumerId={settleTarget.consumerId}
          consumerName={settleTarget.consumerName}
          pendingBalance={settleTarget.balance}
          onSettled={refreshAll}
        />
      )}
    </div>
  );
}
