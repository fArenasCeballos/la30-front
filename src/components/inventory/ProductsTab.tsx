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
    siigo_code: string;
  }>({
    name: "",
    category_id: "",
    price: "",
    sort_order: "0",
    store_ids: [],
    siigo_code: "",
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
      siigo_code: "",
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
      siigo_code: product.siigo_code || "",
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
        toast.error("Completa todos los campos obligatorios");
        setSaving(false);
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
        name: form.name.trim(),
        category_id: form.category_id,
        price: Number(form.price),
        sort_order: Number(form.sort_order),
        image_url: finalImageUrl,
        store_ids: form.store_ids,
        siigo_code: form.siigo_code.trim() || null,
      };

      if (editProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editProduct.id);
        if (error) {
          // ROLLBACK STORAGE
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
        toast.success("Producto creado con éxito");
      }

      await fetchProducts();
      setIsDialogOpen(false);
    } catch (err: unknown) {
      console.error("Error in handleSave:", err);
      if (uploadedPath) await deleteProductImage(uploadedPath);
      toast.error("Error interno al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, available: !currentStatus } : p)),
    );

    const { error } = await supabase
      .from("products")
      .update({ available: !currentStatus })
      .eq("id", id);

    if (error) {
      // Revert optimistic update
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, available: currentStatus } : p)),
      );
      toast.error(`Error al actualizar estado: ${error.message}`);
      return;
    }

    toast.success(
      !currentStatus
        ? "Producto activado (Disponible)"
        : "Producto marcado como Agotado",
    );
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    const product = productToDelete;
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

    if (imageUrl) {
      await deleteProductImage(imageUrl);
    }

    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    toast.success("Producto eliminado del catálogo");
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
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="font-semibold text-xs text-slate-500">
          Cargando catálogo de productos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Modern Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors"
              strokeWidth={2}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plato o bebida..."
              className="pl-9.5 pr-9 h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm transition-all focus-visible:ring-1 focus-visible:ring-teal-500/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons & item stats */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <div className="text-xs font-semibold text-slate-500 px-2 py-1 rounded-lg bg-slate-100 hidden sm:inline-flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "producto" : "productos"}
              </span>
            </div>

            <Button
              onClick={openNew}
              className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Nuevo Producto</span>
            </Button>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer",
              categoryFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
            )}
          >
            Todos ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer",
                  isSelected
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
                )}
              >
                <span>{cat.icon || "📦"}</span>
                <span>{cat.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isSelected
                      ? "bg-teal-700 text-teal-100"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Product Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
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

      {/* Clean Empty State */}
      {filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <Search className="h-7 w-7" />
          </div>
          <div className="max-w-sm space-y-1">
            <h3 className="font-bold text-slate-800 text-base">
              No se encontraron productos
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No hay ítems que coincidan con la búsqueda o el filtro de categoría
              seleccionado.
            </p>
          </div>
          {(search || categoryFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Restablecer filtros
            </Button>
          )}
        </div>
      )}

      {/* Product Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
              {editProduct ? (
                <Edit className="h-6 w-6" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              {editProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editProduct
                ? "Actualiza el precio, detalles y disponibilidad en los menús de tus sedes."
                : "Agrega un nuevo ítem o plato a la carta del restaurante."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Image Upload Area */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Fotografía del Producto
              </Label>
              <div
                className={cn(
                  "relative aspect-16/10 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden group",
                  isDragging
                    ? "border-teal-500 bg-teal-50/50 scale-[1.01]"
                    : "border-slate-200 bg-slate-50 hover:border-teal-500/50 hover:bg-slate-100/60",
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
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                      <div className="bg-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <ImagePlus className="h-4 w-4 text-teal-600" />
                        <span>Cambiar fotografía</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-3 right-3 h-8 w-8 rounded-xl shadow-md border border-white/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (imagePreview.startsWith("blob:"))
                          URL.revokeObjectURL(imagePreview);
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-2 p-6">
                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center mx-auto text-slate-400 group-hover:text-teal-600 transition-colors">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-700">
                        {isDragging
                          ? "Suelta la imagen aquí"
                          : "Haz clic o arrastra una foto"}
                      </p>
                      <p className="text-[11px] text-slate-400">
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

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Nombre del Ítem *
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ej: Hamburguesa Especial 30"
                  className="h-11 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Categoría *
                </Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category_id: v }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl border border-slate-200 text-sm font-medium">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={cat.id}
                        className="rounded-lg text-sm font-medium"
                      >
                        <span className="mr-2">{cat.icon}</span> {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Precio al Público (COP) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="0"
                    className="h-11 pl-8 rounded-xl border border-slate-200 font-bold text-base"
                  />
                </div>
                {form.price && (
                  <p className="text-[11px] font-semibold text-teal-600 px-1">
                    {formatPrice(Number(form.price))} COP
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Prioridad en Lista (Orden)
                </Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                  placeholder="0"
                  className="h-11 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Código Siigo (Opcional - Facturación)
                </Label>
                <Input
                  value={form.siigo_code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, siigo_code: e.target.value }))
                  }
                  placeholder="Ej: 1001 o PROD-BURGER"
                  className="h-11 rounded-xl border border-slate-200 text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-semibold text-slate-700">
                Disponibilidad en Sedes
              </Label>
              <StoreMultiSelect
                selectedStoreIds={form.store_ids}
                onChange={(ids) => setForm((f) => ({ ...f, store_ids: ids }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-8 gap-2.5 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="h-11 rounded-xl font-semibold text-xs px-5 border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-6 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editProduct ? (
                "Guardar Cambios"
              ) : (
                "Crear Producto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="h-12 w-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
              ¿Eliminar este producto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              El producto{" "}
              <strong className="text-slate-800">
                {productToDelete?.name}
              </strong>{" "}
              será eliminado permanentemente del catálogo y de todas las sedes.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-semibold text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-10 rounded-xl font-semibold text-xs bg-rose-600 text-white hover:bg-rose-700"
            >
              Confirmar Eliminación
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
      <div className="h-full w-full bg-slate-100 flex flex-col items-center justify-center text-slate-300">
        <span className="text-4xl mb-1">{product.categories?.icon || "🍔"}</span>
        <span className="text-[10px] font-semibold tracking-wider text-slate-400">
          Sin Foto
        </span>
      </div>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(product.image_url, 400)}
      alt={product.name}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex flex-col h-full bg-white rounded-2xl border transition-all duration-200 relative overflow-hidden shadow-xs hover:shadow-md",
        isDragging
          ? "border-teal-500 ring-2 ring-teal-500/20 shadow-lg"
          : "border-slate-200/80 hover:border-slate-300",
        !product.available && "opacity-75 bg-slate-50/50",
      )}
    >
      {/* Product Image Box */}
      <div className="aspect-16/10 rounded-t-2xl overflow-hidden relative bg-slate-100 border-b border-slate-100">
        <InventoryProductImage product={product} />

        {/* Top-Left Category Badge */}
        {product.categories && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/90 backdrop-blur-md text-slate-700 shadow-xs border border-white/40">
              <span>{product.categories.icon}</span>
              <span className="truncate max-w-[110px]">
                {product.categories.label}
              </span>
            </span>
          </div>
        )}

        {/* Top-Right Status Badge */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
          {product.available ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/90 backdrop-blur-xs text-white shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>Activo</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-600/90 backdrop-blur-xs text-white shadow-xs">
              <span>Agotado</span>
            </span>
          )}
        </div>

        {/* Drag Handle Overlay (Desktop) */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          title="Arrastrar para ordenar"
          className="absolute bottom-2.5 right-2.5 z-20 h-7 w-7 rounded-lg bg-white/90 backdrop-blur-md shadow-xs border border-slate-200/60 hidden lg:flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Product Info Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
              {product.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-slate-900">
              {formatPrice(product.price)}
            </span>
            {product.siigo_code && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Siigo: {product.siigo_code}
              </span>
            )}
          </div>
        </div>

        {/* Action Footer: Availability Switch + Edit/Delete */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Direct Switch for Quick Availability Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={product.available}
              onCheckedChange={() =>
                toggleAvailability(product.id, product.available)
              }
              className="scale-85 data-[state=checked]:bg-teal-600"
            />
            <span
              className={cn(
                "text-[11px] font-semibold select-none",
                product.available ? "text-emerald-700" : "text-slate-400",
              )}
            >
              {product.available ? "Disponible" : "Agotado"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEdit(product)}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              <span>Editar</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
                <DropdownMenuItem
                  onClick={() => openEdit(product)}
                  className="text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Editar detalles</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    toggleAvailability(product.id, product.available)
                  }
                  className="text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      product.available ? "bg-rose-500" : "bg-emerald-500",
                    )}
                  />
                  <span>
                    {product.available
                      ? "Marcar agotado"
                      : "Marcar disponible"}
                  </span>
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                <DropdownMenuItem
                  onClick={() => setProductToDelete(product)}
                  className="text-xs font-semibold rounded-lg text-rose-600 focus:text-rose-700 focus:bg-rose-50 flex items-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar producto</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
