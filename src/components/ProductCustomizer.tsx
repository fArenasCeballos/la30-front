import { useState, useEffect } from "react";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/formatPrice";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle, Plus, Minus, Loader2 } from "lucide-react";

interface CustomOption {
  id: string;
  option_key: string;
  label: string;
  icon: string;
  choices: { id: string; value: string; label: string; icon: string }[];
}

interface ExtraOption {
  id: string;
  extra_key: string;
  label: string;
  icon: string;
  price_per_unit: number;
  max_qty: number;
}

interface ProductCustomizerProps {
  product: Product | null;
  categoryName?: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (product: Product, notes: string, extraCost: number) => void;
}

export function ProductCustomizer({
  product,
  categoryName = "",
  open,
  onClose,
  onConfirm,
}: ProductCustomizerProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [extraQtys, setExtraQtys] = useState<Record<string, number>>({});
  
  const [options, setOptions] = useState<CustomOption[]>([]);
  const [extras, setExtras] = useState<ExtraOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !categoryName) return;

    let isMounted = true;
    const fetchCustomization = async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_customization_for_category', { 
        p_category_name: categoryName 
      });

      if (!error && data && isMounted) {
        setOptions(data.options || []);
        setExtras(data.extras || []);
      }
      if (isMounted) setLoading(false);
    };

    fetchCustomization();

    return () => {
      isMounted = false;
    };
  }, [open, categoryName]);

  if (!product) return null;

  const totalExtraCost = extras.reduce(
    (sum, ext) => sum + (extraQtys[ext.id] || 0) * ext.price_per_unit,
    0,
  );

  const handleSelect = (optionId: string, value: string) => {
    setSelections((prev) => ({ ...prev, [optionId]: value }));
  };

  const handleExtraQty = (extId: string, delta: number, max: number) => {
    setExtraQtys((prev) => {
      const current = prev[extId] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [extId]: next };
    });
  };

  const handleConfirm = () => {
    const noteParts: string[] = [];
    options.forEach((opt) => {
      const sel = selections[opt.id];
      if (sel) {
        const choice = opt.choices.find((c) => c.value === sel);
        if (choice) noteParts.push(choice.label);
      }
    });
    extras.forEach((ext) => {
      const qty = extraQtys[ext.id] || 0;
      if (qty > 0) noteParts.push(`+${qty} ${ext.label}`);
    });

    onConfirm(product, noteParts.join(", "), totalExtraCost);
    setSelections({});
    setExtraQtys({});
  };

  const handleClose = () => {
    setSelections({});
    setExtraQtys({});
    onClose();
  };

  const hasCustomization = options.length > 0 || extras.length > 0;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm text-center p-12 flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">Cargando opciones</DialogTitle>
          <DialogDescription className="sr-only">Estamos preparando las opciones de personalización para ti.</DialogDescription>
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Cargando opciones...</p>
        </DialogContent>
      </Dialog>
    );
  }

  // If no customization
  if (!hasCustomization) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm text-center p-6 space-y-4">
          <DialogTitle className="font-display text-xl font-bold flex flex-col items-center gap-4">
            <span className="text-5xl">
              {categoryName === "bebidas" ? "🥤" : "🍔"}
            </span>
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-2xl font-display font-bold text-primary">
            {formatPrice(product.price)}
          </DialogDescription>
          <Button
            size="touch"
            className="w-full"
            onClick={() => {
              onConfirm(product, "", 0);
              setSelections({});
              setExtraQtys({});
            }}
          >
            <CheckCircle className="h-5 w-5 mr-2" /> Agregar al pedido
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <span className="text-2xl">
              {categoryName === "perros" ? "🌭" : "🍔"}
            </span>
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Personaliza tu pedido
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {options.map((opt) => (
            <div key={opt.id} className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <span className="text-lg">{opt.icon || '🛠️'}</span> {opt.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {opt.choices.map((choice) => {
                  const selected = selections[opt.id] === choice.value;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleSelect(opt.id, choice.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 touch-target ${
                        selected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <span className="text-xl">{choice.icon || '🔹'}</span>
                      <span className="text-sm font-medium">
                        {choice.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {extras.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-sm">➕ Adicionales</p>
              {extras.map((ext) => {
                const qty = extraQtys[ext.id] || 0;
                return (
                  <div
                    key={ext.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      qty > 0
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-2xl">{ext.icon || '➕'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ext.label}</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatPrice(ext.price_per_unit)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleExtraQty(ext.id, -1, ext.max_qty)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-bold text-sm">
                        {qty}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleExtraQty(ext.id, 1, ext.max_qty)}
                        disabled={qty >= ext.max_qty}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t space-y-3 bg-card">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Precio base</span>
            <span className="font-display font-bold">
              {formatPrice(product.price)}
            </span>
          </div>
          {totalExtraCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Adicionales</span>
              <span className="font-display font-bold text-primary">
                +{formatPrice(totalExtraCost)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center border-t pt-2">
            <span className="font-semibold">Total por unidad</span>
            <span className="font-display text-2xl font-bold text-primary">
              {formatPrice(product.price + totalExtraCost)}
            </span>
          </div>
          <Button size="touch" className="w-full" onClick={handleConfirm}>
            <CheckCircle className="h-5 w-5 mr-2" /> Agregar al pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
