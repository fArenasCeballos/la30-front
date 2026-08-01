import { useState, useMemo, useCallback, useEffect } from "react";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/formatPrice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Banknote,
  CreditCard,
  Smartphone,
  ArrowLeft,
  CheckCircle,
  Receipt,
  Delete,
  Users,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = "efectivo" | "tarjeta" | "nequi" | "mixto";
type SubMethod = "tarjeta_credito" | "tarjeta_debito" | "nequi" | "daviplata";
type BaseMethod = "efectivo" | "tarjeta" | "nequi";

export interface SharedPaymentEntry {
  method: BaseMethod;
  subMethod?: SubMethod;
  amount: number;
}

const PAYMENT_METHODS: {
  key: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    key: "efectivo",
    label: "EFECTIVO",
    icon: <Banknote className="h-5 w-5 lg:h-8 lg:w-8" />,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  {
    key: "tarjeta",
    label: "TARJETA",
    icon: <CreditCard className="h-5 w-5 lg:h-8 lg:w-8" />,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  {
    key: "nequi",
    label: "NEQUI / TRANSF.",
    icon: <Smartphone className="h-5 w-5 lg:h-8 lg:w-8" />,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  {
    key: "mixto",
    label: "COMPARTIDO",
    icon: <Users className="h-5 w-5 lg:h-7 lg:w-7" />,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
];

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

interface PaymentCalculatorProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  onPaymentComplete: (
    method: PaymentMethod,
    received: number,
    breakdown?: {
      efectivo?: number;
      tarjeta?: number;
      nequi?: number;
      tarjeta_credito?: number;
      tarjeta_debito?: number;
      daviplata?: number;
    },
    sharedPayments?: SharedPaymentEntry[],
  ) => Promise<boolean> | boolean | Promise<void> | void;
}

export function PaymentCalculator({
  order,
  open,
  onClose,
  onPaymentComplete,
}: PaymentCalculatorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [subMethod, setSubMethod] = useState<SubMethod | null>(null);
  const [received, setReceived] = useState("");

  // Shared (multi-person) payment state
  const [partialPayments, setPartialPayments] = useState<SharedPaymentEntry[]>(
    [],
  );
  const [currentPartialMethod, setCurrentPartialMethod] =
    useState<BaseMethod | null>(null);
  const [currentPartialSubMethod, setCurrentPartialSubMethod] =
    useState<SubMethod | null>(null);

  const [alreadyPaidItemIds, setAlreadyPaidItemIds] = useState<Set<string>>(new Set());
  const [currentPersonItemIds, setCurrentPersonItemIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [step, setStep] = useState<
    | "method"
    | "amount"
    | "sub_method_tarjeta"
    | "sub_method_transfer"
    | "shared_items"
    | "shared_method"
    | "shared_amount"
    | "done"
  >("method");

  const receivedNum = useMemo(() => parseInt(received) || 0, [received]);

  // Total previously paid (from DB)
  const previouslyPaid = useMemo(() => {
    if (!order.payments) return 0;
    return order.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [order.payments]);

  const baseRemaining = useMemo(() => {
    return Math.max(0, order.total - previouslyPaid);
  }, [order.total, previouslyPaid]);

  // Total already covered by partial payments in this modal session
  const partialTotal = useMemo(
    () => partialPayments.reduce((sum, p) => sum + p.amount, 0),
    [partialPayments],
  );

  // Amount still to be paid
  const remainingTotal = useMemo(() => {
    if (method === "mixto") return Math.max(0, baseRemaining - partialTotal);
    return baseRemaining;
  }, [method, baseRemaining, partialTotal]);

  useEffect(() => {
    if (open && order.id) {
      try {
        const stored = localStorage.getItem(`paid_items_${order.id}`);
        if (stored) {
          setTimeout(() => {
            const parsed = JSON.parse(stored);
            setAlreadyPaidItemIds(new Set(parsed));
            if (parsed.length > 0) {
              setMethod("mixto");
              setStep("shared_items");
            }
          }, 0);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [open, order.id]);

  const change = useMemo(() => {
    if (method === "mixto" && step === "shared_amount") {
      return Math.max(0, receivedNum - remainingTotal);
    }
    if (method !== "mixto" && step === "amount") {
      return Math.max(0, receivedNum - baseRemaining);
    }
    return 0;
  }, [receivedNum, baseRemaining, method, remainingTotal, step]);

  // Can finalize the entire payment or partial
  const canConfirm = useMemo(() => {
    if (method === "mixto" && step === "shared_amount") {
      return receivedNum > 0 && receivedNum <= remainingTotal;
    }
    if (step === "amount" && method === "efectivo") {
      return receivedNum >= baseRemaining;
    }
    return false;
  }, [method, step, receivedNum, remainingTotal, baseRemaining]);

  // Can add current amount as a partial (not the last one)
  const canAddPartial = useMemo(() => {
    if (step !== "shared_amount") return false;
    return receivedNum > 0 && receivedNum < remainingTotal;
  }, [step, receivedNum, remainingTotal]);

  const handleNumpad = useCallback(
    (val: string) => {
      if (isSubmitting) return;
      if (val === "C") {
        setReceived("");
      } else if (val === "DEL") {
        setReceived((prev) => prev.slice(0, -1));
      } else {
        setReceived((prev) => (prev + val).slice(0, 10));
      }
    },
    [isSubmitting],
  );

  const handleQuickAmount = useCallback(
    (amount: number) => {
      if (isSubmitting) return;
      setReceived((prev) => String((parseInt(prev) || 0) + amount));
    },
    [isSubmitting],
  );

  const resetState = useCallback(() => {
    setMethod(null);
    setSubMethod(null);
    setReceived("");
    setPartialPayments([]);
    setCurrentPartialMethod(null);
    setCurrentPartialSubMethod(null);
    setAlreadyPaidItemIds(new Set());
    setCurrentPersonItemIds(new Set());
    setSelectedItemIds(new Set());
    setStep("method");
    setIsSubmitting(false);
  }, []);

  const handleExact = useCallback(() => {
    if (isSubmitting) return;
    setReceived(String(remainingTotal));
  }, [remainingTotal, isSubmitting]);

  // Add the current entry as a partial payment and continue
  const addPartialPayment = useCallback(() => {
    if (
      !currentPartialMethod ||
      receivedNum <= 0 ||
      receivedNum >= remainingTotal
    )
      return;
    const newPartial: SharedPaymentEntry = {
      method: currentPartialMethod,
      subMethod: currentPartialSubMethod ?? undefined,
      amount: receivedNum,
    };
    setPartialPayments((prev) => [...prev, newPartial]);
    setAlreadyPaidItemIds((prev) => {
      const next = new Set([...prev, ...currentPersonItemIds]);
      localStorage.setItem(`paid_items_${order.id}`, JSON.stringify([...next]));
      return next;
    });
    setReceived("");
    setCurrentPartialMethod(null);
    setCurrentPartialSubMethod(null);
    setCurrentPersonItemIds(new Set());
    setSelectedItemIds(new Set());
    setStep("shared_items");
  }, [
    currentPartialMethod,
    currentPartialSubMethod,
    receivedNum,
    remainingTotal,
    currentPersonItemIds,
    order.id,
  ]);

  const removePartialPayment = useCallback((index: number) => {
    setPartialPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirmPayment = useCallback(
    async (
      overrideReceived?: number,
      overrideMethod?: PaymentMethod,
      overrideSubMethod?: SubMethod | null,
    ) => {
      const activeMethod = overrideMethod || method;
      if (!activeMethod || isSubmitting) return;
      setIsSubmitting(true);

      const currentReceived =
        overrideReceived !== undefined ? overrideReceived : receivedNum;

      const breakdown: {
        efectivo?: number;
        tarjeta?: number;
        nequi?: number;
        tarjeta_credito?: number;
        tarjeta_debito?: number;
        daviplata?: number;
      } = {};

      let finalReceived = currentReceived;
      let finalSharedPayments: SharedPaymentEntry[] | undefined;

      if (activeMethod === "mixto") {
        // Build all payments: existing partials + the current (final) entry
        const allPayments: SharedPaymentEntry[] = [...partialPayments];
        if (currentPartialMethod && currentReceived > 0) {
          allPayments.push({
            method: currentPartialMethod,
            subMethod: currentPartialSubMethod ?? undefined,
            amount: currentReceived,
          });
        }

        // Aggregate into breakdown by method for DB
        allPayments.forEach((p) => {
          if (p.method === "efectivo") {
            breakdown.efectivo = (breakdown.efectivo || 0) + p.amount;
          } else if (p.subMethod) {
            breakdown[p.subMethod] = (breakdown[p.subMethod] || 0) + p.amount;
          } else if (p.method === "tarjeta") {
            breakdown.tarjeta = (breakdown.tarjeta || 0) + p.amount;
          } else if (p.method === "nequi") {
            breakdown.nequi = (breakdown.nequi || 0) + p.amount;
          }
        });

        finalReceived = allPayments.reduce((sum, p) => sum + p.amount, 0);
        finalSharedPayments = allPayments;
      } else if (activeMethod === "efectivo") {
        breakdown.efectivo = currentReceived;
      } else {
        const finalSub =
          overrideSubMethod ||
          subMethod ||
          (activeMethod as "tarjeta" | "nequi");
        breakdown[finalSub] = currentReceived;
      }

      try {
        const success = await onPaymentComplete(
          activeMethod,
          finalReceived,
          breakdown,
          finalSharedPayments,
        );
        if (success !== false) {
          if (finalReceived >= remainingTotal) {
            localStorage.removeItem(`paid_items_${order.id}`);
          } else if (activeMethod === "mixto") {
            const finalPaidItems = new Set([...alreadyPaidItemIds, ...currentPersonItemIds]);
            localStorage.setItem(`paid_items_${order.id}`, JSON.stringify([...finalPaidItems]));
          }
          setStep("done");
          setTimeout(() => {
            resetState();
            onClose();
          }, 1500);
        } else {
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error("Error processing payment:", error);
        setIsSubmitting(false);
      }
    },
    [
      method,
      isSubmitting,
      receivedNum,
      partialPayments,
      currentPartialMethod,
      currentPartialSubMethod,
      subMethod,
      onPaymentComplete,
      resetState,
      onClose,
      remainingTotal,
      order.id,
      alreadyPaidItemIds,
      currentPersonItemIds,
    ],
  );

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;
      if (e.key >= "0" && e.key <= "9") handleNumpad(e.key);
      else if (e.key === "Backspace") handleNumpad("DEL");
      else if (e.key === "Escape" || e.key === "Delete") handleNumpad("C");
      else if (e.key === "Enter") {
        if ((step === "amount" || step === "shared_amount") && canConfirm)
          handleConfirmPayment();
        else if (step === "shared_amount" && canAddPartial) addPartialPayment();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    step,
    canConfirm,
    canAddPartial,
    handleNumpad,
    handleConfirmPayment,
    addPartialPayment,
    isSubmitting,
  ]);

  const handleClose = () => {
    if (isSubmitting) return;
    resetState();
    onClose();
  };

  const selectMethod = (m: PaymentMethod) => {
    if (isSubmitting) return;
    setMethod(m);
    if (m === "mixto") {
      setSelectedItemIds(new Set());
      setCurrentPersonItemIds(new Set());
      setStep("shared_items");
    } else if (m === "tarjeta") {
      setStep("sub_method_tarjeta");
    } else if (m === "nequi") {
      setStep("sub_method_transfer");
    } else {
      setStep("amount");
    }
  };

  const selectSharedMethod = (m: BaseMethod) => {
    setCurrentPartialMethod(m);
    setCurrentPartialSubMethod(null);
    if (m === "tarjeta") {
      setStep("sub_method_tarjeta");
    } else if (m === "nequi") {
      setStep("sub_method_transfer");
    } else {
      setStep("shared_amount");
    }
  };

  const selectSubMethodTarjeta = (
    sub: "tarjeta_credito" | "tarjeta_debito",
  ) => {
    if (method === "mixto") {
      setCurrentPartialSubMethod(sub);
      setStep("shared_amount");
    } else {
      setSubMethod(sub);
      setReceived(String(baseRemaining));
      handleConfirmPayment(baseRemaining, "tarjeta", sub);
    }
  };

  const selectSubMethodTransfer = (sub: "nequi" | "daviplata") => {
    if (method === "mixto") {
      setCurrentPartialSubMethod(sub);
      setStep("shared_amount");
    } else {
      setSubMethod(sub);
      setReceived(String(baseRemaining));
      handleConfirmPayment(baseRemaining, "nequi", sub);
    }
  };

  const getMethodLabel = (m: BaseMethod, sub?: SubMethod) => {
    if (sub === "tarjeta_credito") return "T. Crédito";
    if (sub === "tarjeta_debito") return "T. Débito";
    if (sub === "daviplata") return "Daviplata";
    if (sub === "nequi") return "Nequi";
    if (m === "efectivo") return "Efectivo";
    if (m === "tarjeta") return "Tarjeta";
    return "Nequi";
  };

  const getMethodIcon = (m: BaseMethod) => {
    if (m === "efectivo") return <Banknote className="h-3.5 w-3.5" />;
    if (m === "tarjeta") return <CreditCard className="h-3.5 w-3.5" />;
    return <Smartphone className="h-3.5 w-3.5" />;
  };

  const getMethodColor = (m: BaseMethod) => {
    if (m === "efectivo")
      return "bg-green-500/10 text-green-700 border-green-500/20";
    if (m === "tarjeta")
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    return "bg-purple-500/10 text-purple-700 border-purple-500/20";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-y-auto max-h-[92vh] rounded-3xl lg:rounded-[2.5rem] border-none shadow-strong bg-white/95 backdrop-blur-xl custom-scrollbar">
        {/* Glassmorphic Loading Overlay */}
        {isSubmitting && step !== "done" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 lg:p-12 space-y-6 bg-white/90 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] animate-in fade-in duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/5 shadow-inner">
                <svg
                  className="animate-spin h-8 w-8 text-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl lg:text-2xl font-black tracking-tighter text-foreground uppercase">
                Procesando Transacción
              </h3>
              <p className="text-muted-foreground font-medium text-xs lg:text-sm max-w-xs mx-auto">
                Por favor, espera un momento mientras registramos el pago de
                forma segura...
              </p>
            </div>
          </div>
        )}

        {/* Done step */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center p-12 lg:p-16 space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
              <div className="relative w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500/10 shadow-inner">
                <CheckCircle
                  className="h-16 w-16 text-green-500"
                  strokeWidth={3}
                />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-5xl font-black tracking-tighter text-foreground">
                ¡PAGO EXITOSO!
              </h2>
              <p className="text-muted-foreground font-medium text-xl">
                Procesando facturación y comandas...
              </p>
            </div>
          </div>
        )}

        {/* ═══════ Method selection ═══════ */}
        {step === "method" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <DialogHeader className="p-4 lg:p-6 pb-2 lg:pb-3">
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-primary/10 p-2 lg:p-3 rounded-2xl">
                  <Receipt className="h-8 w-8 text-primary" strokeWidth={3} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                    PUNTO DE PAGO
                  </div>
                  <DialogTitle className="text-2xl lg:text-4xl font-black tracking-tighter">
                    Cobrar Pedido #{order.locator}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="sr-only">
                Selección de método de pago
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 lg:p-6 pt-2 lg:pt-3 space-y-3 lg:space-y-6">
              {/* Ticket Order summary */}
              <div className="relative">
                <div className="absolute inset-0 bg-accent/5 rounded-2xl lg:rounded-[2.5rem] -rotate-1 translate-y-1" />
                <div className="relative rounded-2xl lg:rounded-3xl bg-white border-2 border-accent/20 p-4 lg:p-5 space-y-2 lg:space-y-3 shadow-soft">
                  <div className="flex items-center justify-between border-b-2 border-dashed border-accent/20 pb-4 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      DETALLE DE ORDEN
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      {order.order_items?.length} ITEMS
                    </span>
                  </div>
                  <div className="space-y-2 max-h-25 overflow-y-auto pr-2 custom-scrollbar">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-lg"
                      >
                        <span className="font-bold flex items-center gap-3">
                          <span className="text-primary font-black bg-primary/5 px-2 py-0.5 rounded-lg text-sm">
                            {item.quantity}x
                          </span>
                          {item.products.name}
                        </span>
                        <span className="font-black tracking-tighter text-muted-foreground/60">
                          {formatPrice(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-2 border-accent/10 pt-4 flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                        {previouslyPaid > 0 ? "RESTANTE A RECAUDAR" : "TOTAL A RECAUDAR"}
                      </span>
                      <div className="text-2xl lg:text-4xl font-black tracking-tighter text-primary">
                        {formatPrice(baseRemaining)}
                      </div>
                      {previouslyPaid > 0 && (
                        <div className="text-xs font-bold text-muted-foreground mt-1">
                          TOTAL ORIGINAL: {formatPrice(order.total)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment methods */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-accent/20" />
                  <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em]">
                    MÉTODO DE PAGO
                  </span>
                  <div className="h-px flex-1 bg-accent/20" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.key}
                      onClick={() => selectMethod(pm.key)}
                      className={cn(
                        "group relative flex flex-row lg:flex-col items-center justify-center gap-2 lg:gap-3 p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] shadow-soft hover:shadow-xl",
                        pm.color,
                      )}
                    >
                      <div className="transition-transform duration-500 group-hover:scale-110 shrink-0">
                        {pm.icon}
                      </div>
                      <span className="text-[9px] lg:text-xs font-black tracking-widest truncate">
                        {pm.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ Shared: Item Selector ═══════ */}
        {step === "shared_items" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-6 flex flex-col h-[60vh] lg:h-[70vh]">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStep("method");
                  setMethod(null);
                  setPartialPayments([]);
                  setReceived("");
                  try {
                    const stored = localStorage.getItem(`paid_items_${order.id}`);
                    setAlreadyPaidItemIds(stored ? new Set(JSON.parse(stored)) : new Set());
                  } catch (e) {
                    setAlreadyPaidItemIds(new Set());
                  }
                }}
                className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-accent/10"
              >
                <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  PAGO COMPARTIDO • PAGO #{partialPayments.length + 1}
                </div>
                <h3 className="text-xl lg:text-2xl font-black tracking-tighter">
                  ¿Qué ítems va a pagar?
                </h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {order.order_items?.map((item) => {
                const isSelected = selectedItemIds.has(item.id);
                const isAlreadyPaid = alreadyPaidItemIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    disabled={isAlreadyPaid}
                    onClick={() => {
                      if (isAlreadyPaid) return;
                      setSelectedItemIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 transition-all text-left",
                      isAlreadyPaid ? "opacity-50 grayscale cursor-not-allowed bg-accent/5" :
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "bg-white hover:bg-accent/5 border-accent/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors shrink-0",
                        isAlreadyPaid ? "bg-accent/20 border-accent/30 text-muted-foreground" :
                        isSelected ? "bg-primary border-primary text-white" : "border-accent/30"
                      )}>
                        {(isSelected || isAlreadyPaid) && <CheckCircle className="h-4 w-4" strokeWidth={3} />}
                      </div>
                      <div>
                        <span className="font-bold block">{item.products?.name}</span>
                        <span className="text-xs font-black text-muted-foreground/60">{item.quantity}x • {formatPrice(item.unit_price)} c/u</span>
                      </div>
                    </div>
                    <span className="font-black text-primary">
                      {isAlreadyPaid ? "PAGADO" : formatPrice(item.unit_price * item.quantity)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pt-4 mt-4 border-t border-accent/10 shrink-0 space-y-2">
              <Button
                size="lg"
                className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-strong"
                onClick={() => {
                  let sum = 0;
                  order.order_items?.forEach((item) => {
                    if (selectedItemIds.has(item.id)) sum += (item.unit_price * item.quantity);
                  });
                  setReceived(String(sum));
                  setCurrentPersonItemIds(new Set(selectedItemIds));
                  setStep("shared_method");
                }}
              >
                CONTINUAR CON {selectedItemIds.size > 0 ? "ÍTEMS" : "CERO (0)"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl border-2 font-black text-[10px] shadow-soft bg-transparent text-muted-foreground border-accent/20 uppercase"
                onClick={() => {
                  setReceived("");
                  setCurrentPersonItemIds(new Set());
                  setSelectedItemIds(new Set());
                  setStep("shared_method");
                }}
              >
                DIGITAR MONTO MANUALMENTE
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ Shared: Select method for next partial ═══════ */}
        {step === "shared_method" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStep("shared_items");
                }}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-amber-600 font-black uppercase tracking-[0.3em] text-[10px]">
                  PAGO COMPARTIDO • PAGO #{partialPayments.length + 1}
                </div>
                <h3 className="text-2xl lg:text-4xl font-black tracking-tighter">
                  ¿Cómo paga?
                </h3>
              </div>
            </div>

            {/* Show remaining */}
            <div className="bg-amber-500/5 rounded-2xl lg:rounded-3xl p-4 lg:p-6 mb-4 lg:mb-6 border-2 border-amber-500/10 border-dashed text-center">
              <p className="text-xs font-black text-amber-600/60 uppercase tracking-widest mb-1">
                {receivedNum > 0
                  ? "TOTAL SELECCIONADO"
                  : partialPayments.length === 0
                  ? "TOTAL A PAGAR"
                  : "MONTO RESTANTE"}
              </p>
              <div className="text-3xl lg:text-4xl font-black tracking-tighter text-amber-600">
                {formatPrice(receivedNum > 0 ? receivedNum : remainingTotal)}
              </div>
              {receivedNum > 0 && receivedNum !== remainingTotal && (
                <p className="text-[10px] font-bold text-amber-600/40 mt-2 uppercase tracking-wider">
                  SALDO DESPUÉS DE ESTE PAGO: {formatPrice(Math.max(0, remainingTotal - receivedNum))}
                </p>
              )}
            </div>

            {/* Show already added partials */}
            {partialPayments.length > 0 && (
              <div className="space-y-2 mb-4 lg:mb-6">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  PAGOS REGISTRADOS
                </p>
                {partialPayments.map((p, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border-2 animate-in fade-in slide-in-from-left-4 duration-300",
                      getMethodColor(p.method),
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      {getMethodIcon(p.method)}
                      <span className="text-xs font-black">
                        Pago {idx + 1}: {getMethodLabel(p.method, p.subMethod)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm">
                        {formatPrice(p.amount)}
                      </span>
                      <button
                        onClick={() => removePartialPayment(idx)}
                        className="h-6 w-6 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-all active:scale-90"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-accent/10 mt-2">
                  <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                    ACUMULADO
                  </span>
                  <span className="text-sm font-black text-foreground">
                    {formatPrice(partialTotal)} / {formatPrice(order.total)}
                  </span>
                </div>
              </div>
            )}

            {/* Method buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              {PAYMENT_METHODS.filter((pm) => pm.key !== "mixto").map((pm) => (
                <button
                  key={pm.key}
                  onClick={() => selectSharedMethod(pm.key as BaseMethod)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 p-6 lg:p-8 rounded-2xl lg:rounded-3xl border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl",
                    pm.color,
                  )}
                >
                  {pm.icon}
                  <span className="text-[10px] font-black tracking-widest">
                    {pm.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ Shared: Amount entry ═══════ */}
        {step === "shared_amount" && currentPartialMethod && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-6 mb-2 lg:mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setReceived("");
                  setCurrentPartialMethod(null);
                  setCurrentPartialSubMethod(null);
                  setStep("shared_method");
                }}
                className="h-10 w-10 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-accent/10 animate-none"
              >
                <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-amber-600 font-black uppercase tracking-[0.3em] text-[8px] lg:text-[10px]">
                  PAGO #{partialPayments.length + 1} •{" "}
                  {getMethodLabel(
                    currentPartialMethod,
                    currentPartialSubMethod ?? undefined,
                  ).toUpperCase()}
                </div>
                <h3 className="text-xl lg:text-2xl font-black tracking-tighter">
                  ¿Cuánto paga esta persona?
                </h3>
              </div>
            </div>

            {/* Show existing partials summary */}
            {partialPayments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {partialPayments.map((p, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black",
                      getMethodColor(p.method),
                    )}
                  >
                    {getMethodIcon(p.method)}
                    <span>{formatPrice(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 lg:space-y-4">
              {/* Display */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-8">
                <div className="rounded-2xl lg:rounded-3xl bg-accent/5 p-4 lg:p-6 text-center space-y-1 lg:space-y-3 border-2 border-accent/5 shadow-inner">
                  <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                    MONTO DE ESTE PAGO
                  </p>
                  <p className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground">
                    {received ? formatPrice(receivedNum) : "$0"}
                  </p>
                  {receivedNum > 0 &&
                    receivedNum >= remainingTotal &&
                    currentPartialMethod === "efectivo" && (
                      <div className="pt-3 border-t border-accent/10 mt-3 flex flex-col items-center gap-1">
                        <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none">
                          CAMBIO PARA EL CLIENTE
                        </p>
                        <p className="text-lg lg:text-2xl font-black tracking-tighter text-green-500">
                          {formatPrice(change)}
                        </p>
                      </div>
                    )}
                  <div className="pt-2 mt-2 border-t border-accent/5">
                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                      RESTANTE:{" "}
                      <span className="text-foreground font-black ml-1">
                        {formatPrice(remainingTotal)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExact}
                      className="h-10 lg:h-12 rounded-xl lg:rounded-2xl border-2 font-black uppercase tracking-widest text-[8px] lg:text-[10px] shadow-soft"
                    >
                      MONTO EXACTO
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReceived("50000")}
                      className="h-10 lg:h-12 rounded-xl lg:rounded-2xl border-2 font-black text-sm shadow-soft"
                    >
                      $50.000
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {QUICK_AMOUNTS.slice(2, 6).map((a) => (
                      <Button
                        key={a}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickAmount(a)}
                        className="h-10 lg:h-12 rounded-xl lg:rounded-2xl font-black text-sm shadow-soft bg-white border-2 border-accent/5"
                      >
                        +{formatPrice(a)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "C",
                  "0",
                  "DEL",
                ].map((key) => (
                  <Button
                    key={key}
                    variant="secondary"
                    className={cn(
                      "h-10 lg:h-11 rounded-xl lg:rounded-2xl font-black text-lg transition-all active:scale-95 shadow-soft border-2 border-transparent",
                      key === "C"
                        ? "text-destructive hover:bg-destructive/5 hover:border-destructive/10"
                        : key === "DEL"
                          ? "hover:bg-accent/10"
                          : "hover:border-primary/20",
                    )}
                    onClick={() => handleNumpad(key)}
                  >
                    {key === "DEL" ? (
                      <Delete className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      key
                    )}
                  </Button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {canAddPartial && (
                  <Button
                    size="lg"
                    className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] lg:text-xs uppercase tracking-[0.15em] shadow-strong shadow-amber-500/20 transition-all active:scale-95"
                    onClick={addPartialPayment}
                  >
                    <Users
                      className="h-5 w-5 lg:h-6 lg:w-6 mr-2"
                      strokeWidth={3}
                    />
                    AGREGAR PAGO Y CONTINUAR (FALTAN{" "}
                    {formatPrice(remainingTotal - receivedNum)})
                  </Button>
                )}
                {canConfirm && (
                  <Button
                    size="lg"
                    className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-[10px] lg:text-xs uppercase tracking-[0.15em] shadow-strong shadow-primary/20 transition-all active:scale-95"
                    disabled={isSubmitting}
                    onClick={() => handleConfirmPayment()}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-3 justify-center">
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        PROCESANDO PAGO...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          className="h-5 w-5 lg:h-6 lg:w-6"
                          strokeWidth={3}
                        />
                        {receivedNum >= remainingTotal ? "CONFIRMAR PAGO FINAL" : "CONFIRMAR PAGO PARCIAL"}
                      </div>
                    )}
                  </Button>
                )}
                {!canAddPartial && !canConfirm && (
                  <Button
                    size="lg"
                    disabled
                    className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-[0.2em]"
                  >
                    INGRESA UN MONTO
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ Sub Method Tarjeta ═══════ */}
        {step === "sub_method_tarjeta" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (method === "mixto") setStep("shared_method");
                  else setStep("method");
                }}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  TIPO DE TARJETA
                </div>
                <h3 className="text-4xl font-black tracking-tighter">
                  Selecciona una opción
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button
                onClick={() => selectSubMethodTarjeta("tarjeta_debito")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl bg-cyan-500/10 text-cyan-600 border-cyan-500/20"
              >
                <CreditCard className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-black tracking-widest uppercase">
                  T. DÉBITO
                </span>
              </button>
              <button
                onClick={() => selectSubMethodTarjeta("tarjeta_credito")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                <CreditCard className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-black tracking-widest uppercase">
                  T. CRÉDITO
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════ Sub Method Transfer ═══════ */}
        {step === "sub_method_transfer" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (method === "mixto") setStep("shared_method");
                  else setStep("method");
                }}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  TIPO DE TRANSFERENCIA
                </div>
                <h3 className="text-4xl font-black tracking-tighter">
                  Selecciona una opción
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button
                onClick={() => selectSubMethodTransfer("nequi")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl bg-purple-500/10 text-purple-600 border-purple-500/20"
              >
                <Smartphone className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-black tracking-widest uppercase">
                  NEQUI
                </span>
              </button>
              <button
                onClick={() => selectSubMethodTransfer("daviplata")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl bg-red-500/10 text-red-600 border-red-500/20"
              >
                <Smartphone className="h-12 w-12" strokeWidth={2} />
                <span className="text-sm font-black tracking-widest uppercase">
                  DAVIPLATA
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════ Amount / calculator (single efectivo only) ═══════ */}
        {step === "amount" && method === "efectivo" && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-6 mb-2 lg:mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStep("method");
                  setReceived("");
                }}
                className="h-10 w-10 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-accent/10 animate-none"
              >
                <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[8px] lg:text-[10px]">
                  REGISTRAR EFECTIVO
                </div>
                <h3 className="text-xl lg:text-2xl font-black tracking-tighter">
                  Monto Recibido
                </h3>
              </div>
            </div>

            <div className="space-y-3 lg:space-y-4">
              {/* Display */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-8">
                <div className="rounded-2xl lg:rounded-3xl bg-accent/5 p-4 lg:p-6 text-center space-y-1 lg:space-y-3 border-2 border-accent/5 shadow-inner">
                  <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                    EFECTIVO RECIBIDO
                  </p>
                  <p className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground">
                    {received ? formatPrice(receivedNum) : "$0"}
                  </p>
                  {receivedNum > 0 && (
                    <div className="pt-3 border-t border-accent/10 mt-3 flex flex-col items-center gap-1">
                      <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none">
                        CAMBIO PARA EL CLIENTE
                      </p>
                      <p
                        className={cn(
                          "text-lg lg:text-2xl font-black tracking-tighter",
                          canConfirm ? "text-green-500" : "text-destructive",
                        )}
                      >
                        {canConfirm
                          ? formatPrice(change)
                          : `Falta ${formatPrice(order.total - receivedNum)}`}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-accent/5">
                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                      DEBE PAGAR:{" "}
                      <span className="text-foreground font-black ml-1">
                        {formatPrice(order.total)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExact}
                      className="h-10 lg:h-12 rounded-xl lg:rounded-2xl border-2 font-black uppercase tracking-widest text-[8px] lg:text-[10px] shadow-soft"
                    >
                      MONTO EXACTO
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReceived("50000")}
                      className="h-10 lg:h-12 rounded-xl lg:rounded-2xl border-2 font-black text-sm shadow-soft"
                    >
                      $50.000
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {QUICK_AMOUNTS.slice(2, 6).map((a) => (
                      <Button
                        key={a}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickAmount(a)}
                        className="h-10 lg:h-12 rounded-xl lg:rounded-2xl font-black text-sm shadow-soft bg-white border-2 border-accent/5"
                      >
                        +{formatPrice(a)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "C",
                  "0",
                  "DEL",
                ].map((key) => (
                  <Button
                    key={key}
                    variant="secondary"
                    className={cn(
                      "h-10 lg:h-11 rounded-xl lg:rounded-2xl font-black text-lg transition-all active:scale-95 shadow-soft border-2 border-transparent",
                      key === "C"
                        ? "text-destructive hover:bg-destructive/5 hover:border-destructive/10"
                        : key === "DEL"
                          ? "hover:bg-accent/10"
                          : "hover:border-primary/20",
                    )}
                    onClick={() => handleNumpad(key)}
                  >
                    {key === "DEL" ? (
                      <Delete className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      key
                    )}
                  </Button>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-[10px] lg:text-xs uppercase tracking-[0.2em] shadow-strong shadow-primary/20 transition-all active:scale-95"
                disabled={!canConfirm || isSubmitting}
                onClick={() => handleConfirmPayment()}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3 justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    PROCESANDO PAGO...
                  </div>
                ) : canConfirm ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle
                      className="h-5 w-5 lg:h-6 lg:w-6"
                      strokeWidth={3}
                    />
                    {order.status === "pendiente" ||
                    order.status === "en_preparacion"
                      ? "CONFIRMAR PAGO & ENVIAR A COCINA"
                      : "CONFIRMAR PAGO & ENTREGAR"}
                  </div>
                ) : (
                  "MONTO INSUFICIENTE"
                )}
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
