import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FileText } from "lucide-react";

export function SiigoProductsModal() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any>(null);

  const fetchProducts = async (retries = 3): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("siigo-get-products");
      
      if (error) {
        // Si es error de Rate Limit y quedan reintentos, esperamos y reintentamos
        if (error.status === 429 && retries > 0) {
          toast.warning("Límite de Siigo alcanzado. Reintentando en 5 segundos...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return fetchProducts(retries - 1);
        }
        throw error;
      }
      
      setProducts(data);
    } catch (err) {
      toast.error("Error al obtener productos de Siigo");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && fetchProducts()}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Ver Productos Siigo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Productos en Siigo</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="p-4">Cargando...</div>
        ) : (
          <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify(products, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
