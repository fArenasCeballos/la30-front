import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import { supabase } from "@/lib/supabase";
import {
  getRawMaterials,
  getRecipesForProduct,
  upsertRecipe,
  deleteRecipe,
  getMaterialCategories,
} from "@/lib/inventoryService";
import { getCompatibleUnits, convertToBase } from "@/lib/unitConversions";
import { formatPrice } from "@/lib/formatPrice";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Search,
  UtensilsCrossed,
  X,
  Loader2,
  Package,
  TrendingUp,
  DollarSign,
  Coins,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function RecipesTab() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");

  const [formData, setFormData] = useState({
    raw_material_id: "",
    unit_id: "",
    quantity_required: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [activeProductCategoryId, setActiveProductCategoryId] = useState<string>("");
  const [activeMaterialCategoryId, setActiveMaterialCategoryId] = useState<string>("");

  // 1. Obtener productos del catálogo
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["catalog_products", activeStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, available, category_id, categories(name)")
        .contains("store_ids", [activeStore!.id])
        .eq("available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!activeStore?.id,
  });

  const { data: productCategories = [] } = useQuery({
    queryKey: ["product_categories", activeStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .contains("store_ids", [activeStore!.id])
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!activeStore?.id,
  });

  const { data: materialCategories = [] } = useQuery({
    queryKey: ["material_categories", activeStore?.id],
    queryFn: () => getMaterialCategories(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeProductCategoryId
      ? p.category_id === activeProductCategoryId
      : true;
    return matchSearch && matchCat;
  });

  const effectiveSelectedProductId =
    selectedProductId || (filteredProducts[0]?.id ?? "");

  // 2. Obtener insumos
  const { data: materials = [] } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  // 3. Obtener recetas para el producto seleccionado
  const { data: recipes = [], isLoading: isLoadingRecipes } = useQuery({
    queryKey: ["recipes", effectiveSelectedProductId],
    queryFn: () => getRecipesForProduct(effectiveSelectedProductId),
    enabled: !!effectiveSelectedProductId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const baseQty = convertToBase(
        Number(formData.quantity_required),
        formData.unit_id,
      );
      return upsertRecipe({
        product_id: effectiveSelectedProductId,
        raw_material_id: formData.raw_material_id,
        quantity_required: baseQty,
      });
    },
    onSuccess: () => {
      toast.success("Ingrediente agregado a la ficha técnica");
      queryClient.invalidateQueries({
        queryKey: ["recipes", effectiveSelectedProductId],
      });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (raw_material_id: string) =>
      deleteRecipe(effectiveSelectedProductId, raw_material_id),
    onSuccess: () => {
      toast.success("Ingrediente removido de la receta");
      queryClient.invalidateQueries({
        queryKey: ["recipes", effectiveSelectedProductId],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.raw_material_id || !formData.quantity_required) {
      toast.error("Selecciona un insumo y digita la cantidad requerida");
      return;
    }
    saveMutation.mutate();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ raw_material_id: "", unit_id: "", quantity_required: "" });
    setIngredientSearch("");
    setIsDropdownOpen(false);
  };

  const filteredMaterials = materials.filter((m) => {
    const matchCat = activeMaterialCategoryId
      ? m.category_id === activeMaterialCategoryId
      : true;
    const matchSearch = m.name
      .toLowerCase()
      .includes(ingredientSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const selectedProduct = filteredProducts.find(
    (p) => p.id === effectiveSelectedProductId,
  );

  const totalRecipeCost = useMemo(() => {
    return recipes.reduce((sum, r) => {
      const costPerUnit = Number(r.raw_materials?.cost_per_unit || 0);
      const qty = Number(r.quantity_required || 0);
      return sum + qty * costPerUnit;
    }, 0);
  }, [recipes]);

  const productPrice = Number(selectedProduct?.price || 0);
  const grossProfit = productPrice - totalRecipeCost;
  const profitMargin = productPrice > 0 ? (grossProfit / productPrice) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Selector de Producto (Lado Izquierdo) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[500px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-600" />
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Platos del Menú
            </h3>
          </div>
          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {filteredProducts.length}
          </span>
        </div>

        <div className="p-3.5 flex-1 flex flex-col min-h-0 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto..."
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <select
              value={activeProductCategoryId}
              onChange={(e) => setActiveProductCategoryId(e.target.value)}
              className="w-full h-8 px-2.5 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {productCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
            {isLoadingProducts ? (
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No se encontraron productos.
              </p>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = effectiveSelectedProductId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProductId(p.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all cursor-pointer",
                      isSelected
                        ? "border-teal-600 bg-teal-50/60 shadow-2xs text-teal-950"
                        : "border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60 text-slate-800",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-bold text-xs truncate">{p.name}</div>
                      <span className="text-[10px] font-black text-slate-600 shrink-0">
                        {formatPrice(p.price || 0)}
                      </span>
                    </div>
                    {p.categories?.name && (
                      <div className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 tracking-wider">
                        {p.categories.name}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Receta y Acciones (Lado Derecho) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedProduct ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[500px]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600">
                  <UtensilsCrossed className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Ficha técnica de ingredientes, inversión y rentabilidad
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setIsModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                <span>Agregar Ingrediente</span>
              </Button>
            </div>

            {/* Financial Comparison Summary Ribbon */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Costo Inversión */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Coins className="size-3 text-amber-500" />
                  Inversión Receta
                </span>
                <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {formatPrice(totalRecipeCost)}
                </p>
                <span className="text-[9px] text-slate-400 font-medium">
                  Costo de insumos
                </span>
              </div>

              {/* Precio Venta */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <DollarSign className="size-3 text-blue-500" />
                  Precio Venta
                </span>
                <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {formatPrice(productPrice)}
                </p>
                <span className="text-[9px] text-slate-400 font-medium">
                  Carta / Menú
                </span>
              </div>

              {/* Ganancia Bruta */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-500" />
                  Ganancia Bruta
                </span>
                <p
                  className={cn(
                    "text-base sm:text-lg font-black mt-0.5",
                    grossProfit >= 0 ? "text-emerald-700" : "text-rose-600",
                  )}
                >
                  {formatPrice(grossProfit)}
                </p>
                <span className="text-[9px] text-slate-400 font-medium">
                  Por unidad vendida
                </span>
              </div>

              {/* Margen % */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Percent className="size-3 text-purple-500" />
                  Rentabilidad
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "text-base sm:text-lg font-black",
                      profitMargin >= 50
                        ? "text-emerald-700"
                        : profitMargin >= 30
                          ? "text-amber-600"
                          : "text-rose-600",
                    )}
                  >
                    {productPrice > 0 ? `${profitMargin.toFixed(1)}%` : "0%"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-black uppercase px-1.5 py-0.2 rounded",
                      profitMargin >= 50
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : profitMargin >= 30
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200",
                    )}
                  >
                    {profitMargin >= 50
                      ? "Óptimo"
                      : profitMargin >= 30
                        ? "Moderado"
                        : "Bajo"}
                  </Badge>
                </div>
                <span className="text-[9px] text-slate-400 font-medium">
                  Margen sobre venta
                </span>
              </div>
            </div>

            {/* List of Ingredients */}
            <div className="flex-1 p-4 sm:p-5">
              {isLoadingRecipes ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mb-2" />
                  <span className="text-xs font-medium">Cargando receta...</span>
                </div>
              ) : recipes.length === 0 ? (
                <div className="text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-8 max-w-md mx-auto my-8">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700 text-sm">
                    Sin ingredientes configurados
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Agrega los insumos que componen este plato para que se
                    descuenten del stock automáticamente en cada venta y se calcule su costo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recipes.map((recipe) => {
                    const costPerUnit = Number(
                      recipe.raw_materials?.cost_per_unit || 0,
                    );
                    const qty = Number(recipe.quantity_required || 0);
                    const subtotalCost = qty * costPerUnit;

                    return (
                      <div
                        key={recipe.id}
                        className="flex items-center justify-between p-3.5 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 hover:shadow-2xs transition-all"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-slate-900 text-xs truncate">
                              {recipe.raw_materials?.name}
                            </h4>
                            <span className="text-xs font-black text-slate-800 tabular-nums">
                              {formatPrice(subtotalCost)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mt-1">
                            <span>
                              Consumo:{" "}
                              <strong className="text-teal-700 font-bold">
                                {recipe.quantity_required}{" "}
                                {recipe.raw_materials?.unit}
                              </strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {formatPrice(costPerUnit)} / {recipe.raw_materials?.unit}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Quitar este ingrediente de la receta?",
                              )
                            ) {
                              deleteMutation.mutate(recipe.raw_material_id);
                            }
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                          title="Quitar ingrediente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] bg-white border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-bold text-slate-700 text-sm">
              Selecciona un producto
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Selecciona un plato o bebida para configurar su ficha técnica de
              insumos.
            </p>
          </div>
        )}
      </div>

      {/* Modal Agregar a Receta */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Agregar a Receta
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedProduct.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Filtrar Categoría de Insumo
                </label>
                <select
                  value={activeMaterialCategoryId}
                  onChange={(e) => setActiveMaterialCategoryId(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500/30 text-slate-700"
                >
                  <option value="">Todas las categorías</option>
                  {materialCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-700">
                  Insumo / Materia Prima *
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required={!formData.raw_material_id}
                    value={
                      formData.raw_material_id
                        ? materials.find(
                            (m) => m.id === formData.raw_material_id,
                          )?.name || ""
                        : ingredientSearch
                    }
                    onChange={(e) => {
                      setIngredientSearch(e.target.value);
                      if (formData.raw_material_id) {
                        setFormData((p) => ({
                          ...p,
                          raw_material_id: "",
                          unit_id: "",
                        }));
                      }
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsDropdownOpen(false), 200);
                    }}
                    placeholder="Escribe el nombre del insumo..."
                    className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto no-scrollbar py-1">
                      {filteredMaterials.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 text-center">
                          No se encontraron coincidencias
                        </div>
                      ) : (
                        filteredMaterials.map((m) => (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => {
                              setFormData((p) => ({
                                ...p,
                                raw_material_id: m.id,
                                unit_id: m.unit,
                              }));
                              setIngredientSearch("");
                              setIsDropdownOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-800">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              ({m.unit})
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {formData.raw_material_id && (
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Unidad de Medida *
                    </label>
                    <select
                      value={formData.unit_id}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, unit_id: e.target.value }))
                      }
                      className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      {getCompatibleUnits(
                        materials.find(
                          (m) => m.id === formData.raw_material_id,
                        )?.unit || "",
                      ).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label} ({u.short})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Cantidad Requerida *
                    </label>
                    <Input
                      required
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={formData.quantity_required}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          quantity_required: e.target.value,
                        }))
                      }
                      className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                      placeholder="Ej: 150"
                    />
                  </div>

                  <div className="col-span-2 bg-teal-50/60 p-3 rounded-xl border border-teal-200/50">
                    <p className="text-[11px] text-teal-900 font-medium leading-relaxed">
                      Se descontarán{" "}
                      <strong className="font-bold text-teal-700">
                        {formData.quantity_required || 0} {formData.unit_id}
                      </strong>{" "}
                      del inventario central por cada unidad de{" "}
                      <strong className="font-bold text-slate-800">
                        {selectedProduct.name}
                      </strong>{" "}
                      vendida.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1 h-11 rounded-xl text-xs font-semibold border-slate-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending || !formData.raw_material_id}
                  className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {saveMutation.isPending ? "Guardando..." : "Guardar Ingrediente"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
