import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  Check,
  Image as ImageIcon,
  ImageOff,
  X,
  ExternalLink,
} from "lucide-react";
import { listProductImages, type StorageProductImage } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";

interface ProductImageGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (imageUrl: string, imageName: string) => void;
  currentSelectedUrl?: string | null;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProductImageGalleryModal({
  open,
  onOpenChange,
  onSelectImage,
  currentSelectedUrl,
}: ProductImageGalleryModalProps) {
  const [images, setImages] = useState<StorageProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<StorageProductImage | null>(
    null,
  );

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProductImages();
      setImages(data);
    } catch (err: unknown) {
      console.error("Error al cargar imágenes de Supabase Storage:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las imágenes de Supabase";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar imágenes al abrir el modal si no están cargadas
  useEffect(() => {
    if (open) {
      fetchImages();
      setSearch("");
    }
  }, [open, fetchImages]);

  // Si hay una imagen actualmente seleccionada en el producto, buscarla
  useEffect(() => {
    if (currentSelectedUrl && images.length > 0) {
      const match = images.find(
        (img) =>
          img.url === currentSelectedUrl ||
          currentSelectedUrl.endsWith(`/products/${img.name}`) ||
          currentSelectedUrl.endsWith(`/${img.name}`),
      );
      if (match) setSelectedItem(match);
    }
  }, [currentSelectedUrl, images]);

  const filteredImages = useMemo(() => {
    if (!search.trim()) return images;
    const term = search.toLowerCase().trim();
    return images.filter((img) => img.name.toLowerCase().includes(term));
  }, [images, search]);

  const handleConfirmSelection = () => {
    if (!selectedItem) return;
    onSelectImage(selectedItem.url, selectedItem.name);
    onOpenChange(false);
  };

  const handleCardDoubleClick = (img: StorageProductImage) => {
    onSelectImage(img.url, img.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shadow-xs">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-800">
                  Galería de Imágenes en Supabase
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Carpeta de origen:{" "}
                  <code className="bg-slate-100 text-teal-700 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    assets/products
                  </code>
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className="text-xs font-semibold px-2.5 py-1 border-slate-200 text-slate-600 bg-slate-50"
            >
              {images.length}{" "}
              {images.length === 1 ? "foto cargada" : "fotos cargadas"}
            </Badge>
          </div>

          {/* Barra de búsqueda y refresh */}
          <div className="flex items-center gap-2 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre de archivo (ej. hamburguesa, perro, logo)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchImages}
              disabled={loading}
              className="h-9 px-3 text-xs gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              title="Actualizar listado desde Supabase"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  loading && "animate-spin text-teal-600",
                )}
              />
              <span className="hidden sm:inline">Refrescar</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-75">
          {loading && images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-teal-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-600">
                Consultando imágenes en Supabase Storage...
              </p>
              <p className="text-[11px] text-slate-400">
                Buscando archivos en el bucket{" "}
                <code className="text-teal-600">assets/products</code>
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-amber-50/80 border border-amber-200 text-center space-y-3 max-w-md mx-auto my-10">
              <ImageOff className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-amber-900">
                No se pudieron listar las imágenes
              </p>
              <p className="text-xs text-amber-700">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchImages}
                className="mt-2 text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
              >
                Reintentar
              </Button>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <ImageOff className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {search
                  ? `No se encontraron imágenes que coincidan con "${search}"`
                  : "Aún no hay imágenes en la carpeta 'products'"}
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                {search
                  ? "Intenta con otro término de búsqueda o limpia el filtro."
                  : "Sube imágenes desde el formulario del producto o directamente en la consola de Supabase Storage en el bucket 'assets/products'."}
              </p>
              {search && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearch("")}
                  className="text-xs rounded-xl"
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredImages.map((img) => {
                const isSelected = selectedItem?.url === img.url;
                const isCurrentProduct =
                  currentSelectedUrl &&
                  (currentSelectedUrl === img.url ||
                    currentSelectedUrl.endsWith(`/${img.name}`));

                return (
                  <div
                    key={img.name}
                    onClick={() => setSelectedItem(img)}
                    onDoubleClick={() => handleCardDoubleClick(img)}
                    className={cn(
                      "group relative flex flex-col rounded-xl border p-2 cursor-pointer transition-all duration-200 select-none overflow-hidden",
                      isSelected
                        ? "border-teal-500 bg-teal-50/50 shadow-md ring-2 ring-teal-500/20"
                        : "border-slate-200 bg-white hover:border-teal-300 hover:shadow-xs",
                    )}
                  >
                    {/* Badge de selección actual */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 z-10 bg-teal-600 text-white rounded-full p-1 shadow-sm">
                        <Check className="h-3 w-3 stroke-3" />
                      </div>
                    )}

                    {isCurrentProduct && !isSelected && (
                      <Badge className="absolute top-2.5 left-2.5 z-10 text-[9px] bg-slate-900/80 text-white px-1.5 py-0.5 border-0">
                        Actual
                      </Badge>
                    )}

                    {/* Contenedor de la imagen */}
                    <div className="relative aspect-square w-full rounded-lg bg-slate-100/80 border border-slate-100 overflow-hidden flex items-center justify-center">
                      <img
                        src={img.url}
                        alt={img.name}
                        loading="lazy"
                        className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="mt-2 space-y-0.5">
                      <p
                        className="text-[11px] font-semibold text-slate-700 truncate"
                        title={img.name}
                      >
                        {img.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>{formatBytes(img.size)}</span>
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                          title="Abrir en pestaña nueva"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 truncate max-w-sm">
            {selectedItem ? (
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Check className="h-3.5 w-3.5 text-teal-600 inline" />
                Seleccionada:{" "}
                <strong className="truncate max-w-50 text-teal-700">
                  {selectedItem.name}
                </strong>
              </span>
            ) : (
              <span>
                Haz clic en una imagen para seleccionarla o doble clic para
                aplicar.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedItem}
              onClick={handleConfirmSelection}
              className="text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Usar esta imagen</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
