import { useEffect, useState, useMemo } from 'react';
import { formatPrice } from '@/lib/formatPrice';
import type { Product, Category, ProductWithCategory } from '@/types';
import { useOrders } from '@/context/OrderContext';
import { ProductCustomizer } from '@/components/ProductCustomizer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Minus, Trash2, ShoppingCart, ArrowLeft, ArrowRight, CheckCircle, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

interface CartItem {
  id: string;
  product: ProductWithCategory;
  quantity: number;
  notes?: string;
  unit_price: number;
}

const categoryEmoji: Record<string, string> = {
  perros: '🌭',
  hamburguesas: '🍔',
  bebidas: '🥤',
  extras: '🍟',
};

export default function Kiosko() {
  const { addOrder } = useOrders();
  const [locator, setLocator] = useState('');
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'locator' | 'menu' | 'confirm'>('locator');
  const [orderNotes, setOrderNotes] = useState('');
  const [customizingProduct, setCustomizingProduct] = useState<ProductWithCategory | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
      const { data: prodData } = await supabase.from('products').select('*, categories(*)').eq('available', true).order('sort_order');
      
      if (catData && catData.length > 0) {
        setCategories(catData as Category[]);
        setActiveCategory((catData[0] as Category).name);
      }
      
      if (prodData) {
        setProducts(prodData as unknown as ProductWithCategory[]);
      }
    };
    loadData();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter(p => p.categories?.name === activeCategory),
    [products, activeCategory]
  );

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart]
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleProductClick = (product: ProductWithCategory) => {
    setCustomizingProduct(product);
  };

  const handleCustomizationConfirm = (product: Product, notes: string, extraCost: number) => {
    const unitPrice = product.price + extraCost;
    const cartKey = `${product.id}-${notes}`;
    
    setCart(prev => {
      const existing = prev.find(i => i.id === cartKey);
      if (existing) {
        return prev.map(i => i.id === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        id: cartKey, 
        product: product as ProductWithCategory, 
        quantity: 1, 
        notes: notes || undefined,
        unit_price: unitPrice 
      }];
    });
    toast.success(`${product.name} agregado`, { duration: 1000 });
    setCustomizingProduct(null);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => i.id === itemId ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    );
  };

  const handleSend = async () => {
    if (cart.length === 0) {
      toast.error('Agrega productos al pedido');
      return;
    }
    
    const itemsForDb = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      notes: item.notes || undefined
    }));

    await addOrder(locator, itemsForDb, orderNotes);
    setCart([]);
    setLocator('');
    setOrderNotes('');
    setStep('locator');
  };

  // Step 1: Locator
  if (step === 'locator') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Nuevo Pedido</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Ingresa el número de localizador del cliente</p>
          <Input
            value={locator}
            onChange={e => setLocator(e.target.value.toUpperCase())}
            placeholder="Ej: A-12"
            className="h-14 sm:h-16 text-center text-xl sm:text-2xl font-display font-bold"
            autoFocus
          />
          <Button
            size="xl"
            className="w-full"
            disabled={!locator.trim()}
            onClick={() => setStep('menu')}
          >
            <ArrowRight className="h-5 w-5 mr-2" />
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Confirmation
  if (step === 'confirm') {
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 animate-slide-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep('menu')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl sm:text-2xl font-bold">Confirmar Pedido</h1>
        </div>

        <div className="pos-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Localizador</span>
            <span className="font-display text-xl sm:text-2xl font-bold text-primary">{locator}</span>
          </div>

          <div className="space-y-3 border-t pt-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs shrink-0">{item.quantity}x</Badge>
                    <span className="font-medium text-sm truncate">{item.product.name}</span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 ml-8">📝 {item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {item.product.image_url && (
                    <img 
                      src={getOptimizedImageUrl(item.product.image_url, 80)} 
                      alt={item.product.name} 
                      className="w-10 h-10 rounded-md object-cover border" 
                    />
                  )}
                  <span className="text-sm font-semibold shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-base sm:text-lg font-medium">Total</span>
              <span className="font-display text-2xl sm:text-3xl font-bold text-primary">{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{itemCount} producto(s)</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notas del pedido (opcional)</label>
          <Textarea
            value={orderNotes}
            onChange={e => setOrderNotes(e.target.value)}
            placeholder="Notas adicionales..."
            className="resize-none"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="touch" className="flex-1" onClick={() => setStep('menu')}>
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button size="touch" className="flex-2" onClick={handleSend}>
            <CheckCircle className="h-5 w-5 mr-2" />
            Enviar a Caja
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Menu selection
  return (
    <>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        {/* Product selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 border-b">
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <Button variant="ghost" size="icon" onClick={() => { setStep('locator'); setCart([]); }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="font-display text-lg sm:text-xl font-bold">Mesa {locator}</h2>

              {/* Mobile cart button */}
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="touch" className="ml-auto lg:hidden relative">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    <span className="text-sm">{itemCount}</span>
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-96 p-0 flex flex-col">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle className="font-display flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Carrito
                    </SheetTitle>
                  </SheetHeader>
                  <CartContent 
                    cart={cart} 
                    updateQuantity={updateQuantity} 
                    total={total} 
                    itemCount={itemCount} 
                    setStep={setStep} 
                    setCartOpen={setCartOpen} 
                  />
                </SheetContent>
              </Sheet>

              <Badge variant="default" className="hidden lg:flex">{itemCount} items</Badge>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.name ? 'default' : 'secondary'}
                  size="touch"
                  onClick={() => setActiveCategory(cat.name)}
                  className="whitespace-nowrap text-xs sm:text-sm"
                >
                  {cat.icon} {cat.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {filteredProducts.map(product => {
                const inCartCount = cart
                  .filter(i => i.product.id === product.id)
                  .reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className={`pos-card text-left hover:border-primary/50 active:scale-[0.98] transition-all touch-target ${inCartCount > 0 ? 'border-primary/30 bg-accent/50' : ''}`}
                  >
                    {/* Product image */}
                    <div className="aspect-square rounded-lg bg-muted/50 mb-2 overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <img src={getOptimizedImageUrl(product.image_url, 400)} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl sm:text-4xl">{categoryEmoji[product.categories?.name || ''] || '🍔'}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm mb-1 truncate">{product.name}</h3>
                    <p className="font-display font-bold text-primary text-sm sm:text-base">{formatPrice(product.price)}</p>
                    {inCartCount > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="default" className="text-xs">{inCartCount}</Badge>
                        <span className="text-xs text-muted-foreground">en pedido</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile floating total bar */}
          {cart.length > 0 && (
            <div className="lg:hidden p-3 border-t bg-card flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{itemCount} productos</p>
                <p className="font-display text-xl font-bold text-primary">{formatPrice(total)}</p>
              </div>
              <Button size="touch" onClick={() => setStep('confirm')}>
                <ArrowRight className="h-5 w-5 mr-2" />
                Revisar
              </Button>
            </div>
          )}
        </div>

        {/* Desktop cart sidebar */}
        <div className="hidden lg:flex w-96 border-l bg-card flex-col">
          <div className="p-4 border-b flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold">Carrito</h3>
            <span className="text-xs text-muted-foreground ml-auto">{itemCount} productos</span>
          </div>
          <CartContent 
            cart={cart} 
            updateQuantity={updateQuantity} 
            total={total} 
            itemCount={itemCount} 
            setStep={setStep} 
            setCartOpen={setCartOpen} 
          />
        </div>
      </div>

      <ProductCustomizer
        product={customizingProduct}
        categoryName={customizingProduct?.categories?.name}
        open={!!customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={handleCustomizationConfirm}
      />
    </>
  );
}
interface CartContentProps {
  cart: CartItem[];
  updateQuantity: (itemId: string, delta: number) => void;
  total: number;
  itemCount: number;
  setStep: (step: 'locator' | 'menu' | 'confirm') => void;
  setCartOpen: (open: boolean) => void;
}

function CartContent({ cart, updateQuantity, total, itemCount, setStep, setCartOpen }: CartContentProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Toca un producto para agregarlo</p>
          </div>
        )}
        {cart.map(item => (
          <div key={item.id} className="rounded-xl bg-background p-3 space-y-2 animate-slide-in">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(item.unit_price)} c/u</p>
                {item.notes && (
                  <p className="text-xs text-primary/80 mt-0.5">📝 {item.notes}</p>
                )}
              </div>
              <span className="font-display font-bold text-sm text-primary">
                {formatPrice(item.unit_price * item.quantity)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQuantity(item.id, -1)}>
                  {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5" />}
                </Button>
                <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQuantity(item.id, 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t space-y-3 bg-card">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal ({itemCount} items)</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-primary">{formatPrice(total)}</span>
          </div>
        </div>
        <Button
          size="touch"
          className="w-full"
          onClick={() => { setStep('confirm'); setCartOpen(false); }}
          disabled={cart.length === 0}
        >
          <ArrowRight className="h-5 w-5 mr-2" />
          Revisar Pedido
        </Button>
      </div>
    </>
  );
}
