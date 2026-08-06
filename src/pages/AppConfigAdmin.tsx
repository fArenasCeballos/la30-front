import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { toast } from "sonner";
import { Smartphone, Flame, Ticket, Clock, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Category, Product, Combo, Coupon } from "@/types";

export default function AppConfigAdmin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("catalog");

  // ─── Fetch Categories & Products ────────────────────────────
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["admin-app-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Category[];
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["admin-app-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  // ─── Fetch Combos ───────────────────────────────────────────
  const { data: combos = [] } = useQuery<Combo[]>({
    queryKey: ["admin-app-combos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Combo[];
    },
  });

  // ─── Fetch Coupons ──────────────────────────────────────────
  const { data: coupons = [] } = useQuery<Coupon[]>({
    queryKey: ["admin-app-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Coupon[];
    },
  });

  // ─── Mutations for Catalog Toggles ──────────────────────────
  const toggleProductMutation = useMutation({
    mutationFn: async ({
      id,
      available,
    }: {
      id: string;
      available: boolean;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ available })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-app-products"] });
      toast.success("Estado del producto actualizado");
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("categories")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-app-categories"] });
      toast.success("Estado de categoría actualizado");
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  // ─── New Combo Modal State ──────────────────────────────────
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [comboName, setComboName] = useState("");
  const [comboDesc, setComboDesc] = useState("");
  const [comboPrice, setComboPrice] = useState("");
  const [comboOriginalPrice, setComboOriginalPrice] = useState("");
  const [comboImageUrl, setComboImageUrl] = useState("");

  const createComboMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("combos").insert({
        name: comboName,
        description: comboDesc || null,
        combo_price: parseInt(comboPrice, 10) || 0,
        original_price:
          parseInt(comboOriginalPrice, 10) || parseInt(comboPrice, 10) || 0,
        image_url: comboImageUrl || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-app-combos"] });
      toast.success("Combo creado exitosamente");
      setComboModalOpen(false);
      setComboName("");
      setComboDesc("");
      setComboPrice("");
      setComboOriginalPrice("");
      setComboImageUrl("");
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  // ─── New Coupon Modal State ─────────────────────────────────
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<
    "percentage" | "fixed"
  >("percentage");
  const [couponDiscountValue, setCouponDiscountValue] = useState("");
  const [couponMinTotal, setCouponMinTotal] = useState("");

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coupons").insert({
        code: couponCode.toUpperCase().trim(),
        discount_type: couponDiscountType,
        discount_value: parseInt(couponDiscountValue, 10) || 0,
        min_order_total: parseInt(couponMinTotal, 10) || 0,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-app-coupons"] });
      toast.success("Cupón creado exitosamente");
      setCouponModalOpen(false);
      setCouponCode("");
      setCouponDiscountValue("");
      setCouponMinTotal("");
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-orange-500 to-amber-500 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <Smartphone className="w-8 h-8" />
            Configuración de la App Móvil
          </h1>
          <p className="text-orange-100 text-sm mt-1">
            Administra los productos, categorías, combos promocionales y cupones
            visibles en la30-app.
          </p>
        </div>

        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none text-xs px-3 py-1.5 backdrop-blur-md">
          Sincronizado en Tiempo Real ⚡
        </Badge>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 bg-muted/60 p-1.5 rounded-2xl h-14">
          <TabsTrigger
            value="catalog"
            className="rounded-xl font-bold gap-2 text-xs sm:text-sm"
          >
            <Smartphone className="w-4 h-4 text-orange-500" />
            Catálogo App
          </TabsTrigger>
          <TabsTrigger
            value="combos"
            className="rounded-xl font-bold gap-2 text-xs sm:text-sm"
          >
            <Flame className="w-4 h-4 text-red-500" />
            Combos Promocionales
          </TabsTrigger>
          <TabsTrigger
            value="coupons"
            className="rounded-xl font-bold gap-2 text-xs sm:text-sm"
          >
            <Ticket className="w-4 h-4 text-purple-500" />
            Cupones Descuento
          </TabsTrigger>
          <TabsTrigger
            value="hours"
            className="rounded-xl font-bold gap-2 text-xs sm:text-sm"
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            Horarios App
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: CATÁLOGO APP ────────────────────────────────── */}
        <TabsContent value="catalog" className="mt-6 space-y-6">
          {/* Categories Manager */}
          <div className="bg-card rounded-2xl p-5 border shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Categorías Visibles en la App
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3.5 bg-muted/30 border rounded-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl">{cat.icon || "📦"}</span>
                    <span className="font-bold text-sm truncate">
                      {cat.label || cat.name}
                    </span>
                  </div>
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={(checked) =>
                      toggleCategoryMutation.mutate({
                        id: cat.id,
                        is_active: checked,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-card rounded-2xl p-5 border shadow-sm">
            <h2 className="text-lg font-bold mb-4">
              Productos en la App Móvil
            </h2>

            <div className="space-y-3">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/20 border rounded-2xl gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-14 h-14 rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
                        🍔
                      </div>
                    )}

                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {prod.description || "Sin descripción"}
                      </p>
                      <span className="font-black text-sm text-orange-600 mt-1 block">
                        {formatPrice(prod.price)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {prod.available ? "Visible en App" : "Oculto"}
                      </span>
                      <Switch
                        checked={prod.available}
                        onCheckedChange={(checked) =>
                          toggleProductMutation.mutate({
                            id: prod.id,
                            available: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: COMBOS PROMOCIONALES ────────────────────────── */}
        <TabsContent value="combos" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Combos Activos para la App</h2>

            <Dialog open={comboModalOpen} onOpenChange={setComboModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Nuevo Combo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="font-black text-lg">
                    Crear Nuevo Combo
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-xs font-bold mb-1 block">
                      Nombre del Combo
                    </label>
                    <Input
                      placeholder="Ej: Combo Pareja La 30 🔥"
                      value={comboName}
                      onChange={(e) => setComboName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block">
                      Descripción
                    </label>
                    <Input
                      placeholder="Ej: 2 Hamburguesas + 1 Papas + 2 Gaseosas"
                      value={comboDesc}
                      onChange={(e) => setComboDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold mb-1 block">
                        Precio Combo ($)
                      </label>
                      <Input
                        placeholder="52900"
                        type="number"
                        value={comboPrice}
                        onChange={(e) => setComboPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">
                        Precio Original ($)
                      </label>
                      <Input
                        placeholder="64700"
                        type="number"
                        value={comboOriginalPrice}
                        onChange={(e) => setComboOriginalPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block">
                      URL de Imagen (Opcional)
                    </label>
                    <Input
                      placeholder="https://..."
                      value={comboImageUrl}
                      onChange={(e) => setComboImageUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700 font-bold rounded-xl mt-2"
                    onClick={() => createComboMutation.mutate()}
                    disabled={
                      createComboMutation.isPending || !comboName || !comboPrice
                    }
                  >
                    {createComboMutation.isPending
                      ? "Guardando..."
                      : "Guardar Combo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {combos.map((c) => (
              <div
                key={c.id}
                className="bg-card rounded-2xl p-5 border shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-lg">{c.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.description}
                    </p>
                  </div>
                  <Badge className="bg-red-100 text-red-700 font-bold border-none text-xs">
                    🔥 Combo
                  </Badge>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <span className="text-xs text-muted-foreground line-through mr-2">
                      {formatPrice(c.original_price)}
                    </span>
                    <span className="font-black text-lg text-red-600">
                      {formatPrice(c.combo_price)}
                    </span>
                  </div>
                  <Switch checked={c.is_active} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB 3: CUPONES DESCUENTO ───────────────────────────── */}
        <TabsContent value="coupons" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Cupones de Descuento</h2>

            <Dialog open={couponModalOpen} onOpenChange={setCouponModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Nuevo Cupón
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="font-black text-lg">
                    Crear Nuevo Cupón
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-xs font-bold mb-1 block">
                      Código del Cupón
                    </label>
                    <Input
                      placeholder="Ej: LA30APP"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold mb-1 block">
                        Tipo Descuento
                      </label>
                      <select
                        className="w-full h-10 border rounded-xl px-3 text-sm font-semibold bg-background"
                        value={couponDiscountType}
                        onChange={(e) =>
                          setCouponDiscountType(
                            e.target.value as "percentage" | "fixed",
                          )
                        }
                      >
                        <option value="percentage">Porcentaje (%)</option>
                        <option value="fixed">Monto Fijo ($ COP)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">
                        Valor Descuento
                      </label>
                      <Input
                        placeholder={
                          couponDiscountType === "percentage"
                            ? "15 (para 15%)"
                            : "5000"
                        }
                        type="number"
                        value={couponDiscountValue}
                        onChange={(e) => setCouponDiscountValue(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block">
                      Monto Mínimo de Pedido ($)
                    </label>
                    <Input
                      placeholder="30000"
                      type="number"
                      value={couponMinTotal}
                      onChange={(e) => setCouponMinTotal(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 font-bold rounded-xl mt-2"
                    onClick={() => createCouponMutation.mutate()}
                    disabled={
                      createCouponMutation.isPending ||
                      !couponCode ||
                      !couponDiscountValue
                    }
                  >
                    {createCouponMutation.isPending
                      ? "Guardando..."
                      : "Guardar Cupón"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {coupons.map((coup) => (
              <div
                key={coup.id}
                className="bg-card rounded-2xl p-5 border shadow-sm space-y-2"
              >
                <div className="flex justify-between items-center">
                  <Badge className="bg-purple-100 text-purple-700 font-black text-sm tracking-wider px-3 py-1">
                    🎟️ {coup.code}
                  </Badge>
                  <Switch checked={coup.is_active} />
                </div>
                <p className="font-black text-xl text-purple-700 pt-2">
                  {coup.discount_type === "percentage"
                    ? `${coup.discount_value}% OFF`
                    : `-${formatPrice(coup.discount_value)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Mínimo pedido: {formatPrice(coup.min_order_total || 0)}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB 4: HORARIOS DE ATENCIÓN ────────────────────────── */}
        <TabsContent value="hours" className="mt-6 space-y-6">
          <div className="bg-card rounded-2xl p-6 border shadow-sm space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Horarios de Operación de la App Móvil
            </h2>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs font-semibold text-emerald-800">
              ⚡ Horario de atención por defecto en Pereira:{" "}
              <strong>4:00 PM a 4:00 AM</strong>. Los pedidos fuera de este
              rango mostrarán aviso de tienda cerrada.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
                "Domingo",
              ].map((day, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-muted/20 border rounded-xl"
                >
                  <span className="font-bold text-sm">{day}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      4:00 PM - 4:00 AM
                    </span>
                    <Switch defaultChecked />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
