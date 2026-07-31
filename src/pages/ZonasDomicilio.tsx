import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Palette,
} from "lucide-react";
import { ZoneMapEditor, ZONE_COLORS } from "@/components/admin/ZoneMapEditor";
import type { DeliveryZone, LatLngPoint, Json } from "@/types";

interface DeliveryZoneRow {
  id: string;
  name: string;
  price: number;
  polygon: LatLngPoint[][];
  color: string;
  is_active: boolean;
  created_at: string;
}

interface ZoneFormState {
  name: string;
  price: string;
  color: string;
  polygon: LatLngPoint[][];
}

const INITIAL_FORM: ZoneFormState = {
  name: "",
  price: "",
  color: ZONE_COLORS[0],
  polygon: [],
};

export default function ZonasDomicilio() {
  const queryClient = useQueryClient();
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<ZoneFormState>(INITIAL_FORM);
  const [isCreating, setIsCreating] = useState(false);

  // ─── Fetch zones ────────────────────────────────────────────
  const { data: zones = [], isLoading } = useQuery<DeliveryZone[]>({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("name");

      if (error) throw error;

      return (data as unknown as DeliveryZoneRow[]).map(
        (row): DeliveryZone => ({
          id: row.id,
          name: row.name,
          price: Number(row.price),
          polygon: row.polygon,
          color: row.color,
          is_active: row.is_active,
          created_at: row.created_at,
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  // ─── Create / Update mutation ──────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      price: number;
      polygon: LatLngPoint[][];
      color: string;
    }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("delivery_zones")
          .update({
            name: payload.name,
            price: payload.price,
            polygon: payload.polygon as unknown as Json,
            color: payload.color,
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_zones").insert({
          name: payload.name,
          price: payload.price,
          polygon: payload.polygon as unknown as Json,
          color: payload.color,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      void queryClient.invalidateQueries({
        queryKey: ["delivery-zones-active"],
      });
      toast.success(
        editingZone ? "Zona actualizada" : "Zona creada exitosamente",
      );
      resetForm();
    },
    onError: () => {
      toast.error("Error al guardar la zona");
    },
  });

  // ─── Toggle active mutation ────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("delivery_zones")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      void queryClient.invalidateQueries({
        queryKey: ["delivery-zones-active"],
      });
    },
  });

  // ─── Delete mutation ───────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      void queryClient.invalidateQueries({
        queryKey: ["delivery-zones-active"],
      });
      toast.success("Zona eliminada");
      if (editingZone) resetForm();
    },
    onError: () => {
      toast.error("Error al eliminar la zona");
    },
  });

  // ─── Form handlers ────────────────────────────────────────
  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setEditingZone(null);
    setIsCreating(false);
  }, []);

  const handleEdit = useCallback((zone: DeliveryZone) => {
    setEditingZone(zone);
    setIsCreating(true);
    setForm({
      name: zone.name,
      price: String(zone.price),
      color: zone.color,
      polygon: zone.polygon,
    });
  }, []);

  const handlePolygonCreated = useCallback(
    (polygon: LatLngPoint[][]) => {
      setForm((prev) => ({ ...prev, polygon }));
      if (!isCreating) setIsCreating(true);
    },
    [isCreating],
  );

  const handleZoneClick = useCallback(
    (zone: DeliveryZone) => {
      handleEdit(zone);
    },
    [handleEdit],
  );

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Ingresa un nombre para la zona");
      return;
    }
    const price = Number(form.price);
    if (isNaN(price) || price < 0) {
      toast.error("Ingresa un precio válido");
      return;
    }
    if (form.polygon.length === 0) {
      toast.error("Dibuja un polígono en el mapa");
      return;
    }

    saveMutation.mutate({
      id: editingZone?.id,
      name: form.name.trim(),
      price,
      polygon: form.polygon,
      color: form.color,
    });
  };

  return (
    <div className="section-container space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/10 p-2.5 rounded-2xl">
            <MapPin className="h-6 w-6 text-purple-600" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-black tracking-tight">
              Zonas de Domicilio
            </h2>
            <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-0.5">
              Configura precios por zona geográfica
            </p>
          </div>
        </div>
        {!isCreating && (
          <Button
            onClick={() => {
              setIsCreating(true);
              setForm({
                ...INITIAL_FORM,
                color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
              });
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl lg:rounded-2xl h-10 lg:h-12 px-4 lg:px-8 font-black text-xs lg:text-sm shadow-xl shadow-purple-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4 mr-1 lg:mr-2" />
            Nueva Zona
          </Button>
        )}
      </div>

      {/* Map + Form Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 h-100 lg:h-137.5">
          <ZoneMapEditor
            zones={zones}
            editingZone={editingZone}
            onPolygonCreated={handlePolygonCreated}
            onZoneClick={handleZoneClick}
            draftPolygon={form.polygon}
            draftColor={form.color}
          />
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Create/Edit Form */}
          {isCreating && (
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 space-y-4 shadow-lg animate-in slide-in-from-right-5 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-purple-600">
                  {editingZone ? "Editar Zona" : "Nueva Zona"}
                </h3>
                <button
                  onClick={resetForm}
                  className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 block">
                    Nombre de la Zona
                  </label>
                  <Input
                    placeholder="Ej: Cerritos, Cuba, Dosquebradas..."
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 block">
                    Precio del Domicilio
                  </label>
                  <Input
                    placeholder="5000"
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    className="rounded-xl border-2 font-bold h-11 focus-visible:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">
                    <Palette className="inline h-3 w-3 mr-1" />
                    Color de la Zona
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setForm((prev) => ({ ...prev, color }))}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                          form.color === color
                            ? "border-gray-800 scale-110 ring-2 ring-offset-2 ring-gray-300"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  {form.polygon.length === 0 ? (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                        {editingZone
                          ? "Polígono existente (puedes redibujar)"
                          : "Dibuja una zona en el mapa"}
                      </p>
                      <p className="text-[9px] text-amber-600 mt-1">
                        Usa las herramientas arriba a la derecha para trazar
                        polígonos, cuadrados o círculos.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-700">
                        ✓ Polígono trazado
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingZone ? "Actualizar" : "Guardar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="rounded-xl h-11 border-2 font-black text-xs uppercase tracking-widest"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Zone List */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">
              Zonas Configuradas ({zones.length})
            </h3>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-16 rounded-xl bg-accent/10 animate-pulse"
                  />
                ))}
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-10 bg-white/40 rounded-2xl border-2 border-dashed border-accent/15">
                <MapPin className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs font-bold text-muted-foreground/40">
                  Sin zonas configuradas
                </p>
                <p className="text-[9px] text-muted-foreground/30 mt-1">
                  Crea tu primera zona de domicilio
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-100 overflow-y-auto premium-scrollbar pr-1">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={cn(
                      "bg-white border-2 rounded-xl p-3 transition-all hover:shadow-md cursor-pointer group",
                      editingZone?.id === zone.id
                        ? "border-purple-400 shadow-md"
                        : "border-accent/10 hover:border-purple-200",
                      !zone.is_active && "opacity-50",
                    )}
                    onClick={() => handleEdit(zone)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="h-4 w-4 rounded-full shrink-0 border"
                          style={{ backgroundColor: zone.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate">
                            {zone.name}
                          </p>
                          <p className="text-[10px] font-black text-purple-600">
                            {formatPrice(zone.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={zone.is_active}
                          onCheckedChange={(checked) => {
                            toggleMutation.mutate({
                              id: zone.id,
                              is_active: checked,
                            });
                          }}
                          className="scale-75"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(zone);
                          }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:bg-purple-50 hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar la zona "${zone.name}"?`)) {
                              deleteMutation.mutate(zone.id);
                            }
                          }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
