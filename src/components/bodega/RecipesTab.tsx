import React, { useState } from "react";
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
import { toast } from "sonner";
import { Plus, Trash2, Search, UtensilsCrossed, Filter } from "lucide-react";

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
        .select("id, name, available, category_id, categories(name)")
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
    const matchCat = activeProductCategoryId ? p.category_id === activeProductCategoryId : true;
    return matchSearch && matchCat;
  });

  // 2. Obtener insumos
  const { data: materials = [] } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  // 3. Obtener recetas para el producto seleccionado
  const { data: recipes = [], isLoading: isLoadingRecipes } = useQuery({
    queryKey: ["recipes", selectedProductId],
    queryFn: () => getRecipesForProduct(selectedProductId),
    enabled: !!selectedProductId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const baseQty = convertToBase(
        Number(formData.quantity_required),
        formData.unit_id,
      );
      return upsertRecipe({
        product_id: selectedProductId,
        raw_material_id: formData.raw_material_id,
        quantity_required: baseQty,
      });
    },
    onSuccess: () => {
      toast.success("Ingrediente guardado en la receta");
      queryClient.invalidateQueries({
        queryKey: ["recipes", selectedProductId],
      });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (rawMaterialId: string) =>
      deleteRecipe(selectedProductId, rawMaterialId),
    onSuccess: () => {
      toast.success("Ingrediente eliminado de la receta");
      queryClient.invalidateQueries({
        queryKey: ["recipes", selectedProductId],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !formData.raw_material_id) return;
    saveMutation.mutate();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDropdownOpen(false);
    setIngredientSearch("");
    setFormData({
      raw_material_id: "",
      unit_id: "",
      quantity_required: "",
    });
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const filteredMaterials = materials.filter((m) => {
    const matchCat = activeMaterialCategoryId ? m.category_id === activeMaterialCategoryId : true;
    const matchSearch = ingredientSearch ? m.name.toLowerCase().includes(ingredientSearch.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Selector de Producto (Lado Izquierdo) */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-6 border rounded-2xl shadow-sm flex flex-col h-full max-h-[800px]">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 shrink-0">
            Seleccionar Producto
          </h3>
          
          <div className="space-y-3 mb-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={activeProductCategoryId}
                onChange={(e) => setActiveProductCategoryId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-slate-600"
              >
                <option value="">Todas las categorías</option>
                {productCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto premium-scrollbar pr-2 space-y-2">
            {isLoadingProducts ? (
              <p className="text-sm text-slate-400">Cargando catálogo...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No se encontraron productos.</p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedProductId === p.id
                      ? "border-primary bg-primary/5 shadow-sm text-primary"
                      : "border-slate-100 hover:border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <div className="font-bold">{p.name}</div>
                  {p.categories?.name && (
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                      {p.categories.name}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Receta y Acciones (Lado Derecho) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedProduct ? (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Receta del Producto
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                  {selectedProduct.name}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm font-bold text-sm"
              >
                <Plus className="h-4 w-4" />
                Agregar Ingrediente
              </button>
            </div>

            <div className="flex-1 p-6">
              {isLoadingRecipes ? (
                <p className="text-center text-slate-400 my-8">
                  Cargando receta...
                </p>
              ) : recipes.length === 0 ? (
                <div className="text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8">
                  <p className="text-slate-500 font-medium">
                    Este producto no tiene ingredientes configurados.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Agrega insumos para que se descuenten automáticamente al
                    vender.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-primary/30 transition-all shadow-sm"
                    >
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">
                          {recipe.raw_materials?.name}
                        </h4>
                        <p className="text-xs font-semibold text-slate-500 uppercase mt-0.5">
                          Insumo
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-black text-primary">
                            {recipe.quantity_required}
                            <span className="text-sm font-bold text-slate-400 ml-1 uppercase">
                              {recipe.raw_materials?.unit}
                            </span>
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Consumo por unidad
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Quitar este ingrediente de la receta?",
                              )
                            ) {
                              deleteMutation.mutate(recipe.raw_material_id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm">
              Selecciona un producto
            </p>
            <p className="text-xs mt-2">
              Para ver y editar su receta (componentes para descuento de stock)
            </p>
          </div>
        )}
      </div>

      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-800">
                  Agregar a Receta
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
                  {selectedProduct.name}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Categoría del Insumo
                </label>
                <select
                  value={activeMaterialCategoryId}
                  onChange={(e) => setActiveMaterialCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-600"
                >
                  <option value="">Todas las categorías</option>
                  {materialCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Insumo (Materia Prima)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required={!formData.raw_material_id}
                    value={
                      formData.raw_material_id
                        ? materials.find((m) => m.id === formData.raw_material_id)?.name || ""
                        : ingredientSearch
                    }
                    onChange={(e) => {
                      setIngredientSearch(e.target.value);
                      if (formData.raw_material_id) {
                        setFormData((p) => ({ ...p, raw_material_id: "", unit_id: "" }));
                      }
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => {
                      // Small delay to allow click on dropdown items
                      setTimeout(() => setIsDropdownOpen(false), 200);
                    }}
                    placeholder="Escribe para buscar..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto premium-scrollbar py-1">
                      {filteredMaterials.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">
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
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="font-bold text-slate-700">{m.name}</span>
                            <span className="ml-1.5 text-xs text-slate-400 uppercase">({m.unit})</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {formData.raw_material_id && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Unidad de Medida
                    </label>
                    <select
                      value={formData.unit_id}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, unit_id: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {getCompatibleUnits(
                        materials.find((m) => m.id === formData.raw_material_id)
                          ?.unit || "",
                      ).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label} ({u.short})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Cantidad Requerida
                    </label>
                    <input
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
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Ej: 150"
                    />
                  </div>

                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Se descontarán{" "}
                      <strong className="text-primary">
                        {formData.quantity_required || 0} {formData.unit_id}
                      </strong>{" "}
                      del stock general por cada unidad de{" "}
                      <strong className="text-slate-600">
                        {selectedProduct.name}
                      </strong>{" "}
                      vendida.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || !formData.raw_material_id}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  Guardar Ingrediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
