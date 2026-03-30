import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/formatPrice';
import type { Category, ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Package, Plus, Edit, Trash2, Search, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Inventario() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<ProductWithCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', price: '' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    const { data: prodData } = await supabase
      .from('products')
      .select('*, categories(*)')
      .order('sort_order');
    if (prodData) setProducts(prodData as unknown as ProductWithCategory[]);
    setLoading(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (catData) setCategories(catData as Category[]);
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchProducts();
      await fetchCategories();
    };
    load();
  }, [fetchProducts, fetchCategories]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditProduct(null);
    setForm({ 
      name: '', 
      category_id: categories[0]?.id || '', 
      price: '' 
    });
    setImagePreview(null);
    setIsDialogOpen(true);
  };

  const openEdit = (product: ProductWithCategory) => {
    setEditProduct(product);
    setForm({ 
      name: product.name, 
      category_id: product.category_id, 
      price: String(product.price) 
    });
    setImagePreview(product.image_url || null);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { // 2MB limit for base64 strings in DB
      toast.error('La imagen no debe superar 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.category_id) {
      toast.error('Completa todos los campos');
      return;
    }

    const productData = {
      name: form.name,
      category_id: form.category_id,
      price: Number(form.price),
      image_url: imagePreview,
    };

    if (editProduct) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('products') as any)
        .update(productData)
        .eq('id', editProduct.id);
      
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
      toast.success('Producto actualizado');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('products') as any)
        .insert([productData]);
      
      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }
      toast.success('Producto creado');
    }
    
    fetchProducts();
    setIsDialogOpen(false);
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('products') as any)
      .update({ available: !currentStatus })
      .eq('id', id);
    
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, available: !currentStatus } : p
    ));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Producto eliminado');
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando inventario...</div>;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          <h1 className="font-display text-xl sm:text-2xl font-bold">Inventario</h1>
          <Badge variant="secondary">{products.length} productos</Badge>
        </div>
        <Button onClick={openNew} size="touch">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nuevo Producto</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-10 h-11"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map(product => (
          <div key={product.id} className={`pos-card transition-opacity ${!product.available ? 'opacity-50' : ''}`}>
            {/* Product image */}
            <div className="aspect-square rounded-lg bg-muted/50 mb-3 overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl sm:text-5xl">{product.categories?.icon || '📦'}</span>
              )}
            </div>
            <div className="flex items-start justify-between mb-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{product.name}</h3>
                <span className="text-xs text-muted-foreground">{product.categories?.label}</span>
              </div>
              <Switch
                checked={product.available}
                onCheckedChange={() => toggleAvailability(product.id, product.available)}
              />
            </div>
            <p className="font-display text-lg sm:text-xl font-bold text-primary mb-2">{formatPrice(product.price)}</p>
            <div className="flex items-center gap-2">
              <Badge variant={product.available ? 'success' : 'pending'} className="text-xs">
                {product.available ? 'Disponible' : 'Agotado'}
              </Badge>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(product)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(product.id)}>
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
              {editProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Imagen del producto</Label>
              <div
                className="relative aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setImagePreview(null); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-2 p-4">
                    <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Toca para subir imagen</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG (máx. 2MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select 
                value={form.category_id} 
                onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Precio (COP)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="15000"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editProduct ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
