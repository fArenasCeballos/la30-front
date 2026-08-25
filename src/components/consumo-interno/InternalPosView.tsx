import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";
import {
  isBeverageProduct,
  calculateInternalPrice,
  createInternalConsumption,
  fetchPartners,
} from "@/lib/internalConsumptionService";
import { buildInternalConsumptionReceiptHTML } from "@/lib/internalReceiptUtils";
import { silentPrint } from "@/lib/receiptUtils";
import { PartnerModal } from "@/components/consumo-interno/PartnerModal";
import {
  ProductCustomizer,
  type CustomizationValues,
} from "@/components/ProductCustomizer";
import type {
  Profile,
  Category,
  ProductWithCategory,
  InternalPartner,
  InternalPaymentStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  UserPlus,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Percent,
  Coffee,
  Edit3,
  UtensilsCrossed,
  Users,
  Handshake,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartItem {
  id: string; // unique key for the cart row
  product: ProductWithCategory;
  quantity: number;
  isBeverage: boolean;
  originalPrice: number;
  discountedPrice: number;
  notes?: string;
  customizationValues?: CustomizationValues;
}

type ConsumerSelection =
  | { type: "employee"; id: string; name: string }
  | { type: "partner"; id: string; name: string }
  | null;

// ─── Component ───────────────────────────────────────────────────────────────

export function InternalPosView() {
  const { user } = useAuth();
  const { activeStore } = useStore();
  const storeId = activeStore?.id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<"consumer" | "menu" | "confirm">("consumer");
  const [consumer, setConsumer] = useState<ConsumerSelection>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [consumerSearch, setConsumerSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState<"paid" | "pending">("pending");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [consumerTab, setConsumerTab] = useState<"employee" | "partner">(
    "employee",
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] =
    useState<ProductWithCategory | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  // ── Data Queries ───────────────────────────────────────────────────────────

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<
    Profile[]
  >({
    queryKey: ["internal-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: partners = [],
    isLoading: loadingPartners,
    refetch: refetchPartners,
  } = useQuery<InternalPartner[]>({
    queryKey: ["internal-partners"],
    queryFn: fetchPartners,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["internal-categories", storeId],
    queryFn: async () => {
      let query = supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (storeId) {
        query = query.contains("store_ids", [storeId]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  const { data: products = [], isLoading: loadingProds } = useQuery<
    ProductWithCategory[]
  >({
    queryKey: ["internal-products", storeId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*, categories(id, name, sort_order)")
        .eq("available", true)
        .order("sort_order");
      if (storeId) {
        query = query.contains("store_ids", [storeId]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProductWithCategory[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  // ── Filtered Consumer List ─────────────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    if (!consumerSearch.trim()) return employees;
    const q = consumerSearch.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        (emp.role && emp.role.toLowerCase().includes(q)),
    );
  }, [employees, consumerSearch]);

  const filteredPartners = useMemo(() => {
    const active = partners.filter((p) => p.is_active);
    if (!consumerSearch.trim()) return active;
    const q = consumerSearch.toLowerCase();
    return active.filter((p) => p.name.toLowerCase().includes(q));
  }, [partners, consumerSearch]);

  // ── Filtered Products ──────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory) {
      result = result.filter(
        (p) =>
          p.category_id === activeCategory ||
          p.categories?.name === activeCategory,
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalOriginal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.originalPrice * item.quantity,
        0,
      ),
    [cart],
  );

  const totalDiscounted = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.discountedPrice * item.quantity,
        0,
      ),
    [cart],
  );

  const totalDiscount = totalOriginal - totalDiscounted;

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  // ── Cart & Customizer Helpers ──────────────────────────────────────────────

  const handleProductClick = (product: ProductWithCategory) => {
    setCustomizingProduct(product);
  };

  const handleEditItem = (item: CartItem) => {
    setEditingCartItem(item);
    setCustomizingProduct(item.product);
  };

  const handleCustomizationConfirm = (
    product: ProductWithCategory,
    notes: string,
    extraCost: number,
    customizationValues: CustomizationValues,
  ) => {
    const unitOriginalPrice = (Number(product.price) || 0) + (Number(extraCost) || 0);
    const categoryName = product.categories?.name ?? null;
    const beverage = isBeverageProduct(categoryName, product.name);
    const unitDiscountedPrice = calculateInternalPrice(unitOriginalPrice, beverage);
    const cartKey = `${product.id}-${notes || ""}`;

    // If editing existing cart item
    if (editingCartItem) {
      setCart((prev) => {
        const filtered = prev.filter((i) => i.id !== editingCartItem.id);
        const existing = filtered.find((i) => i.id === cartKey);
        if (existing) {
          return filtered.map((i) =>
            i.id === cartKey
              ? {
                  ...i,
                  quantity: i.quantity + editingCartItem.quantity,
                }
              : i,
          );
        }
        return [
          ...filtered,
          {
            id: cartKey,
            product,
            quantity: editingCartItem.quantity,
            isBeverage: beverage,
            originalPrice: unitOriginalPrice,
            discountedPrice: unitDiscountedPrice,
            notes: notes || undefined,
            customizationValues,
          },
        ];
      });
      toast.success(`${product.name} actualizado`, { duration: 1000 });
      setEditingCartItem(null);
      setCustomizingProduct(null);
      return;
    }

    // Normal add
    setCart((prev) => {
      const existing = prev.find((item) => item.id === cartKey);
      if (existing) {
        return prev.map((item) =>
          item.id === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: cartKey,
          product,
          quantity: 1,
          isBeverage: beverage,
          originalPrice: unitOriginalPrice,
          discountedPrice: unitDiscountedPrice,
          notes: notes || undefined,
          customizationValues,
        },
      ];
    });
    toast.success(`${product.name} agregado`, { duration: 1000 });
    setCustomizingProduct(null);
  };

  const updateQuantity = useCallback((cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === cartId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartId));
  }, []);

  // ── Submit Order ───────────────────────────────────────────────────────────

  const handleSubmitOrder = async () => {
    if (!consumer || cart.length === 0 || !storeId) return;

    setIsSubmitting(true);
    try {
      const paymentStatus: InternalPaymentStatus =
        paymentMode === "paid" ? "paid" : "pending";

      const consumptionId = await createInternalConsumption({
        storeId,
        consumerType: consumer.type,
        employeeId:
          consumer.type === "employee" ? consumer.id : undefined,
        partnerId:
          consumer.type === "partner" ? consumer.id : undefined,
        consumerName: consumer.name,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          categoryName: item.product.categories?.name ?? null,
          quantity: item.quantity,
          originalPrice: item.originalPrice,
          notes: item.notes,
        })),
        paymentStatus,
        paymentMethod: paymentMode === "paid" ? paymentMethod : undefined,
        notes: orderNotes.trim() || undefined,
      });

      toast.success(`Consumo interno registrado para ${consumer.name}`);

      // Print receipt
      try {
        const { data: fullConsumption } = await supabase
          .from("internal_consumptions" as never)
          .select("*, internal_consumption_items(*)" as never)
          .eq("id" as never, consumptionId as never)
          .single();

        if (fullConsumption) {
          const receiptHTML = buildInternalConsumptionReceiptHTML({
            consumption: fullConsumption as never,
            storeName: activeStore?.name ?? "La 30",
            cashierName: user?.name ?? "Cajero",
          });
          await silentPrint(receiptHTML, "Consumo Interno");
        }
      } catch {
        console.warn("No se pudo imprimir la tirilla de consumo interno");
      }

      // Reset state
      setCart([]);
      setConsumer(null);
      setOrderNotes("");
      setPaymentMode("pending");
      setStep("consumer");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 1: Consumer Selection
  // ───────────────────────────────────────────────────────────────────────────

  if (step === "consumer") {
    return (
      <div className="section-container max-w-4xl mx-auto py-6 sm:py-10 px-4 animate-in fade-in duration-300 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto text-primary shadow-soft">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            ¿Quién va a consumir?
          </h2>
          <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">
            Selecciona el beneficiario para aplicar el 50% de descuento en comidas
          </p>
        </div>

        {/* Tabs: Empleados / Socios */}
        <div className="flex items-center justify-center gap-2 max-w-xs mx-auto bg-accent/20 p-1.5 rounded-2xl border-2 border-accent/20">
          <button
            onClick={() => {
              setConsumerTab("employee");
              setConsumerSearch("");
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              consumerTab === "employee"
                ? "bg-white text-primary shadow-md border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-4 w-4" />
            Empleados
          </button>
          <button
            onClick={() => {
              setConsumerTab("partner");
              setConsumerSearch("");
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              consumerTab === "partner"
                ? "bg-white text-primary shadow-md border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Handshake className="h-4 w-4" />
            Socios
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder={`Buscar ${consumerTab === "employee" ? "empleado" : "socio"}...`}
              value={consumerSearch}
              onChange={(e) => setConsumerSearch(e.target.value)}
              className="pl-11 h-12 rounded-2xl border-2 font-bold bg-white shadow-soft"
            />
          </div>
          {consumerTab === "partner" && (
            <Button
              size="sm"
              className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-md shrink-0"
              onClick={() => setShowPartnerModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Socio
            </Button>
          )}
        </div>

        {/* Employees Grid */}
        {consumerTab === "employee" && (
          <div>
            {loadingEmployees ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-black uppercase tracking-[0.2em] text-[10px]">
                  Cargando empleados...
                </p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-20 text-center space-y-3 opacity-30">
                <Users className="h-14 w-14 mx-auto" />
                <p className="font-black text-sm uppercase tracking-wider">
                  No se encontraron empleados
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setConsumer({
                        type: "employee",
                        id: emp.id,
                        name: emp.name,
                      });
                      setStep("menu");
                    }}
                    className="pos-card group p-4 sm:p-5 rounded-2xl border-2 text-left bg-white hover:border-primary hover:shadow-lg transition-all flex flex-col items-center text-center cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-xl mb-3 group-hover:scale-110 transition-transform">
                      {emp.name.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {emp.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="mt-2 text-[9px] font-black uppercase tracking-wider border-primary/20 text-primary bg-primary/5 px-2.5 py-0.5 rounded-lg"
                    >
                      {emp.role || "Personal"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Partners Grid */}
        {consumerTab === "partner" && (
          <div>
            {loadingPartners ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-black uppercase tracking-[0.2em] text-[10px]">
                  Cargando socios...
                </p>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="py-20 text-center space-y-3 opacity-30">
                <Handshake className="h-14 w-14 mx-auto" />
                <p className="font-black text-sm uppercase tracking-wider">
                  No se encontraron socios
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {filteredPartners.map((partner) => (
                  <button
                    key={partner.id}
                    onClick={() => {
                      setConsumer({
                        type: "partner",
                        id: partner.id,
                        name: partner.name,
                      });
                      setStep("menu");
                    }}
                    className="pos-card group p-4 sm:p-5 rounded-2xl border-2 text-left bg-white hover:border-blue-500 hover:shadow-lg transition-all flex flex-col items-center text-center cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center text-blue-600 font-black text-xl mb-3 group-hover:scale-110 transition-transform">
                      {partner.name.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {partner.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="mt-2 text-[9px] font-black uppercase tracking-wider border-blue-500/30 text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg"
                    >
                      Socio
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <PartnerModal
          open={showPartnerModal}
          onOpenChange={setShowPartnerModal}
          editingPartner={null}
          onSaved={() => refetchPartners()}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 2: Menu & Products & Cart (Matching Kiosko & Caja POS layout)
  // ───────────────────────────────────────────────────────────────────────────

  if (step === "menu") {
    return (
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-[calc(100vh-8.5rem)] animate-in fade-in duration-300">
        {/* Main Content: Catalog */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
          {/* Header Bar */}
          <div className="p-3 sm:p-4 lg:p-6 border-b bg-white/80 backdrop-blur-md sticky top-0 z-30 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-2 shrink-0 shadow-soft"
                  onClick={() => setStep("consumer")}
                  title="Cambiar beneficiario"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                      {consumer?.name}
                    </h2>
                    <Badge
                      className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0",
                        consumer?.type === "employee"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-blue-500/10 text-blue-600 border-blue-500/20",
                      )}
                    >
                      {consumer?.type === "employee" ? "Empleado" : "Socio"}
                    </Badge>
                  </div>
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground/80 truncate">
                    Descuento del 50% en Comidas · Bebidas a precio regular
                  </p>
                </div>
              </div>

              {/* Mobile Cart Trigger Button */}
              <div className="lg:hidden">
                <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                  <Button
                    size="sm"
                    className="rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest gap-2 shadow-strong h-10 px-4 relative"
                    onClick={() => setCartOpen(true)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>{itemCount}</span>
                    <span className="hidden sm:inline">
                      · {formatPrice(totalDiscounted)}
                    </span>
                  </Button>
                  <SheetContent
                    side="right"
                    className="w-full sm:max-w-md p-0 flex flex-col h-full bg-white z-100"
                  >
                    <SheetHeader className="p-4 sm:p-6 border-b text-left bg-accent/10">
                      <SheetTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        Pedido Interno · {consumer?.name}
                      </SheetTitle>
                    </SheetHeader>
                    <InternalCartContent
                      cart={cart}
                      updateQuantity={updateQuantity}
                      removeFromCart={removeFromCart}
                      onEditItem={handleEditItem}
                      totalOriginal={totalOriginal}
                      totalDiscounted={totalDiscounted}
                      totalDiscount={totalDiscount}
                      itemCount={itemCount}
                      onProceed={() => {
                        setCartOpen(false);
                        setStep("confirm");
                      }}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-2 font-bold bg-white shadow-soft"
                />
              </div>

              {/* Category Select / Chips */}
              <div className="flex-1 overflow-x-auto premium-scrollbar pb-1">
                <div className="flex gap-1.5 min-w-max">
                  <button
                    onClick={() => setActiveCategory("")}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 border-2",
                      !activeCategory
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-muted-foreground border-accent/20 hover:border-primary/30",
                    )}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 border-2 flex items-center gap-1.5",
                        activeCategory === cat.id
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-muted-foreground border-accent/20 hover:border-primary/30",
                      )}
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      <span>{cat.label || cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 custom-scrollbar">
            {loadingProds ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl bg-accent/20 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center space-y-3 opacity-30">
                <UtensilsCrossed className="h-16 w-16 mx-auto" />
                <p className="font-black text-sm uppercase tracking-wider">
                  No se encontraron productos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredProducts.map((product) => {
                  const catName = product.categories?.name ?? null;
                  const beverage = isBeverageProduct(catName, product.name);
                  const discounted = calculateInternalPrice(
                    product.price,
                    beverage,
                  );
                  const inCartCount = cart
                    .filter((item) => item.product.id === product.id)
                    .reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className={cn(
                        "pos-card group p-3 sm:p-4 text-left border-2 rounded-2xl transition-all relative cursor-pointer flex flex-col bg-white hover:border-primary/40 hover:shadow-lg",
                        inCartCount > 0 && "border-primary bg-primary/2 shadow-sm",
                      )}
                    >
                      {/* In Cart Badge */}
                      {inCartCount > 0 && (
                        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-xl bg-primary text-white border-2 border-white shadow-strong flex items-center justify-center font-black text-xs z-20 animate-in zoom-in duration-200">
                          {inCartCount}
                        </div>
                      )}

                      {/* Image */}
                      <div className="aspect-square rounded-xl bg-accent/20 mb-3 overflow-hidden flex items-center justify-center relative">
                        {product.image_url ? (
                          <img
                            src={getOptimizedImageUrl(product.image_url, 300)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-3xl sm:text-4xl opacity-30">
                            {product.categories?.icon || "🍔"}
                          </span>
                        )}

                        {/* Discount Tag on Image */}
                        <div className="absolute bottom-1.5 left-1.5">
                          {beverage ? (
                            <Badge className="bg-amber-500/90 text-white font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                              <Coffee className="h-2.5 w-2.5 mr-0.5" />
                              Bebida
                            </Badge>
                          ) : (
                            <Badge className="bg-green-600/90 text-white font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                              <Percent className="h-2.5 w-2.5 mr-0.5" />
                              50% Dcto
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 space-y-1">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          {product.categories?.name}
                        </p>
                        <h3 className="font-black text-xs sm:text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </div>

                      {/* Price Section */}
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-accent/40 space-y-2">
                        <div className="flex items-baseline gap-1.5">
                          {beverage ? (
                            <span className="font-black text-sm sm:text-base text-foreground">
                              {formatPrice(product.price)}
                            </span>
                          ) : (
                            <>
                              <span className="font-black text-sm sm:text-base text-green-600">
                                {formatPrice(discounted)}
                              </span>
                              <span className="text-[10px] text-muted-foreground line-through font-bold">
                                {formatPrice(product.price)}
                              </span>
                            </>
                          )}
                        </div>

                        <Button
                          size="sm"
                          className="w-full h-8 sm:h-9 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-soft bg-primary text-white hover:bg-primary/90 transition-all active:scale-95"
                        >
                          AGREGAR
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Cart Sidebar */}
        <aside className="hidden lg:flex w-96 xl:w-105 bg-accent/15 flex-col overflow-hidden border-l border-accent/30">
          <div className="p-5 xl:p-6 border-b flex items-center justify-between bg-white/70 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-soft">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-base xl:text-lg tracking-tight">
                  Pedido Interno
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {consumer?.name}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="font-black border-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-widest text-[9px]"
            >
              {itemCount} {itemCount === 1 ? "Artículo" : "Artículos"}
            </Badge>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white/40">
            <InternalCartContent
              cart={cart}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
              onEditItem={handleEditItem}
              totalOriginal={totalOriginal}
              totalDiscounted={totalDiscounted}
              totalDiscount={totalDiscount}
              itemCount={itemCount}
              onProceed={() => setStep("confirm")}
            />
          </div>
        </aside>

        {/* Product Customizer Dialog */}
        <ProductCustomizer
          product={customizingProduct}
          categoryName={customizingProduct?.categories?.name}
          open={!!customizingProduct}
          onClose={() => {
            setCustomizingProduct(null);
            setEditingCartItem(null);
          }}
          onConfirm={handleCustomizationConfirm}
          initialValues={editingCartItem?.customizationValues || null}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 3: Confirm & Payment Mode
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="section-container max-w-3xl mx-auto py-6 sm:py-10 px-4 animate-in fade-in duration-300 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl border-2 shadow-soft hover:shadow-medium"
          onClick={() => setStep("menu")}
        >
          <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
        <div>
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-1">
            Consumo Interno
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Confirmar Pedido
          </h1>
        </div>
      </div>

      {/* Beneficiary Badge Card */}
      <div className="bg-white rounded-2xl border-2 border-accent/20 p-4 sm:p-5 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
            {consumer?.name.charAt(0)}
          </div>
          <div>
            <p className="font-black text-base">{consumer?.name}</p>
            <p className="text-xs font-bold text-muted-foreground">
              {consumer?.type === "employee" ? "Empleado" : "Socio"} · 50%
              Dcto. en Comidas
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl",
            consumer?.type === "employee"
              ? "bg-primary text-white"
              : "bg-blue-600 text-white",
          )}
        >
          {consumer?.type === "employee" ? "Empleado" : "Socio"}
        </Badge>
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-3xl border-2 border-accent/20 overflow-hidden shadow-soft">
        <div className="p-4 sm:p-6 border-b bg-accent/5 flex items-center justify-between">
          <p className="font-black text-sm uppercase tracking-widest text-muted-foreground">
            Resumen de Productos ({itemCount})
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary font-black text-xs uppercase tracking-wider h-8"
            onClick={() => setStep("menu")}
          >
            Editar Pedido
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 pb-3 border-b border-dashed border-accent/30 last:border-0 last:pb-0"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-accent/20 overflow-hidden shrink-0 flex items-center justify-center border">
                  {item.product.image_url ? (
                    <img
                      src={getOptimizedImageUrl(item.product.image_url, 80)}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-base">
                      {item.product.categories?.icon || "🍔"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-sm leading-tight truncate">
                    {item.quantity}x {item.product.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.isBeverage ? (
                      <Badge
                        variant="outline"
                        className="text-[8px] font-bold text-amber-600 border-amber-400/40 bg-amber-50"
                      >
                        Bebida (Sin Dcto)
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[8px] font-bold text-green-600 border-green-400/40 bg-green-50"
                      >
                        50% Dcto
                      </Badge>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-[11px] font-bold text-primary italic mt-1 leading-tight">
                      “{item.notes}”
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-sm text-foreground">
                  {formatPrice(item.discountedPrice * item.quantity)}
                </p>
                {!item.isBeverage && (
                  <p className="text-[10px] text-muted-foreground line-through">
                    {formatPrice(item.originalPrice * item.quantity)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Calculations */}
        <div className="border-t-2 border-accent/20 p-4 sm:p-6 space-y-2.5 bg-accent/5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Precio Original Total:</span>
            <span className="line-through font-bold">
              {formatPrice(totalOriginal)}
            </span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm text-green-600 font-black">
            <span>Descuento Empleado / Socio:</span>
            <span>-{formatPrice(totalDiscount)}</span>
          </div>
          <div className="flex justify-between items-end pt-3 border-t-2 border-accent/20">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary leading-none mb-1">
                Total a Pagar
              </p>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-primary">
                {formatPrice(totalDiscounted)}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-700 font-black border-green-300 text-xs px-3 py-1">
              Ahorras {formatPrice(totalDiscount)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="space-y-2">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
          Observaciones Generales
        </label>
        <Textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          placeholder="Ej: Empacar para llevar, sin cubiertos, etc."
          className="rounded-2xl border-2 bg-white font-bold px-4 py-3 min-h-20 resize-none shadow-soft"
        />
      </div>

      {/* Payment Mode */}
      <div className="space-y-3">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
          Modalidad de Pago
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMode("pending")}
            className={cn(
              "p-5 rounded-2xl border-2 text-left transition-all cursor-pointer bg-white",
              paymentMode === "pending"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-accent/20 hover:border-primary/30",
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-black text-foreground">
                Saldo Pendiente
              </p>
              <Badge
                variant="outline"
                className="text-[8px] font-bold uppercase"
              >
                Cuenta Mensual
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Se acumula en el estado de cuenta y se cobra al final del mes.
            </p>
          </button>

          <button
            onClick={() => setPaymentMode("paid")}
            className={cn(
              "p-5 rounded-2xl border-2 text-left transition-all cursor-pointer bg-white",
              paymentMode === "paid"
                ? "border-green-500 bg-green-50/50 shadow-md"
                : "border-accent/20 hover:border-green-400/30",
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-black text-green-700">Pagar Ahora</p>
              <Badge className="bg-green-100 text-green-700 text-[8px] font-bold uppercase border-green-300">
                Inmediato
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              El beneficiario cancela el valor de inmediato en caja.
            </p>
          </button>
        </div>
      </div>

      {/* Payment Method (if paying now) */}
      {paymentMode === "paid" && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
            Método de Pago
          </label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-base px-5 shadow-soft">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-2 shadow-strong p-2">
              <SelectItem
                value="efectivo"
                className="rounded-xl font-bold py-3 px-4"
              >
                💵 Efectivo
              </SelectItem>
              <SelectItem
                value="nequi"
                className="rounded-xl font-bold py-3 px-4"
              >
                🟣 Nequi
              </SelectItem>
              <SelectItem
                value="tarjeta"
                className="rounded-xl font-bold py-3 px-4"
              >
                💳 Tarjeta
              </SelectItem>
              <SelectItem
                value="daviplata"
                className="rounded-xl font-bold py-3 px-4"
              >
                🔴 Daviplata
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Submit Button */}
      <Button
        className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm sm:text-base shadow-strong shadow-primary/20 transition-all hover:scale-[1.01] active:scale-98"
        onClick={handleSubmitOrder}
        disabled={isSubmitting || cart.length === 0}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            Registrando Consumo...
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5 mr-3" />
            Confirmar Consumo · {formatPrice(totalDiscounted)}
          </>
        )}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CART CONTENT (Used in Desktop Sidebar & Mobile Sheet)
// ─────────────────────────────────────────────────────────────────────────────

interface InternalCartContentProps {
  cart: CartItem[];
  updateQuantity: (cartId: string, delta: number) => void;
  removeFromCart: (cartId: string) => void;
  onEditItem: (item: CartItem) => void;
  totalOriginal: number;
  totalDiscounted: number;
  totalDiscount: number;
  itemCount: number;
  onProceed: () => void;
}

function InternalCartContent({
  cart,
  updateQuantity,
  onEditItem,
  totalOriginal,
  totalDiscounted,
  totalDiscount,
  itemCount,
  onProceed,
}: InternalCartContentProps) {
  return (
    <div className="flex flex-col flex-1 h-full min-h-0">
      {/* Scrollable Items List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16 opacity-40">
            <div className="w-18 h-18 rounded-3xl bg-accent/30 flex items-center justify-center text-muted-foreground border-2 border-dashed border-accent">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-sm uppercase tracking-widest text-muted-foreground">
                Carrito Vacío
              </p>
              <p className="text-xs font-medium text-muted-foreground max-w-45">
                Toca cualquier producto del menú para agregarlo al pedido.
              </p>
            </div>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="pos-card p-3 sm:p-3.5 space-y-2.5 group border-2 border-accent/20 bg-white rounded-2xl shadow-soft hover:border-primary/30 transition-all animate-in slide-in-from-right duration-200"
            >
              <div className="flex items-start gap-3">
                {/* Image */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-xl bg-accent/20 overflow-hidden flex items-center justify-center border">
                    {item.product.image_url ? (
                      <img
                        src={getOptimizedImageUrl(item.product.image_url, 80)}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base">
                        {item.product.categories?.icon || "🍔"}
                      </span>
                    )}
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-md bg-primary text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-soft">
                    {item.quantity}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate group-hover:text-primary transition-colors">
                    {item.product.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.isBeverage ? (
                      <Badge
                        variant="outline"
                        className="text-[7px] font-bold text-amber-600 border-amber-300 bg-amber-50 px-1 py-0"
                      >
                        Bebida
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[7px] font-bold text-green-600 border-green-300 bg-green-50 px-1 py-0"
                      >
                        -50%
                      </Badge>
                    )}
                    <span className="text-[10px] font-black text-green-600">
                      {formatPrice(item.discountedPrice)} c/u
                    </span>
                    {!item.isBeverage && (
                      <span className="text-[8px] font-bold line-through text-muted-foreground">
                        {formatPrice(item.originalPrice)}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[10px] font-bold text-primary italic mt-1 leading-tight">
                      “{item.notes}”
                    </p>
                  )}
                </div>

                {/* Subtotal */}
                <p className="font-black text-xs sm:text-sm tabular-nums text-foreground">
                  {formatPrice(item.discountedPrice * item.quantity)}
                </p>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-accent/40">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl border shadow-soft hover:text-primary transition-all"
                  onClick={() => onEditItem(item)}
                  title="Editar observaciones"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1 bg-accent/30 p-0.5 rounded-xl border border-accent/40">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-lg hover:bg-white transition-all"
                    onClick={() => updateQuantity(item.id, -1)}
                  >
                    {item.quantity === 1 ? (
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 font-black" />
                    )}
                  </Button>
                  <span className="w-6 text-center font-black text-xs tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-lg hover:bg-white transition-all"
                    onClick={() => updateQuantity(item.id, 1)}
                  >
                    <Plus className="h-3.5 w-3.5 font-black text-primary" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary & Footer */}
      {cart.length > 0 && (
        <div className="p-4 sm:p-5 border-t-2 border-dashed border-accent/40 space-y-4 bg-white/90 backdrop-blur-md">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <span>Precio Original</span>
              <span className="line-through tabular-nums">
                {formatPrice(totalOriginal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-green-600">
              <span>Descuento (50%)</span>
              <span className="tabular-nums">-{formatPrice(totalDiscount)}</span>
            </div>
            <div className="flex justify-between items-end pt-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-0.5">
                  Total Pedido
                </p>
                <p className="text-xl sm:text-2xl font-black tracking-tight text-primary">
                  {formatPrice(totalDiscounted)}
                </p>
              </div>
              <p className="text-[9px] font-black text-muted-foreground bg-accent/40 px-2 py-0.5 rounded-lg uppercase">
                {itemCount} {itemCount === 1 ? "Ítem" : "Ítems"}
              </p>
            </div>
          </div>

          <Button
            className="w-full h-12 sm:h-14 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-strong bg-primary hover:bg-primary/90 text-white transition-all hover:scale-[1.02] active:scale-95 group"
            onClick={onProceed}
          >
            REVISAR PEDIDO
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  );
}
