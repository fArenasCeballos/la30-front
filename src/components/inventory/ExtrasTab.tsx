import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/formatPrice';
import type { Category, ProductExtra } from '@/types';
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
import { Plus, Edit, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function ExtrasTab() {
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [editExtra, setEditExtra] = useState<ProductExtra | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    category_id: '',
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
    : extras.filter(e => e.category_id === filterCat);

  const openNew = () => {
    setEditExtra(null);
    setForm({
      category_id: categories[0]?.id || '',
      extra_key: '',
      label: '',
      icon: '🧀',
      price_per_unit: '',
      max_qty: '1',
      sort_order: String(extras.length),
    });
    setIsDialogOpen(true);
  };

  const openEdit = (extra: ProductExtra) => {
    setEditExtra(extra);
    setForm({
      category_id: extra.category_id,
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
      if (!form.label.trim() || !form.extra_key.trim() || !form.category_id || !form.price_per_unit) {
        toast.error('Completa todos los campos obligatorios');
        return;
      }
      const extraData = {
        category_id: form.category_id,
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

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este extra?')) return;
    const { error } = await supabase.from('product_extras').delete().eq('id', id);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    setExtras(prev => prev.filter(e => e.id !== id));
    toast.success('Extra eliminado');
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

            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-xs">{getCatLabel(extra.category_id)}</Badge>
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
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(extra.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
              <Label>Categoría</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
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
              <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🧀" className="text-2xl text-center" />
            </div>
            <div className="space-y-2">
              <Label>Clave (slug)</Label>
              <Input value={form.extra_key} onChange={e => setForm(f => ({ ...f, extra_key: e.target.value }))} placeholder="queso_extra" />
              <p className="text-xs text-muted-foreground">Identificador único: sin espacios ni tildes</p>
            </div>
            <div className="space-y-2">
              <Label>Etiqueta visible</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Queso extra" />
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
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="0" />
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
    </div>
  );
}
