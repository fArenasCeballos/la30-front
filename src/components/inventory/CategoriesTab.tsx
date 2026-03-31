import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
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
import { toast } from 'sonner';

export function CategoriesTab() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', label: '', icon: '', sort_order: '0' });

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (error) { toast.error(`Error: ${error.message}`); return; }
    if (data) setCategories(data as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await fetchCategories();
    };
    load();
  }, [fetchCategories, user]);

  const openNew = () => {
    setEditCategory(null);
    setForm({ name: '', label: '', icon: '📦', sort_order: String(categories.length) });
    setIsDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setForm({
      name: cat.name,
      label: cat.label,
      icon: cat.icon || '',
      sort_order: String(cat.sort_order),
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!form.name.trim() || !form.label.trim()) {
        toast.error('El nombre clave y la etiqueta son obligatorios');
        return;
      }

      const catData = {
        name: form.name.toLowerCase().replace(/\s+/g, '_'),
        label: form.label,
        icon: form.icon || null,
        sort_order: Number(form.sort_order) || 0,
      };

      if (editCategory) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('categories') as any)
          .update(catData)
          .eq('id', editCategory.id)
          .select();

        if (error) {
          console.error("❌ Error en UPDATE:", error);
          toast.error(`Error al actualizar: ${error.message}`);
          return;
        }
        toast.success('Categoría actualizada');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error, data } = await (supabase.from('categories') as any)
          .insert(catData)
          .select();

        if (error) {
          console.error("❌ Error en INSERT:", error);
          toast.error(`Error al crear: ${error.message}`);
          return;
        }
        console.log("✅ INSERT exitoso:", data);
        toast.success('Categoría creada');
      }

      console.log("5. Refrescando categorías...");
      await fetchCategories();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      console.error("❌ Error inesperado en handleSave:", err);
      toast.error('Error interno al guardar la categoría');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('categories') as any)
    .update({ is_active: !currentStatus })
    .eq('id', id)
    .select();

  if (error) {
    toast.error(`Error: ${error.message}`);
    return;
  }

  setCategories(prev =>
    prev.map(c =>
      c.id === id ? { ...c, is_active: !currentStatus } : c
    )
  );
};

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    
    const id = categoryToDelete.id;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    
    if (error) {
      if (error.code === '23503') {
        toast.error('No se puede eliminar: Esta categoría tiene productos asociados.');
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setCategoryToDelete(null);
      return;
    }

    setCategories(prev => prev.filter(c => c.id !== id));
    toast.success('Categoría eliminada');
    setCategoryToDelete(null);
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando categorías...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Badge variant="secondary">{categories.length} categorías</Badge>
        <Button onClick={openNew} size="touch">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {categories.map(cat => (
          <div
            key={cat.id}
            className={`pos-card transition-opacity ${!cat.is_active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <span className="text-3xl">{cat.icon || '📦'}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{cat.label}</h3>
                <span className="text-xs text-muted-foreground font-mono">{cat.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={cat.is_active ? 'success' : 'pending'} className="text-xs">
                {cat.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
              <span className="text-xs text-muted-foreground">Orden: {cat.sort_order}</span>
              <div className="ml-auto flex items-center gap-1">
                <Switch
                  checked={cat.is_active}
                  onCheckedChange={() => toggleActive(cat.id, cat.is_active)}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(cat)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCategoryToDelete(cat)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Icono (emoji)</Label>
              <Input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🌭"
                className="text-2xl text-center"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre clave (slug)</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="perros_calientes"
              />
              <p className="text-xs text-muted-foreground">
                Identificador interno, sin espacios ni tildes. Ej: <code>perros</code>, <code>hamburguesas</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Etiqueta visible</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Perros Calientes"
              />
            </div>
            <div className="space-y-2">
              <Label>Orden de visualización</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editCategory ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog 
        open={!!categoryToDelete} 
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la categoría <strong>{categoryToDelete?.label}</strong> permanentemente. 
              <br /><br />
              <span className="text-destructive font-medium">Nota:</span> Si la categoría tiene productos asociados, no podrá ser eliminada por seguridad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar Categoría
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
