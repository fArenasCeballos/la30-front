import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import {
  getRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deactivateRawMaterial,
  getMaterialCategories,
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
} from "@/lib/inventoryService";
import type {
  RawMaterial,
  RawMaterialInsert,
  RawMaterialUpdate,
  RawMaterialCategory,
} from "@/types";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  FolderPlus,
  X,
  Scale,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getBaseUnits } from "@/lib/unitConversions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Preset colours for categories ──────────────────────────────────────────
const PRESET_COLORS = [
  "#0d9488", "#0284c7", "#6366f1", "#8b5cf6",
  "#d97706", "#ea580c", "#e11d48", "#16a34a",
  "#475569", "#059669",
];

// ─── CategoryBadge ───────────────────────────────────────────────────────────
function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs"
      style={{ backgroundColor: color }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
      <span>{name}</span>
    </span>
  );
}

export function RawMaterialsTab() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "ok">("all");

  // ─── Insumo modal ─────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    unit: "g",
    category_id: "",
    min_stock: "",
    current_stock: "",
    cost_per_unit: "",
  });

  // ─── Categorías modal ─────────────────────────────────────────────────────
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<RawMaterialCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", color: PRESET_COLORS[0] });

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["material_categories", activeStore?.id],
    queryFn: () => getMaterialCategories(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategoryId
      ? m.category_id === activeCategoryId
      : true;
    const isLow = m.current_stock <= m.min_stock;
    const matchStock =
      stockFilter === "all"
        ? true
        : stockFilter === "low"
          ? isLow
          : !isLow;

    return matchSearch && matchCat && matchStock;
  });

  const lowStockCount = materials.filter((m) => m.current_stock <= m.min_stock).length;

  // ─── Mutations: Insumos ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: RawMaterialInsert) => createRawMaterial(data),
    onSuccess: () => {
      toast.success("Insumo registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RawMaterialUpdate }) =>
      updateRawMaterial(id, data),
    onSuccess: () => {
      toast.success("Insumo actualizado");
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deactivateRawMaterial(id),
    onSuccess: () => {
      toast.success("Insumo eliminado");
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Mutations: Categorías ────────────────────────────────────────────────
  const createCatMutation = useMutation({
    mutationFn: () =>
      createMaterialCategory({
        store_id: activeStore!.id,
        name: catForm.name,
        color: catForm.color,
      }),
    onSuccess: () => {
      toast.success("Categoría creada");
      queryClient.invalidateQueries({ queryKey: ["material_categories"] });
      closeCatModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCatMutation = useMutation({
    mutationFn: () =>
      updateMaterialCategory(editingCat!.id, {
        name: catForm.name,
        color: catForm.color,
      }),
    onSuccess: () => {
      toast.success("Categoría actualizada");
      queryClient.invalidateQueries({ queryKey: ["material_categories"] });
      closeCatModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => deleteMaterialCategory(id),
    onSuccess: () => {
      toast.success("Categoría eliminada");
      queryClient.invalidateQueries({ queryKey: ["material_categories"] });
      if (activeCategoryId === editingCat?.id) setActiveCategoryId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Handlers: Insumos ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    const payload = {
      name: formData.name.trim(),
      unit: formData.unit,
      category_id: formData.category_id || null,
      min_stock: Number(formData.min_stock) || 0,
      cost_per_unit: Number(formData.cost_per_unit) || 0,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate({
        store_id: activeStore.id,
        ...payload,
        current_stock: Number(formData.current_stock) || 0,
      });
    }
  };

  const openModal = (item?: RawMaterial) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        unit: item.unit,
        category_id: item.category_id ?? "",
        min_stock: String(item.min_stock),
        current_stock: String(item.current_stock),
        cost_per_unit: item.cost_per_unit != null ? String(item.cost_per_unit) : "0",
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        unit: "g",
        category_id: activeCategoryId ?? "",
        min_stock: "",
        current_stock: "",
        cost_per_unit: "",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // ─── Handlers: Categorías ─────────────────────────────────────────────────
  const openCatModal = (cat?: RawMaterialCategory) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, color: cat.color });
    } else {
      setEditingCat(null);
      setCatForm({ name: "", color: PRESET_COLORS[0] });
    }
    setIsCatModalOpen(true);
  };

  const closeCatModal = () => {
    setIsCatModalOpen(false);
    setEditingCat(null);
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCat) updateCatMutation.mutate();
    else createCatMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="font-semibold text-xs text-slate-500">
          Cargando inventario de insumos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Modern Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors"
              strokeWidth={2}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar insumo (ej: carne, queso, pan)..."
              className="pl-9.5 pr-9 h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm transition-all focus-visible:ring-1 focus-visible:ring-teal-500/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick status filters & Action button */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {/* Status pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  stockFilter === "all"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                Todos ({materials.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("low")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  stockFilter === "low"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "text-rose-600 hover:bg-rose-50",
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Bajo Stock ({lowStockCount})</span>
              </button>
            </div>

            <Button
              onClick={() => openModal()}
              className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Nuevo Insumo</span>
            </Button>
          </div>
        </div>

        {/* Category Filter Chips Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveCategoryId(null)}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer",
              activeCategoryId === null
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
            )}
          >
            Todas las categorías
          </button>

          {categories.map((cat) => {
            const count = materials.filter((m) => m.category_id === cat.id).length;
            const isSelected = activeCategoryId === cat.id;
            return (
              <div key={cat.id} className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setActiveCategoryId(isSelected ? null : cat.id)
                  }
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer",
                    isSelected
                      ? "text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200/70",
                  )}
                  style={isSelected ? { backgroundColor: cat.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? "#fff" : cat.color }}
                  />
                  <span>{cat.name}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {count}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => openCatModal(cat)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Editar categoría"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => openCatModal()}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-slate-300 text-slate-500 hover:text-teal-600 hover:border-teal-500 hover:bg-teal-50/50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Nueva Categoría</span>
          </button>
        </div>
      </div>

      {/* Responsive View: Desktop Table + Mobile/Tablet Cards */}

      {/* ── Mobile / Tablet Cards View (hidden on xl screens) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 xl:hidden">
        {filtered.map((item) => {
          const isLow = item.current_stock <= item.min_stock;
          const ratio =
            item.min_stock > 0
              ? Math.min(Math.round((item.current_stock / item.min_stock) * 100), 200)
              : 100;
          return (
            <div
              key={item.id}
              className={cn(
                "bg-white rounded-2xl border p-4 transition-all duration-200 shadow-xs flex flex-col justify-between space-y-3",
                isLow
                  ? "border-rose-200 bg-rose-50/20"
                  : "border-slate-200/80 hover:border-slate-300",
              )}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {item.name}
                  </h4>
                  {isLow ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      Stock Bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Normal
                    </span>
                  )}
                </div>

                {item.raw_material_categories && (
                  <CategoryBadge
                    name={item.raw_material_categories.name}
                    color={item.raw_material_categories.color}
                  />
                )}
              </div>

              {/* Stock Numbers & Visual Meter */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-500 font-medium">Stock Actual:</span>
                  <span
                    className={cn(
                      "font-bold text-base",
                      isLow ? "text-rose-600" : "text-slate-900",
                    )}
                  >
                    {item.current_stock} {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Mínimo requerido:</span>
                  <span className="font-semibold text-slate-600">
                    {item.min_stock} {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Costo Base:</span>
                  <span className="font-bold text-teal-700">
                    ${Number(item.cost_per_unit || 0).toLocaleString("es-CO")} / {item.unit}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isLow ? "bg-rose-500" : "bg-teal-500",
                    )}
                    style={{ width: `${Math.min(ratio, 100)}%` }}
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openModal(item)}
                  className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  <span>Editar</span>
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("¿Seguro que deseas eliminar este insumo?")) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop Table View (visible on xl+ screens) ── */}
      <div className="hidden xl:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] uppercase font-bold tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Insumo</th>
                <th className="px-6 py-3.5">Categoría</th>
                <th className="px-6 py-3.5">Unidad Base</th>
                <th className="px-6 py-3.5 text-right">Costo Base</th>
                <th className="px-6 py-3.5 text-right">Stock Mínimo</th>
                <th className="px-6 py-3.5 text-right">Stock Actual</th>
                <th className="px-6 py-3.5 text-center">Estado</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const isLow = item.current_stock <= item.min_stock;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4">
                      {item.raw_material_categories ? (
                        <CategoryBadge
                          name={item.raw_material_categories.name}
                          color={item.raw_material_categories.color}
                        />
                      ) : (
                        <span className="text-xs text-slate-300 font-medium">
                          Sin categoría
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-semibold text-xs uppercase">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-teal-700 text-xs">
                      ${Number(item.cost_per_unit || 0).toLocaleString("es-CO")} <span className="text-slate-400 font-normal">/ {item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-500">
                      {item.min_stock} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">
                      <span
                        className={
                          isLow
                            ? "text-rose-600 font-black text-base"
                            : "text-slate-900 text-base"
                        }
                      >
                        {item.current_stock} {item.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isLow ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold shadow-2xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Stock Bajo</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Normal</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openModal(item)}
                          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Seguro que deseas eliminar este insumo?",
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <Scale className="h-7 w-7" />
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="font-bold text-slate-800 text-base">
              No se encontraron insumos
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activeCategoryId
                ? "No hay insumos asignados a la categoría seleccionada."
                : "No hay materias primas que coincidan con la búsqueda o filtro."}
            </p>
          </div>
          {(searchTerm || activeCategoryId || stockFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setActiveCategoryId(null);
                setStockFilter("all");
              }}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Restablecer filtros
            </Button>
          )}
        </div>
      )}

      {/* ── Modal: Insumo ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Scale className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {editingItem ? "Editar Insumo" : "Nuevo Insumo"}
                </h3>
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
                  Nombre del Insumo *
                </label>
                <Input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
                  placeholder="Ej: Carne de Res Molida Premium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Categoría
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, category_id: e.target.value }))
                  }
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Unidad Base *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit: e.target.value }))
                    }
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {getBaseUnits().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} ({u.short})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-slate-400" />
                    <span>Stock Mínimo</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.min_stock}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        min_stock: e.target.value,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Costo Unitario de Referencia ($)</span>
                  <span className="text-[10px] text-teal-600 font-medium">
                    Por cada {formData.unit || "unidad"}
                  </span>
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.cost_per_unit}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      cost_per_unit: e.target.value,
                    }))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                  placeholder="0.00"
                />
                <p className="text-[11px] text-slate-400">
                  Costo de referencia por {formData.unit}. Se actualiza automáticamente cuando registras compras o entradas de inventario.
                </p>
              </div>

              {!editingItem && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Stock Inicial
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.current_stock}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        current_stock: e.target.value,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                    placeholder="0"
                  />
                  <p className="text-[11px] text-slate-400">
                    Puedes iniciar con stock en cero y registrar compras
                    después.
                  </p>
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingItem ? "Guardar Cambios" : "Crear Insumo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Categoría ──────────────────────────────────────────────── */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-900">
                {editingCat ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button
                type="button"
                onClick={closeCatModal}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Nombre de Categoría *
                </label>
                <Input
                  required
                  type="text"
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
                  placeholder="Ej: Carnes, Salsas, Empaques..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Color Identificador
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm((p) => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 cursor-pointer"
                      style={{
                        backgroundColor: c,
                        outline:
                          catForm.color === c ? `2.5px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                <CategoryBadge
                  name={catForm.name || "Ejemplo"}
                  color={catForm.color}
                />
                <span className="text-xs text-slate-400">
                  Previsualización de etiqueta
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                {editingCat && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Eliminar esta categoría? Los insumos quedarán sin categoría.",
                        )
                      ) {
                        deleteCatMutation.mutate(editingCat.id);
                        closeCatModal();
                      }
                    }}
                    className="h-10 px-3 text-rose-600 hover:bg-rose-50 border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCatModal}
                  className="flex-1 h-10 rounded-xl text-xs font-semibold border-slate-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createCatMutation.isPending || updateCatMutation.isPending
                  }
                  className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingCat ? "Guardar" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
