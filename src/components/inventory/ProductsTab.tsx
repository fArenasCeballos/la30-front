import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";
import type { Category, ProductWithCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  Edit,
  Trash2,
  Search,
  ImagePlus,
  X,
  Loader2,
  GripHorizontal,
  Package,
  MoreVertical,
  Power,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import {
  resizeImage,
  uploadProductImage,
  getOptimizedImageUrl,
  deleteProductImage,
} from "@/lib/imageUtils";
import { StoreMultiSelect } from "./StoreMultiSelect";

export function ProductsTab() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editProduct, setEditProduct] = useState<ProductWithCategory | null>(
    null,
  );
  const [productToDelete, setProductToDelete] =
    useState<ProductWithCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    category_id: string;
    price: string;
    sort_order: string;
    store_ids: string[];
  }>({
    name: "",
    category_id: "",
    price: "",
    sort_order: "0",
    store_ids: [],
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    const { data: prodData } = await supabase
      .from("products")
      .select("*, categories(*)")
      .order("sort_order");
    if (prodData) setProducts(prodData as unknown as ProductWithCategory[]);
    setLoading(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data: catData } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    if (catData) setCategories(catData as Category[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await fetchProducts();
      await fetchCategories();
    };
    load();
  }, [fetchProducts, fetchCategories, user]);

  const filtered = (products || []).filter((p) => {
    if (!p || !p.name) return false;
    const matchesSearch = p.name
      .toLowerCase()
      .includes((search || "").toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openNew = () => {
    setEditProduct(null);
    setForm({
      name: "",
      category_id: categories[0]?.id || "",
      price: "",
      sort_order: "0",
      store_ids: categories[0]?.store_ids || [],
    });
    if (imagePreview && imagePreview.startsWith("blob:"))
      URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setSelectedFile(null);
    setIsDragging(false);
    setIsDialogOpen(true);
  };

  const openEdit = (product: ProductWithCategory) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      category_id: product.category_id || "",
      price: String(product.price),
      sort_order: String(product.sort_order || 0),
      store_ids: product.store_ids || [],
    });
    if (imagePreview && imagePreview.startsWith("blob:"))
      URL.revokeObjectURL(imagePreview);

    // Normalizar la URL si viene rota de la DB (inyectar /public/ si falta)
    let initialImage = product.image_url;
    if (initialImage && initialImage.includes("/storage/v1/object/assets/")) {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "");
      initialImage = initialImage.replace(
        /\/storage\/v1\/object\/assets\//,
        `${baseUrl}/storage/v1/object/public/assets/`,
      );
    }

    setImagePreview(initialImage || null);
    setSelectedFile(null);
    setIsDragging(false);
    setIsDialogOpen(true);
  };

  const processFile = (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Solo se permiten imágenes JPG o PNG");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("La imagen no debe superar 15MB");
      return;
    }

    setSelectedFile(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
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
        toast.error("Completa todos los campos");
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
          const msg =
            uploadError instanceof Error
              ? uploadError.message
              : "Error al subir imagen";
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      const productData = {
        name: form.name,
        category_id: form.category_id,
        price: Number(form.price),
        sort_order: Number(form.sort_order),
        image_url: finalImageUrl,
        store_ids: form.store_ids,
      };

      if (editProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editProduct.id);
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

        toast.success("Producto actualizado");
      } else {
        const { error } = await supabase.from("products").insert([productData]);
        if (error) {
          // ROLLBACK STORAGE
          if (uploadedPath) await deleteProductImage(uploadedPath);
          toast.error(`Error DB: ${error.message}`);
          return;
        }
        toast.success("Producto creado");
      }

      await fetchProducts();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in handleSave:", err);
      // ROLLBACK STORAGE
      if (uploadedPath) await deleteProductImage(uploadedPath);
      toast.error("Error interno al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ available: !currentStatus })
      .eq("id", id);
    if (error) {
      toast.error(`Error DB: ${error.message}`);
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, available: !currentStatus } : p)),
    );
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    const product = productToDelete;
    // Guardar referencia de la imagen antes de borrar de la DB
    const imageUrl = product.image_url;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      if (error.code === "23503") {
        toast.error(
          "No se puede eliminar: Este producto tiene pedidos asociados.",
        );
      } else {
        toast.error(`Error: ${error.message}`);
      }
      setProductToDelete(null);
      return;
    }

    // Si el borrado de la DB fue exitoso, borrar la imagen del Storage
    if (imageUrl) {
      await deleteProductImage(imageUrl);
    }

    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    toast.success("Producto eliminado");
    setProductToDelete(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProducts((items) => {
        const visibleItems = items.filter((p) => {
          if (!p || !p.name) return false;
          const matchesSearch = p.name
            .toLowerCase()
            .includes((search || "").toLowerCase());
          const matchesCategory =
            categoryFilter === "all" || p.category_id === categoryFilter;
          return matchesSearch && matchesCategory;
        });

        const oldIndex = visibleItems.findIndex((i) => i.id === active.id);
        const newIndex = visibleItems.findIndex((i) => i.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return items;

        const newVisibleItems = arrayMove(visibleItems, oldIndex, newIndex);

        const updatedItems = newVisibleItems.map((item, index) => ({
          ...item,
          sort_order: index,
        }));

        const newProducts = items
          .map((p) => {
            const updated = updatedItems.find((u) => u.id === p.id);
            return updated ? updated : p;
          })
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        // Actualización silenciosa a base de datos
        updatedItems.forEach(async (u) => {
          await supabase
            .from("products")
            .update({ sort_order: u.sort_order })
            .eq("id", u.id);
        });

        return newProducts;
      });
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Actualizando catálogo...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-1000 fill-mode-both">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="relative flex-1 max-w-3xl group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search
              className="h-7 w-7 text-muted-foreground/40 group-focus-within:text-primary transition-all duration-500 group-focus-within:scale-110"
              strokeWidth={2.5}
            />
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el catálogo maestro..."
            className="pl-16 h-20 rounded-[2.5rem] border-4 border-white shadow-strong focus-visible:ring-primary/20 bg-white/60 backdrop-blur-xl transition-all text-xl font-bold placeholder:text-muted-foreground/30 focus-visible:border-primary/40 focus-visible:scale-[1.02]"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-white/60 backdrop-blur-xl px-8 py-4 rounded-4xl border-4 border-white shadow-strong hidden md:flex items-center gap-5 group/stats hover:scale-105 transition-all duration-500">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover/stats:rotate-12 transition-transform">
              <Package className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 leading-none mb-1.5">
                CATÁLOGO TOTAL
              </p>
              <p className="text-lg font-black text-foreground">
                {products.length}{" "}
                <span className="text-primary/40 font-bold ml-1">
                  Productos
                </span>
              </p>
            </div>
          </div>
          <Button
            onClick={openNew}
            className="h-20 px-12 rounded-[2.5rem] font-black text-sm tracking-widest shadow-strong shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all group bg-primary hover:bg-primary/90 text-white border-4 border-white/20"
          >
            <Plus
              className="h-7 w-7 mr-4 group-hover:rotate-90 transition-transform duration-700"
              strokeWidth={3}
            />
            AGREGAR PRODUCTO
          </Button>
        </div>
      </div>

      {/* Premium Category Filter */}
      <div className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <div className="h-[3px] w-16 bg-primary/30 rounded-full" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-muted-foreground/40">
            FILTRADO TEMÁTICO
          </h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-8 pt-2 no-scrollbar scroll-smooth -mx-4 px-4">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "h-16 px-12 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all shrink-0 border-4",
              categoryFilter === "all"
                ? "shadow-strong shadow-primary/20 scale-110 z-10 border-white bg-primary text-white"
                : "bg-white/60 border-white shadow-soft hover:border-primary/40 text-muted-foreground/40 hover:text-primary hover:bg-white",
            )}
          >
            TODOS
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={categoryFilter === cat.id ? "default" : "outline"}
              onClick={() => setCategoryFilter(cat.id)}
              className={cn(
                "h-16 px-12 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all shrink-0 border-4 group/cat",
                categoryFilter === cat.id
                  ? "shadow-strong shadow-primary/20 scale-110 z-10 border-white bg-primary text-white"
                  : "bg-white/60 border-white shadow-soft hover:border-primary/40 text-muted-foreground/40 hover:text-primary hover:bg-white",
              )}
            >
              <span className="text-2xl mr-4 scale-110 group-hover/cat:scale-125 transition-transform">
                {cat.icon}
              </span>
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-10">
          <SortableContext
            items={filtered.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            {filtered.map((product) => (
              <SortableProductCard
                key={product.id}
                product={product}
                openEdit={openEdit}
                setProductToDelete={setProductToDelete}
                toggleAvailability={toggleAvailability}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {filtered.length === 0 && (
        <div className="py-40 flex flex-col items-center justify-center space-y-8 bg-accent/5 rounded-[3.5rem] border-4 border-dashed border-accent/20 animate-in fade-in duration-700">
          <div className="h-28 w-28 rounded-[2.5rem] bg-white border-2 shadow-soft flex items-center justify-center text-muted-foreground/20">
            <Search className="h-12 w-12 animate-pulse" strokeWidth={3} />
          </div>
          <div className="text-center">
            <p className="font-black uppercase tracking-[0.4em] text-sm text-muted-foreground/40 mb-2">
              Sin coincidencias exactas
            </p>
            <p className="text-xs font-bold text-muted-foreground/30 italic">
              Intenta con otros términos o ajusta los filtros
            </p>
          </div>
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] p-10 border-none shadow-strong">
          <DialogHeader className="space-y-4 mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              {editProduct ? (
                <Edit className="h-8 w-8" />
              ) : (
                <Plus className="h-8 w-8" />
              )}
            </div>
            <DialogTitle className="text-4xl font-black tracking-tight">
              {editProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription className="text-lg font-medium text-muted-foreground">
              {editProduct
                ? "Modifica la información, precio y visibilidad en tus tiendas."
                : "Crea una nueva experiencia para tus clientes en el menú."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            {/* Image Upload Area */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                Fotografía Principal
              </Label>
              <div
                className={cn(
                  "relative aspect-video rounded-4xl border-4 border-dashed transition-all duration-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden group",
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.02] shadow-strong"
                    : "border-accent/40 bg-accent/10 hover:border-primary/40 hover:bg-accent/20 shadow-soft",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <>
                    <img
                      src={
                        imagePreview.startsWith("blob:")
                          ? imagePreview
                          : getOptimizedImageUrl(imagePreview, 800)
                      }
                      alt="Preview"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white p-4 rounded-full shadow-xl">
                        <ImagePlus className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-6 right-6 h-12 w-12 rounded-2xl shadow-strong border-2 border-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (imagePreview.startsWith("blob:"))
                          URL.revokeObjectURL(imagePreview);
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-6 w-6" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-4 p-8">
                    <div className="h-20 w-20 rounded-4xl bg-white border shadow-soft flex items-center justify-center mx-auto group-hover:rotate-6 transition-transform">
                      <ImagePlus
                        className={cn(
                          "h-10 w-10 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-widest text-[11px] mb-1">
                        {isDragging
                          ? "SUELTA PARA CARGAR"
                          : "CARGAR IMAGEN DEL MENÚ"}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        JPG o PNG de alta resolución (máx. 15MB)
                      </p>
                    </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                  Nombre del Ítem
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ej: Hamburguesa Clásica"
                  className="h-14 rounded-2xl border-2 bg-accent/10 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                  Categoría
                </Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category_id: v }))
                  }
                >
                  <SelectTrigger className="h-14 rounded-2xl border-2 bg-accent/10 border-transparent font-bold">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-strong">
                    {categories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={cat.id}
                        className="rounded-xl py-3 font-bold"
                      >
                        <span className="mr-2 text-lg">{cat.icon}</span>{" "}
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                  Precio al Público
                </Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black opacity-40">
                    $
                  </div>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="0.00"
                    className="h-14 pl-8 rounded-2xl border-2 bg-accent/10 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 font-black text-lg"
                  />
                </div>
                {form.price && (
                  <p className="text-xs font-black text-primary px-1 tracking-widest uppercase animate-in fade-in slide-in-from-top-1">
                    {formatPrice(Number(form.price))} COP
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                  Prioridad en Lista
                </Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                  placeholder="0"
                  className="h-14 rounded-2xl border-2 bg-accent/10 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 font-bold"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1 opacity-60">
                Disponibilidad por Tiendas
              </Label>
              <StoreMultiSelect
                selectedStoreIds={form.store_ids}
                onChange={(ids) => setForm((f) => ({ ...f, store_ids: ids }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-12 gap-4">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs px-8"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs px-10 shadow-lg shadow-primary/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  PROCESANDO...
                </>
              ) : editProduct ? (
                "GUARDAR CAMBIOS"
              ) : (
                "CREAR PRODUCTO"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <AlertDialogContent className="rounded-[2.5rem] border-4 p-10 max-w-lg">
          <AlertDialogHeader className="space-y-4">
            <div className="h-20 w-20 rounded-4xl bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <Trash2 className="h-10 w-10" />
            </div>
            <AlertDialogTitle className="text-3xl font-black tracking-tight">
              ¿Eliminar este ítem?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium text-muted-foreground leading-relaxed">
              El producto{" "}
              <strong className="text-foreground">
                {productToDelete?.name}
              </strong>{" "}
              será removido permanentemente de todos los menús y tiendas. Esta
              acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] border-2">
              Mantener Ítem
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-destructive text-white hover:bg-destructive/90 shadow-strong shadow-destructive/20"
            >
              CONFIRMAR ELIMINACIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InventoryProductImage({ product }: { product: ProductWithCategory }) {
  const [error, setError] = useState(false);

  if (!product.image_url || error) {
    return (
      <div className="h-full w-full bg-accent/20 flex flex-col items-center justify-center opacity-40">
        <span className="text-6xl mb-2">
          {product.categories?.icon || "📦"}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest">
          Sin Imagen
        </span>
      </div>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(product.image_url, 400)}
      alt={product.name}
      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
      onError={() => setError(true)}
    />
  );
}

function SortableProductCard({
  product,
  openEdit,
  setProductToDelete,
  toggleAvailability,
}: {
  product: ProductWithCategory;
  openEdit: (p: ProductWithCategory) => void;
  setProductToDelete: (p: ProductWithCategory) => void;
  toggleAvailability: (id: string, current: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "pos-card group flex flex-col h-full border-4 transition-all duration-700 relative overflow-hidden",
        isDragging
          ? "shadow-2xl scale-105 z-50 border-primary bg-white ring-8 ring-primary/5"
          : "shadow-strong hover:shadow-2xl hover:scale-[1.03] border-white bg-white/60 hover:bg-white hover:border-primary/20",
        !product.available && "opacity-60 grayscale-[0.4]",
      )}
    >
      {/* Product Image Section */}
      <div className="aspect-4/3 rounded-2xl lg:rounded-[2.5rem] bg-accent/10 m-2 lg:m-3 overflow-hidden relative border-2 lg:border-4 border-white shadow-soft group-hover:shadow-strong transition-all duration-700">
        <InventoryProductImage product={product} />

        {/* Desktop Drag Handle (Hidden on mobile) */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-3 left-3 z-30 h-12 w-12 rounded-xl bg-white/90 backdrop-blur-md shadow-lg border-2 border-accent/10 items-center justify-center cursor-grab active:cursor-grabbing hidden lg:flex opacity-0 group-hover:opacity-100 transition-all duration-500 hover:scale-110 hover:bg-primary hover:text-white group/drag"
        >
          <GripHorizontal
            className="h-6 w-6 text-primary group-hover/drag:text-white"
            strokeWidth={3}
          />
        </div>

        {/* Mobile Action Menu (Clean UI) */}
        <div className="absolute top-3 right-3 z-40 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg border-2 border-white text-foreground active:scale-95 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-3xl border-4 border-white shadow-strong backdrop-blur-xl bg-white/95">
              <DropdownMenuItem
                className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 focus:bg-primary focus:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(product);
                }}
              >
                <Edit className="h-5 w-5" />
                EDITAR PRODUCTO
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 focus:bg-primary focus:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAvailability(product.id, product.available);
                }}
              >
                <Power className={cn("h-5 w-5", product.available ? "text-primary group-focus:text-white" : "text-destructive")} />
                {product.available ? "MARCAR AGOTADO" : "MARCAR DISPONIBLE"}
              </DropdownMenuItem>
              <div className="h-px bg-accent/10 my-1 mx-2" />
              <DropdownMenuItem
                className="h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest gap-3 px-4 text-destructive focus:bg-destructive focus:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setProductToDelete(product);
                }}
              >
                <Trash2 className="h-5 w-5" />
                ELIMINAR PRODUCTO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop Action Buttons Overlay */}
        <div className="absolute inset-x-3 bottom-3 hidden lg:flex gap-2 translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700 z-30">
          <Button
            size="sm"
            className="flex-1 h-12 rounded-xl font-black text-[9px] tracking-[0.2em] shadow-xl bg-white/95 backdrop-blur-md text-foreground hover:bg-primary hover:text-white transition-all border-none"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(product);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            EDITAR
          </Button>
          <div
            className={cn(
              "flex items-center px-4 rounded-xl bg-white/95 backdrop-blur-md shadow-xl border-2 transition-colors",
              product.available ? "border-primary/20" : "border-destructive/20",
            )}
          >
            <Switch
              checked={product.available}
              onCheckedChange={() =>
                toggleAvailability(product.id, product.available)
              }
              className="scale-75 data-[state=checked]:bg-primary"
            />
          </div>
          <Button
            size="icon"
            variant="destructive"
            className="h-12 w-12 rounded-xl shadow-xl bg-destructive/90 backdrop-blur-md hover:bg-destructive hover:scale-105 transition-all border-none"
            onClick={(e) => {
              e.stopPropagation();
              setProductToDelete(product);
            }}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Gradient Overlay for bottom text readability */}
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      </div>

      {/* Content Info */}
      <div className="flex-1 flex flex-col space-y-2 lg:space-y-5 p-4 lg:p-8 pt-2 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
            <span className="text-[10px] mr-1.5">
              {product.categories?.icon}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
              {product.categories?.label}
            </span>
          </div>
          {!product.available && (
            <div className="px-3 py-1 bg-destructive/10 rounded-full border border-destructive/20 flex items-center gap-2 animate-pulse">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span className="text-[9px] font-black uppercase tracking-widest text-destructive">
                AGOTADO
              </span>
            </div>
          )}
        </div>

        <h3 className="font-black text-base lg:text-2xl tracking-tighter text-foreground group-hover:text-primary transition-colors duration-500 leading-[1.1] min-h-[2.2em]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between pt-4 lg:pt-6 border-t border-accent/10 mt-auto">
          <div className="flex flex-col">
            <p className="text-[8px] lg:text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] mb-0.5 lg:mb-1">
              VALOR UNITARIO
            </p>
            <p className="font-black text-xl lg:text-4xl text-primary tracking-tighter group-hover:scale-110 transition-transform origin-left duration-700">
              {formatPrice(product.price)}
            </p>
          </div>


          <div className="hidden lg:flex -space-x-3 group/stores">
            {(product.store_ids || []).slice(0, 3).map((sid, i) => (
              <div
                key={sid}
                className="h-8 w-8 rounded-full border-4 border-white bg-accent/20 shadow-soft flex items-center justify-center overflow-hidden transition-transform duration-500 hover:z-10 hover:-translate-y-2"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="h-full w-full bg-linear-to-br from-accent/10 to-accent/30" />
              </div>
            ))}
            {(product.store_ids || []).length > 3 && (
              <div className="h-8 w-8 rounded-full border-4 border-white bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary backdrop-blur-sm shadow-soft hover:z-10 hover:-translate-y-2 transition-transform duration-500">
                +{(product.store_ids || []).length - 3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
}
