import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
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
import { Plus, Edit, Trash2, LayoutGrid, Loader2, MoreVertical, Power } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    label: string;
    icon: string;
    sort_order: string;
    store_ids: string[];
  }>({
    name: "",
    label: "",
    icon: "",
    sort_order: "0",
    store_ids: [],
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
      store_ids: [],
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
        label: form.label,
        icon: form.icon || null,
        sort_order: Number(form.sort_order) || 0,
        store_ids: form.store_ids,
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
        toast.success("Categoría actualizada");
      } else {
        const { error } = await supabase.from("categories").insert(catData);

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Categoría creada");
      }

      await fetchCategories();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      toast.error("Error interno al guardar la categoría");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c)),
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
    toast.success("Categoría eliminada");
    setCategoryToDelete(null);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Cargando categorías...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-16 animate-in fade-in duration-1000 fill-mode-both">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 bg-white/40 backdrop-blur-xl p-6 lg:p-10 rounded-4xl lg:rounded-[3.5rem] border border-white shadow-strong relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />

        <div className="flex items-center gap-8 relative">
          <div className="h-14 w-14 lg:h-20 lg:w-20 rounded-2xl lg:rounded-4xl bg-linear-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary shadow-inner border border-primary/5 group-hover:rotate-12 transition-transform duration-500">
            <LayoutGrid className="h-7 w-7 lg:h-10 lg:w-10" strokeWidth={2.5} />
          </div>
          <div className="space-y-1 lg:space-y-2">
            <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-[0.5em] text-primary/40 leading-none">
              ARQUITECTURA DE MENÚ
            </p>
            <p className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground">
              {categories.length}{" "}
              <span className="text-primary/40 font-bold">Categorías</span>
            </p>
          </div>
        </div>

        <Button
          onClick={openNew}
          className="h-14 lg:h-20 px-8 lg:px-12 rounded-2xl lg:rounded-[2.5rem] font-black text-xs lg:text-sm tracking-widest shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group bg-primary hover:bg-primary/90 text-white border-2 lg:border-4 border-white/20 relative"
        >
          <Plus
            className="h-5 w-5 lg:h-7 lg:w-7 mr-3 lg:mr-4 group-hover:rotate-90 transition-transform duration-700"
            strokeWidth={3}
          />
          NUEVA CATEGORÍA
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-10">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className={cn(
              "pos-card group flex flex-col h-full border-4 transition-all duration-700 relative overflow-hidden",
              !cat.is_active
                ? "opacity-60 grayscale-[0.4] bg-accent/5 border-accent/20"
                : "bg-white/60 border-white hover:bg-white hover:border-primary/20 hover:shadow-2xl hover:scale-[1.03]",
            )}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-start justify-between p-8 pb-4">
              <div className="h-24 w-24 rounded-4xl bg-white border-4 border-accent/5 flex items-center justify-center text-6xl shadow-strong group-hover:scale-110 transition-all duration-700 group-hover:rotate-6 relative">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl scale-0 group-hover:scale-100 transition-transform duration-700" />
                <span className="relative">{cat.icon || "📦"}</span>
              </div>
              <div className="flex flex-col items-end gap-4">
                <div className="flex items-center gap-3">
                  {/* Mobile Action Menu */}
                  <div className="lg:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-2xl bg-white shadow-soft border border-accent/5 active:scale-95 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-6 w-6" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-2 rounded-3xl border-4 border-white shadow-strong backdrop-blur-xl bg-white/95">
                        <DropdownMenuItem
                          className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 focus:bg-primary focus:text-white transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(cat);
                          }}
                        >
                          <Edit className="h-5 w-5" />
                          EDITAR CATEGORÍA
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 focus:bg-primary focus:text-white transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActive(cat.id, !!cat.is_active);
                          }}
                        >
                          <Power className={cn("h-5 w-5", cat.is_active ? "text-primary" : "text-destructive")} />
                          {cat.is_active ? "DESACTIVAR" : "ACTIVAR"}
                        </DropdownMenuItem>
                        <div className="h-px bg-accent/10 my-1 mx-2" />
                        <DropdownMenuItem
                          className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 text-destructive focus:bg-destructive focus:text-white transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(cat);
                          }}
                        >
                          <Trash2 className="h-5 w-5" />
                          ELIMINAR CATEGORÍA
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="hidden lg:block p-2 rounded-2xl bg-white/80 backdrop-blur-md shadow-soft border-2 border-accent/5 group-hover:border-primary/20 transition-colors">
                    <Switch
                      checked={cat.is_active}
                      onCheckedChange={() =>
                        toggleActive(cat.id, !!cat.is_active)
                      }
                      className="scale-90 data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2",
                    cat.is_active
                      ? "bg-primary/5 text-primary border-primary/10"
                      : "bg-muted/10 text-muted-foreground border-muted/20",
                  )}
                >
                  {cat.is_active ? "VISIBLE" : "OCULTO"}
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 pt-4 space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] leading-none">
                  NOMBRE CLAVE: {cat.name}
                </p>
                <h3 className="font-black text-3xl tracking-tighter leading-none group-hover:text-primary transition-colors duration-500">
                  {cat.label}
                </h3>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 px-4 py-1.5 bg-accent/10 rounded-xl border border-accent/10 shadow-inner">
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    POSICIÓN #{cat.sort_order}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 flex items-center gap-4">
              <Button
                size="lg"
                className="flex-1 h-16 rounded-2xl font-black text-[11px] tracking-widest shadow-strong bg-white/95 backdrop-blur-md text-foreground hover:bg-primary hover:text-white transition-all border-none"
                onClick={() => openEdit(cat)}
              >
                <Edit className="h-5 w-5 mr-3" />
                EDITAR
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="hidden lg:flex h-16 w-16 rounded-2xl shadow-strong bg-destructive/90 backdrop-blur-md hover:bg-destructive hover:scale-110 transition-all border-none opacity-0 group-hover:opacity-100"
                onClick={() => setCategoryToDelete(cat)}
              >
                <Trash2 className="h-6 w-6" />
              </Button>
            </div>

            {/* Decorative background element */}
            <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full py-48 flex flex-col items-center justify-center space-y-10 bg-white/40 rounded-[4rem] border-4 border-white shadow-soft group">
            <div className="h-32 w-32 rounded-[3rem] bg-accent/5 flex items-center justify-center text-muted-foreground/20 group-hover:scale-110 transition-transform duration-700">
              <LayoutGrid
                className="h-16 w-16 animate-pulse"
                strokeWidth={1.5}
              />
            </div>
            <div className="text-center space-y-3">
              <p className="font-black uppercase tracking-[0.5em] text-sm text-muted-foreground/40">
                MENÚ SIN ESTRUCTURA
              </p>
              <p className="text-xs font-bold text-muted-foreground/20 italic max-w-xs mx-auto">
                Define tu primera categoría para empezar a organizar tu oferta
                gastronómica.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto rounded-[3.5rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-2xl">
          <DialogHeader className="space-y-6 mb-12">
            <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner group-hover:rotate-12 transition-transform">
              {editCategory ? (
                <Edit className="h-10 w-10" />
              ) : (
                <Plus className="h-10 w-10" />
              )}
            </div>
            <div>
              <DialogTitle className="text-5xl font-black tracking-tighter mb-3">
                {editCategory ? "Editar Categoría" : "Nueva Categoría"}
              </DialogTitle>
              <DialogDescription className="text-xl font-medium text-muted-foreground leading-relaxed">
                Organiza tu oferta gastronómica en grupos lógicos para una
                navegación intuitiva.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-10">
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
                  Etiqueta de Navegación
                </Label>
                <div className="relative group">
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
                    placeholder="Ej: Parrilla & Brasas"
                    className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                  />
                  {form.name && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 shadow-inner">
                        SLUG: {form.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                  Posición en el Menú
                </Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                  placeholder="0"
                  className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                />
                <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] px-2 italic">
                  * Define el orden de aparición de izquierda a derecha en el
                  Kiosko.
                </p>
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
                    {editCategory ? "ACTUALIZAR CATEGORÍA" : "CREAR CATEGORÍA"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent className="rounded-[3.5rem] border-4 border-white p-12 max-w-lg bg-white/95 backdrop-blur-2xl shadow-strong">
          <AlertDialogHeader className="space-y-6">
            <div className="h-24 w-24 rounded-[2.5rem] bg-destructive/10 flex items-center justify-center text-destructive mb-2 shadow-inner group-hover:rotate-12 transition-transform">
              <Trash2 className="h-12 w-12" />
            </div>
            <div>
              <AlertDialogTitle className="text-4xl font-black tracking-tighter mb-4">
                ¿Eliminar categoría?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                La categoría{" "}
                <strong className="text-foreground">
                  "{categoryToDelete?.label}"
                </strong>{" "}
                será removida del sistema de forma permanente.
                <div className="mt-8 flex items-start gap-4 p-6 bg-destructive/5 rounded-3xl border-2 border-destructive/10">
                  <div className="h-3 w-3 rounded-full bg-destructive mt-1.5 shrink-0 animate-pulse" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-destructive leading-tight">
                    Nota: Esta acción solo se permitirá si la categoría no
                    contiene productos activos.
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
              ELIMINAR DEFINITIVAMENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
