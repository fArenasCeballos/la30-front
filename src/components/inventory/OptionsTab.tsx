import { useState, useEffect, useCallback } from "react";
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
  Settings2,
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
  const [options, setOptions] = useState<ProductCustomOption[]>([]);
  const [choices, setChoices] = useState<Record<string, ProductCustomChoice[]>>(
    {},
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");

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

      if (optRes.data) setOptions(optRes.data as ProductCustomOption[]);
      if (catRes.data) setCategories(catRes.data as Category[]);

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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCatLabel = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? `${cat.icon || ""} ${cat.label}` : catId;
  };

  const filteredOptions =
    filterCat === "all"
      ? options
      : options.filter(
          (o) =>
            o.category_id === filterCat ||
            (o.category_ids && o.category_ids.includes(filterCat)),
        );

  const nextOptionSortOrder = () => {
    if (options.length === 0) return 0;
    return Math.max(...options.map((o) => o.sort_order ?? 0)) + 1;
  };

  const openNewOption = () => {
    setEditOption(null);
    setOptionForm({
      category_ids: filterCat !== "all" ? [filterCat] : [],
      option_key: "",
      label: "",
      icon: "🧅",
      sort_order: String(nextOptionSortOrder()),
      store_ids: [],
    });
    setIsOptionDialogOpen(true);
  };

  const openEditOption = (option: ProductCustomOption) => {
    setEditOption(option);
    setOptionForm({
      category_ids:
        option.category_ids || (option.category_id ? [option.category_id] : []),
      option_key: option.option_key,
      label: option.label,
      icon: option.icon || "",
      sort_order: String(option.sort_order),
      store_ids: option.store_ids || [],
    });
    setIsOptionDialogOpen(true);
  };

  const saveOption = async () => {
    setSaving(true);
    try {
      if (
        !optionForm.label.trim() ||
        !optionForm.option_key.trim() ||
        optionForm.category_ids.length === 0
      ) {
        toast.error("Completa todos los campos obligatorios");
        setSaving(false);
        return;
      }
      const optionData = {
        category_ids: optionForm.category_ids,
        category_id: optionForm.category_ids[0],
        option_key: optionForm.option_key.toLowerCase().replace(/\s+/g, "_"),
        label: optionForm.label,
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
        toast.success("Opción actualizada");
      } else {
        const { error } = await supabase
          .from("product_custom_options")
          .insert([optionData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Opción creada");
      }
      await fetchData();
      setIsOptionDialogOpen(false);
    } catch (err: unknown) {
      toast.error("Error interno al guardar la opción");
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
    toast.success("Opción eliminada");
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
        name: choiceForm.label,
        value: choiceForm.value.toLowerCase().replace(/\s+/g, "_"),
        label: choiceForm.label,
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
        toast.success("Variable actualizada");
      } else {
        const { error } = await supabase
          .from("product_custom_choices")
          .insert([choiceData]);
        if (error) {
          toast.error(`Error DB: ${error.message}`);
          setSaving(false);
          return;
        }
        toast.success("Variable agregada");
      }
      await fetchData();
      setIsChoiceDialogOpen(false);
    } catch (err: unknown) {
      toast.error("Error interno al guardar la variable");
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
    toast.success("Variable eliminada");
    setChoiceToDelete(null);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Cargando personalizaciones...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-16 animate-in fade-in duration-1000 fill-mode-both">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 bg-white/40 backdrop-blur-xl p-6 lg:p-10 rounded-4xl lg:rounded-[3.5rem] border border-white shadow-strong relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-10 relative">
          <div className="h-14 w-14 lg:h-20 lg:w-20 rounded-2xl lg:rounded-4xl bg-linear-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary shadow-inner border border-primary/5 group-hover:rotate-12 transition-transform duration-500">
            <ListChecks className="h-7 w-7 lg:h-10 lg:w-10" strokeWidth={2.5} />
          </div>
          <div className="space-y-6 sm:space-y-2">
            <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-[0.5em] text-primary/40 leading-none">
              PERSONALIZACIÓN POR SELECCIÓN
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <p className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground whitespace-nowrap">
                {options.length}{" "}
                <span className="text-primary/40 font-bold">Variaciones</span>
              </p>
              <div className="h-12 w-[3px] bg-primary/10 hidden sm:block rounded-full" />
              <div className="relative group/select min-w-[280px]">
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="h-14 lg:h-16 px-6 lg:px-8 rounded-xl lg:rounded-2xl border-2 lg:border-4 border-white bg-white/60 backdrop-blur-md shadow-soft font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all focus:border-primary/40 focus:ring-0 group-hover/select:shadow-strong group-hover/select:scale-105">
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
          onClick={openNewOption}
          className="h-14 lg:h-20 px-8 lg:px-12 rounded-2xl lg:rounded-[2.5rem] font-black text-xs lg:text-sm tracking-widest shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group bg-primary hover:bg-primary/90 text-white border-2 lg:border-4 border-white/20 relative"
        >
          <Plus
            className="h-5 w-5 lg:h-7 lg:w-7 mr-3 lg:mr-4 group-hover:rotate-90 transition-transform duration-700"
            strokeWidth={3}
          />
          NUEVA VARIACIÓN
        </Button>
      </div>

      <div className="space-y-6 lg:space-y-12">
        {filteredOptions.map((option, idx) => {
          const optChoices = choices[option.id] || [];
          return (
            <div
              key={option.id}
              className="pos-card overflow-hidden group border-4 border-white transition-all duration-700 hover:shadow-2xl bg-white/60 hover:bg-white relative"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Header Section */}
              <div className="bg-linear-to-br from-accent/5 to-accent/10 p-6 lg:p-12 border-b-2 lg:border-b-4 border-white flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-10">
                <div className="flex items-center gap-8">
                  <div className="h-16 w-16 lg:h-24 lg:w-24 rounded-2xl lg:rounded-4xl bg-white flex items-center justify-center text-4xl lg:text-6xl shadow-strong group-hover:scale-110 transition-all duration-700 group-hover:rotate-6 relative">
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl scale-0 group-hover:scale-100 transition-transform duration-700" />
                    <span className="relative">{option.icon || "🛠️"}</span>
                  </div>
                  <div className="space-y-2 lg:space-y-4">
                    <h3 className="font-black text-xl lg:text-4xl tracking-tighter text-foreground group-hover:text-primary transition-colors leading-none">
                      {option.label}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4">
                      {(
                        option.category_ids ||
                        (option.category_id ? [option.category_id] : [])
                      ).map((cid) => (
                        <div
                          key={cid}
                          className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 bg-primary/5 text-primary border-primary/10 shadow-soft"
                        >
                          {getCatLabel(cid)}
                        </div>
                      ))}
                      <div className="h-10 w-[2px] bg-primary/10 hidden sm:block rounded-full mx-2" />
                      <span className="text-[10px] font-black text-primary/40 tracking-[0.3em] uppercase bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
                        KEY: {option.option_key}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 lg:gap-4 opacity-0 translate-x-10 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-700">
                  <Button
                    size="icon"
                    className="h-12 w-12 lg:h-16 lg:w-16 rounded-xl lg:rounded-2xl shadow-strong bg-white/90 backdrop-blur-md text-foreground hover:bg-primary hover:text-white transition-all border-none"
                    onClick={() => openEditOption(option)}
                  >
                    <Edit className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={3} />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-12 w-12 lg:h-16 lg:w-16 rounded-xl lg:rounded-2xl shadow-strong bg-destructive/90 backdrop-blur-md hover:bg-destructive hover:scale-110 transition-all border-none"
                    onClick={() => setOptionToDelete(option)}
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Choices Section */}
              <div className="p-12 space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-12 bg-primary/20 rounded-full" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-muted-foreground/40">
                      OPCIONES DISPONIBLES ({optChoices.length})
                    </h4>
                  </div>
                  <Button
                    onClick={() => openNewChoice(option.id)}
                    className="h-12 lg:h-14 px-6 lg:px-8 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase tracking-widest border-2 lg:border-4 border-white shadow-soft bg-white hover:bg-primary hover:text-white hover:scale-105 transition-all"
                  >
                    <Plus
                      className="h-4 w-4 lg:h-5 lg:w-5 mr-2 lg:mr-3"
                      strokeWidth={3}
                    />{" "}
                    AÑADIR
                  </Button>
                </div>

                {optChoices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                    {optChoices.map((choice) => (
                      <div
                        key={choice.id}
                        className="flex items-center justify-between p-4 lg:p-6 rounded-3xl lg:rounded-4xl border-2 border-accent/5 bg-accent/5 hover:bg-white hover:border-primary/20 hover:shadow-strong transition-all duration-500 group/choice relative overflow-hidden"
                      >
                        <div className="flex items-center gap-3 lg:gap-5">
                          <span className="text-xl lg:text-3xl group-hover/choice:scale-125 group-hover/choice:rotate-12 transition-transform duration-500">
                            {choice.icon || "🔹"}
                          </span>
                          <span className="text-xs lg:text-sm font-black tracking-tighter text-foreground/80 group-hover/choice:text-primary transition-colors">
                            {choice.label}
                          </span>
                        </div>
                        <div className="flex gap-2 opacity-0 translate-x-4 group-hover/choice:opacity-100 group-hover/choice:translate-x-0 transition-all duration-500">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => openEditChoice(choice)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => setChoiceToDelete(choice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-primary/5 rounded-full blur-xl opacity-0 group-hover/choice:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 border-4 border-white rounded-[3.5rem] bg-accent/5 border-dashed flex flex-col items-center justify-center space-y-6">
                    <div className="h-20 w-20 rounded-4xl bg-white border-2 shadow-soft flex items-center justify-center text-muted-foreground/20">
                      <ListChecks className="h-10 w-10 animate-pulse" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">
                      Configura las opciones que el cliente podrá elegir.
                    </p>
                  </div>
                )}
              </div>

              {/* Decorative element */}
              <div className="absolute -right-24 -bottom-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            </div>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="col-span-full py-48 flex flex-col items-center justify-center space-y-10 bg-white/40 rounded-[4rem] border-4 border-white shadow-soft group">
            <div className="h-32 w-32 rounded-[3rem] bg-accent/5 flex items-center justify-center text-muted-foreground/20 group-hover:scale-110 transition-transform duration-700">
              <ListChecks
                className="h-16 w-16 animate-pulse"
                strokeWidth={1.5}
              />
            </div>
            <div className="text-center space-y-3">
              <p className="font-black uppercase tracking-[0.5em] text-sm text-muted-foreground/40">
                SIN VARIACIONES
              </p>
              <p className="text-xs font-bold text-muted-foreground/20 italic max-w-xs mx-auto">
                Define grupos de variaciones para que tus clientes personalicen
                sus productos.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Option Editor Dialog */}
      <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto rounded-[3.5rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-2xl">
          <DialogHeader className="space-y-6 mb-12">
            <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner group-hover:rotate-12 transition-transform">
              {editOption ? (
                <Edit className="h-10 w-10" />
              ) : (
                <Settings2 className="h-10 w-10" />
              )}
            </div>
            <div>
              <DialogTitle className="text-5xl font-black tracking-tighter mb-3">
                {editOption ? "Editar Grupo" : "Nuevo Grupo"}
              </DialogTitle>
              <DialogDescription className="text-xl font-medium text-muted-foreground leading-relaxed">
                Agrupa selecciones como "Término de Carne" o "Tipo de Pan".
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
                    {optionForm.category_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {optionForm.category_ids.map((cid) => {
                          const cat = categories.find((c) => c.id === cid);
                          return (
                            <div
                              key={cid}
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
                          optionForm.category_ids.includes(cat.id) &&
                            "bg-primary/10",
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
                          onCheckedChange={() => {}}
                          className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 flex items-center gap-3">
                          <span className="text-2xl">{cat.icon}</span>
                          <span className="text-xs font-black uppercase tracking-widest group-hover:text-primary transition-colors">
                            {cat.label}
                          </span>
                        </div>
                        {optionForm.category_ids.includes(cat.id) && (
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
                  value={optionForm.icon}
                  onChange={(emoji) =>
                    setOptionForm((f) => ({ ...f, icon: emoji }))
                  }
                />
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                  Nombre del Grupo
                </Label>
                <div className="relative group">
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
                    className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                  />
                  {optionForm.option_key && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 shadow-inner">
                        KEY: {optionForm.option_key}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                  Prioridad de Visualización
                </Label>
                <Input
                  type="number"
                  value={optionForm.sort_order}
                  onChange={(e) =>
                    setOptionForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                  placeholder="0"
                  className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
                />
                <p className="text-[10px] font-black text-muted-foreground/30 px-2 tracking-widest uppercase italic">
                  VALORES MÁS BAJOS APARECEN PRIMERO
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                Alcance de Tiendas
              </Label>
              <div className="bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border-4 border-white shadow-soft">
                <StoreMultiSelect
                  selectedStoreIds={optionForm.store_ids}
                  onChange={(ids) =>
                    setOptionForm((f) => ({ ...f, store_ids: ids }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-16 gap-6">
            <Button
              variant="ghost"
              onClick={() => setIsOptionDialogOpen(false)}
              disabled={saving}
              className="h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] px-12"
            >
              Cerrar
            </Button>
            <Button
              onClick={saveOption}
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
                    {editOption ? "ACTUALIZAR GRUPO" : "CREAR GRUPO"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choice Editor Dialog */}
      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent className="max-w-lg rounded-[3rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-2xl">
          <DialogHeader className="space-y-6 mb-10 text-center flex flex-col items-center">
            <div className="h-20 w-20 rounded-[1.75rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner mb-2">
              <CheckCircle2 className="h-10 w-10" strokeWidth={3} />
            </div>
            <div>
              <DialogTitle className="text-4xl font-black tracking-tighter mb-2">
                {editChoice.choice ? "Editar Opción" : "Añadir Opción"}
              </DialogTitle>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">
                Configura los valores de selección
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-10">
            <div className="flex flex-col items-center gap-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">
                Identificador Visual
              </Label>
              <div className="p-8 rounded-4xl bg-white border-4 border-white shadow-soft transition-transform hover:scale-110">
                <EmojiPicker
                  value={choiceForm.icon}
                  onChange={(emoji) =>
                    setChoiceForm((f) => ({ ...f, icon: emoji }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 opacity-40">
                Nombre de la Opción
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
                placeholder="Ej: Brioche"
                className="h-16 px-8 rounded-2xl border-4 border-white shadow-soft bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 text-xl font-black transition-all"
              />
            </div>
          </div>

          <DialogFooter className="mt-12 gap-4">
            <Button
              variant="ghost"
              onClick={() => setIsChoiceDialogOpen(false)}
              className="h-14 rounded-xl font-black text-[11px] uppercase tracking-widest px-8"
            >
              CANCELAR
            </Button>
            <Button
              onClick={saveChoice}
              disabled={saving}
              className="flex-1 h-14 bg-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-strong shadow-primary/20 relative group/choice-save overflow-hidden"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/choice-save:translate-y-0 transition-transform duration-300" />
                  <span className="relative">
                    {editChoice.choice ? "GUARDAR CAMBIOS" : "AÑADIR OPCIÓN"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Delete Alert */}
      <AlertDialog
        open={!!optionToDelete}
        onOpenChange={(open) => !open && setOptionToDelete(null)}
      >
        <AlertDialogContent className="rounded-[3.5rem] border-4 border-white p-12 max-w-lg bg-white/95 backdrop-blur-2xl shadow-strong">
          <AlertDialogHeader className="space-y-6">
            <div className="h-24 w-24 rounded-[2.5rem] bg-destructive/10 flex items-center justify-center text-destructive mb-2 shadow-inner">
              <Trash2 className="h-12 w-12" />
            </div>
            <div>
              <AlertDialogTitle className="text-4xl font-black tracking-tighter mb-4">
                ¿Remover grupo?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
                El grupo{" "}
                <strong className="text-foreground">
                  "{optionToDelete?.label}"
                </strong>{" "}
                y todas sus opciones internas serán eliminadas de forma
                permanente.
                <div className="mt-8 flex items-start gap-4 p-6 bg-destructive/5 rounded-3xl border-2 border-destructive/10">
                  <div className="h-3 w-3 rounded-full bg-destructive mt-1.5 shrink-0 animate-pulse" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-destructive leading-tight">
                    Esta acción afectará la visualización en el kiosko
                    inmediatamente.
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
              onClick={deleteOption}
              className="h-16 px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] bg-destructive text-white hover:bg-destructive/90 shadow-strong shadow-destructive/20 border-4 border-white/20"
            >
              CONFIRMAR ELIMINACIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Choice Delete Alert */}
      <AlertDialog
        open={!!choiceToDelete}
        onOpenChange={(open) => !open && setChoiceToDelete(null)}
      >
        <AlertDialogContent className="rounded-[3rem] border-4 border-white p-10 max-w-md bg-white/95 backdrop-blur-2xl shadow-strong">
          <AlertDialogHeader className="space-y-4">
            <div className="h-20 w-20 rounded-4xl bg-destructive/10 flex items-center justify-center text-destructive mb-2 shadow-inner">
              <Trash2 className="h-10 w-10" />
            </div>
            <div>
              <AlertDialogTitle className="text-3xl font-black tracking-tighter mb-2">
                ¿Eliminar opción?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground font-medium">
                La opción{" "}
                <strong className="text-foreground">
                  "{choiceToDelete?.label}"
                </strong>{" "}
                será removida de este grupo.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-3">
            <AlertDialogCancel className="h-14 rounded-xl font-black uppercase tracking-[0.2em] text-[9px] border-4 border-white bg-white/50 px-6 shadow-soft">
              CANCELAR
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteChoice}
              className="h-14 flex-1 rounded-xl font-black uppercase tracking-[0.2em] text-[9px] bg-destructive text-white hover:bg-destructive/90 shadow-strong shadow-destructive/20"
            >
              ELIMINAR OPCIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
