import { useState, useCallback, useEffect, useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import { supabase } from "@/lib/supabase";
import type {
  Category,
  ProductCustomOption,
  ProductCustomChoice,
} from "@/types";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  ListChecks,
  Loader2,
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

export function OptionsTab() {
  const { stores } = useStore();
  const companyStoreIds = useMemo(() => new Set(stores.map((s) => s.id)), [stores]);
  const [options, setOptions] = useState<ProductCustomOption[]>([]);
  const [choices, setChoices] = useState<Record<string, ProductCustomChoice[]>>(
    {},
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [editOption, setEditOption] = useState<ProductCustomOption | null>(
    null,
  );
  const [optionToDelete, setOptionToDelete] =
    useState<ProductCustomOption | null>(null);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optionForm, setOptionForm] = useState({
    category_ids: [] as string[],
    option_key: "",
    label: "",
    icon: "",
    sort_order: "0",
    store_ids: [] as string[],
  });

  const [editChoice, setEditChoice] = useState<{
    choice: ProductCustomChoice | null;
    optionId: string;
  }>({ choice: null, optionId: "" });
  const [choiceToDelete, setChoiceToDelete] =
    useState<ProductCustomChoice | null>(null);
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [choiceForm, setChoiceForm] = useState({
    value: "",
    label: "",
    icon: "",
    sort_order: "0",
  });

  const fetchData = useCallback(async () => {
    try {
      const [optRes, choRes, catRes] = await Promise.all([
        supabase.from("product_custom_options").select("*").order("sort_order"),
        supabase.from("product_custom_choices").select("*").order("sort_order"),
        supabase.from("categories").select("*").order("sort_order"),
      ]);

      if (optRes.data) {
        const allOpts = optRes.data as ProductCustomOption[];
        setOptions(
          allOpts.filter(
            (o) =>
              stores.length === 0 ||
              Boolean(o.store_ids && o.store_ids.some((id) => companyStoreIds.has(id))),
          ),
        );
      }
      if (catRes.data) {
        const allCats = catRes.data as Category[];
        setCategories(
          allCats.filter(
            (c) =>
              stores.length === 0 ||
              Boolean(c.store_ids && c.store_ids.some((id) => companyStoreIds.has(id))),
          ),
        );
      }

      if (choRes.data) {
        const groupedChoices: Record<string, ProductCustomChoice[]> = {};
        (choRes.data as ProductCustomChoice[]).forEach((choice) => {
          if (!groupedChoices[choice.option_id]) {
            groupedChoices[choice.option_id] = [];
          }
          groupedChoices[choice.option_id].push(choice);
        });
        setChoices(groupedChoices);
      }
    } catch (err: unknown) {
      console.error("Error fetching customization data:", err);
      toast.error("Error al cargar datos de personalización");
    } finally {
      setLoading(false);
    }
  }, [stores, companyStoreIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCatLabel = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon || ""} ${cat.label}` : catId;
  };

  const filteredOptions = options.filter((o) => {
    const matchesCategory =
      filterCat === "all" ||
      o.category_id === filterCat ||
      (o.category_ids && o.category_ids.includes(filterCat));
    const matchesSearch =
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.option_key.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const nextOptionSortOrder = () => {
    if (options.length === 0) return 0;
    return Math.max(...options.map((o) => o.sort_order ?? 0)) + 1;
  };

  const openNewOption = () => {
    setEditOption(null);
    setOptionForm({
      category_ids:
        filterCat !== "all"
          ? [filterCat]
          : categories[0]?.id
            ? [categories[0].id]
            : [],
      option_key: "",
      label: "",
      icon: "🛠️",
      sort_order: String(nextOptionSortOrder()),
      store_ids: stores.map((s) => s.id),
    });
    setIsOptionDialogOpen(true);
  };

  const openEditOption = (option: ProductCustomOption) => {
    setEditOption(option);
    setOptionForm({
      category_ids:
        option.category_ids ||
        (option.category_id ? [option.category_id] : []),
      option_key: option.option_key,
      label: option.label,
      icon: option.icon || "",
      sort_order: String(option.sort_order ?? 0),
      store_ids: option.store_ids || [],
    });
    setIsOptionDialogOpen(true);
  };

  const saveOption = async () => {
    setSaving(true);
    try {
      if (!optionForm.label.trim() || !optionForm.option_key.trim()) {
        toast.error("El nombre y la clave son obligatorios");
        setSaving(false);
        return;
      }
      if (optionForm.category_ids.length === 0) {
        toast.error("Debes vincular al menos una categoría");
        setSaving(false);
        return;
      }

      const optionData = {
        category_ids: optionForm.category_ids,
        category_id: optionForm.category_ids[0],
        option_key: optionForm.option_key
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_"),
        label: optionForm.label.trim(),
        icon: optionForm.icon || null,
        sort_order: Number(optionForm.sort_order) || 0,
        store_ids: optionForm.store_ids,
      };

      if (editOption) {
        const { error } = await supabase
          .from("product_custom_options")
          .update(optionData)
          .eq("id", editOption.id);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Grupo de variaciones actualizado");
      } else {
        const { error } = await supabase
          .from("product_custom_options")
          .insert([optionData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Grupo de variaciones creado");
      }
      await fetchData();
      setIsOptionDialogOpen(false);
    } catch {
      toast.error("Error interno al guardar el grupo");
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async () => {
    if (!optionToDelete) return;
    const { error } = await supabase
      .from("product_custom_options")
      .delete()
      .eq("id", optionToDelete.id);
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== optionToDelete.id));
    toast.success("Grupo de variaciones eliminado");
    setOptionToDelete(null);
  };

  const openNewChoice = (optionId: string) => {
    const currentChoices = choices[optionId] || [];
    const nextOrder =
      currentChoices.length === 0
        ? 0
        : Math.max(...currentChoices.map((c) => c.sort_order ?? 0)) + 1;
    setEditChoice({ choice: null, optionId });
    setChoiceForm({
      value: "",
      label: "",
      icon: "✅",
      sort_order: String(nextOrder),
    });
    setIsChoiceDialogOpen(true);
  };

  const openEditChoice = (choice: ProductCustomChoice) => {
    setEditChoice({ choice, optionId: choice.option_id });
    setChoiceForm({
      value: choice.value,
      label: choice.label,
      icon: choice.icon || "",
      sort_order: String(choice.sort_order),
    });
    setIsChoiceDialogOpen(true);
  };

  const saveChoice = async () => {
    setSaving(true);
    try {
      if (!choiceForm.label.trim() || !choiceForm.value.trim()) {
        toast.error("Completa todos los campos obligatorios");
        setSaving(false);
        return;
      }
      const choiceData = {
        option_id: editChoice.optionId,
        value: choiceForm.value.trim().toLowerCase().replace(/\s+/g, "_"),
        label: choiceForm.label.trim(),
        icon: choiceForm.icon || null,
        sort_order: Number(choiceForm.sort_order) || 0,
      };

      if (editChoice.choice) {
        const { error } = await supabase
          .from("product_custom_choices")
          .update(choiceData)
          .eq("id", editChoice.choice.id);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Opción actualizada");
      } else {
        const { error } = await supabase
          .from("product_custom_choices")
          .insert([choiceData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Opción agregada");
      }
      await fetchData();
      setIsChoiceDialogOpen(false);
    } catch {
      toast.error("Error interno al guardar la opción");
    } finally {
      setSaving(false);
    }
  };

  const deleteChoice = async () => {
    if (!choiceToDelete) return;
    const { error } = await supabase
      .from("product_custom_choices")
      .delete()
      .eq("id", choiceToDelete.id);
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    fetchData();
    toast.success("Opción eliminada");
    setChoiceToDelete(null);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="font-semibold text-xs text-slate-500">
          Cargando opciones y variaciones...
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
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Variaciones & Opciones
            </h2>
            <p className="text-xs text-slate-500">
              {options.length} grupos configurados (términos, panes, salsas)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-48 sm:w-56">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar grupo..."
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
            onClick={openNewOption}
            className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Nuevo Grupo</span>
          </Button>
        </div>
      </div>

      {/* List of Option Groups */}
      <div className="space-y-5">
        {filteredOptions.map((option) => {
          const optChoices = choices[option.id] || [];
          return (
            <div
              key={option.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
            >
              {/* Group Header */}
              <div className="p-4 sm:p-5 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-teal-50 text-2xl flex items-center justify-center border border-teal-100/70 shrink-0">
                    <span>{option.icon || "🛠️"}</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">
                      {option.label}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200/60">
                        key: {option.option_key}
                      </span>
                      {(
                        option.category_ids ||
                        (option.category_id ? [option.category_id] : [])
                      ).map((cid) => (
                        <span
                          key={cid}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60"
                        >
                          {getCatLabel(cid)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditOption(option)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    <span>Editar Grupo</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setOptionToDelete(option)}
                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Choices Content Area */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Opciones configuradas ({optChoices.length})
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => openNewChoice(option.id)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Añadir Opción</span>
                  </Button>
                </div>

                {optChoices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                    {optChoices.map((choice) => (
                      <div
                        key={choice.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 hover:bg-white hover:border-teal-500/40 hover:shadow-2xs transition-all group/choice"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">
                            {choice.icon || "🔹"}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {choice.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => openEditChoice(choice)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition-colors"
                            title="Editar opción"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setChoiceToDelete(choice)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Eliminar opción"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-medium">
                      No hay opciones agregadas a este grupo aún. Haz clic en
                      "Añadir Opción" para empezar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-center p-8">
            <ListChecks className="h-10 w-10 text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">
              No hay grupos de variaciones
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Crea grupos como "Término de la carne", "Tipo de queso" o
              "Acompañamiento".
            </p>
          </div>
        )}
      </div>

      {/* Option Editor Dialog */}
      <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
              <ListChecks className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              {editOption ? "Editar Grupo de Variación" : "Nuevo Grupo de Variación"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Agrupa selecciones como "Término de Carne" o "Tipo de Pan".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Categories Multi-Select */}
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
                    {optionForm.category_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {optionForm.category_ids.map((catId) => {
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
                          optionForm.category_ids.includes(cat.id)
                            ? "bg-teal-50 text-teal-900"
                            : "hover:bg-slate-100 text-slate-700",
                        )}
                        onClick={() => {
                          const current = optionForm.category_ids;
                          const next = current.includes(cat.id)
                            ? current.filter((id) => id !== cat.id)
                            : [...current, cat.id];
                          setOptionForm((f) => ({ ...f, category_ids: next }));
                        }}
                      >
                        <Checkbox
                          checked={optionForm.category_ids.includes(cat.id)}
                          className="h-4 w-4 rounded data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                        />
                        <span className="text-base">{cat.icon}</span>
                        <span className="flex-1">{cat.label}</span>
                        {optionForm.category_ids.includes(cat.id) && (
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
                  value={optionForm.icon}
                  onChange={(emoji) =>
                    setOptionForm((f) => ({ ...f, icon: emoji }))
                  }
                />
              </div>
            </div>

            {/* Group Label */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nombre del Grupo *
              </Label>
              <Input
                value={optionForm.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setOptionForm((f) => ({
                    ...f,
                    label,
                    option_key: editOption
                      ? f.option_key
                      : generateSlug(label),
                  }));
                }}
                placeholder="Ej: Término de la Carne"
                className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
              />
              {optionForm.option_key && (
                <p className="text-[11px] font-mono text-slate-400 px-1">
                  Clave: {optionForm.option_key}
                </p>
              )}
            </div>

            {/* Sort order */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Prioridad de Orden
              </Label>
              <Input
                type="number"
                value={optionForm.sort_order}
                onChange={(e) =>
                  setOptionForm((f) => ({ ...f, sort_order: e.target.value }))
                }
                placeholder="0"
                className="h-11 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            {/* Stores */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-semibold text-slate-700">
                Disponibilidad en Sedes
              </Label>
              <StoreMultiSelect
                selectedStoreIds={optionForm.store_ids}
                onChange={(ids) =>
                  setOptionForm((f) => ({ ...f, store_ids: ids }))
                }
              />
            </div>
          </div>

          <DialogFooter className="mt-8 gap-2.5 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsOptionDialogOpen(false)}
              disabled={saving}
              className="h-11 rounded-xl font-semibold text-xs px-5 border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveOption}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-6 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editOption ? (
                "Guardar Cambios"
              ) : (
                "Crear Grupo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choice Editor Dialog */}
      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              {editChoice.choice ? "Editar Opción" : "Añadir Opción"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Valor de selección para este grupo (ej: Término medio, Brioche, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Icono o Emoji
              </Label>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex justify-center">
                <EmojiPicker
                  value={choiceForm.icon}
                  onChange={(emoji) =>
                    setChoiceForm((f) => ({ ...f, icon: emoji }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nombre de la Opción *
              </Label>
              <Input
                value={choiceForm.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setChoiceForm((f) => ({
                    ...f,
                    label,
                    value: editChoice.choice ? f.value : generateSlug(label),
                  }));
                }}
                placeholder="Ej: Término Medio (3/4)"
                className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsChoiceDialogOpen(false)}
              className="h-10 rounded-xl font-semibold text-xs px-4"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveChoice}
              disabled={saving}
              className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 shadow-xs"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editChoice.choice ? (
                "Guardar Cambios"
              ) : (
                "Añadir Opción"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Alert */}
      <AlertDialog
        open={!!optionToDelete}
        onOpenChange={(open) => !open && setOptionToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              ¿Eliminar grupo de variación?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              El grupo{" "}
              <strong className="text-slate-800">
                "{optionToDelete?.label}"
              </strong>{" "}
              y todas sus opciones internas serán eliminadas del catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-semibold text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteOption}
              className="h-10 rounded-xl font-semibold text-xs bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Choice Alert */}
      <AlertDialog
        open={!!choiceToDelete}
        onOpenChange={(open) => !open && setChoiceToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              ¿Eliminar opción?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              La opción{" "}
              <strong className="text-slate-800">
                "{choiceToDelete?.label}"
              </strong>{" "}
              será removida de este grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-semibold text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteChoice}
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
