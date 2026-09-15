import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import type { Category, ProductExtra } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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

export function ExtrasTab() {
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editExtra, setEditExtra] = useState<ProductExtra | null>(null);
  const [extraToDelete, setExtraToDelete] = useState<ProductExtra | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category_ids: [] as string[],
    extra_key: "",
    label: "",
    icon: "",
    price_per_unit: "",
    max_qty: "1",
    sort_order: "0",
    store_ids: [] as string[],
  });

  const fetchData = useCallback(async () => {
    const [{ data: extData }, { data: catData }] = await Promise.all([
      supabase.from("product_extras").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    if (extData) setExtras(extData as ProductExtra[]);
    if (catData) setCategories(catData as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCatLabel = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon || ""} ${cat.label}` : catId;
  };

  const filtered = extras.filter((e) => {
    const matchesCategory =
      filterCat === "all" ||
      (e.category_ids && e.category_ids.includes(filterCat)) ||
      e.category_id === filterCat;
    const matchesSearch =
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.extra_key.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const nextSortOrder = () => {
    if (extras.length === 0) return 0;
    return Math.max(...extras.map((e) => e.sort_order ?? 0)) + 1;
  };

  const openNew = () => {
    setEditExtra(null);
    setForm({
      category_ids:
        filterCat !== "all"
          ? [filterCat]
          : categories[0]?.id
            ? [categories[0].id]
            : [],
      extra_key: "",
      label: "",
      icon: "🧀",
      price_per_unit: "",
      max_qty: "1",
      sort_order: String(nextSortOrder()),
      store_ids: [],
    });
    setIsDialogOpen(true);
  };

  const openEdit = (extra: ProductExtra) => {
    setEditExtra(extra);
    setForm({
      category_ids:
        extra.category_ids || (extra.category_id ? [extra.category_id] : []),
      extra_key: extra.extra_key,
      label: extra.label,
      icon: extra.icon || "",
      price_per_unit: String(extra.price_per_unit),
      max_qty: String(extra.max_qty ?? 1),
      sort_order: String(extra.sort_order ?? 0),
      store_ids: extra.store_ids || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.label.trim() || !form.extra_key.trim()) {
        toast.error("El nombre y la clave son obligatorios");
        setSaving(false);
        return;
      }
      if (form.category_ids.length === 0) {
        toast.error("Debes vincular al menos una categoría");
        setSaving(false);
        return;
      }

      const extraData = {
        category_ids: form.category_ids,
        category_id: form.category_ids[0],
        extra_key: form.extra_key.trim().toLowerCase().replace(/\s+/g, "_"),
        label: form.label.trim(),
        icon: form.icon || null,
        price_per_unit: Number(form.price_per_unit) || 0,
        max_qty: Number(form.max_qty) || 1,
        sort_order: Number(form.sort_order) || 0,
        store_ids: form.store_ids,
      };

      if (editExtra) {
        const { error } = await supabase
          .from("product_extras")
          .update(extraData)
          .eq("id", editExtra.id);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Ingrediente adicional actualizado");
      } else {
        const { error } = await supabase
          .from("product_extras")
          .insert([extraData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Ingrediente adicional creado");
      }
      await fetchData();
      setIsDialogOpen(false);
    } catch {
      toast.error("Error interno al guardar el ingrediente adicional");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!extraToDelete) return;
    const { error } = await supabase
      .from("product_extras")
      .delete()
      .eq("id", extraToDelete.id);
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    setExtras((prev) => prev.filter((e) => e.id !== extraToDelete.id));
    toast.success("Ingrediente eliminado con éxito");
    setExtraToDelete(null);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="font-semibold text-xs text-slate-500">
          Cargando ingredientes adicionales...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Ingredientes & Extras
            </h2>
            <p className="text-xs text-slate-500">
              {extras.length} adicionales configurados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48 sm:w-56">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs"
            />
          </div>

          <div className="w-44 sm:w-48">
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs font-medium">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs font-semibold">
                  Todas las categorías
                </SelectItem>
                {categories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={cat.id}
                    className="text-xs font-medium"
                  >
                    <span className="mr-1.5">{cat.icon}</span> {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={openNew}
            className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Nuevo Extra</span>
          </Button>
        </div>
      </div>

      {/* Grid of Extras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((extra) => (
          <div
            key={extra.id}
            className="group flex flex-col justify-between bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md p-4 sm:p-5 transition-all duration-200 shadow-xs"
          >
            {/* Header: Emoji Avatar + Price */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="h-13 w-13 rounded-2xl bg-emerald-50 text-3xl flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                <span>{extra.icon || "🧀"}</span>
              </div>

              <div className="text-right">
                <p className="font-bold text-base text-slate-900 leading-none">
                  {formatPrice(extra.price_per_unit)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                  x unidad
                </span>
              </div>
            </div>

            {/* Info Body */}
            <div className="space-y-2 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition-colors line-clamp-1">
                  {extra.label}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  key: {extra.extra_key}
                </p>
              </div>

              {/* Linked categories pills */}
              <div className="flex flex-wrap gap-1">
                {(extra.category_ids || [extra.category_id])
                  .filter(Boolean)
                  .map((cid) => (
                    <span
                      key={cid}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600"
                    >
                      {getCatLabel(cid)}
                    </span>
                  ))}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Máximo permitido:{" "}
                <span className="font-bold text-slate-800">
                  {extra.max_qty} uds.
                </span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEdit(extra)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                <span>Editar</span>
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExtraToDelete(extra)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-center p-8">
            <Sparkles className="h-10 w-10 text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">
              No hay ingredientes adicionales
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Agrega tocineta, queso extra, salsas especiales o aderezos.
            </p>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
              {editExtra ? (
                <Edit className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              {editExtra ? "Editar Ingrediente Extra" : "Nuevo Ingrediente Extra"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configura ingredientes de personalización con cobro opcional por
              unidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Category multi-selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Categorías Vinculadas *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto min-h-11 py-2 px-3.5 rounded-xl border border-slate-200 text-xs text-left"
                  >
                    {form.category_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {form.category_ids.map((catId) => {
                          const cat = categories.find((c) => c.id === catId);
                          return (
                            <span
                              key={catId}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60"
                            >
                              {cat?.icon} {cat?.label}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        Seleccionar categorías vinculadas...
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-2 rounded-2xl" align="start">
                  <div className="max-h-[280px] overflow-y-auto space-y-1">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs font-medium",
                          form.category_ids.includes(cat.id)
                            ? "bg-teal-50 text-teal-900"
                            : "hover:bg-slate-100 text-slate-700",
                        )}
                        onClick={() => {
                          const current = form.category_ids;
                          const next = current.includes(cat.id)
                            ? current.filter((id) => id !== cat.id)
                            : [...current, cat.id];
                          setForm((f) => ({ ...f, category_ids: next }));
                        }}
                      >
                        <Checkbox
                          checked={form.category_ids.includes(cat.id)}
                          className="h-4 w-4 rounded data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                        />
                        <span className="text-base">{cat.icon}</span>
                        <span className="flex-1">{cat.label}</span>
                        {form.category_ids.includes(cat.id) && (
                          <CheckCircle2 className="h-4 w-4 text-teal-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Emoji Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Icono o Emoji
              </Label>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex justify-center">
                <EmojiPicker
                  value={form.icon}
                  onChange={(emoji) => setForm((f) => ({ ...f, icon: emoji }))}
                />
              </div>
            </div>

            {/* Extra Label */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nombre del Ingrediente *
              </Label>
              <Input
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label,
                    extra_key: editExtra ? f.extra_key : generateSlug(label),
                  }));
                }}
                placeholder="Ej: Tocineta Ahumada Crispy"
                className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
              />
              {form.extra_key && (
                <p className="text-[11px] font-mono text-slate-400 px-1">
                  Clave: {form.extra_key}
                </p>
              )}
            </div>

            {/* Price & Max Qty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Precio x Unidad (COP)
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    value={form.price_per_unit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        price_per_unit: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 pl-8 rounded-xl border border-slate-200 font-bold text-base"
                  />
                </div>
                {form.price_per_unit && (
                  <p className="text-[11px] font-semibold text-teal-600 px-1">
                    {formatPrice(Number(form.price_per_unit))} COP
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Límite Máximo por Pedido
                </Label>
                <Input
                  type="number"
                  value={form.max_qty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_qty: e.target.value }))
                  }
                  placeholder="1"
                  className="h-11 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            {/* Store availability */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-semibold text-slate-700">
                Disponibilidad en Sedes
              </Label>
              <StoreMultiSelect
                selectedStoreIds={form.store_ids}
                onChange={(ids) => setForm((f) => ({ ...f, store_ids: ids }))}
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
              ) : editExtra ? (
                "Guardar Cambios"
              ) : (
                "Crear Extra"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog
        open={!!extraToDelete}
        onOpenChange={(open) => !open && setExtraToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              ¿Eliminar ingrediente adicional?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              El ingrediente{" "}
              <strong className="text-slate-800">
                "{extraToDelete?.label}"
              </strong>{" "}
              dejará de estar disponible en las opciones de personalización.
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
