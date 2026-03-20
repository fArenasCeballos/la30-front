import { useState, useMemo } from "react";
import type { Order } from "@/types";
import { formatPrice } from "@/data/mock";
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

type PaymentMethod = "efectivo" | "tarjeta" | "nequi";

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
];

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

interface PaymentCalculatorProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  onPaymentComplete: (method: PaymentMethod, received: number) => void;
}

export function PaymentCalculator({
  order,
  open,
  onClose,
  onPaymentComplete,
}: PaymentCalculatorProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState("");
  const [step, setStep] = useState<"method" | "amount" | "done">("method");

  const receivedNum = useMemo(() => parseInt(received) || 0, [received]);
  const change = useMemo(
    () => Math.max(0, receivedNum - order.total),
    [receivedNum, order.total],
  );
  const canConfirm = receivedNum >= order.total;

  const handleNumpad = (val: string) => {
    if (val === "C") {
      setReceived("");
    } else if (val === "DEL") {
      setReceived((prev) => prev.slice(0, -1));
    } else {
      setReceived((prev) => (prev + val).slice(0, 10));
    }
  };

  const handleQuickAmount = (amount: number) => {
    setReceived((prev) => String((parseInt(prev) || 0) + amount));
  };

  const handleExact = () => {
    setReceived(String(order.total));
  };

  const handleConfirmPayment = () => {
    if (!method) return;
    setStep("done");
    setTimeout(() => {
      onPaymentComplete(method, receivedNum);
      resetState();
    }, 1500);
  };

  const resetState = () => {
    setMethod(null);
    setReceived("");
    setStep("method");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const selectMethod = (m: PaymentMethod) => {
    setMethod(m);
    if (m !== "efectivo") {
      setReceived(String(order.total));
    }
    setStep("amount");
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
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      <span className="font-medium">{item.quantity}x</span>{" "}
                      {item.product.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatPrice(item.product.price * item.quantity)}
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
                  Método de pago
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.key}
                      onClick={() => selectMethod(pm.key)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent/50 transition-all active:scale-95 touch-target"
                    >
                      <div className="text-primary">{pm.icon}</div>
                      <span className="text-sm font-medium">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Amount / calculator */}
        {step === "amount" && method && (
          <div className="animate-slide-in">
            <div className="p-4 pb-2 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStep("method");
                  setReceived("");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="font-display font-bold text-lg">
                  {PAYMENT_METHODS.find((p) => p.key === method)?.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total:{" "}
                  <span className="font-bold text-primary">
                    {formatPrice(order.total)}
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
                {method === "efectivo" && receivedNum > 0 && (
                  <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-muted-foreground">Cambio</p>
                    <p
                      className={`font-display text-2xl font-bold ${canConfirm ? "text-green-500" : "text-destructive"}`}
                    >
                      {canConfirm
                        ? formatPrice(change)
                        : `Falta ${formatPrice(order.total - receivedNum)}`}
                    </p>
                  </div>
                )}
              </div>

              {method === "efectivo" && (
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
                className="w-full"
                disabled={!canConfirm}
                onClick={handleConfirmPayment}
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
