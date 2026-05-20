/**
 * SiigoInvoiceModal
 *
 * Store-agnostic modal for Siigo electronic invoicing.
 * Supports automatic (Consumidor Final) and manual (custom client) flows.
 * Handles proportional split invoices for mixed payments.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  FileText,
  User,
  Zap,
  Loader2,
  CheckCircle,
  XCircle,
  Search,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import { toast } from "sonner";
import type { Order } from "@/types";
import {
  type SiigoCustomer,
  type SiigoInvoiceResult,
  getInvoiceConfigs,
  generateSiigoInvoice,
  fetchSiigoCustomer,
  saveSiigoCustomer,
  distributeTotalAmongItems,
} from "@/lib/siigoService";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SiigoInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  method: string;
  breakdown?: {
    efectivo?: number;
    tarjeta?: number;
    nequi?: number;
    tarjeta_credito?: number;
    tarjeta_debito?: number;
    daviplata?: number;
  };
}

type Step = "choose" | "auto" | "manual" | "result";

interface InvoiceResultEntry {
  method: string;
  amount: number;
  result: SiigoInvoiceResult;
}

// ─── ID type options ───────────────────────────────────────────────────────────

const ID_TYPES = [
  { value: "13", label: "Cédula de Ciudadanía" },
  { value: "31", label: "NIT" },
  { value: "22", label: "Cédula de Extranjería" },
  { value: "42", label: "Documento de Identidad Extranjero" },
  { value: "50", label: "NIT de otro país" },
  { value: "91", label: "NUIP" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function SiigoInvoiceModal({
  open,
  onClose,
  order,
  method,
  breakdown,
}: SiigoInvoiceModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<InvoiceResultEntry[]>([]);
  const [progressLabel, setProgressLabel] = useState("");

  // Manual form state
  const [personType, setPersonType] = useState<"Person" | "Company">("Person");
  const [idType, setIdType] = useState("13");
  const [identification, setIdentification] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);

  // Calculate invoice configs
  const invoiceConfigs = getInvoiceConfigs(method, order.total, breakdown);
  const totalToInvoice = invoiceConfigs.reduce((s, c) => s + c.amount, 0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("choose");
      setResults([]);
      setIsProcessing(false);
      setProgressLabel("");
      setPersonType("Person");
      setIdType("13");
      setIdentification("");
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCustomerFound(false);
    }
  }, [open]);

  // ─── Customer Lookup with debounce ──────────────────────────────────────────

  const handleIdentificationSearch = useCallback(async () => {
    if (!identification || identification.length < 3) return;
    setIsSearching(true);
    try {
      const customer = await fetchSiigoCustomer(identification);
      if (customer) {
        setPersonType(customer.person_type);
        setIdType(customer.id_type);
        if (customer.person_type === "Company") {
          setCompanyName(customer.name[0] || "");
        } else {
          setFirstName(customer.name[0] || "");
          setLastName(customer.name[1] || "");
        }
        setEmail(customer.email || "");
        setPhone(customer.phones?.[0]?.number || "");
        setAddress(customer.address?.address || "");
        setCustomerFound(true);
        toast.success("Cliente encontrado y datos cargados");
      } else {
        setCustomerFound(false);
      }
    } catch {
      // Silently fail, user can fill manually
    } finally {
      setIsSearching(false);
    }
  }, [identification]);

  // ─── Build customer object from form ────────────────────────────────────────

  const buildCustomerFromForm = (): SiigoCustomer => ({
    person_type: personType,
    id_type: idType,
    identification: identification.trim(),
    name:
      personType === "Company"
        ? [companyName.trim()]
        : [firstName.trim(), lastName.trim()],
    address: {
      address: address.trim() || "Calle 0 # 0-0",
      city: { country_code: "Co", state_code: "11", city_code: "11001" },
    },
    phones: [{ number: phone.trim() || "0000000" }],
    email: email.trim() || undefined,
  });

  // ─── Process Invoices (sequential for multi) ────────────────────────────────

  const processInvoices = useCallback(
    async (customer?: SiigoCustomer) => {
      setIsProcessing(true);
      setResults([]);
      const allResults: InvoiceResultEntry[] = [];

      for (let i = 0; i < invoiceConfigs.length; i++) {
        const config = invoiceConfigs[i];
        const label =
          invoiceConfigs.length > 1
            ? `Generando factura ${i + 1} de ${invoiceConfigs.length}: ${config.method === "tarjeta" ? "Tarjeta" : "Transferencia"}...`
            : "Generando factura electrónica...";
        setProgressLabel(label);

        const result = await generateSiigoInvoice({
          orderId: order.id,
          method: config.method,
          items: order.order_items ?? [],
          total: order.total,
          locator: order.locator ?? "",
          customer,
          invoiceTotal: config.amount,
          overrideMethod: config.method,
          deliveryFee: order.delivery_fee ?? 0,
        });

        allResults.push({
          method: config.method,
          amount: config.amount,
          result,
        });
        setResults([...allResults]);
      }

      // Save customer for future autocomplete if manual and at least one succeeded
      if (customer && allResults.some((r) => r.result.success)) {
        saveSiigoCustomer(customer).catch(() => {
          /* silent */
        });
      }

      setIsProcessing(false);
      setStep("result");
    },
    [invoiceConfigs, order],
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleAutomatic = () => {
    setStep("auto");
    processInvoices();
  };

  const handleManualSubmit = () => {
    if (!identification.trim()) {
      toast.error("Ingresa el número de identificación");
      return;
    }
    if (personType === "Person" && !firstName.trim()) {
      toast.error("Ingresa el nombre del cliente");
      return;
    }
    if (personType === "Company" && !companyName.trim()) {
      toast.error("Ingresa la razón social");
      return;
    }
    if (!email.trim()) {
      toast.error("El correo electrónico es obligatorio para facturación");
      return;
    }

    const customer = buildCustomerFromForm();
    setStep("auto");
    processInvoices(customer);
  };

  const allSuccess =
    results.length > 0 && results.every((r) => r.result.success);
  const hasErrors = results.some((r) => !r.result.success);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isProcessing && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-2",
          step === "manual" && "sm:max-w-2xl",
        )}
        onInteractOutside={(e) => {
          if (isProcessing) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-wider">
            <FileText className="h-5 w-5 text-primary" />
            Facturación Electrónica
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-muted-foreground/70">
            Pedido #{order.locator} · Total: {formatPrice(order.total)} ·
            Facturar: {formatPrice(totalToInvoice)}
            {invoiceConfigs.length > 1 &&
              ` (${invoiceConfigs.length} facturas)`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: Choose ────────────────────────────────────────────── */}
        {step === "choose" && (
          <div className="space-y-4 py-2">
            <p className="text-sm font-bold text-center text-foreground/80">
              ¿Deseas realizar la factura de venta manualmente?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleAutomatic}
                className="group relative p-5 rounded-2xl border-2 border-primary/10 hover:border-primary/40 bg-linear-to-br from-emerald-50 to-white transition-all hover:shadow-lg text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span className="font-black text-sm uppercase tracking-wider text-emerald-700">
                    Automática
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground/70 leading-relaxed">
                  Generar factura a Consumidor Final de forma instantánea
                </p>
              </button>

              <button
                onClick={() => setStep("manual")}
                className="group relative p-5 rounded-2xl border-2 border-primary/10 hover:border-primary/40 bg-linear-to-br from-blue-50 to-white transition-all hover:shadow-lg text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="font-black text-sm uppercase tracking-wider text-blue-700">
                    Manual
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground/70 leading-relaxed">
                  Ingresar datos del cliente para factura nominativa
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Auto (processing) ─────────────────────────────────── */}
        {step === "auto" && isProcessing && (
          <div className="py-10 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground animate-pulse">
              {progressLabel}
            </p>

            {/* Show partial results as they come in */}
            {results.length > 0 && (
              <div className="w-full space-y-2 mt-4">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl text-xs font-bold",
                      r.result.success
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    {r.result.success ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="capitalize">{r.method}</span>
                    <span className="ml-auto">{formatPrice(r.amount)}</span>
                    {r.result.invoiceNumber && (
                      <span className="text-emerald-500">
                        {r.result.invoiceNumber}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Manual Form ───────────────────────────────────────── */}
        {step === "manual" && (
          <div className="space-y-4 py-2">
            {/* Identification lookup */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Tipo de Persona
                  </Label>
                  <Select
                    value={personType}
                    onValueChange={(v) =>
                      setPersonType(v as "Person" | "Company")
                    }
                  >
                    <SelectTrigger className="rounded-xl h-9 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Person">Persona Natural</SelectItem>
                      <SelectItem value="Company">Persona Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Tipo de Documento
                  </Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger className="rounded-xl h-9 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Número de Identificación
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={identification}
                    onChange={(e) => {
                      setIdentification(e.target.value);
                      setCustomerFound(false);
                    }}
                    placeholder="Ej: 1234567890"
                    className="rounded-xl h-9 text-xs font-bold flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleIdentificationSearch();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleIdentificationSearch}
                    disabled={isSearching || identification.length < 3}
                    className="rounded-xl h-9 px-3"
                  >
                    {isSearching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                {customerFound && (
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Cliente encontrado
                  </p>
                )}
              </div>
            </div>

            {/* Name fields */}
            {personType === "Person" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Nombres *
                  </Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                    className="rounded-xl h-9 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Apellidos
                  </Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Pérez"
                    className="rounded-xl h-9 text-xs font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Razón Social *
                </Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Empresa S.A.S."
                  className="rounded-xl h-9 text-xs font-bold"
                />
              </div>
            )}

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Correo Electrónico *
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="rounded-xl h-9 text-xs font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Teléfono
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="3001234567"
                  className="rounded-xl h-9 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest">
                Dirección
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle 10 # 20-30"
                className="rounded-xl h-9 text-xs font-bold"
              />
            </div>

            {/* Collapsible order summary */}
            <details className="group rounded-2xl border bg-muted/20 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-3 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Detalle del Pedido
                  </span>
                  <span className="text-xs font-black text-primary">
                    {formatPrice(totalToInvoice)}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground/50 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-3 space-y-1">
                {distributeTotalAmongItems(
                  (order.order_items ?? [])
                    .filter((item) => item.products != null)
                    .map((item) => ({
                      id: item.id,
                      product_id: item.products?.siigo_code || item.product_id || item.products?.id || "unknown",
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      products: {
                        name: item.products?.name ?? "Producto",
                        id: item.products?.id ?? "unknown",
                        siigo_code: item.products?.siigo_code ?? null,
                      },
                    })),
                  totalToInvoice
                ).map((item, idx) => (
                  <div
                    key={item.id + idx}
                    className="flex justify-between text-xs font-semibold"
                  >
                    <span>
                      {item.quantity}x {item.products.name}
                    </span>
                    <span>{formatPrice(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-black pt-2 border-t mt-2">
                  <span>A Facturar</span>
                  <span className="text-primary">
                    {formatPrice(totalToInvoice)}
                  </span>
                </div>
                {invoiceConfigs.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl mt-2">
                    <AlertTriangle className="h-3 w-3" />
                    Se generarán {invoiceConfigs.length} facturas:{" "}
                    {invoiceConfigs
                      .map(
                        (c) =>
                          `${c.method === "tarjeta" ? "Tarjeta" : "Transferencia"} ${formatPrice(c.amount)}`,
                      )
                      .join(" + ")}
                  </div>
                )}
              </div>
            </details>

            {/* Submit */}
            <Button
              onClick={handleManualSubmit}
              className="w-full rounded-xl h-11 font-black text-xs uppercase tracking-widest"
            >
              <FileText className="h-4 w-4 mr-2" />
              Emitir Factura
              {invoiceConfigs.length > 1 ? `s (${invoiceConfigs.length})` : ""}
            </Button>
          </div>
        )}

        {/* ── Step: Results ────────────────────────────────────────────── */}
        {step === "result" && (
          <div className="space-y-4 py-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "p-4 rounded-2xl border-2",
                  r.result.success
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50",
                )}
              >
                <div className="flex items-center gap-3">
                  {r.result.success ? (
                    <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm uppercase tracking-wider">
                      {r.result.success ? "Factura Generada" : "Error"}
                    </p>
                    {r.result.success ? (
                      <p className="text-xs font-bold text-emerald-700">
                        N° {r.result.invoiceNumber} ·{" "}
                        <span className="capitalize">{r.method}</span> ·{" "}
                        {formatPrice(r.amount)}
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-red-700 truncate">
                        {r.result.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Button
              onClick={onClose}
              variant={allSuccess ? "default" : "outline"}
              className="w-full rounded-xl h-10 font-black text-xs uppercase tracking-widest"
            >
              {allSuccess ? "Listo" : hasErrors ? "Cerrar" : "Continuar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
