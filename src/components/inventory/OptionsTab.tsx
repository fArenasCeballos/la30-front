import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, ProductCustomOption, ProductCustomChoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Edit, Trash2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

export function OptionsTab() {
  const [options, setOptions] = useState<ProductCustomOption[]>([]);
  const [choices, setChoices] = useState<Record<string, ProductCustomChoice[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  
  const [editOption, setEditOption] = useState<ProductCustomOption | null>(null);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [optionForm, setOptionForm] = useState({
    category_id: '',
    option_key: '',
    label: '',
    icon: '',
    sort_order: '0',
  });

  const [editChoice, setEditChoice] = useState<{choice: ProductCustomChoice | null, optionId: string}>({choice: null, optionId: ''});
  const [isChoiceDialogOpen, setIsChoiceDialogOpen] = useState(false);
  const [choiceForm, setChoiceForm] = useState({
    value: '',
    label: '',
    icon: '',
    sort_order: '0',
  });

  const fetchData = useCallback(async () => {
    const [{ data: optData }, { data: choData }, { data: catData }] = await Promise.all([
      supabase.from('product_custom_options').select('*').order('sort_order'),
      supabase.from('product_custom_choices').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    
    if (optData) setOptions(optData as ProductCustomOption[]);
    if (catData) setCategories(catData as Category[]);
    
    if (choData) {
      const groupedChoices: Record<string, ProductCustomChoice[]> = {};
      (choData as ProductCustomChoice[]).forEach(choice => {
        if (!groupedChoices[choice.option_id]) {
          groupedChoices[choice.option_id] = [];
        }
        groupedChoices[choice.option_id].push(choice);
      });
      setChoices(groupedChoices);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchData();
    };
    load();
  }, [fetchData]);

  const getCatLabel = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? `${cat.icon || ''} ${cat.label}` : catId;
  };

  const filteredOptions = filterCat === 'all'
    ? options
    : options.filter(o => o.category_id === filterCat);

  // --- Opciones (Grupos) ---
  const openNewOption = () => {
    setEditOption(null);
    setOptionForm({
      category_id: categories[0]?.id || '',
      option_key: '',
      label: '',
      icon: '🧅',
      sort_order: String(options.length),
    });
    setIsOptionDialogOpen(true);
  };

  const openEditOption = (option: ProductCustomOption) => {
    setEditOption(option);
    setOptionForm({
      category_id: option.category_id,
      option_key: option.option_key,
      label: option.label,
      icon: option.icon || '',
      sort_order: String(option.sort_order),
    });
    setIsOptionDialogOpen(true);
  };

  const saveOption = async () => {
    try {
      if (!optionForm.label.trim() || !optionForm.option_key.trim() || !optionForm.category_id) {
        toast.error('Completa todos los campos obligatorios');
        return;
      }
      const optionData = {
        category_id: optionForm.category_id,
        option_key: optionForm.option_key.toLowerCase().replace(/\s+/g, '_'),
        label: optionForm.label,
        icon: optionForm.icon || null,
        sort_order: Number(optionForm.sort_order) || 0,
      };

      if (editOption) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_custom_options') as any)
          .update(optionData)
          .eq('id', editOption.id);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Opción actualizada');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_custom_options') as any)
          .insert([optionData]);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Opción creada');
      }
      await fetchData();
      setIsOptionDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in saveOption:", err);
      toast.error('Error interno al guardar la opción');
    }
  };

  const deleteOption = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta opción de personalización? Se eliminarán también todas sus variables.')) return;
    const { error } = await supabase.from('product_custom_options').delete().eq('id', id);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    setOptions(prev => prev.filter(o => o.id !== id));
    toast.success('Opción eliminada');
  };

  // --- Opciones (Choices) ---
  const openNewChoice = (optionId: string) => {
    const currentChoices = choices[optionId] || [];
    setEditChoice({ choice: null, optionId });
    setChoiceForm({
      value: '',
      label: '',
      icon: '✅',
      sort_order: String(currentChoices.length),
    });
    setIsChoiceDialogOpen(true);
  };

  const openEditChoice = (choice: ProductCustomChoice) => {
    setEditChoice({ choice, optionId: choice.option_id });
    setChoiceForm({
      value: choice.value,
      label: choice.label,
      icon: choice.icon || '',
      sort_order: String(choice.sort_order),
    });
    setIsChoiceDialogOpen(true);
  };

  const saveChoice = async () => {
    try {
      if (!choiceForm.label.trim() || !choiceForm.value.trim()) {
        toast.error('Completa todos los campos obligatorios');
        return;
      }
      const choiceData = {
        option_id: editChoice.optionId,
        value: choiceForm.value.toLowerCase().replace(/\s+/g, '_'),
        label: choiceForm.label,
        icon: choiceForm.icon || null,
        sort_order: Number(choiceForm.sort_order) || 0,
      };

      if (editChoice.choice) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_custom_choices') as any)
          .update(choiceData)
          .eq('id', editChoice.choice.id);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Variable actualizada');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_custom_choices') as any)
          .insert([choiceData]);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Variable agregada');
      }
      await fetchData();
      setIsChoiceDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in saveChoice:", err);
      toast.error('Error interno al guardar la variable');
    }
  };

  const deleteChoice = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta variable?')) return;
    const { error } = await supabase.from('product_custom_choices').delete().eq('id', id);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    fetchData();
    toast.success('Variable eliminada');
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando opciones...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{options.length} grupos</Badge>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNewOption} size="touch">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      <div className="space-y-4">
        {filteredOptions.map(option => {
          const optChoices = choices[option.id] || [];
          return (
            <div key={option.id} className="pos-card overflow-hidden">
              <div className="bg-muted/30 -mx-4 -mt-4 p-4 border-b mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.icon || '🛠️'}</span>
                  <div>
                    <h3 className="font-semibold">{option.label}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{getCatLabel(option.category_id)}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{option.option_key}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditOption(option)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteOption(option.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Variables seleccionables ({optChoices.length})
                  </span>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openNewChoice(option.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Variable
                  </Button>
                </div>

                {optChoices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {optChoices.map(choice => (
                      <div key={choice.id} className="flex items-center justify-between p-2 rounded-lg border bg-card hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{choice.icon || '🔹'}</span>
                          <span className="text-sm font-medium">{choice.label}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditChoice(choice)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteChoice(choice.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 border border-dashed rounded-lg bg-muted/10">
                    <p className="text-sm text-muted-foreground">No hay variables configuradas.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredOptions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-xl">
            <ListChecks className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No hay grupos de personalización{filterCat !== 'all' ? ' para esta categoría' : ''}.</p>
            <p className="text-sm text-muted-foreground">Crea grupos como "Tipo de pan" o "Cebolla".</p>
          </div>
        )}
      </div>

      {/* Dialog para Grupos (Options) */}
      <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editOption ? 'Editar Grupo' : 'Nuevo Grupo de Personalización'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={optionForm.category_id} onValueChange={(v) => setOptionForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Icono (emoji)</Label>
              <Input value={optionForm.icon} onChange={e => setOptionForm(f => ({ ...f, icon: e.target.value }))} placeholder="🧅" className="text-2xl text-center" />
            </div>
            <div className="space-y-2">
              <Label>Clave (slug)</Label>
              <Input value={optionForm.option_key} onChange={e => setOptionForm(f => ({ ...f, option_key: e.target.value }))} placeholder="cebolla" />
              <p className="text-xs text-muted-foreground">Identificador único dentro de la categoría</p>
            </div>
            <div className="space-y-2">
              <Label>Etiqueta visible</Label>
              <Input value={optionForm.label} onChange={e => setOptionForm(f => ({ ...f, label: e.target.value }))} placeholder="Cebolla" />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input type="number" value={optionForm.sort_order} onChange={e => setOptionForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOptionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveOption}>{editOption ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Variables (Choices) */}
      <Dialog open={isChoiceDialogOpen} onOpenChange={setIsChoiceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editChoice.choice ? 'Editar Variable' : 'Nueva Variable'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Icono (emoji)</Label>
              <Input value={choiceForm.icon} onChange={e => setChoiceForm(f => ({ ...f, icon: e.target.value }))} placeholder="🚫" className="text-xl text-center" />
            </div>
            <div className="space-y-2">
              <Label>Valor (slug)</Label>
              <Input value={choiceForm.value} onChange={e => setChoiceForm(f => ({ ...f, value: e.target.value }))} placeholder="sin_cebolla" />
            </div>
            <div className="space-y-2">
              <Label>Etiqueta visible</Label>
              <Input value={choiceForm.label} onChange={e => setChoiceForm(f => ({ ...f, label: e.target.value }))} placeholder="Sin cebolla" />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input type="number" value={choiceForm.sort_order} onChange={e => setChoiceForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsChoiceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveChoice}>{editChoice.choice ? 'Guardar' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
