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
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = "efectivo" | "tarjeta" | "nequi" | "mixto";

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
    label: "COMBINADO",
    icon: (
      <div className="flex -space-x-2 lg:-space-x-4">
        <Banknote className="h-4 w-4 lg:h-7 lg:w-7" />
        <Smartphone className="h-4 w-4 lg:h-7 lg:w-7" />
      </div>
    ),
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
    breakdown?: { efectivo?: number; tarjeta?: number; nequi?: number },
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
  const [received, setReceived] = useState("");
  const [step, setStep] = useState<
    | "method"
    | "amount"
    | "split_first"
    | "split_amount"
    | "split_second"
    | "done"
  >("method");

  // States for mixed payment
  const [firstMethod, setFirstMethod] = useState<Exclude<
    PaymentMethod,
    "mixto"
  > | null>(null);
  const [firstAmount, setFirstAmount] = useState("");
  const [secondMethod, setSecondMethod] = useState<Exclude<
    PaymentMethod,
    "mixto"
  > | null>(null);

  const firstAmountNum = useMemo(
    () => parseInt(firstAmount) || 0,
    [firstAmount],
  );
  const receivedNum = useMemo(() => parseInt(received) || 0, [received]);

  // Remaining total if it's a mixed payment
  const remainingTotal = useMemo(() => {
    if (method === "mixto") return Math.max(0, order.total - firstAmountNum);
    return order.total;
  }, [method, order.total, firstAmountNum]);

  const change = useMemo(() => {
    if (method === "mixto" && secondMethod === "efectivo") {
      return Math.max(0, receivedNum - remainingTotal);
    }
    return Math.max(
      0,
      receivedNum + (method === "mixto" ? firstAmountNum : 0) - order.total,
    );
  }, [
    receivedNum,
    firstAmountNum,
    order.total,
    method,
    secondMethod,
    remainingTotal,
  ]);

  const canConfirm = useMemo(() => {
    if (method === "mixto") {
      if (secondMethod === "efectivo") return receivedNum >= remainingTotal;
      return true; // Simple confirmation for non-cash second method as it's exact
    }
    return receivedNum >= order.total;
  }, [method, secondMethod, receivedNum, remainingTotal, order.total]);

  const handleNumpad = useCallback(
    (val: string) => {
      if (isSubmitting) return;
      const setter = step === "split_amount" ? setFirstAmount : setReceived;
      if (val === "C") {
        setter("");
      } else if (val === "DEL") {
        setter((prev) => prev.slice(0, -1));
      } else {
        setter((prev) => (prev + val).slice(0, 10));
      }
    },
    [step, isSubmitting],
  );

  const handleQuickAmount = useCallback((amount: number) => {
    if (isSubmitting) return;
    setReceived((prev) => String((parseInt(prev) || 0) + amount));
  }, [isSubmitting]);

  const resetState = useCallback(() => {
    setMethod(null);
    setReceived("");
    setFirstMethod(null);
    setFirstAmount("");
    setSecondMethod(null);
    setStep("method");
    setIsSubmitting(false);
  }, []);

  const handleExact = useCallback(() => {
    if (isSubmitting) return;
    setReceived(String(remainingTotal));
  }, [remainingTotal, isSubmitting]);

  const handleConfirmPayment = useCallback(
    async (
      overrideReceived?: number,
      overrideSecondMethod?: Exclude<PaymentMethod, "mixto">,
      overrideMethod?: PaymentMethod,
    ) => {
      const activeMethod = overrideMethod || method;
      if (!activeMethod || isSubmitting) return;
      setIsSubmitting(true);

      const currentReceived =
        overrideReceived !== undefined ? overrideReceived : receivedNum;
      const currentSecondMethod =
        overrideSecondMethod !== undefined
          ? overrideSecondMethod
          : secondMethod;

      const finalReceived =
        activeMethod === "mixto" ? firstAmountNum + currentReceived : currentReceived;

      // Build breakdown
      const breakdown: { efectivo?: number; tarjeta?: number; nequi?: number } =
        {};
      if (activeMethod === "mixto") {
        if (firstMethod) breakdown[firstMethod] = firstAmountNum;
        if (currentSecondMethod)
          breakdown[currentSecondMethod] =
            currentSecondMethod === "efectivo"
              ? currentReceived
              : remainingTotal;
      } else if (activeMethod) {
        breakdown[activeMethod as Exclude<PaymentMethod, "mixto">] = currentReceived;
      }

      try {
        const success = await onPaymentComplete(activeMethod, finalReceived, breakdown);
        if (success !== false) {
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
      secondMethod,
      firstMethod,
      firstAmountNum,
      remainingTotal,
      onPaymentComplete,
      resetState,
      onClose,
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
        if (step === "amount" && canConfirm) handleConfirmPayment();
        else if (
          step === "split_amount" &&
          firstAmountNum > 0 &&
          firstAmountNum < order.total
        )
          setStep("split_second");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    step,
    canConfirm,
    firstAmountNum,
    order.total,
    handleNumpad,
    handleConfirmPayment,
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
      setStep("split_first");
    } else if (m === "tarjeta" || m === "nequi") {
      // Tarjeta/Nequi: monto exacto, confirmar directo sin calculadora
      setReceived(String(order.total));
      handleConfirmPayment(order.total, undefined, m);
    } else {
      // Efectivo: mostrar calculadora para ingresar monto recibido
      setStep("amount");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="relative max-w-xl p-0 gap-0 overflow-y-auto max-h-[92vh] rounded-3xl lg:rounded-[2.5rem] border-none shadow-strong bg-white/95 backdrop-blur-xl custom-scrollbar">
        {/* Glassmorphic Loading Overlay */}
        {isSubmitting && step !== "done" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 lg:p-12 space-y-6 bg-white/90 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] animate-in fade-in duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/5 shadow-inner">
                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl lg:text-2xl font-black tracking-tighter text-foreground uppercase">
                Procesando Transacción
              </h3>
              <p className="text-muted-foreground font-medium text-xs lg:text-sm max-w-xs mx-auto">
                Por favor, espera un momento mientras registramos el pago de forma segura...
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

        {/* Method selection */}
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
                  <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
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
                        TOTAL A RECAUDAR
                      </span>
                      <div className="text-2xl lg:text-4xl font-black tracking-tighter text-primary">
                        {formatPrice(order.total)}
                      </div>
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

        {/* Split First Method */}
        {step === "split_first" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-10">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("method")}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  PASO 01 / 02
                </div>
                <h3 className="text-4xl font-black tracking-tighter">
                  Primer Medio
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {PAYMENT_METHODS.filter((pm) => pm.key !== "mixto").map((pm) => (
                <button
                  key={pm.key}
                  onClick={() => {
                    setFirstMethod(pm.key as Exclude<PaymentMethod, "mixto">);
                    setStep("split_amount");
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 p-10 rounded-[2.5rem] border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl",
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

        {/* Split First Amount */}
        {step === "split_amount" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-10">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("split_first")}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  MONTO PARA {firstMethod?.toUpperCase()}
                </div>
                <h3 className="text-4xl font-black tracking-tighter">
                  ¿Cuánto recibiste?
                </h3>
              </div>
            </div>

            <div className="space-y-10">
              <div className="rounded-[2.5rem] bg-accent/5 p-10 text-center space-y-2 border-2 border-accent/5 shadow-inner">
                <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  INGRESAR VALOR
                </p>
                <p className="text-7xl font-black tracking-tighter text-foreground">
                  {firstAmount ? formatPrice(firstAmountNum) : "$0"}
                </p>
                <div className="pt-6 border-t border-accent/10 mt-6">
                  <p className="text-xs font-bold text-muted-foreground/60">
                    Total Pedido:{" "}
                    <span className="text-foreground font-black">
                      {formatPrice(order.total)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                      "h-20 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-soft border-2 border-transparent",
                      key === "C"
                        ? "text-destructive hover:bg-destructive/5 hover:border-destructive/10"
                        : key === "DEL"
                          ? "hover:bg-accent/10"
                          : "hover:border-primary/20",
                    )}
                    onClick={() => handleNumpad(key)}
                  >
                    {key === "DEL" ? (
                      <Delete className="h-7 w-7" strokeWidth={2.5} />
                    ) : (
                      key
                    )}
                  </Button>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full h-20 rounded-3xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-strong shadow-primary/20 transition-all active:scale-95"
                disabled={firstAmountNum <= 0 || firstAmountNum >= order.total}
                onClick={() => setStep("split_second")}
              >
                CONTINUAR (FALTAN {formatPrice(order.total - firstAmountNum)})
              </Button>
            </div>
          </div>
        )}

        {/* Split Second Method */}
        {step === "split_second" && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 p-4 lg:p-10">
            <div className="flex items-center gap-4 lg:gap-6 mb-4 lg:mb-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("split_amount")}
                className="h-14 w-14 rounded-2xl bg-accent/10"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                  PASO 02 / 02
                </div>
                <h3 className="text-4xl font-black tracking-tighter">
                  ¿Cómo paga el resto?
                </h3>
              </div>
            </div>

            <div className="bg-primary/5 rounded-[2.5rem] p-8 mb-10 border-2 border-primary/10 border-dashed text-center">
              <p className="text-xs font-black text-primary/60 uppercase tracking-widest mb-1">
                MONTO RESTANTE
              </p>
              <div className="text-5xl font-black tracking-tighter text-primary">
                {formatPrice(order.total - firstAmountNum)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {PAYMENT_METHODS.filter(
                (pm) => pm.key !== "mixto" && pm.key !== firstMethod,
              ).map((pm) => (
                <button
                  key={pm.key}
                  onClick={() => {
                    const selected = pm.key as Exclude<PaymentMethod, "mixto">;
                    setSecondMethod(selected);
                    if (selected === "efectivo") {
                      setStep("amount");
                    } else {
                      setReceived(String(remainingTotal));
                      handleConfirmPayment(remainingTotal, selected);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 p-10 rounded-[2.5rem] border-2 transition-all duration-500 hover:scale-[1.05] shadow-soft hover:shadow-xl",
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

        {/* Amount / calculator */}
        {step === "amount" && (method || secondMethod) && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-6 mb-2 lg:mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (method === "mixto") setStep("split_second");
                  else setStep("method");
                  setReceived("");
                }}
                className="h-10 w-10 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-accent/10 animate-none"
              >
                <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={3} />
              </Button>
              <div className="space-y-0.5">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[8px] lg:text-[10px]">
                  {method === "mixto"
                    ? "FINALIZAR PAGO MIXTO"
                    : "REGISTRAR EFECTIVO"}
                </div>
                <h3 className="text-xl lg:text-2xl font-black tracking-tighter">
                  {method === "mixto" ? `Efectivo Faltante` : `Monto Recibido`}
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
                          : `Falta ${formatPrice(remainingTotal - receivedNum)}`}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-accent/5">
                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                      DEBE PAGAR:{" "}
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

              <Button
                size="lg"
                className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-[10px] lg:text-xs uppercase tracking-[0.2em] shadow-strong shadow-primary/20 transition-all active:scale-95"
                disabled={!canConfirm || isSubmitting}
                onClick={() => handleConfirmPayment()}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3 justify-center">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
