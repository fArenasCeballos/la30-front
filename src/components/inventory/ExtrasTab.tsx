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

  const filtered =
    filterCat === "all"
      ? extras
      : extras.filter(
          (e) =>
            (e.category_ids && e.category_ids.includes(filterCat)) ||
            e.category_id === filterCat,
        );

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
      max_qty: String(extra.max_qty),
      sort_order: String(extra.sort_order),
      store_ids: extra.store_ids || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (
        !form.label.trim() ||
        !form.extra_key.trim() ||
        form.category_ids.length === 0 ||
        !form.price_per_unit
      ) {
        toast.error("Completa todos los campos obligatorios");
        setSaving(false);
        return;
      }
      const extraData = {
        category_ids: form.category_ids,
        category_id: form.category_ids[0],
        extra_key: form.extra_key.toLowerCase().replace(/\s+/g, "_"),
        label: form.label,
        icon: form.icon || null,
        price_per_unit: Number(form.price_per_unit),
        max_qty: Number(form.max_qty) || 1,
        sort_order: Number(form.sort_order) || 0,
        store_ids: form.store_ids,
      };

      const isDuplicate = extras.some(
        (e) =>
          e.extra_key === extraData.extra_key &&
          (!editExtra || e.id !== editExtra.id),
      );

      if (isDuplicate) {
        toast.error("Este extra ya existe (nombre o clave duplicada).");
        setSaving(false);
        return;
      }

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
        toast.success("Extra actualizado");
      } else {
        const { error } = await supabase
          .from("product_extras")
          .insert([extraData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Extra creado");
      }
      await fetchData();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      toast.error("Error interno al guardar el extra");
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
    toast.success("Extra eliminado");
    setExtraToDelete(null);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Cargando ingredientes...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-1000 fill-mode-both">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 bg-white/40 backdrop-blur-xl p-10 rounded-[3.5rem] border-4 border-white shadow-strong relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-10 relative">
          <div className="h-20 w-20 rounded-4xl bg-linear-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary shadow-inner border border-primary/5 group-hover:rotate-12 transition-transform duration-500">
            <Sparkles className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <div className="space-y-6 sm:space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary/40 leading-none">
              PERSONALIZACIÓN DE PLATOS
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <p className="text-4xl font-black tracking-tighter text-foreground whitespace-nowrap">
                {extras.length}{" "}
                <span className="text-primary/40 font-bold">Adicionales</span>
              </p>
              <div className="h-12 w-[3px] bg-primary/10 hidden sm:block rounded-full" />
              <div className="relative group/select min-w-[280px]">
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="h-16 px-8 rounded-2xl border-4 border-white bg-white/60 backdrop-blur-md shadow-soft font-black text-xs uppercase tracking-widest transition-all focus:border-primary/40 focus:ring-0 group-hover/select:shadow-strong group-hover/select:scale-105">
                    <SelectValue placeholder="Filtrar por grupo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[2.5rem] border-none shadow-strong p-3 bg-white/95 backdrop-blur-xl">
                    <SelectItem
                      value="all"
                      className="font-black uppercase tracking-widest text-[10px] rounded-2xl py-4 transition-colors"
                    >
                      🚀 TODOS LOS GRUPOS
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={cat.id}
                        className="font-black uppercase tracking-widest text-[10px] rounded-2xl py-4 transition-colors"
                      >
                        <span className="mr-3 text-xl scale-125">
                          {cat.icon}
                        </span>{" "}
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={openNew}
          className="h-20 px-12 rounded-[2.5rem] font-black text-sm tracking-widest shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group bg-primary hover:bg-primary/90 text-white border-4 border-white/20 relative"
        >
          <Plus
            className="h-7 w-7 mr-4 group-hover:rotate-90 transition-transform duration-700"
            strokeWidth={3}
          />
          NUEVO INGREDIENTE
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
        {filtered.map((extra, idx) => (
          <div
            key={extra.id}
            className="pos-card group flex flex-col h-full border-4 transition-all duration-700 relative overflow-hidden bg-white/60 border-white hover:bg-white hover:border-primary/20 hover:shadow-2xl hover:scale-[1.03]"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-start justify-between p-8 pb-4">
              <div className="h-24 w-24 rounded-4xl bg-white border-4 border-accent/5 flex items-center justify-center text-6xl shadow-strong group-hover:scale-110 transition-all duration-700 group-hover:rotate-6 relative">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl scale-0 group-hover:scale-100 transition-transform duration-700" />
                <span className="relative">{extra.icon || "➕"}</span>
              </div>
              <div className="text-right space-y-2">
                <p className="font-black text-4xl text-primary tracking-tighter group-hover:scale-110 transition-transform duration-500 origin-right">
                  {formatPrice(extra.price_per_unit)}
                </p>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 block">
                  VALOR ADICIONAL
                </span>
              </div>
            </div>

            <div className="flex-1 p-8 pt-4 space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] leading-none">
                  IDENTIFICADOR: {extra.extra_key}
                </p>
                <h3 className="font-black text-3xl tracking-tighter leading-[1.1] group-hover:text-primary transition-colors duration-500 min-h-[2.2em]">
                  {extra.label}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 pt-2">
                  {extra.category_ids && extra.category_ids.length > 0 ? (
                    extra.category_ids.map((cid) => (
                      <div
                        key={cid}
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 bg-primary/5 text-primary border-primary/10 shadow-soft"
                      >
                        {getCatLabel(cid)}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 bg-primary/5 text-primary border-primary/10 shadow-soft">
                      {getCatLabel(extra.category_id)}
                    </div>
                  )}
                </div>

                <div className="bg-accent/5 backdrop-blur-md rounded-[1.75rem] p-5 border-2 border-white shadow-inner flex items-center justify-between group-hover:bg-white transition-colors duration-700">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/5 group-hover:rotate-12 transition-transform">
                      <CheckCircle2
                        className="h-5 w-5 text-primary"
                        strokeWidth={3}
                      />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                      Máximo permitido
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-2xl text-primary tracking-tighter">
                      {extra.max_qty}
                    </span>
                    <span className="text-[10px] font-black text-primary/40 uppercase">
                      UDS.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 flex items-center gap-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
              <Button
                size="lg"
                className="flex-1 h-16 rounded-2xl font-black text-[11px] tracking-widest shadow-strong bg-white/95 backdrop-blur-md text-foreground hover:bg-primary hover:text-white transition-all border-none"
                onClick={() => openEdit(extra)}
              >
                <Edit className="h-5 w-5 mr-3" />
                EDITAR
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-16 w-16 rounded-2xl shadow-strong bg-destructive/90 backdrop-blur-md hover:bg-destructive hover:scale-110 transition-all border-none"
                onClick={() => setExtraToDelete(extra)}
              >
                <Trash2 className="h-6 w-6" />
              </Button>
            </div>

            {/* Decorative background element */}
            <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-40 flex flex-col items-center justify-center space-y-8 bg-accent/5 rounded-[3.5rem] border-4 border-dashed border-accent/20">
            <div className="h-28 w-28 rounded-[2.5rem] bg-white border-2 shadow-soft flex items-center justify-center text-muted-foreground/20">
              <Sparkles className="h-12 w-12 animate-pulse" strokeWidth={3} />
            </div>
            <p className="font-black uppercase tracking-[0.4em] text-sm text-center text-muted-foreground/40">
              No hay ingredientes adicionales configurados
            </p>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto rounded-[3.5rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-2xl">
          <DialogHeader className="space-y-6 mb-12">
            <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner group-hover:rotate-12 transition-transform">
              {editExtra ? (
                <Edit className="h-10 w-10" />
              ) : (
                <Sparkles className="h-10 w-10" />
              )}
            </div>
            <div>
              <DialogTitle className="text-5xl font-black tracking-tighter mb-3">
                {editExtra ? "Editar Extra" : "Nuevo Extra"}
              </DialogTitle>
              <DialogDescription className="text-xl font-medium text-muted-foreground leading-relaxed">
                Personaliza la experiencia de tus platos con ingredientes
                adicionales.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-10">
            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                Secciones Vinculadas
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto min-h-20 py-4 px-6 rounded-4xl border-4 border-white shadow-soft bg-white/50 focus:border-primary/40 transition-all font-black"
                  >
                    {form.category_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {form.category_ids.map((catId) => {
                          const cat = categories.find((c) => c.id === catId);
                          return (
                            <div
                              key={catId}
                              className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white border border-accent/10 shadow-soft text-primary"
                            >
                              {cat?.icon} {cat?.label}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground opacity-30 text-sm tracking-widest uppercase">
                        Seleccionar categorías vinculadas...
                      </span>
                    )}
                    <ChevronDown className="h-6 w-6 opacity-30 ml-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[340px] p-4 rounded-[2.5rem] border-none shadow-strong bg-white/95 backdrop-blur-xl"
                  align="start"
                >
                  <div className="max-h-[360px] overflow-y-auto space-y-2 p-2 no-scrollbar">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center space-x-4 p-4 hover:bg-primary/5 rounded-2xl cursor-pointer transition-all group",
                          form.category_ids.includes(cat.id) && "bg-primary/10",
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
                          onCheckedChange={() => {}}
                          className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 flex items-center gap-3">
                          <span className="text-2xl">{cat.icon}</span>
                          <span className="text-xs font-black uppercase tracking-widest group-hover:text-primary transition-colors">
                            {cat.label}
                          </span>
                        </div>
                        {form.category_ids.includes(cat.id) && (
                          <CheckCircle2
                            className="h-5 w-5 text-primary"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                Identificador Visual (Emoji)
              </Label>
              <div className="bg-white/50 backdrop-blur-md p-10 rounded-[3rem] border-4 border-white shadow-soft flex justify-center group-focus-within:border-primary/20 transition-all">
                <EmojiPicker
                  value={form.icon}
                  onChange={(emoji) => setForm((f) => ({ ...f, icon: emoji }))}
                />
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                  Nombre del Ingrediente
                </Label>
                <div className="relative group">
                  <Input
                    value={form.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setForm((f) => ({
                        ...f,
                        label,
                        extra_key: editExtra
                          ? f.extra_key
                          : generateSlug(label),
                      }));
                    }}
                    placeholder="Ej: Tocino Ahumado Premium"
                    className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                  />
                  {form.extra_key && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 shadow-inner">
                        KEY: {form.extra_key}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                    Precio x Unidad
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-primary/30 group-focus-within:text-primary transition-colors">
                      $
                    </div>
                    <Input
                      type="number"
                      value={form.price_per_unit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          price_per_unit: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="h-16 pl-12 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-2xl font-black transition-all"
                    />
                  </div>
                  {form.price_per_unit && (
                    <p className="text-[10px] font-black text-primary/60 px-4 tracking-widest uppercase">
                      {formatPrice(Number(form.price_per_unit))} COP POR UNIDAD
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                    Límite por Pedido
                  </Label>
                  <Input
                    type="number"
                    value={form.max_qty}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_qty: e.target.value }))
                    }
                    placeholder="1"
                    className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                Alcance de Tiendas
              </Label>
              <div className="bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border-4 border-white shadow-soft">
                <StoreMultiSelect
                  selectedStoreIds={form.store_ids}
                  onChange={(ids) => setForm((f) => ({ ...f, store_ids: ids }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-16 gap-6">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] px-12"
            >
              Cerrar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-16 px-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-strong shadow-primary/20 relative overflow-hidden group/save"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  SINCRONIZANDO...
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/save:translate-y-0 transition-transform duration-500" />
                  <span className="relative">
                    {editExtra ? "ACTUALIZAR EXTRA" : "CREAR EXTRA"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!extraToDelete}
        onOpenChange={(open) => !open && setExtraToDelete(null)}
      >
        <AlertDialogContent className="rounded-[3.5rem] border-4 border-white p-12 max-w-lg bg-white/95 backdrop-blur-2xl shadow-strong">
          <AlertDialogHeader className="space-y-6">
            <div className="h-24 w-24 rounded-[2.5rem] bg-destructive/10 flex items-center justify-center text-destructive mb-2 shadow-inner group-hover:rotate-12 transition-transform">
              <Trash2 className="h-12 w-12" />
            </div>
            <div>
              <AlertDialogTitle className="text-4xl font-black tracking-tighter mb-4">
                ¿Remover ingrediente?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                El ingrediente{" "}
                <strong className="text-foreground">
                  "{extraToDelete?.label}"
                </strong>{" "}
                dejará de aparecer en las opciones de personalización de forma
                permanente.
                <div className="mt-8 flex items-start gap-4 p-6 bg-destructive/5 rounded-3xl border-2 border-destructive/10">
                  <div className="h-3 w-3 rounded-full bg-destructive mt-1.5 shrink-0 animate-pulse" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-destructive leading-tight">
                    Esta acción no se puede deshacer y afectará a todos los
                    pedidos futuros.
                  </p>
                </div>
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4">
            <AlertDialogCancel className="h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] border-4 border-white bg-white/50 px-8 shadow-soft">
              CANCELAR
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-16 px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] bg-destructive text-white hover:bg-destructive/90 shadow-strong shadow-destructive/20 border-4 border-white/20"
            >
              CONFIRMAR ELIMINACIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
