import { useState, useMemo } from "react";
import { MOCK_PRODUCTS, formatPrice } from "@/data/mock";
import type { OrderItem, Product } from "@/types";
import { useOrders } from "@/context/OrderContext";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "perros", label: "🌭 Perros" },
  { key: "hamburguesas", label: "🍔 Hamburguesas" },
  { key: "bebidas", label: "🥤 Bebidas" },
  { key: "extras", label: "🍟 Extras" },
] as const;

export default function Kiosko() {
  const { addOrder } = useOrders();
  const [locator, setLocator] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("perros");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [step, setStep] = useState<"locator" | "menu" | "confirm">("locator");
  const [orderNotes, setOrderNotes] = useState("");
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(
    null,
  );

  const filteredProducts = useMemo(
    () =>
      MOCK_PRODUCTS.filter((p) => p.category === activeCategory && p.available),
    [activeCategory],
  );

  const total = useMemo(
    () =>
      cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const handleProductClick = (product: Product) => {
    setCustomizingProduct(product);
  };

  const handleCustomizationConfirm = (
    product: Product,
    notes: string,
    extraCost: number,
  ) => {
    const adjustedProduct =
      extraCost > 0
        ? { ...product, price: product.price + extraCost }
        : product;

    // Each customized item is unique (by notes), so add as separate entry
    const cartKey = `${product.id}-${notes}`;
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
          product: adjustedProduct,
          quantity: 1,
          notes: notes || undefined,
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

  const handleSend = () => {
    if (cart.length === 0) {
      toast.error("Agrega productos al pedido");
      return;
    }
    addOrder(locator, cart, "mesero");
    setCart([]);
    setLocator("");
    setOrderNotes("");
    setStep("locator");
  };

  // Step 1: Locator
  if (step === "locator") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ShoppingCart className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold">Nuevo Pedido</h1>
          <p className="text-muted-foreground">
            Ingresa el número de localizador del cliente
          </p>
          <Input
            value={locator}
            onChange={(e) => setLocator(e.target.value.toUpperCase())}
            placeholder="Ej: A-12"
            className="h-16 text-center text-2xl font-display font-bold"
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
    );
  }

  // Step 3: Confirmation
  if (step === "confirm") {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-6 animate-slide-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("menu")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-2xl font-bold">Confirmar Pedido</h1>
        </div>

        <div className="pos-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Localizador</span>
            <span className="font-display text-2xl font-bold text-primary">
              {locator}
            </span>
          </div>

          <div className="space-y-3 border-t pt-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {item.quantity}x
                    </Badge>
                    <span className="font-medium text-sm">
                      {item.product.name}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 ml-8">
                      📝 {item.notes}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total</span>
              <span className="font-display text-3xl font-bold text-primary">
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
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button size="touch" className="flex-[2]" onClick={handleSend}>
            <CheckCircle className="h-5 w-5 mr-2" />
            Enviar a Caja
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Menu selection
  return (
    <>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        {/* Product selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3 mb-3">
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
              <h2 className="font-display text-xl font-bold">Mesa {locator}</h2>
              <Badge variant="default" className="ml-auto">
                {itemCount} items
              </Badge>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.key}
                  variant={activeCategory === cat.key ? "default" : "secondary"}
                  size="touch"
                  onClick={() => setActiveCategory(cat.key)}
                  className="whitespace-nowrap"
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const inCartCount = cart
                  .filter((i) => i.product.id === product.id)
                  .reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className={`pos-card text-left hover:border-primary/50 active:scale-[0.98] transition-all touch-target ${inCartCount > 0 ? "border-primary/30 bg-accent/50" : ""}`}
                  >
                    <h3 className="font-semibold text-sm mb-1">
                      {product.name}
                    </h3>
                    <p className="font-display font-bold text-primary">
                      {formatPrice(product.price)}
                    </p>
                    {inCartCount > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="default">{inCartCount}</Badge>
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
        </div>

        {/* Cart sidebar */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-card flex flex-col">
          <div className="p-4 border-b flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold">Carrito</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {itemCount} productos
            </span>
          </div>

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
                      {formatPrice(item.product.price)} c/u
                    </p>
                    {item.notes && (
                      <p className="text-xs text-primary/80 mt-0.5">
                        📝 {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-display font-bold text-sm text-primary">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                <span className="font-display text-3xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
            <Button
              size="touch"
              className="w-full"
              onClick={() => setStep("confirm")}
              disabled={cart.length === 0}
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Revisar Pedido
            </Button>
          </div>
        </div>
      </div>

      <ProductCustomizer
        product={customizingProduct}
        open={!!customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={handleCustomizationConfirm}
      />
    </>
  );
}
