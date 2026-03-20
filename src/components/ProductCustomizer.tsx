import { useState } from "react";
import type { Product } from "@/types";
import { formatPrice } from "@/data/mock";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Plus, Minus } from "lucide-react";

interface CustomOption {
  id: string;
  label: string;
  icon: string;
  choices: { value: string; label: string; icon: string }[];
}

interface ExtraOption {
  id: string;
  label: string;
  icon: string;
  pricePerUnit: number;
  maxQty: number;
}

// Define customization options per category
const PERROS_OPTIONS: CustomOption[] = [
  {
    id: "cebolla",
    label: "Cebolla",
    icon: "🧅",
    choices: [
      { value: "sin", label: "Sin cebolla", icon: "🚫" },
      { value: "cruda", label: "Cruda", icon: "🥬" },
      { value: "sofrita", label: "Sofrita", icon: "🍳" },
    ],
  },
  {
    id: "salsas",
    label: "Salsas",
    icon: "🫙",
    choices: [
      { value: "con", label: "Con salsas", icon: "✅" },
      { value: "sin", label: "Sin salsas", icon: "🚫" },
    ],
  },
  {
    id: "ripio",
    label: "Ripio (papita)",
    icon: "🥔",
    choices: [
      { value: "con", label: "Con ripio", icon: "✅" },
      { value: "sin", label: "Sin ripio", icon: "🚫" },
    ],
  },
];

const PERROS_EXTRAS: ExtraOption[] = [
  {
    id: "salchicha_extra",
    label: "Salchicha adicional",
    icon: "🌭",
    pricePerUnit: 3000,
    maxQty: 4,
  },
];

const HAMBURGUESAS_OPTIONS: CustomOption[] = [
  {
    id: "verdura",
    label: "Verduras",
    icon: "🥗",
    choices: [
      { value: "completa", label: "Completa", icon: "✅" },
      { value: "sin_tomate", label: "Sin tomate", icon: "🍅🚫" },
      { value: "sin_lechuga", label: "Sin lechuga", icon: "🥬🚫" },
      { value: "sin_verdura", label: "Sin verduras", icon: "🚫" },
    ],
  },
  {
    id: "salsas",
    label: "Salsas",
    icon: "🫙",
    choices: [
      { value: "con", label: "Con salsas", icon: "✅" },
      { value: "sin", label: "Sin salsas", icon: "🚫" },
    ],
  },
];

const HAMBURGUESAS_EXTRAS: ExtraOption[] = [
  {
    id: "queso_extra",
    label: "Queso extra",
    icon: "🧀",
    pricePerUnit: 2000,
    maxQty: 3,
  },
  {
    id: "tocineta",
    label: "Tocineta",
    icon: "🥓",
    pricePerUnit: 3000,
    maxQty: 2,
  },
];

function getOptionsForProduct(product: Product): {
  options: CustomOption[];
  extras: ExtraOption[];
} {
  if (product.category === "perros") {
    return { options: PERROS_OPTIONS, extras: PERROS_EXTRAS };
  }
  if (product.category === "hamburguesas") {
    return { options: HAMBURGUESAS_OPTIONS, extras: HAMBURGUESAS_EXTRAS };
  }
  return { options: [], extras: [] };
}

interface ProductCustomizerProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (product: Product, notes: string, extraCost: number) => void;
}

export function ProductCustomizer({
  product,
  open,
  onClose,
  onConfirm,
}: ProductCustomizerProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [extraQtys, setExtraQtys] = useState<Record<string, number>>({});

  if (!product) return null;

  const { options, extras } = getOptionsForProduct(product);
  const hasCustomization = options.length > 0 || extras.length > 0;

  const totalExtraCost = extras.reduce(
    (sum, ext) => sum + (extraQtys[ext.id] || 0) * ext.pricePerUnit,
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
    // Build notes from selections
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

  // If no customization, just confirm directly
  if (!hasCustomization) {
    // Auto-confirm with no notes
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm text-center p-6 space-y-4">
          <div className="text-5xl">
            {product.category === "bebidas" ? "🥤" : "🍟"}
          </div>
          <h2 className="font-display text-xl font-bold">{product.name}</h2>
          <p className="text-2xl font-display font-bold text-primary">
            {formatPrice(product.price)}
          </p>
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
              {product.category === "perros" ? "🌭" : "🍔"}
            </span>
            {product.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Personaliza tu pedido</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Custom options */}
          {options.map((opt) => (
            <div key={opt.id} className="space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <span className="text-lg">{opt.icon}</span> {opt.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {opt.choices.map((choice) => {
                  const selected = selections[opt.id] === choice.value;
                  return (
                    <button
                      key={choice.value}
                      onClick={() => handleSelect(opt.id, choice.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 touch-target ${
                        selected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <span className="text-xl">{choice.icon}</span>
                      <span className="text-sm font-medium">
                        {choice.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Extras */}
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
                    <span className="text-2xl">{ext.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ext.label}</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatPrice(ext.pricePerUnit)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleExtraQty(ext.id, -1, ext.maxQty)}
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
                        onClick={() => handleExtraQty(ext.id, 1, ext.maxQty)}
                        disabled={qty >= ext.maxQty}
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

        {/* Footer */}
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
