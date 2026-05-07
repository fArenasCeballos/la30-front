import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/formatPrice";
import type { Product, Category, ProductWithCategory } from "@/types";
import { useOrders } from "@/context/OrderContext";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import type { CustomizationValues } from "@/components/ProductCustomizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Edit3,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface CartItem {
  id: string;
  product: ProductWithCategory;
  quantity: number;
  notes?: string;
  unit_price: number;
  customizationValues?: CustomizationValues;
}

// --- Cart persistence via sessionStorage ---
const CART_STORAGE_KEY = "la30_kiosko_draft";

interface CartDraft {
  locator: string;
  step: "locator" | "menu" | "confirm";
  orderNotes: string;
  items: { productId: string; quantity: number; notes?: string; unitPrice: number }[];
}

function saveDraft(draft: CartDraft) {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(draft));
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft(): CartDraft | null {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartDraft;
  } catch { return null; }
}

function clearDraft() {
  sessionStorage.removeItem(CART_STORAGE_KEY);
}

export default function Kiosko() {
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get("edit");
  const { addOrder, updateOrder, orders } = useOrders();

  // Initialize from draft if available (and not in edit mode)
  const savedDraft = !editOrderId ? loadDraft() : null;

  const [locator, setLocator] = useState(savedDraft?.locator ?? "");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]); // rehydrated in useEffect below
  const [step, setStep] = useState<"locator" | "menu" | "confirm">(savedDraft?.step ?? "locator");
  const [orderNotes, setOrderNotes] = useState(savedDraft?.orderNotes ?? "");
  const [customizingProduct, setCustomizingProduct] =
    useState<ProductWithCategory | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  // Queries con React Query
  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as Category[];
    },
  });

  const { data: products = [], isLoading: loadingProds } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(*)")
        .eq("available", true)
        .order("sort_order");
      return (data || []) as unknown as ProductWithCategory[];
    },
  });

  // Set default active category when data loads
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);

  // Rehydrate cart from sessionStorage once products are loaded
  useEffect(() => {
    if (draftHydrated || editOrderId || products.length === 0) return;
    const draft = loadDraft();
    if (!draft || draft.items.length === 0) {
      setDraftHydrated(true);
      return;
    }
    const rehydrated: CartItem[] = [];
    const skipped: string[] = [];
    for (const saved of draft.items) {
      const product = products.find((p) => p.id === saved.productId);
      if (!product) {
        skipped.push(saved.productId);
        continue;
      }
      const cartKey = `${product.id}-${saved.notes || ""}`;
      rehydrated.push({
        id: cartKey,
        product,
        quantity: saved.quantity,
        notes: saved.notes,
        unit_price: product.price, // always use current price
      });
    }
    if (rehydrated.length > 0) {
      setCart(rehydrated);
      toast.info(`Carrito restaurado (${rehydrated.length} productos)`, { duration: 2000 });
    }
    if (skipped.length > 0) {
      toast.warning(`${skipped.length} producto(s) ya no disponibles fueron removidos`, { duration: 3000 });
    }
    setDraftHydrated(true);
  }, [products, draftHydrated, editOrderId]);

  // Persist cart state to sessionStorage on every change
  useEffect(() => {
    if (!draftHydrated && !editOrderId) return; // don't overwrite before hydration
    if (editOrderId) return; // don't persist edit mode
    if (cart.length === 0 && step === "locator" && !locator) {
      clearDraft();
      return;
    }
    saveDraft({
      locator,
      step,
      orderNotes,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        notes: item.notes,
        unitPrice: item.unit_price,
      })),
    });
  }, [cart, locator, step, orderNotes, draftHydrated, editOrderId]);

  // Cargar pedido para editar si existe editOrderId
  useEffect(() => {
    if (editOrderId && orders.length > 0) {
      const orderToEdit = orders.find((o) => o.id === editOrderId);
      if (orderToEdit) {
        if (orderToEdit.status !== "pendiente") {
          toast.error("Solo se pueden editar pedidos pendientes");
          window.history.replaceState({}, "", "/kiosko");
          return;
        }
        setLocator(orderToEdit.locator || "");
        setOrderNotes(orderToEdit.notes || "");

        // Transformar order_items a CartItem
        const initialCart = (orderToEdit.order_items || []).map((item) => {
          const product = item.products;
          if (!product) return null;
          const cartKey = `${product.id}-${item.notes || ""}`;
          return {
            id: cartKey,
            product: product as ProductWithCategory,
            quantity: item.quantity,
            notes: item.notes || undefined,
            unit_price: item.unit_price,
          };
        }).filter(Boolean) as CartItem[];
        setCart(initialCart);
        setStep("menu"); // Ir directo al menú al editar
      }
    }
  }, [editOrderId, orders]);

  // Derivación de la categoría activa para evitar efectos innecesarios
  const currentCategory =
    activeCategory || (categories.length > 0 ? categories[0].name : "");

  const filteredProducts = useMemo(
    () => (products || []).filter((p) => p?.categories?.name === currentCategory),
    [products, currentCategory],
  );

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const handleProductClick = (product: ProductWithCategory) => {
    setCustomizingProduct(product);
  };

  const handleEditItem = (item: CartItem) => {
    setEditingCartItem(item);
    setCustomizingProduct(item.product);
  };

  const handleCustomizationConfirm = (
    product: Product,
    notes: string,
    extraCost: number,
    customizationValues: CustomizationValues,
  ) => {
    const unitPrice = product.price + extraCost;
    const cartKey = `${product.id}-${notes}`;

    // If editing an existing cart item, replace it
    if (editingCartItem) {
      setCart((prev) => {
        const filtered = prev.filter((i) => i.id !== editingCartItem.id);
        const existing = filtered.find((i) => i.id === cartKey);
        if (existing) {
          // Merge quantity into existing item with same key
          return filtered.map((i) =>
            i.id === cartKey
              ? { ...i, quantity: i.quantity + editingCartItem.quantity }
              : i,
          );
        }
        return [
          ...filtered,
          {
            id: cartKey,
            product: product as ProductWithCategory,
            quantity: editingCartItem.quantity,
            notes: notes || undefined,
            unit_price: unitPrice,
            customizationValues,
          },
        ];
      });
      toast.success(`${product.name} actualizado`, { duration: 1000 });
      setEditingCartItem(null);
      setCustomizingProduct(null);
      return;
    }

    // Normal add flow
    setCart((prev) => {
      const existing = prev.find((i) => i.id === cartKey);
      if (existing) {
        return prev.map((i) =>
          i.id === cartKey ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id: cartKey,
          product: product as ProductWithCategory,
          quantity: 1,
          notes: notes || undefined,
          unit_price: unitPrice,
          customizationValues,
        },
      ];
    });
    toast.success(`${product.name} agregado`, { duration: 1000 });
    setCustomizingProduct(null);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const [isSending, setIsSending] = useState(false);
  const handleSend = async () => {
    if (cart.length === 0) {
      toast.error("Agrega productos al pedido");
      return;
    }

    setIsSending(true);
    try {
      const itemsForDb = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || undefined,
      }));

      if (editOrderId) {
        await updateOrder(editOrderId, locator, itemsForDb, orderNotes);
        window.history.replaceState({}, "", "/kiosko");
      } else {
        await addOrder(locator, itemsForDb, orderNotes);
      }
      setCart([]);
      setLocator("");
      setOrderNotes("");
      setStep("locator");
      clearDraft();
    } finally {
      setIsSending(false);
    }
  };

  // Step 1: Locator
  if (step === "locator") {
    return (
      <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Nuevo Pedido
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Ingresa el número de localizador del cliente
          </p>
          <Input
            value={locator}
            onChange={(e) => setLocator(e.target.value.toUpperCase())}
            placeholder="Ej: 12"
            className="h-14 sm:h-16 text-center text-xl sm:text-2xl font-display font-bold"
            autoFocus
          />
          <Button
            size="xl"
            className="w-full"
            disabled={!locator.trim()}
            onClick={() => setStep("menu")}
          >
            <ArrowRight className="h-5 w-5 mr-2" />
            Continuar
          </Button>
        </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Step 3: Confirmation
  if (step === "confirm") {
    return (
      <ErrorBoundary>
        <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 animate-slide-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("menu")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            {editOrderId ? "Editar Pedido" : "Confirmar Pedido"}
          </h1>
        </div>

        <div className="pos-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Localizador</span>
            <span className="font-display text-xl sm:text-2xl font-bold text-primary">
              {locator}
            </span>
          </div>

          <div className="space-y-3 border-t pt-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs shrink-0">
                      {item.quantity}x
                    </Badge>
                    <span className="font-medium text-sm truncate">
                      {item.product.name}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 ml-8">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <CartItemImage product={item.product} />
                  <span className="text-sm font-semibold shrink-0">
                    {formatPrice(item.unit_price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-base sm:text-lg font-medium">Total</span>
              <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
                {formatPrice(total)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {itemCount} producto(s)
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Notas del pedido (opcional)
          </label>
          <Textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Notas adicionales..."
            className="resize-none"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => setStep("menu")}
            disabled={isSending}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            size="touch"
            className="flex-2"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            {editOrderId ? "Guardar Cambios" : "Enviar a Caja"}
          </Button>
        </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Step 2: Menu selection
  return (
    <ErrorBoundary>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        {/* Product selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 border-b">
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStep("locator");
                  setCart([]);
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="font-display text-lg sm:text-xl font-bold">
                Mesa {locator}
              </h2>

              {/* Mobile cart button */}
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="touch"
                    className="ml-auto lg:hidden relative"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    <span className="text-sm">{itemCount}</span>
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[85vw] sm:w-96 p-0 flex flex-col"
                >
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle className="font-display flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Carrito
                    </SheetTitle>
                  </SheetHeader>
                  <CartContent
                    cart={cart}
                    updateQuantity={updateQuantity}
                    onEditItem={handleEditItem}
                    total={total}
                    itemCount={itemCount}
                    setStep={setStep}
                    setCartOpen={setCartOpen}
                  />
                </SheetContent>
              </Sheet>

              <Badge variant="default" className="hidden lg:flex">
                {itemCount} items
              </Badge>
            </div>
            <div className="bg-muted/30 p-1.5 rounded-2xl">
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {loadingCats
                  ? [1, 2, 3, 4].map((i) => (
                      <Skeleton
                        key={i}
                        className="h-12 w-28 rounded-xl shrink-0"
                      />
                    ))
                  : categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={
                          currentCategory === cat.name ? "default" : "secondary"
                        }
                        onClick={() => setActiveCategory(cat.name)}
                        className={cn(
                          "h-12 px-6 rounded-xl whitespace-nowrap text-sm font-medium transition-all shrink-0 border-none",
                          currentCategory === cat.name
                            ? "shadow-lg shadow-primary/20 scale-[1.02]"
                            : "bg-background/50 text-muted-foreground hover:bg-background hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.icon}</span>
                          <span className="sm:hidden">
                            {cat.label.substring(0, 4)}
                          </span>
                          <span className="hidden sm:inline">{cat.label}</span>
                        </div>
                      </Button>
                    ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {loadingProds
                ? [1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))
                : filteredProducts.map((product) => {
                    const inCartCount = cart
                      .filter((i) => i.product.id === product.id)
                      .reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className={`pos-card text-left hover:border-primary/50 active:scale-[0.98] transition-all touch-target ${inCartCount > 0 ? "border-primary/30 bg-accent/50" : ""}`}
                      >
                        {/* Product image */}
                        <div className="aspect-square rounded-lg bg-muted/50 mb-2 overflow-hidden flex items-center justify-center">
                          <ProductImage product={product} />
                        </div>
                        <h3 className="font-semibold text-xs sm:text-sm mb-1 truncate">
                          {product.name}
                        </h3>
                        <p className="font-display font-bold text-primary text-sm sm:text-base">
                          {formatPrice(product.price)}
                        </p>
                        {inCartCount > 0 && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="default" className="text-xs">
                              {inCartCount}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              en pedido
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* Mobile floating total bar */}
          {cart.length > 0 && (
            <div className="lg:hidden p-3 border-t bg-card flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {itemCount} productos
                </p>
                <p className="font-display text-xl font-bold text-primary">
                  {formatPrice(total)}
                </p>
              </div>
              <Button size="touch" onClick={() => setStep("confirm")}>
                <ArrowRight className="h-5 w-5 mr-2" />
                Revisar
              </Button>
            </div>
          )}
        </div>

        {/* Desktop cart sidebar */}
        <div className="hidden lg:flex w-96 border-l bg-card flex-col">
          <div className="p-4 border-b flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold">Carrito</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {itemCount} productos
            </span>
          </div>
          <CartContent
            cart={cart}
            updateQuantity={updateQuantity}
            onEditItem={handleEditItem}
            total={total}
            itemCount={itemCount}
            setStep={setStep}
            setCartOpen={setCartOpen}
          />
        </div>
      </div>

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
    </ErrorBoundary>
  );
}
interface CartContentProps {
  cart: CartItem[];
  updateQuantity: (itemId: string, delta: number) => void;
  onEditItem: (item: CartItem) => void;
  total: number;
  itemCount: number;
  setStep: (step: "locator" | "menu" | "confirm") => void;
  setCartOpen: (open: boolean) => void;
}

function CartContent({
  cart,
  updateQuantity,
  onEditItem,
  total,
  itemCount,
  setStep,
  setCartOpen,
}: CartContentProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              Toca un producto para agregarlo
            </p>
          </div>
        )}
        {cart.map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-background p-3 space-y-2 animate-slide-in"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {item.product.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(item.unit_price)} c/u
                </p>
                {item.notes && (
                  <p className="text-xs text-primary/80 mt-0.5">
                    📝 {item.notes}
                  </p>
                )}
              </div>
              <span className="font-display font-bold text-sm text-primary">
                {formatPrice(item.unit_price * item.quantity)}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-end mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => {
                  onEditItem(item);
                  setCartOpen(false);
                }}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => updateQuantity(item.id, -1)}
                >
                  {item.quantity === 1 ? (
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                </Button>
                <span className="w-8 text-center font-bold text-sm">
                  {item.quantity}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => updateQuantity(item.id, 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t space-y-3 bg-card">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal ({itemCount} items)</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
              {formatPrice(total)}
            </span>
          </div>
        </div>
        <Button
          size="touch"
          className="w-full"
          onClick={() => {
            setStep("confirm");
            setCartOpen(false);
          }}
          disabled={cart.length === 0}
        >
          <ArrowRight className="h-5 w-5 mr-2" />
          Revisar Pedido
        </Button>
      </div>
    </>
  );
}

function ProductImage({ product }: { product: ProductWithCategory }) {
  const [error, setError] = useState(false);

  if (!product.image_url || error) {
    return (
      <span className="text-3xl sm:text-4xl">
        {product.categories?.icon || "📦"}
      </span>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(product.image_url, 400)}
      alt={product.name}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function CartItemImage({ product }: { product: ProductWithCategory }) {
  const [error, setError] = useState(false);

  if (!product.image_url || error) {
    return (
      <div className="w-10 h-10 rounded-md border flex items-center justify-center bg-muted/50 shrink-0">
        <span className="text-lg">{product.categories?.icon || "📦"}</span>
      </div>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(product.image_url, 80)}
      alt={product.name}
      className="w-10 h-10 rounded-md object-cover border shrink-0"
      onError={() => setError(true)}
    />
  );
}
