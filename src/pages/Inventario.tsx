import { useState, useRef } from 'react';
import { MOCK_PRODUCTS, formatPrice } from '@/data/mock';
import type{ Product } from '@/types';
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
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'perros' as Product['category'], price: '' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditProduct(null);
    setForm({ name: '', category: 'perros', price: '' });
    setImagePreview(null);
    setIsDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setForm({ name: product.name, category: product.category, price: String(product.price) });
    setImagePreview(product.image || null);
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.price) {
      toast.error('Completa todos los campos');
      return;
    }
    if (editProduct) {
      setProducts(prev => prev.map(p =>
        p.id === editProduct.id
          ? { ...p, name: form.name, category: form.category, price: Number(form.price), image: imagePreview || undefined }
          : p
      ));
      toast.success('Producto actualizado');
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: form.name,
        category: form.category,
        price: Number(form.price),
        image: imagePreview || undefined,
        available: true,
      };
      setProducts(prev => [...prev, newProduct]);
      toast.success('Producto creado');
    }
    setIsDialogOpen(false);
  };

  const toggleAvailability = (id: string) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, available: !p.available } : p
    ));
  };

  const handleDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Producto eliminado');
  };

  const categoryLabels: Record<string, string> = {
    perros: '🌭 Perros',
    hamburguesas: '🍔 Hamburguesas',
    bebidas: '🥤 Bebidas',
    extras: '🍟 Extras',
  };

  const categoryEmoji: Record<string, string> = {
    perros: '🌭',
    hamburguesas: '🍔',
    bebidas: '🥤',
    extras: '🍟',
  };

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
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl sm:text-5xl">{categoryEmoji[product.category]}</span>
              )}
            </div>
            <div className="flex items-start justify-between mb-1">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">{product.name}</h3>
                <span className="text-xs text-muted-foreground">{categoryLabels[product.category]}</span>
              </div>
              <Switch
                checked={product.available}
                onCheckedChange={() => toggleAvailability(product.id)}
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
                    <p className="text-xs text-muted-foreground">JPG, PNG (máx. 5MB)</p>
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
              <Select value={form.category} onValueChange={(v: Product['category']) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="perros">🌭 Perros</SelectItem>
                  <SelectItem value="hamburguesas">🍔 Hamburguesas</SelectItem>
                  <SelectItem value="bebidas">🥤 Bebidas</SelectItem>
                  <SelectItem value="extras">🍟 Extras</SelectItem>
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
