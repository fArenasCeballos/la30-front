import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, LayoutGrid, Loader2, Smartphone } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { StoreMultiSelect } from "./StoreMultiSelect";

const generateSlug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

export function CategoriesTab() {
  const { user } = useAuth();
  const { stores } = useStore();
  const companyStoreIds = useMemo(() => new Set(stores.map((s) => s.id)), [stores]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{
    name: string;
    label: string;
    icon: string;
    sort_order: string;
    store_ids: string[];
    is_available_app: boolean;
  }>({
    name: "",
    label: "",
    icon: "",
    sort_order: "0",
    store_ids: [],
    is_available_app: true,
  });

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    if (data) setCategories(data as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchCategories();
  }, [fetchCategories, user]);

  const nextSortOrder = () => {
    if (categories.length === 0) return 0;
    return Math.max(...categories.map((c) => c.sort_order ?? 0)) + 1;
  };

  const openNew = () => {
    setEditCategory(null);
    setForm({
      name: "",
      label: "",
      icon: "📦",
      sort_order: String(nextSortOrder()),
      store_ids: stores.map((s) => s.id),
      is_available_app: true,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setForm({
      name: cat.name,
      label: cat.label,
      icon: cat.icon || "",
      sort_order: String(cat.sort_order),
      store_ids: cat.store_ids || [],
      is_available_app: cat.is_available_app ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.name.trim() || !form.label.trim()) {
        toast.error("El nombre clave y la etiqueta son obligatorios");
        setSaving(false);
        return;
      }

      const catData = {
        name: form.name.toLowerCase().replace(/\s+/g, "_"),
        label: form.label.trim(),
        icon: form.icon || null,
        sort_order: Number(form.sort_order) || 0,
        store_ids: form.store_ids,
        is_available_app: form.is_available_app,
      };

      if (editCategory) {
        const { error } = await supabase
          .from("categories")
          .update(catData)
          .eq("id", editCategory.id);

        if (error) {
          toast.error(`Error al actualizar: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Categoría actualizada con éxito");
      } else {
        const { error } = await supabase.from("categories").insert(catData);

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Categoría creada con éxito");
      }

      await fetchCategories();
      setIsDialogOpen(false);
    } catch {
      toast.error("Error interno al guardar la categoría");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    // Optimistic
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c)),
    );

    const { error } = await supabase
      .from("categories")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: currentStatus } : c)),
      );
      toast.error(`Error al actualizar estado: ${error.message}`);
      return;
    }

    toast.success(
      !currentStatus
        ? "Categoría visible en menús"
        : "Categoría ocultada de los menús",
    );
  };

  const toggleAppVisibility = async (id: string, currentStatus: boolean) => {
    // Optimistic
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, is_available_app: !currentStatus } : c,
      ),
    );

    const { error } = await supabase
      .from("categories")
      .update({ is_available_app: !currentStatus })
      .eq("id", id);

    if (error) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_available_app: currentStatus } : c,
        ),
      );
      toast.error(`Error al actualizar visibilidad en la app: ${error.message}`);
      return;
    }

    toast.success(
      !currentStatus
        ? "Categoría visible en la App Móvil 📱"
        : "Categoría ocultada de la App Móvil",
    );
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    const id = categoryToDelete.id;
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      if (error.code === "23503") {
        toast.error(
          "No se puede eliminar: Esta categoría tiene productos asociados.",
        );
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setCategoryToDelete(null);
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success("Categoría eliminada con éxito");
    setCategoryToDelete(null);
  };

  const filteredCategories = categories
    .filter((c) => {
      if (stores.length > 0) {
        return Boolean(c.store_ids && c.store_ids.some((id) => companyStoreIds.has(id)));
      }
      return true;
    })
    .filter(
      (c) =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()),
    );

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="font-semibold text-xs text-slate-500">
          Cargando categorías...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Control Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Estructura de Categorías
            </h2>
            <p className="text-xs text-slate-500">
              {filteredCategories.length}{" "}
              {filteredCategories.length === 1
                ? "categoría configurada"
                : "categorías configuradas"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1 sm:w-60">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoría..."
              className="h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs"
            />
          </div>

          <Button
            onClick={openNew}
            className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Nueva Categoría</span>
          </Button>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className={cn(
              "group flex flex-col justify-between bg-white rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-xs hover:shadow-md",
              !cat.is_active
                ? "opacity-75 bg-slate-50/50 border-slate-200"
                : "border-slate-200/80 hover:border-slate-300",
            )}
          >
            {/* Header: Emoji Avatar + Visibility Controls */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-3xl flex items-center justify-center border border-amber-500/15 group-hover:scale-105 transition-transform shrink-0">
                <span>{cat.icon || "📦"}</span>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                {/* Switch POS / Menú General */}
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={() => toggleActive(cat.id, !!cat.is_active)}
                    className="data-[state=checked]:bg-teal-600 scale-75"
                    title={cat.is_active ? "Visible en POS" : "Oculto en POS"}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-md",
                      cat.is_active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {cat.is_active ? "POS" : "No POS"}
                  </span>
                </div>

                {/* Toggle App Móvil (la30-app) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAppVisibility(cat.id, cat.is_available_app ?? true);
                  }}
                  title={
                    (cat.is_available_app ?? true)
                      ? "Visible en App Móvil (clic para ocultar)"
                      : "Oculto en App Móvil (clic para mostrar)"
                  }
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-2xs transition-transform active:scale-95 cursor-pointer border",
                    (cat.is_available_app ?? true)
                      ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                      : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 line-through opacity-80",
                  )}
                >
                  <Smartphone className="h-2.5 w-2.5" />
                  <span>{(cat.is_available_app ?? true) ? "App Móvil" : "No en App"}</span>
                </button>
              </div>
            </div>

            {/* Info Body */}
            <div className="space-y-1 mb-4">
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition-colors">
                {cat.label}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>slug: {cat.name}</span>
                <span>•</span>
                <span>orden: #{cat.sort_order}</span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEdit(cat)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                <span>Editar</span>
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCategoryToDelete(cat)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-center p-8">
            <LayoutGrid className="h-10 w-10 text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">
              No hay categorías
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Crea tu primera categoría para organizar los platos de la carta.
            </p>
          </div>
        )}
      </div>

      {/* Category Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
              {editCategory ? (
                <Edit className="h-6 w-6" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              {editCategory ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Organiza la carta gastronómica en grupos lógicos para navegación
              fácil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Emoji Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Icono o Emoji de la Categoría
              </Label>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex justify-center">
                <EmojiPicker
                  value={form.icon}
                  onChange={(emoji) => setForm((f) => ({ ...f, icon: emoji }))}
                />
              </div>
            </div>

            {/* Label and Slug */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nombre Visible (Etiqueta) *
              </Label>
              <Input
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label,
                    name: editCategory ? f.name : generateSlug(label),
                  }));
                }}
                placeholder="Ej: Hamburguesas Especiales"
                className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
              />
              {form.name && (
                <p className="text-[11px] font-mono text-slate-400 px-1">
                  Identificador clave (slug): {form.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Posición en Menú (Orden numérico)
              </Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: e.target.value }))
                }
                placeholder="0"
                className="h-11 rounded-xl border border-slate-200 text-sm"
              />
              <p className="text-[11px] text-slate-400 px-1">
                Define el orden de aparición de izquierda a derecha en los
                pedidos.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-semibold text-slate-700">
                Disponibilidad en Sedes
              </Label>
              <StoreMultiSelect
                selectedStoreIds={form.store_ids}
                onChange={(ids) => setForm((f) => ({ ...f, store_ids: ids }))}
              />
            </div>

            {/* App Móvil Visibility Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-100 bg-purple-50/50">
              <div className="space-y-0.5 pr-2">
                <Label
                  htmlFor="cat-app-visibility-switch"
                  className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <span>Visualizar en la App Móvil (la30-app)</span>
                </Label>
                <p className="text-[11px] text-slate-500">
                  Si este check está marcado, la categoría aparecerá en la aplicación móvil de los clientes. Si no, estará oculta en la app.
                </p>
              </div>
              <Switch
                id="cat-app-visibility-switch"
                checked={form.is_available_app}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_available_app: checked }))
                }
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>

          <DialogFooter className="mt-8 gap-2.5 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="h-11 rounded-xl font-semibold text-xs px-5 border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-6 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editCategory ? (
                "Guardar Cambios"
              ) : (
                "Crear Categoría"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              ¿Eliminar categoría?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              La categoría{" "}
              <strong className="text-slate-800">
                "{categoryToDelete?.label}"
              </strong>{" "}
              será eliminada. Solo se permitirá si no contiene productos activos
              asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-semibold text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-10 rounded-xl font-semibold text-xs bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
