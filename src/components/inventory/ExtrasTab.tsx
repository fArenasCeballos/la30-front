import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/formatPrice';
import type { Category, ProductExtra } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Sparkles } from 'lucide-react';
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
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const generateSlug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');

export function ExtrasTab() {
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [editExtra, setEditExtra] = useState<ProductExtra | null>(null);
  const [extraToDelete, setExtraToDelete] = useState<ProductExtra | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    category_ids: [] as string[],
    extra_key: '',
    label: '',
    icon: '',
    price_per_unit: '',
    max_qty: '1',
    sort_order: '0',
  });

  const fetchData = useCallback(async () => {
    const [{ data: extData }, { data: catData }] = await Promise.all([
      supabase.from('product_extras').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    if (extData) setExtras(extData as ProductExtra[]);
    if (catData) setCategories(catData as Category[]);
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

  const filtered = filterCat === 'all'
    ? extras
    : extras.filter(e => 
        (e.category_ids && e.category_ids.includes(filterCat)) || 
        (e.category_id === filterCat)
      );

  const nextSortOrder = () => {
    if (extras.length === 0) return 0;
    return Math.max(...extras.map(e => e.sort_order ?? 0)) + 1;
  };

  const openNew = () => {
    setEditExtra(null);
    setForm({
      category_ids: filterCat !== 'all' ? [filterCat] : (categories[0]?.id ? [categories[0].id] : []),
      extra_key: '',
      label: '',
      icon: '🧀',
      price_per_unit: '',
      max_qty: '1',
      sort_order: String(nextSortOrder()),
    });
    setIsDialogOpen(true);
  };

  const openEdit = (extra: ProductExtra) => {
    setEditExtra(extra);
    setForm({
      category_ids: extra.category_ids || (extra.category_id ? [extra.category_id] : []),
      extra_key: extra.extra_key,
      label: extra.label,
      icon: extra.icon || '',
      price_per_unit: String(extra.price_per_unit),
      max_qty: String(extra.max_qty),
      sort_order: String(extra.sort_order),
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!form.label.trim() || !form.extra_key.trim() || form.category_ids.length === 0 || !form.price_per_unit) {
        toast.error('Completa todos los campos obligatorios');
        return;
      }
      const extraData = {
        category_ids: form.category_ids,
        category_id: form.category_ids[0], // Keep first for backward compat if column still exists
        extra_key: form.extra_key.toLowerCase().replace(/\s+/g, '_'),
        label: form.label,
        icon: form.icon || null,
        price_per_unit: Number(form.price_per_unit),
        max_qty: Number(form.max_qty) || 1,
        sort_order: Number(form.sort_order) || 0,
      };

      if (editExtra) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_extras') as any)
          .update(extraData)
          .eq('id', editExtra.id);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Extra actualizado');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('product_extras') as any)
          .insert([extraData]);
        if (error) { toast.error(`Error DB: ${error.message}`); return; }
        toast.success('Extra creado');
      }
      await fetchData();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in saveExtra:", err);
      toast.error('Error interno al guardar el extra');
    }
  };

  const handleDelete = async () => {
    if (!extraToDelete) return;
    const { error } = await supabase.from('product_extras').delete().eq('id', extraToDelete.id);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    setExtras(prev => prev.filter(e => e.id !== extraToDelete.id));
    toast.success('Extra eliminado');
    setExtraToDelete(null);
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando extras...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{extras.length} extras</Badge>
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
        <Button onClick={openNew} size="touch">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Extra
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map(extra => (
          <div key={extra.id} className="pos-card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{extra.icon || '➕'}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{extra.label}</h3>
                <span className="text-xs text-muted-foreground font-mono">{extra.extra_key}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {extra.category_ids && extra.category_ids.length > 0 ? (
                extra.category_ids.map(cid => (
                  <Badge key={cid} variant="default" className="text-[10px] px-1 h-5">{getCatLabel(cid)}</Badge>
                ))
              ) : (
                <Badge variant="default" className="text-[10px] px-1 h-5">{getCatLabel(extra.category_id)}</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-bold text-primary">{formatPrice(extra.price_per_unit)}</p>
                <p className="text-xs text-muted-foreground">Máximo: {extra.max_qty} uds.</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(extra)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setExtraToDelete(extra)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No hay extras{filterCat !== 'all' ? ' para esta categoría' : ''}.</p>
            <p className="text-sm text-muted-foreground">Crea uno para que aparezca en el Kiosko.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editExtra ? 'Editar Extra' : 'Nuevo Extra'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categorías</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10 py-2">
                    {form.category_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {form.category_ids.map(catId => {
                          const cat = categories.find(c => c.id === catId);
                          return (
                            <Badge key={catId} variant="secondary" className="text-[10px] px-1 h-5">
                              {cat?.icon} {cat?.label}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Selecciona una o más categorías</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2" align="start">
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {categories.map((cat) => (
                      <div 
                        key={cat.id} 
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                        onClick={() => {
                          const current = form.category_ids;
                          const next = current.includes(cat.id)
                            ? current.filter(id => id !== cat.id)
                            : [...current, cat.id];
                          setForm(f => ({ ...f, category_ids: next }));
                        }}
                      >
                        <Checkbox 
                          checked={form.category_ids.includes(cat.id)} 
                          onCheckedChange={() => {}} // Handle in parent div
                        />
                        <label className="text-sm cursor-pointer flex-1 select-none">
                          {cat.icon} {cat.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Icono (emoji)</Label>
              <EmojiPicker value={form.icon} onChange={(emoji) => setForm(f => ({ ...f, icon: emoji }))} />
            </div>
            <div className="space-y-2">
              <Label>Etiqueta visible</Label>
              <Input value={form.label} onChange={e => {
                const label = e.target.value;
                setForm(f => ({
                  ...f,
                  label,
                  extra_key: editExtra ? f.extra_key : generateSlug(label),
                }));
              }} placeholder="Queso extra" />
              {form.extra_key && (
                <p className="text-xs text-muted-foreground">
                  Clave: <code className="bg-muted px-1 rounded">{form.extra_key}</code>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio por unidad (COP)</Label>
                <Input type="number" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} placeholder="2000" />
              </div>
              <div className="space-y-2">
                <Label>Cantidad máxima</Label>
                <Input type="number" value={form.max_qty} onChange={e => setForm(f => ({ ...f, max_qty: e.target.value }))} placeholder="3" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editExtra ? 'Guardar cambios' : 'Crear extra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={!!extraToDelete} 
        onOpenChange={(open) => !open && setExtraToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar extra?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas eliminar el extra <strong>{extraToDelete?.label}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar Extra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
