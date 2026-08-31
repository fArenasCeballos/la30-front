import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/formatPrice";
import type {
  Product,
  Category,
  ProductWithCategory,
  DeliveryZone,
  LatLngPoint,
  Order,
} from "@/types";
import type { Tables } from "@/types/database.types";
import { useOrders } from "@/context/OrderContext";
import { useStore } from "@/context/StoreContext";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import type { CustomizationValues } from "@/components/ProductCustomizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DeliveryZoneCombobox } from "@/components/DeliveryZoneCombobox";
import { DeliveryZonePickerMap } from "@/components/DeliveryZonePickerMap";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatusBadge } from "@/components/StatusBadge";

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
  items: {
    productId: string;
    quantity: number;
    notes?: string;
    unitPrice: number;
  }[];
  isDeliveryOrder?: boolean;
  deliveryName?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryFee?: number;
  selectedZoneId?: string;
  driverId?: string;
}

function saveDraft(draft: CartDraft) {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota exceeded — ignore */
  }
}

function loadDraft(): CartDraft | null {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartDraft;
  } catch {
    return null;
  }
}

function clearDraft() {
  sessionStorage.removeItem(CART_STORAGE_KEY);
}

export default function Kiosko() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get("edit");
  const { addOrder, addDeliveryOrder, updateOrder, orders } = useOrders();
  const { data: zones = [] } = useQuery<DeliveryZone[]>({
    queryKey: ["delivery-zones-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (
        data as unknown as {
          id: string;
          name: string;
          price: number;
          polygon: LatLngPoint[][];
          color: string;
          is_active: boolean;
          created_at: string;
        }[]
      ).map(
        (row): DeliveryZone => ({
          id: row.id,
          name: row.name,
          price: Number(row.price),
          polygon: row.polygon,
          color: row.color,
          is_active: row.is_active,
          created_at: row.created_at,
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  const { activeStore } = useStore();
  const storeId = activeStore?.id;
  const isDeliveryMode = activeStore?.slug === "domicilios";

  // Initialize from draft if available (and not in edit mode)
  const savedDraft = !editOrderId ? loadDraft() : null;

  const [locator, setLocator] = useState(savedDraft?.locator ?? "");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]); // rehydrated in useEffect below
  const [step, setStep] = useState<"locator" | "menu" | "confirm">(
    savedDraft?.step ?? "locator",
  );
  const [isDeliveryOrder, setIsDeliveryOrder] = useState(
    savedDraft?.isDeliveryOrder ?? false,
  );
  const [deliveryName, setDeliveryName] = useState(
    savedDraft?.deliveryName ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    savedDraft?.deliveryAddress ?? "",
  );
  const [deliveryPhone, setDeliveryPhone] = useState(
    savedDraft?.deliveryPhone ?? "",
  );
  const [deliveryFee, setDeliveryFee] = useState<number>(
    savedDraft?.deliveryFee ?? 0,
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(
    savedDraft?.selectedZoneId,
  );
  const [driverId, setDriverId] = useState<string | undefined>(
    savedDraft?.driverId,
  );
  const [orderNotes, setOrderNotes] = useState(savedDraft?.orderNotes ?? "");
  const [customizingProduct, setCustomizingProduct] =
    useState<ProductWithCategory | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const nextDeliveryLocator = useMemo(() => {
    if (!isDeliveryMode) return "";
    const deliveryCount = orders.filter((o) => o.is_delivery).length;
    return String(deliveryCount + 1);
  }, [isDeliveryMode, orders]);

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["delivery-drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Queries con React Query
  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      try {
        let query = supabase
          .from("categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");
        if (storeId) query = query.contains("store_ids", [storeId]);
        const { data, error } = await query;
        if (error) throw error;
        localStorage.setItem(
          `la30_cached_categories_${storeId}`,
          JSON.stringify(data),
        );
        return (data || []) as Category[];
      } catch (err) {
        console.warn("Error fetching categories, falling back to cache:", err);
        const cached = localStorage.getItem(
          `la30_cached_categories_${storeId}`,
        );
        if (cached) return JSON.parse(cached) as Category[];
        return [];
      }
    },
  });

  const { data: products = [], isLoading: loadingProds } = useQuery({
    queryKey: ["products", storeId],
    queryFn: async () => {
      try {
        let query = supabase
          .from("products")
          .select("*, categories(*)")
          .eq("available", true)
          .order("sort_order");
        if (storeId) query = query.contains("store_ids", [storeId]);
        const { data, error } = await query;
        if (error) throw error;
        localStorage.setItem(
          `la30_cached_products_${storeId}`,
          JSON.stringify(data),
        );
        return (data || []) as unknown as ProductWithCategory[];
      } catch (err) {
        console.warn("Error fetching products, falling back to cache:", err);
        const cached = localStorage.getItem(`la30_cached_products_${storeId}`);
        if (cached)
          return JSON.parse(cached) as unknown as ProductWithCategory[];
        return [];
      }
    },
  });

  // Rehydrate cart from sessionStorage once products are loaded
  useEffect(() => {
    if (draftHydrated || editOrderId || products.length === 0) return;
    const draft = loadDraft();

    // Use setTimeout to avoid synchronous cascading renders
    setTimeout(() => {
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
          unit_price: Number(product.price) || 0, // always use current price
        });
      }
      if (rehydrated.length > 0) {
        setCart(rehydrated);
        toast.info(`Carrito restaurado (${rehydrated.length} productos)`, {
          duration: 2000,
        });
      }
      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} producto(s) ya no disponibles fueron removidos`,
          { duration: 3000 },
        );
      }
      setDraftHydrated(true);
    }, 0);
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
      isDeliveryOrder,
      deliveryName,
      deliveryAddress,
      deliveryPhone,
      deliveryFee,
      selectedZoneId,
      driverId,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        notes: item.notes,
        unitPrice: item.unit_price,
      })),
    });
  }, [
    cart,
    locator,
    step,
    orderNotes,
    draftHydrated,
    editOrderId,
    isDeliveryOrder,
    deliveryName,
    deliveryAddress,
    deliveryPhone,
    deliveryFee,
    selectedZoneId,
    driverId,
  ]);

  const { data: directOrderToEdit } = useQuery({
    queryKey: ["order-to-edit", editOrderId],
    queryFn: async () => {
      if (!editOrderId) return null;
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, order_items(*, products(id, name, siigo_code, sort_order, category_id, categories(id, name, sort_order)))",
        )
        .eq("id", editOrderId)
        .single();
      if (error) {
        console.error("Error fetching order to edit:", error);
        return null;
      }
      return data as unknown as Order;
    },
    enabled: !!editOrderId,
    staleTime: 0,
  });

  const orderToEdit = useMemo(() => {
    if (!editOrderId) return null;
    return (
      orders.find((o) => o.id === editOrderId) || directOrderToEdit || null
    );
  }, [editOrderId, orders, directOrderToEdit]);

  // Cargar pedido para editar si existe editOrderId
  useEffect(() => {
    if (!editOrderId || !orderToEdit) return;

    if (orderToEdit.status !== "pendiente") {
      toast.error("Solo se pueden editar pedidos pendientes");
      navigate(orderToEdit.is_delivery ? "/domicilios" : "/caja");
      return;
    }

    const cleanNotes =
      orderToEdit.notes?.startsWith("📍") &&
      (!orderToEdit.delivery_address ||
        orderToEdit.notes.includes(orderToEdit.delivery_address) ||
        orderToEdit.notes.trim() ===
          `📍 ${orderToEdit.delivery_address?.trim()}`)
        ? ""
        : orderToEdit.notes || "";

    setLocator(orderToEdit.locator || "");
    setOrderNotes(cleanNotes);
    setIsDeliveryOrder(!!orderToEdit.is_delivery);
    if (orderToEdit.is_delivery) {
      setDeliveryName(orderToEdit.delivery_name || "");
      setDeliveryAddress(orderToEdit.delivery_address || "");
      setDeliveryPhone(orderToEdit.delivery_phone || "");
      setDeliveryFee(orderToEdit.delivery_fee || 0);
      setDriverId(orderToEdit.driver_id || undefined);
      const matchingZone = zones.find(
        (z) => z.price === orderToEdit.delivery_fee,
      );
      if (matchingZone) {
        setSelectedZoneId(matchingZone.id);
      }
    }

    // Transformar order_items a CartItem
    const initialCart = (orderToEdit.order_items || [])
      .map((item) => {
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
      })
      .filter(Boolean) as CartItem[];

    setCart(initialCart);
    setStep("menu"); // Ir directo al menú al editar
  }, [editOrderId, orderToEdit, zones, navigate]);

  // Derivación de la categoría activa para evitar efectos innecesarios
  const currentCategory =
    activeCategory || (categories.length > 0 ? categories[0].name : "");

  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const allProducts = products || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }
    return allProducts.filter((p) => p?.categories?.name === currentCategory);
  }, [products, currentCategory, searchQuery]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
        0,
      ),
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
    const unitPrice = (Number(product.price) || 0) + (Number(extraCost) || 0);
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

    // Delivery validation
    if (isDeliveryOrder) {
      if (
        !deliveryName.trim() ||
        !deliveryAddress.trim() ||
        !deliveryPhone.trim()
      ) {
        toast.error("Completa los datos del cliente para el domicilio");
        return;
      }
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
        await updateOrder(
          editOrderId,
          locator,
          itemsForDb,
          orderNotes,
          isDeliveryOrder
            ? {
                name: deliveryName,
                address: deliveryAddress,
                phone: deliveryPhone,
                fee: deliveryFee,
                driver_id: driverId,
              }
            : undefined,
        );
        setCart([]);
        setLocator("");
        setOrderNotes("");
        setIsDeliveryOrder(false);
        clearDraft();
        if (isDeliveryOrder) {
          navigate("/domicilios");
        } else {
          navigate("/caja");
        }
        return;
      } else if (isDeliveryOrder) {
        const deliveryLocator = nextDeliveryLocator;
        await addDeliveryOrder(
          deliveryLocator,
          itemsForDb,
          {
            name: deliveryName,
            address: deliveryAddress,
            phone: deliveryPhone,
            fee: deliveryFee,
            driver_id: driverId,
          },
          orderNotes.trim() || undefined,
        );
        setDeliveryName("");
        setDeliveryAddress("");
        setDeliveryPhone("");
        setDeliveryFee(0);
        setDriverId(undefined);
        navigate("/domicilios");
      } else {
        await addOrder(locator, itemsForDb, orderNotes);
      }
      setCart([]);
      setLocator("");
      setOrderNotes("");
      setIsDeliveryOrder(false);
      if (!isDeliveryOrder) {
        setStep("locator");
      }
      clearDraft();
    } finally {
      setIsSending(false);
    }
  };

  // Loading state when editing an order and waiting for data
  if (editOrderId && !orderToEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">
          Cargando pedido para editar...
        </p>
      </div>
    );
  }

  // Step 1: Locator (Entry) or Delivery/Local choice
  if (step === "locator") {
    return (
      <ErrorBoundary>
        <div className="section-container flex flex-col items-center justify-center min-h-[45vh] py-3 sm:py-6 px-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl space-y-4 sm:space-y-6 text-center">
            <div className="relative inline-block md:block">
              <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full animate-pulse" />
              <div className="relative w-16 h-16 rounded-xl bg-white border shadow-strong flex items-center justify-center mx-auto group">
                <ShoppingCart className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-200" />
              </div>
            </div>

            {/* Delivery mode: show choice between local and delivery */}
            {isDeliveryMode ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-primary font-bold uppercase tracking-[0.3em] text-[8px] sm:text-[9px]">
                    <div className="h-px w-6 bg-primary/30" />
                    Nueva Orden
                    <div className="h-px w-6 bg-primary/30" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                    ¿Tipo de Pedido?
                  </h1>
                  <p className="text-muted-foreground font-medium text-[10px] sm:text-xs max-w-65 sm:max-w-sm mx-auto px-2">
                    Selecciona si el cliente come aquí o es un domicilio.
                  </p>
                </div>

                <div className="flex flex-row gap-3 max-w-md mx-auto justify-center">
                  {/* Local / Eat-in */}
                  <button
                    onClick={() => {
                      setIsDeliveryOrder(false);
                      setLocator("");
                    }}
                    className={cn(
                      "group flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-35 sm:w-45 justify-center",
                      !isDeliveryOrder && locator !== ""
                        ? "border-primary bg-primary/5 shadow-xl shadow-primary/10"
                        : "border-accent/20 bg-white shadow-soft hover:border-primary/30 hover:shadow-medium",
                    )}
                  >
                    <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300">
                      🍽️
                    </span>
                    <div className="text-left leading-none">
                      <p className="font-black text-xs sm:text-sm tracking-tight">
                        Comer Aquí
                      </p>
                      <p className="text-[7px] sm:text-[8px] font-bold text-muted-foreground/35 uppercase tracking-widest mt-0.5">
                        Mesa
                      </p>
                    </div>
                  </button>

                  {/* Delivery */}
                  <button
                    onClick={() => {
                      setIsDeliveryOrder(true);
                      setLocator(nextDeliveryLocator);
                      setStep("menu");
                    }}
                    className="group flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 border-purple-500/20 bg-purple-500/5 shadow-soft hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-35 sm:w-45 justify-center"
                  >
                    <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform duration-300">
                      🛵
                    </span>
                    <div className="text-left leading-none">
                      <p className="font-black text-xs sm:text-sm tracking-tight text-purple-700">
                        Domicilio
                      </p>
                      <p className="text-[7px] sm:text-[8px] font-bold text-purple-400 uppercase tracking-widest mt-0.5">
                        Pedido #{nextDeliveryLocator}
                      </p>
                    </div>
                  </button>
                </div>

                {/* Locator input (only shown if "Comer Aquí" was tapped) */}
                {!isDeliveryOrder && (
                  <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-row items-center justify-center gap-2 max-w-xs sm:max-w-md mx-auto">
                      <div className="relative group w-24">
                        <Input
                          value={locator}
                          onChange={(e) =>
                            setLocator(e.target.value.toUpperCase())
                          }
                          placeholder="00"
                          className="h-10 sm:h-12 text-center text-lg sm:text-xl font-black rounded-lg border-2 border-primary/20 shadow-soft focus-visible:ring-primary focus-visible:border-primary transition-all bg-white"
                          autoFocus
                        />
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-[7px] font-black uppercase tracking-widest rounded-full shadow-lg opacity-0 group-focus-within:opacity-100 transition-opacity whitespace-nowrap">
                          Localizador
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="h-10 sm:h-12 px-6 rounded-lg text-xs font-black shadow-strong hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group w-auto"
                        disabled={!locator.trim()}
                        onClick={() => setStep("menu")}
                      >
                        INICIAR SELECCIÓN
                        <ArrowRight className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Normal mode: just show locator input */
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-primary font-bold uppercase tracking-[0.3em] text-[8px] sm:text-[9px]">
                    <div className="h-px w-6 bg-primary/30" />
                    Nueva Orden
                    <div className="h-px w-6 bg-primary/30" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                    Identifica el Pedido
                  </h1>
                  <p className="text-muted-foreground font-medium text-[10px] sm:text-xs max-w-65 sm:max-w-sm mx-auto px-2">
                    Ingresa el número de localizador asignado para comenzar la
                    selección.
                  </p>
                </div>

                <div className="flex flex-row items-center justify-center gap-2 max-w-xs sm:max-w-md mx-auto">
                  <div className="relative group w-24">
                    <Input
                      value={locator}
                      onChange={(e) => setLocator(e.target.value.toUpperCase())}
                      placeholder="00"
                      className="h-10 sm:h-12 text-center text-lg sm:text-xl font-black rounded-lg border-2 border-primary/20 shadow-soft focus-visible:ring-primary focus-visible:border-primary transition-all bg-white"
                      autoFocus
                    />
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-[7px] font-black uppercase tracking-widest rounded-full shadow-lg opacity-0 group-focus-within:opacity-100 transition-opacity whitespace-nowrap">
                      Localizador
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="h-10 sm:h-12 px-6 rounded-lg text-xs font-black shadow-strong hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group w-auto"
                    disabled={!locator.trim()}
                    onClick={() => setStep("menu")}
                  >
                    INICIAR SELECCIÓN
                    <ArrowRight className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Step 3: Confirmation / Checkout
  if (step === "confirm") {
    return (
      <ErrorBoundary>
        <div className="section-container max-w-4xl mx-auto py-6 sm:py-10 space-y-8 sm:space-y-10 animate-in fade-in duration-300">
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
              <p
                className={cn(
                  "text-[9px] sm:text-[10px] font-black uppercase tracking-widest leading-none mb-1",
                  isDeliveryOrder ? "text-purple-600" : "text-primary",
                )}
              >
                {editOrderId
                  ? isDeliveryOrder
                    ? "🛵 Edición de Domicilio"
                    : "Edición de Orden"
                  : isDeliveryOrder
                    ? "🛵 Nuevo Domicilio"
                    : "Finalizar Pedido"}
              </p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {isDeliveryOrder ? "Datos de Entrega" : "Revisión de Compra"}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-10">
            <div className="lg:col-span-3 space-y-6 sm:space-y-8">
              <div className="pos-card p-0 overflow-hidden border-2 border-primary/5 flex flex-col">
                <div className="p-6 sm:p-8 border-b bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white border-2 border-primary/20 shadow-soft flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black opacity-40 leading-none mb-0.5">
                          {isDeliveryOrder ? "DOM" : "ORD"}
                        </span>
                        <span
                          className={cn(
                            "text-2xl font-black",
                            isDeliveryOrder ? "text-purple-600" : "text-primary",
                          )}
                        >
                          {isDeliveryOrder
                            ? editOrderId
                              ? locator
                              : nextDeliveryLocator
                            : locator}
                        </span>
                      </div>
                      <div>
                        <p className="font-black text-lg">Resumen de Items</p>
                        <p className="text-xs font-bold text-muted-foreground">
                          {itemCount} productos seleccionados
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={editOrderId ? "confirmado" : "pendiente"}
                    />
                  </div>
                </div>

                <div className="p-6 sm:p-8 max-h-112.5 overflow-y-auto premium-scrollbar space-y-6">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-6 group animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex gap-4">
                        <div className="relative shrink-0">
                          <CartItemImage product={item.product} />
                          <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-lg bg-primary text-white font-black p-0 flex items-center justify-center border-2 border-white shadow-soft">
                            {item.quantity}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-black text-sm group-hover:text-primary transition-colors leading-tight">
                            {item.product.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-accent/50 px-2 py-0.5 rounded-full">
                              {item.product.categories?.name}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-[11px] font-bold text-primary italic bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10 inline-block mt-2">
                              “{item.notes}”
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="font-black text-sm tabular-nums shrink-0">
                        {formatPrice(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Info (only in delivery mode) */}
              {isDeliveryOrder && (
                <div className="space-y-4 bg-purple-500/5 p-6 rounded-4xl border-2 border-dashed border-purple-500/20">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-purple-600 px-2 flex items-center gap-2">
                    🛵 Datos del Domicilio
                  </h3>
                  <Input
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="rounded-2xl border-2 border-white p-4 h-12 shadow-soft focus:border-purple-500 transition-all bg-white font-bold text-sm placeholder:text-muted-foreground/30"
                  />
                  <Input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Dirección de entrega"
                    className="rounded-2xl border-2 border-white p-4 h-12 shadow-soft focus:border-purple-500 transition-all bg-white font-bold text-sm placeholder:text-muted-foreground/30"
                  />
                  <div className="flex flex-col gap-2">
                    <DeliveryZoneCombobox
                      selectedZoneId={selectedZoneId}
                      onSelect={(zone: DeliveryZone | null) => {
                        if (zone) {
                          setSelectedZoneId(zone.id);
                          setDeliveryFee(zone.price);
                        } else {
                          setSelectedZoneId(undefined);
                          setDeliveryFee(0);
                        }
                      }}
                    />
                    <DeliveryZonePickerMap
                      zones={zones}
                      selectedZoneId={selectedZoneId}
                      onSelectZone={(zone) => {
                        setSelectedZoneId(zone.id);
                        setDeliveryFee(zone.price);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      placeholder="Celular"
                      type="tel"
                      className="rounded-2xl border-2 border-white p-4 h-12 shadow-soft focus:border-purple-500 transition-all bg-white font-bold text-sm placeholder:text-muted-foreground/30"
                    />
                    <Input
                      value={deliveryFee || ""}
                      onChange={(e) => {
                        setDeliveryFee(Number(e.target.value) || 0);
                        setSelectedZoneId(undefined);
                      }}
                      placeholder="Costo envío (manual)"
                      type="number"
                      className="rounded-2xl border-2 border-white p-4 h-12 shadow-soft focus:border-purple-500 transition-all bg-white font-bold text-sm placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <div className="w-full">
                    {loadingDrivers ? (
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    ) : (
                      <Select
                        value={driverId || "unassigned"}
                        onValueChange={(val) => setDriverId(val === "unassigned" ? undefined : val)}
                      >
                        <SelectTrigger className="h-12 w-full rounded-2xl border-2 border-white shadow-soft transition-all focus:ring-purple-500/20 focus:border-purple-500 bg-white font-bold text-sm text-purple-700">
                          <SelectValue placeholder="Asignar Domiciliario (Opcional)" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2">
                          <SelectItem value="unassigned" className="font-bold text-sm py-3 text-muted-foreground">
                            Sin asignar
                          </SelectItem>
                          {drivers.map((driver: Tables<"delivery_drivers">) => (
                            <SelectItem
                              key={driver.id}
                              value={driver.id}
                              className="font-bold text-sm py-3"
                            >
                              {driver.first_name} {driver.last_name} {driver.motorcycle_plate ? `(${driver.motorcycle_plate})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4 bg-primary/5 p-6 rounded-4xl border-2 border-dashed border-primary/20">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary px-2 flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Comentarios Adicionales
                </h3>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="¿Alguna instrucción especial para tu pedido?"
                  className="rounded-2xl border-2 border-white p-6 h-32 shadow-soft focus:border-primary transition-all bg-white font-bold text-sm placeholder:text-muted-foreground/30"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-24 space-y-6">
                <Button
                  variant="ghost"
                  className="w-full h-14 rounded-2xl font-black text-muted-foreground hover:text-primary transition-all bg-white border-2 border-transparent hover:border-primary/20 shadow-soft hover:shadow-medium"
                  onClick={() => setStep("menu")}
                  disabled={isSending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Seguir Agregando
                </Button>

                <div className="pos-card p-8 border-2 border-primary/10 shadow-medium">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                        Subtotal
                      </p>
                      <p className="font-bold">{formatPrice(total)}</p>
                    </div>
                    {isDeliveryOrder && deliveryFee > 0 && (
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-black text-purple-500 uppercase tracking-widest">
                          Envío
                        </p>
                        <p className="font-bold text-purple-600">
                          {formatPrice(deliveryFee)}
                        </p>
                      </div>
                    )}
                    <div className="h-px bg-dashed border-t-2 border-accent border-dashed" />
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                          Total Neto
                        </p>
                        <p className="text-2xl font-black tracking-tight leading-none">
                          {isDeliveryOrder ? "A Cobrar" : "A Pagar"}
                        </p>
                      </div>
                      <p className="text-4xl font-black text-primary tracking-tighter">
                        {formatPrice(
                          total + (isDeliveryOrder ? deliveryFee : 0),
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "pos-card p-8 text-white shadow-strong overflow-hidden relative group border-none",
                    isDeliveryOrder
                      ? "bg-purple-600 shadow-purple-500/20"
                      : "bg-primary shadow-primary/20",
                  )}
                >
                  <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-300" />
                  <div className="relative z-10 space-y-6">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <CheckCircle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black tracking-tight leading-tight mb-2">
                        {isDeliveryOrder
                          ? "Enviar a domicilio"
                          : "Listo para el despacho"}
                      </h4>
                      <p className="text-white/70 text-sm font-medium">
                        {isDeliveryOrder
                          ? editOrderId
                            ? "Verifica los datos del cliente y los productos antes de actualizar el domicilio."
                            : "Verifica los datos del cliente y los productos antes de crear el domicilio."
                          : "Verifica que todos los productos y cantidades sean correctos antes de confirmar."}
                      </p>
                    </div>
                    <Button
                      size="xl"
                      variant="secondary"
                      className={cn(
                        "w-full h-16 rounded-2xl font-black shadow-lg hover:shadow-xl transition-all",
                        isDeliveryOrder ? "text-purple-600" : "text-primary",
                      )}
                      onClick={handleSend}
                      disabled={isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-6 w-6 mr-2" />
                      )}
                      {editOrderId
                        ? isDeliveryOrder
                          ? "🛵 ACTUALIZAR DOMICILIO"
                          : "GUARDAR CAMBIOS"
                        : isDeliveryOrder
                          ? "🛵 CREAR DOMICILIO"
                          : "CONFIRMAR PEDIDO"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Step 2: Menu selection
  return (
    <ErrorBoundary>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-5rem)] bg-accent/20">
        {/* Main Menu Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white shadow-2xl z-10 lg:rounded-tr-[3rem] lg:rounded-br-[3rem] overflow-hidden">
          {/* Menu Header */}
          <div className="p-4 lg:p-8 space-y-4 lg:space-y-8 border-b bg-white/50 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 lg:gap-5 flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl border-2 shadow-soft group shrink-0"
                  onClick={() => {
                    if (editOrderId) {
                      if (isDeliveryOrder) {
                        navigate("/domicilios");
                      } else {
                        navigate("/caja");
                      }
                      return;
                    }
                    if (cart.length > 0) {
                      toast.info(
                        "Limpia el carrito para cambiar de localizador",
                      );
                      return;
                    }
                    setStep("locator");
                  }}
                >
                  <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                </Button>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[8px] lg:text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1",
                      isDeliveryOrder ? "text-purple-600" : "text-primary",
                    )}
                  >
                    {isDeliveryOrder
                      ? editOrderId
                        ? "🛵 Editando Domicilio"
                        : "🛵 Menú Domicilio"
                      : "Menú Digital"}
                  </p>
                  <h2 className="text-lg lg:text-3xl font-black tracking-tight flex items-center gap-2 lg:gap-3 truncate">
                    <span className="truncate hidden sm:inline">
                      {isDeliveryOrder
                        ? "Pedido Domicilio:"
                        : "Mesa / Localizador:"}
                    </span>
                    <span className="sm:hidden">
                      {isDeliveryOrder ? "DOM:" : "MES:"}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        isDeliveryOrder ? "text-purple-600" : "text-primary",
                      )}
                    >
                      {locator}
                    </span>
                  </h2>
                </div>
              </div>

              {/* Mobile Cart Floating Trigger */}
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="default"
                    size="lg"
                    className="lg:hidden h-12 px-4 rounded-xl font-black shadow-strong relative group shrink-0"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    <span className="text-xs">{formatPrice(total)}</span>
                    {itemCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-white text-primary border-2 border-primary rounded-lg min-w-5 h-5 text-[9px] font-black flex items-center justify-center shadow-lg">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full sm:w-112.5 p-0 flex flex-col border-none shadow-strong h-dvh overflow-hidden"
                  aria-describedby={undefined}
                >
                  <SheetHeader className="p-4 sm:p-8 border-b bg-primary text-white shrink-0">
                    <SheetTitle className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-3 text-white">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      Tu Pedido Actual
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
            </div>

            {/* Search & Categories Navigation */}
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 pb-4">
              <div className="relative shrink-0 w-full sm:w-64 lg:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 lg:h-14 rounded-xl lg:rounded-2xl border-2 font-medium bg-white shadow-soft transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
              <div className="flex-1 w-full min-w-50">
                {loadingCats ? (
                  <Skeleton className="h-12 lg:h-14 w-full rounded-xl lg:rounded-2xl" />
                ) : (
                  <Select
                    value={currentCategory}
                    onValueChange={setActiveCategory}
                  >
                    <SelectTrigger className="h-12 lg:h-14 w-full rounded-xl lg:rounded-2xl border-2 font-black text-xs lg:text-sm bg-white shadow-soft transition-all focus:ring-primary/20 [&>span]:line-clamp-none [&>span]:flex [&>span]:items-center [&>span]:gap-2">
                      <SelectValue placeholder="Selecciona una categoría">
                        {(() => {
                          const selected = categories.find(
                            (c) => c.name === currentCategory,
                          );
                          if (!selected) return null;
                          return (
                            <span className="inline-flex items-center gap-2">
                              {selected.icon && (
                                <span className="text-lg">{selected.icon}</span>
                              )}
                              <span>{selected.label || selected.name}</span>
                            </span>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      {categories.map((cat) => (
                        <SelectItem
                          key={cat.id}
                          value={cat.name}
                          className="font-black text-xs lg:text-sm uppercase py-3 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2">
                            {cat.icon && (
                              <span className="text-lg">{cat.icon}</span>
                            )}
                            <span>{cat.label || cat.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar bg-white">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-6">
              {loadingProds
                ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-4xl" />
                  ))
                : filteredProducts.map((product) => {
                    const inCartCount = cart
                      .filter((i) => i.product.id === product.id)
                      .reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className={cn(
                          "pos-card group p-3 lg:p-4 text-left border-2 transition-all relative cursor-pointer flex flex-col",
                          inCartCount > 0
                            ? "border-primary bg-primary/2 shadow-medium"
                            : "border-transparent hover:border-primary/20 hover:shadow-soft bg-white",
                        )}
                      >
                        {/* Count Badge */}
                        {inCartCount > 0 && (
                          <div className="absolute -top-2 -right-2 h-9 w-9 rounded-2xl bg-primary text-white border-2 border-white shadow-strong flex items-center justify-center font-black z-20 animate-in zoom-in duration-200">
                            {inCartCount}
                          </div>
                        )}

                        <div className="aspect-square rounded-2xl bg-accent/30 mb-4 overflow-hidden flex items-center justify-center relative">
                          <ProductImage product={product} />
                        </div>

                        <div className="flex-1 space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                            {product.categories?.name}
                          </p>
                          <h3 className="font-black text-xs lg:text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {product.name}
                          </h3>
                        </div>

                        <div className="mt-3 pt-3 border-t border-dashed border-accent/50 space-y-3">
                          <p className="font-black text-base lg:text-lg text-primary tracking-tight">
                            {formatPrice(product.price)}
                          </p>
                          <Button
                            size="sm"
                            className="w-full h-10 rounded-xl font-black shadow-soft bg-primary text-white hover:bg-primary/90 transition-all active:scale-95"
                          >
                            AGREGAR
                          </Button>
                        </div>
                      </div>
                    );
                  })}
            </div>
            {filteredProducts.length === 0 && !loadingProds && (
              <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30 py-20">
                <div className="h-24 w-24 rounded-4xl border-4 border-dashed border-primary flex items-center justify-center">
                  <Plus className="h-10 w-10 text-primary" />
                </div>
                <p className="font-black uppercase tracking-[0.3em] text-sm">
                  Próximamente disponibles
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Cart Sidebar */}
        <aside className="hidden lg:flex w-100 bg-accent/20 flex-col overflow-hidden">
          <div className="p-8 border-b flex items-center justify-between bg-white/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <h3 className="font-black text-xl tracking-tight">Tu Pedido</h3>
            </div>
            <Badge
              variant="outline"
              className="font-black border-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-widest text-[9px]"
            >
              {itemCount} Artículos
            </Badge>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
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
        </aside>
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
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white/50 backdrop-blur-xl">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
            <div className="w-20 h-20 rounded-4xl bg-accent/30 flex items-center justify-center text-muted-foreground/30 border-2 border-dashed border-accent">
              <ShoppingCart className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-sm uppercase tracking-widest text-muted-foreground">
                Carrito Vacío
              </p>
              <p className="text-xs font-medium text-muted-foreground/60 max-w-45">
                Toca cualquier producto para empezar a armar el pedido.
              </p>
            </div>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="pos-card p-3 sm:p-4 space-y-3 sm:space-y-4 group border-2 border-transparent hover:border-primary/10 transition-all animate-in slide-in-from-right duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <CartItemImage product={item.product} />
                  <div className="absolute -top-2 -right-2 h-5 w-5 rounded-lg bg-primary text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-soft">
                    {item.quantity}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate group-hover:text-primary transition-colors">
                    {item.product.name}
                  </p>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                    {formatPrice(item.unit_price)} c/u
                  </p>
                  {item.notes && (
                    <p className="text-[11px] font-bold text-primary italic mt-1 leading-tight">
                      “{item.notes}”
                    </p>
                  )}
                </div>
                <p className="font-black text-sm tabular-nums text-primary">
                  {formatPrice(item.unit_price * item.quantity)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-dashed border-accent">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-2 shadow-soft hover:text-primary transition-all"
                  onClick={() => {
                    onEditItem(item);
                    setCartOpen(false);
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1.5 bg-accent/50 p-1 rounded-2xl border border-accent shadow-inner">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-xl hover:bg-white transition-all"
                    onClick={() => updateQuantity(item.id, -1)}
                  >
                    {item.quantity === 1 ? (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    ) : (
                      <Minus className="h-4 w-4 font-black" />
                    )}
                  </Button>
                  <span className="w-8 text-center font-black text-sm tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-xl hover:bg-white transition-all"
                    onClick={() => updateQuantity(item.id, 1)}
                  >
                    <Plus className="h-4 w-4 font-black text-primary" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="p-4 sm:p-8 border-t-2 border-dashed border-accent space-y-4 sm:space-y-6 bg-white/80 backdrop-blur-md">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Subtotal Items</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary leading-none mb-1">
                  Total del Pedido
                </p>
                <p className="text-2xl sm:text-3xl font-black tracking-tighter text-primary">
                  {formatPrice(total)}
                </p>
              </div>
              <p className="text-[10px] font-black text-muted-foreground bg-accent/50 px-2 py-1 rounded-lg">
                {itemCount} {itemCount === 1 ? "ARTÍCULO" : "ARTÍCULOS"}
              </p>
            </div>
          </div>

          <Button
            size="xl"
            className="w-full h-12 sm:h-16 rounded-2xl font-black text-sm sm:text-lg shadow-strong hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group"
            onClick={() => {
              setStep("confirm");
              setCartOpen(false);
            }}
          >
            REVISAR PEDIDO
            <ArrowRight className="h-6 w-6 ml-3 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
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
