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
  Tag,
  FolderPlus,
  ChevronRight,
} from "lucide-react";
import { getBaseUnits } from "@/lib/unitConversions";

// ─── Preset colours for categories ──────────────────────────────────────────
const PRESET_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6",
  "#f97316", "#84cc16",
];

// ─── CategoryBadge ───────────────────────────────────────────────────────────
function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

export function RawMaterialsTab() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // ─── Insumo modal ─────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    unit: "g",
    category_id: "",
    min_stock: "",
    current_stock: "",
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
    return matchSearch && matchCat;
  });

  // ─── Mutations: Insumos ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: RawMaterialInsert) => createRawMaterial(data),
    onSuccess: () => {
      toast.success("Insumo creado correctamente");
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
      name: formData.name,
      unit: formData.unit,
      category_id: formData.category_id || null,
      min_stock: Number(formData.min_stock) || 0,
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
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        unit: "g",
        category_id: activeCategoryId ?? "",
        min_stock: "",
        current_stock: "",
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* ── Sidebar: Categorías ── */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Categorías
            </h3>
            <button
              onClick={() => openCatModal()}
              className="p-1 rounded-lg hover:bg-primary/10 text-primary transition-colors"
              title="Nueva categoría"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>

          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-between ${
                activeCategoryId === null
                  ? "bg-slate-800 text-white"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              <span>Todos los insumos</span>
              <span className="text-xs font-medium opacity-60">{materials.length}</span>
            </button>

            {categories.map((cat) => {
              const count = materials.filter((m) => m.category_id === cat.id).length;
              return (
                <div key={cat.id} className="group flex items-center gap-1">
                  <button
                    onClick={() =>
                      setActiveCategoryId(
                        activeCategoryId === cat.id ? null : cat.id
                      )
                    }
                    className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                      activeCategoryId === cat.id
                        ? "text-white"
                        : "hover:bg-slate-100 text-slate-600"
                    }`}
                    style={
                      activeCategoryId === cat.id
                        ? { backgroundColor: cat.color }
                        : {}
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto text-xs font-medium opacity-60">{count}</span>
                  </button>
                  <button
                    onClick={() => openCatModal(cat)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-all"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {categories.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3 px-2">
                Sin categorías. Crea la primera.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel principal ── */}
      <div className="lg:col-span-3 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm font-bold text-sm"
          >
            <Plus className="h-4 w-4" />
            Nuevo Insumo
          </button>
        </div>

        {/* Breadcrumb if category active */}
        {activeCategoryId && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <span
              className="cursor-pointer hover:text-primary"
              onClick={() => setActiveCategoryId(null)}
            >
              Todos
            </span>
            <ChevronRight className="h-3 w-3" />
            <span
              className="px-2 py-0.5 rounded-full text-white text-[10px]"
              style={{
                backgroundColor:
                  categories.find((c) => c.id === activeCategoryId)?.color ??
                  "#6366f1",
              }}
            >
              {categories.find((c) => c.id === activeCategoryId)?.name}
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b text-[10px] uppercase font-black tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Insumo</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Unidad</th>
                  <th className="px-6 py-4 text-right">Mín.</th>
                  <th className="px-6 py-4 text-right">Stock</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      Cargando insumos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      {activeCategoryId
                        ? "No hay insumos en esta categoría."
                        : "No se encontraron insumos."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {item.name}
                      </td>
                      <td className="px-6 py-4">
                        {item.raw_material_categories ? (
                          <CategoryBadge
                            name={item.raw_material_categories.name}
                            color={item.raw_material_categories.color}
                          />
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 uppercase text-xs font-bold">
                        {item.unit}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">
                        {item.min_stock}
                      </td>
                      <td className="px-6 py-4 text-right font-black">
                        <span
                          className={
                            item.current_stock <= item.min_stock
                              ? "text-red-500"
                              : "text-emerald-500"
                          }
                        >
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.current_stock <= item.min_stock ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Stock Bajo
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            Normal
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(item)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "¿Seguro que deseas eliminar este insumo?"
                                )
                              ) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal: Insumo ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">
                {editingItem ? "Editar Insumo" : "Nuevo Insumo"}
              </h3>
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
                  Nombre del Insumo
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej: Carne de Res"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Categoría
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, category_id: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Unidad
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {getBaseUnits().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} ({u.short})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Stock Mínimo
                  </label>
                  <input
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                </div>
              </div>

              {!editingItem && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Stock Inicial
                  </label>
                  <input
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Puedes empezar con stock en cero y registrar una compra luego.
                  </p>
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
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {editingItem ? "Actualizar" : "Crear Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Categoría ──────────────────────────────────────────────── */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">
                {editingCat ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button
                onClick={closeCatModal}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Nombre
                </label>
                <input
                  required
                  type="text"
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej: Bebidas, Salsas, Empaques..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm((p) => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110 ring-offset-2"
                      style={{
                        backgroundColor: c,
                        outline:
                          catForm.color === c ? `3px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className="w-8 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: catForm.color }}
                  />
                  <input
                    type="color"
                    value={catForm.color}
                    onChange={(e) =>
                      setCatForm((p) => ({ ...p, color: e.target.value }))
                    }
                    className="w-full h-9 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-1"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-slate-50 flex items-center gap-3">
                <CategoryBadge name={catForm.name || "Preview"} color={catForm.color} />
                <span className="text-xs text-slate-400">
                  Así se verá la etiqueta
                </span>
              </div>

              <div className="flex gap-3">
                {editingCat && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("¿Eliminar esta categoría? Los insumos quedarán sin categoría.")) {
                        deleteCatMutation.mutate(editingCat.id);
                        closeCatModal();
                      }
                    }}
                    className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeCatModal}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCatMutation.isPending || updateCatMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {editingCat ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
