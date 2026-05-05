import { useState, useMemo, useCallback, useEffect } from "react";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/formatPrice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
}[] = [
  {
    key: "efectivo",
    label: "Efectivo",
    icon: <Banknote className="h-6 w-6" />,
  },
  {
    key: "tarjeta",
    label: "Tarjeta",
    icon: <CreditCard className="h-6 w-6" />,
  },
  {
    key: "nequi",
    label: "Nequi / Transferencia",
    icon: <Smartphone className="h-6 w-6" />,
  },
  {
    key: "mixto",
    label: "Pago Combinado",
    icon: (
      <div className="flex -space-x-2">
        <Banknote className="h-5 w-5" />
        <Smartphone className="h-5 w-5" />
      </div>
    ),
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
  ) => void;
}

export function PaymentCalculator({
  order,
  open,
  onClose,
  onPaymentComplete,
}: PaymentCalculatorProps) {
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
      const setter = step === "split_amount" ? setFirstAmount : setReceived;
      if (val === "C") {
        setter("");
      } else if (val === "DEL") {
        setter((prev) => prev.slice(0, -1));
      } else {
        setter((prev) => (prev + val).slice(0, 10));
      }
    },
    [step],
  );

  const handleQuickAmount = useCallback((amount: number) => {
    setReceived((prev) => String((parseInt(prev) || 0) + amount));
  }, []);

  const resetState = useCallback(() => {
    setMethod(null);
    setReceived("");
    setFirstMethod(null);
    setFirstAmount("");
    setSecondMethod(null);
    setStep("method");
  }, []);

  const handleExact = useCallback(() => {
    setReceived(String(remainingTotal));
  }, [remainingTotal]);

  const handleConfirmPayment = useCallback(
    (
      overrideReceived?: number,
      overrideSecondMethod?: Exclude<PaymentMethod, "mixto">,
    ) => {
      if (!method) return;
      setStep("done");

      const currentReceived =
        overrideReceived !== undefined ? overrideReceived : receivedNum;
      const currentSecondMethod =
        overrideSecondMethod !== undefined ? overrideSecondMethod : secondMethod;

      const finalReceived =
        method === "mixto" ? firstAmountNum + currentReceived : currentReceived;

      // Build breakdown
      const breakdown: { efectivo?: number; tarjeta?: number; nequi?: number } =
        {};
      if (method === "mixto") {
        if (firstMethod) breakdown[firstMethod] = firstAmountNum;
        if (currentSecondMethod)
          breakdown[currentSecondMethod] =
            currentSecondMethod === "efectivo"
              ? currentReceived
              : remainingTotal;
      } else if (method) {
        // For simple payment methods, we've already narrowed out 'mixto'
        breakdown[method as Exclude<PaymentMethod, "mixto">] = currentReceived;
      }

      setTimeout(() => {
        onPaymentComplete(method, finalReceived, breakdown);
        resetState();
      }, 1500);
    },
    [
      method,
      receivedNum,
      secondMethod,
      firstMethod,
      firstAmountNum,
      remainingTotal,
      onPaymentComplete,
      resetState,
    ],
  );

  // Keyboard support
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Numbers 0-9
      if (e.key >= "0" && e.key <= "9") {
        handleNumpad(e.key);
      }
      // Backspace -> DEL
      else if (e.key === "Backspace") {
        handleNumpad("DEL");
      }
      // Escape or Delete -> C (Clear)
      else if (e.key === "Escape" || e.key === "Delete") {
        handleNumpad("C");
      }
      // Enter -> Confirm or Next
      else if (e.key === "Enter") {
        if (step === "amount" && canConfirm) {
          handleConfirmPayment();
        } else if (
          step === "split_amount" &&
          firstAmountNum > 0 &&
          firstAmountNum < order.total
        ) {
          setStep("split_second");
        }
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
  ]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const selectMethod = (m: PaymentMethod) => {
    setMethod(m);
    if (m === "mixto") {
      setStep("split_first");
    } else {
      if (m !== "efectivo") {
        setReceived(String(order.total));
      }
      setStep("amount");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Done step */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-slide-in">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="font-display text-2xl font-bold">¡Pago Exitoso!</h2>
            <p className="text-muted-foreground">Enviando pedido a cocina...</p>
          </div>
        )}

        {/* Method selection */}
        {step === "method" && (
          <>
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="font-display text-xl">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Cobrar Pedido {order.locator}
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="p-4 space-y-4">
              {/* Order summary */}
              <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      <span className="font-medium">{item.quantity}x</span>{" "}
                      {item.products.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatPrice(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="font-semibold">Total a pagar</span>
                  <span className="font-display text-2xl font-bold text-primary">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>

              {/* Payment methods */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Selecciona método de pago
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.key}
                      onClick={() => selectMethod(pm.key)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent/50 transition-all active:scale-95 touch-target",
                        pm.key === "mixto" &&
                          "border-dashed border-primary/40 bg-primary/5",
                      )}
                    >
                      <div className="text-primary">{pm.icon}</div>
                      <span className="text-xs font-medium text-center">
                        {pm.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step: Split First Method */}
        {step === "split_first" && (
          <div className="animate-slide-in">
            <div className="p-4 pb-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("method")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="font-display font-bold text-lg text-primary">
                  Pago Mixto - Paso 1
                </p>
                <p className="text-sm text-muted-foreground">
                  Selecciona el primer medio de pago
                </p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setFirstMethod("efectivo");
                  setStep("split_amount");
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <Banknote className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium">Efectivo</span>
              </button>
              <button
                onClick={() => {
                  setFirstMethod("nequi");
                  setStep("split_amount");
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <Smartphone className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium">Nequi / Transf.</span>
              </button>
              <button
                onClick={() => {
                  setFirstMethod("tarjeta");
                  setStep("split_amount");
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
              >
                <CreditCard className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium">Tarjeta</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: Split First Amount */}
        {step === "split_amount" && (
          <div className="animate-slide-in">
            <div className="p-4 pb-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("split_first")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="font-display font-bold text-lg text-primary">
                  Monto{" "}
                  {firstMethod === "nequi"
                    ? "Nequi"
                    : firstMethod === "tarjeta"
                      ? "Tarjeta"
                      : "Efectivo"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Pedido: {formatPrice(order.total)}
                </p>
              </div>
            </div>
            <div className="px-4 space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  ¿Cuánto pagó por este medio?
                </p>
                <p className="font-display text-4xl font-bold">
                  {firstAmount ? formatPrice(firstAmountNum) : "$0"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
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
                    variant={
                      key === "C"
                        ? "destructive"
                        : key === "DEL"
                          ? "outline"
                          : "secondary"
                    }
                    className="h-12 font-display text-lg"
                    onClick={() => handleNumpad(key)}
                  >
                    {key === "DEL" ? <Delete className="h-5 w-5" /> : key}
                  </Button>
                ))}
              </div>
              <Button
                className="w-full h-12"
                disabled={firstAmountNum <= 0 || firstAmountNum >= order.total}
                onClick={() => setStep("split_second")}
              >
                Siguiente (Faltan {formatPrice(order.total - firstAmountNum)})
              </Button>
            </div>
          </div>
        )}

        {/* Step: Split Second Method */}
        {step === "split_second" && (
          <div className="animate-slide-in">
            <div className="p-4 pb-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("split_amount")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="font-display font-bold text-lg text-primary">
                  Pago Mixto - Paso 2
                </p>
                <p className="text-sm text-muted-foreground">
                  ¿Cómo paga el resto? (
                  {formatPrice(order.total - firstAmountNum)})
                </p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {firstMethod !== "efectivo" && (
                <button
                  onClick={() => {
                    setSecondMethod("efectivo");
                    setStep("amount");
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
                >
                  <Banknote className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Efectivo</span>
                </button>
              )}
              {firstMethod !== "nequi" && (
                <button
                  onClick={() => {
                    setSecondMethod("nequi");
                    setReceived(String(remainingTotal));
                    handleConfirmPayment(remainingTotal, "nequi");
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
                >
                  <Smartphone className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Nequi</span>
                </button>
              )}
              {firstMethod !== "tarjeta" && (
                <button
                  onClick={() => {
                    setSecondMethod("tarjeta");
                    setReceived(String(remainingTotal));
                    handleConfirmPayment(remainingTotal, "tarjeta");
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary transition-all"
                >
                  <CreditCard className="h-6 w-6 text-primary" />
                  <span className="text-xs font-medium">Tarjeta</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Amount / calculator */}
        {step === "amount" && (method || secondMethod) && (
          <div className="animate-slide-in">
            <div className="p-4 pb-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (method === "mixto") setStep("split_second");
                  else setStep("method");
                  setReceived("");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="font-display font-bold text-lg">
                  {method === "mixto"
                    ? `Completar con ${secondMethod === "efectivo" ? "Efectivo" : secondMethod}`
                    : PAYMENT_METHODS.find((p) => p.key === method)?.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {method === "mixto" ? `Faltante: ` : `Total: `}
                  <span className="font-bold text-primary">
                    {formatPrice(remainingTotal)}
                  </span>
                </p>
              </div>
            </div>

            <div className="px-4 space-y-3">
              {/* Display */}
              <div className="rounded-xl bg-muted/50 p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Monto recibido
                </p>
                <p className="font-display text-4xl font-bold">
                  {received ? formatPrice(receivedNum) : "$0"}
                </p>
                {(method === "efectivo" ||
                  (method === "mixto" && secondMethod === "efectivo")) &&
                  receivedNum > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground">Cambio</p>
                      <p
                        className={`font-display text-2xl font-bold ${canConfirm ? "text-green-500" : "text-destructive"}`}
                      >
                        {canConfirm
                          ? formatPrice(change)
                          : `Falta ${formatPrice(remainingTotal - receivedNum)}`}
                      </p>
                    </div>
                  )}
              </div>

              {(method === "efectivo" ||
                (method === "mixto" && secondMethod === "efectivo")) && (
                <>
                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExact}
                      className="text-xs"
                    >
                      Exacto
                    </Button>
                    {QUICK_AMOUNTS.map((a) => (
                      <Button
                        key={a}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickAmount(a)}
                        className="text-xs"
                      >
                        +{formatPrice(a)}
                      </Button>
                    ))}
                  </div>

                  {/* Numpad */}
                  <div className="grid grid-cols-3 gap-1.5">
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
                        variant={
                          key === "C"
                            ? "destructive"
                            : key === "DEL"
                              ? "outline"
                              : "secondary"
                        }
                        className="h-12 font-display text-lg"
                        onClick={() => handleNumpad(key)}
                      >
                        {key === "DEL" ? <Delete className="h-5 w-5" /> : key}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4">
              <Button
                size="touch"
                className="w-full h-14 text-lg"
                disabled={!canConfirm}
                onClick={() => handleConfirmPayment()}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {canConfirm
                  ? "Confirmar Pago y Enviar a Cocina"
                  : "Monto insuficiente"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
