import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { registerInternalPayment } from "@/lib/internalConsumptionService";
import { formatPrice } from "@/lib/formatPrice";
import type { InternalConsumerType } from "@/types";

interface SettlePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consumerType: InternalConsumerType;
  consumerId: string;
  consumerName: string;
  pendingBalance: number;
  consumptionId?: string;
  onSettled: () => void;
}

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "nequi", label: "Nequi" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "daviplata", label: "Daviplata" },
  { value: "descuento_nomina", label: "Descuento Nómina" },
] as const;

export function SettlePaymentModal({
  open,
  onOpenChange,
  consumerType,
  consumerId,
  consumerName,
  pendingBalance,
  consumptionId,
  onSettled,
}: SettlePaymentModalProps) {
  const [amount, setAmount] = useState(pendingBalance.toString());
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSettle = async () => {
    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Ingresa un monto válido mayor a 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerInternalPayment({
        consumptionId,
        consumerType,
        employeeId: consumerType === "employee" ? consumerId : undefined,
        partnerId: consumerType === "partner" ? consumerId : undefined,
        amount: numericAmount,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      toast.success(
        `Pago de ${formatPrice(numericAmount)} registrado para ${consumerName}`,
      );
      onSettled();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto rounded-[3rem] p-10 border-none shadow-strong bg-white/95 backdrop-blur-xl">
        <DialogHeader className="space-y-4 mb-8">
          <div className="h-16 w-16 rounded-3xl bg-green-500/10 flex items-center justify-center text-green-600 shadow-inner">
            <Banknote className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <DialogTitle className="text-3xl font-black tracking-tight">
            Registrar Pago
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium text-base">
            Registra un abono o pago completo para{" "}
            <strong>{consumerName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Balance display */}
        <div className="bg-accent/10 rounded-2xl p-5 border-2 border-accent/20 mb-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
            Saldo Pendiente
          </div>
          <div className="text-2xl font-black text-foreground">
            {formatPrice(pendingBalance)}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Monto a Pagar *
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              max={pendingBalance}
              className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5"
            />
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-[10px] font-black"
                onClick={() => setAmount(pendingBalance.toString())}
              >
                Saldar Todo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-[10px] font-black"
                onClick={() =>
                  setAmount(Math.round(pendingBalance / 2).toString())
                }
              >
                50%
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Método de Pago *
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-14 rounded-2xl border-2 bg-accent/5 font-bold text-lg px-5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-strong p-2">
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem
                    key={m.value}
                    value={m.value}
                    className="rounded-xl font-bold py-3 px-4"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Observaciones
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Abono parcial de agosto"
              className="rounded-2xl border-2 bg-accent/5 font-bold px-5 min-h-20 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-10 gap-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] px-8"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSettle}
            disabled={isSubmitting}
            className="h-14 flex-1 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[11px] px-10 shadow-strong shadow-green-600/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              "Confirmar Pago"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
