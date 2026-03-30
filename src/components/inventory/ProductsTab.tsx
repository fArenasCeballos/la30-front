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
import { Plus, Edit, Trash2, Search, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { resizeImage, uploadProductImage, getOptimizedImageUrl, deleteProductImage } from '@/lib/imageUtils';

export function ProductsTab() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<ProductWithCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', price: '' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setForm({ name: '', category_id: categories[0]?.id || '', price: '' });
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setSelectedFile(null);
    setIsDragging(false);
    setIsDialogOpen(true);
  };

  const openEdit = (product: ProductWithCategory) => {
    setEditProduct(product);
    setForm({ name: product.name, category_id: product.category_id, price: String(product.price) });
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    
    // Normalizar la URL si viene rota de la DB (inyectar /public/ si falta)
    let initialImage = product.image_url;
    if (initialImage && initialImage.includes('/storage/v1/object/assets/')) {
       const baseUrl = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '');
       initialImage = initialImage.replace(/\/storage\/v1\/object\/assets\//, `${baseUrl}/storage/v1/object/public/assets/`);
    }
    
    setImagePreview(initialImage || null);
    setSelectedFile(null);
    setIsDragging(false);
    setIsDialogOpen(true);
  };

  const processFile = (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG o PNG');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('La imagen no debe superar 15MB');
      return;
    }

    setSelectedFile(file);
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      if (!form.name.trim() || !form.price || !form.category_id) {
        toast.error('Completa todos los campos');
        return;
      }

      let finalImageUrl = imagePreview;

      // 1. Subida de imagen si hay archivo nuevo seleccionado
      if (selectedFile) {
        try {
          const resizedBlob = await resizeImage(selectedFile);
          const { publicUrl, path } = await uploadProductImage(resizedBlob);
          finalImageUrl = publicUrl;
          uploadedPath = path; // Guardamos el path para rollback si falla el DB
        } catch (uploadError: unknown) {
          const msg = uploadError instanceof Error ? uploadError.message : 'Error al subir imagen';
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      const productData = {
        name: form.name,
        category_id: form.category_id,
        price: Number(form.price),
        image_url: finalImageUrl,
      };

      if (editProduct) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('products') as any).update(productData).eq('id', editProduct.id);
        if (error) { 
          // ROLLBACK STORAGE: Si el DB falla, borramos la imagen que acabamos de subir
          if (uploadedPath) await deleteProductImage(uploadedPath);
          toast.error(`Error DB: ${error.message}`); 
          return; 
        }

        // LIMPIEZA: Si el nuevo upload fue exitoso y el update DB también, borramos la vieja
        if (selectedFile && editProduct.image_url) {
          await deleteProductImage(editProduct.image_url);
        }

        toast.success('Producto actualizado');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('products') as any).insert([productData]);
        if (error) { 
          // ROLLBACK STORAGE
          if (uploadedPath) await deleteProductImage(uploadedPath);
          toast.error(`Error DB: ${error.message}`); 
          return; 
        }
        toast.success('Producto creado');
      }

      await fetchProducts();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in handleSave:", err);
      // ROLLBACK STORAGE
      if (uploadedPath) await deleteProductImage(uploadedPath);
      toast.error('Error interno al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('products') as any).update({ available: !currentStatus }).eq('id', id);
    if (error) { toast.error(`Error DB: ${error.message}`); return; }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, available: !currentStatus } : p));
  };

  const handleDelete = async (product: ProductWithCategory) => {
    if (!confirm(`¿Seguro que deseas eliminar el producto "${product.name}"?`)) return;
    
    // Guardar referencia de la imagen antes de borrar de la DB
    const imageUrl = product.image_url;
    
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) { toast.error(`Error: ${error.message}`); return; }
    
    // Si el borrado de la DB fue exitoso, borrar la imagen del Storage
    if (imageUrl) {
      await deleteProductImage(imageUrl);
    }

    setProducts(prev => prev.filter(p => p.id !== product.id));
    toast.success('Producto eliminado');
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando productos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Badge variant="secondary">{products.length} productos</Badge>
        <Button onClick={openNew} size="touch">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nuevo Producto</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="pl-10 h-11" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map(product => (
          <div key={product.id} className={`pos-card transition-opacity ${!product.available ? 'opacity-50' : ''}`}>
            <div className="aspect-square rounded-lg bg-muted/50 mb-3 overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img src={getOptimizedImageUrl(product.image_url, 400)} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl sm:text-5xl">{product.categories?.icon || '📦'}</span>
              )}
            </div>
            <div className="flex items-start justify-between mb-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{product.name}</h3>
                <span className="text-xs text-muted-foreground">{product.categories?.label}</span>
              </div>
              <Switch checked={product.available} onCheckedChange={() => toggleAvailability(product.id, product.available)} />
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
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(product)}>
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
            <div className="space-y-2">
              <Label>Imagen del producto</Label>
              <div
                className={`relative aspect-video rounded-xl border-2 border-dashed transition-all flex items-center justify-center cursor-pointer overflow-hidden ${
                  isDragging 
                    ? 'border-primary bg-primary/10 scale-[1.02]' 
                    : 'border-border bg-muted/30 hover:border-primary/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview.startsWith('blob:') ? imagePreview : getOptimizedImageUrl(imagePreview, 600)} alt="Preview" className="w-full h-full object-cover" />
                    <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={(e) => { 
                      e.stopPropagation(); 
                      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
                      setImagePreview(null); 
                      setSelectedFile(null); 
                    }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-2 p-4">
                    <ImagePlus className={`h-8 w-8 mx-auto transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm text-muted-foreground">
                      {isDragging ? 'Suelta para subir' : 'Arrastra o toca para subir imagen'}
                    </p>
                    <p className="text-xs text-muted-foreground">JPG, PNG (máx. 15MB)</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del producto" />
            </div>
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
              <Label>Precio (COP)</Label>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="15000" />
              {form.price && (
                <p className="text-sm font-medium text-primary text-right animate-in fade-in slide-in-from-top-1">
                  {formatPrice(Number(form.price))}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editProduct ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
