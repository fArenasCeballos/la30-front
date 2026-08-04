import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Bike,
  PlusCircle,
  Search,
  Pencil,
  Eye,
  PowerOff,
  Power,
  Loader2,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Phone,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Tables } from "@/types/database.types";
import { formatPrice } from "@/lib/formatPrice";

type DeliveryDriver = Tables<"delivery_drivers">;
type Order = Tables<"orders">;

export default function DomiciliariosAdmin() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create / Edit state
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyDriver, setHistoryDriver] = useState<DeliveryDriver | null>(
    null,
  );
  const [driverOrders, setDriverOrders] = useState<Order[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_drivers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (err) {
      toast.error(`Error al cargar domiciliarios: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchDrivers();
    };
    load();
  }, [fetchDrivers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return drivers.filter(
      (d) =>
        d.first_name.toLowerCase().includes(q) ||
        d.last_name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        d.motorcycle_plate.toLowerCase().includes(q),
    );
  }, [drivers, search]);

  const openCreate = () => {
    setEditingDriver(null);
    setFirstName("");
    setLastName("");
    setPhone("");
    setPlate("");
    setShowForm(true);
  };

  const openEdit = (driver: DeliveryDriver) => {
    setEditingDriver(driver);
    setFirstName(driver.first_name);
    setLastName(driver.last_name);
    setPhone(driver.phone);
    setPlate(driver.motorcycle_plate);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !phone.trim() ||
      !plate.trim()
    ) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDriver) {
        const { error } = await supabase
          .from("delivery_drivers")
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            motorcycle_plate: plate,
          })
          .eq("id", editingDriver.id);

        if (error) throw error;
        toast.success("Domiciliario actualizado exitosamente");
      } else {
        const { error } = await supabase.from("delivery_drivers").insert([
          {
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            motorcycle_plate: plate,
          },
        ]);

        if (error) throw error;
        toast.success("Domiciliario registrado exitosamente");
      }
      fetchDrivers();
      setShowForm(false);
    } catch (err) {
      toast.error(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (driver: DeliveryDriver) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas ${
          driver.is_active ? "inactivar" : "activar"
        } a ${driver.first_name} ${driver.last_name}?`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("delivery_drivers")
        .update({ is_active: !driver.is_active })
        .eq("id", driver.id);

      if (error) throw error;
      toast.success(
        `Domiciliario ${!driver.is_active ? "activado" : "inactivado"}`,
      );
      fetchDrivers();
    } catch (err) {
      toast.error(`Error al cambiar estado: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const viewHistory = async (driver: DeliveryDriver) => {
    setHistoryDriver(driver);
    setShowHistory(true);
    setLoadingHistory(true);
    setDriverOrders([]);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDriverOrders(data || []);
    } catch (err) {
      toast.error(`Error cargando historial: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Cargando domiciliarios...
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="section-container space-y-16 pb-32 animate-in fade-in duration-700">
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                <Bike className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">
                  Domiciliarios
                </h1>
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                  {drivers.length} Conductores Registrados
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 lg:max-w-3xl justify-end">
              <div className="relative w-full sm:max-w-md group">
                <Search
                  className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 group-focus-within:text-orange-500 transition-all duration-300"
                  strokeWidth={3}
                />
                <Input
                  placeholder="Buscar domiciliario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-2 focus-visible:ring-orange-500/20 bg-white/60 backdrop-blur-md shadow-soft transition-all font-bold focus:border-orange-500/30"
                />
              </div>

              <Button
                size="lg"
                className="w-full sm:w-auto h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black shadow-strong hover:scale-[1.02] active:scale-[0.98] transition-all group px-8"
                onClick={openCreate}
              >
                <PlusCircle
                  className="h-5 w-5 mr-3 group-hover:rotate-90 transition-transform duration-500"
                  strokeWidth={2.5}
                />
                REGISTRAR
              </Button>
            </div>
          </div>

          <div className="bg-white/40 backdrop-blur-md overflow-hidden border-2 shadow-strong rounded-[3rem] border-accent/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-accent/5 text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 border-b-2 border-accent/10">
                    <th className="px-10 py-8 text-left">Conductor</th>
                    <th className="px-10 py-8 text-left">Contacto</th>
                    <th className="px-10 py-8 text-left">Motocicleta</th>
                    <th className="px-10 py-8 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-accent/5">
                  {filtered.map((d, idx) => (
                    <tr
                      key={d.id}
                      className={cn(
                        "group transition-all duration-300 animate-in fade-in slide-in-from-left-6",
                        !d.is_active
                          ? "opacity-60 bg-accent/5 grayscale-[0.5]"
                          : "hover:bg-white/80",
                      )}
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white border-2 border-accent/20 shadow-soft flex items-center justify-center font-black text-orange-500 text-xl group-hover:scale-110 group-hover:border-orange-500/30 group-hover:rotate-3 transition-all duration-500">
                            {d.first_name.charAt(0)}
                          </div>
                          <div className="space-y-1">
                            <div className="font-black text-[17px] tracking-tight text-foreground group-hover:text-orange-500 transition-colors flex items-center gap-2">
                              {d.first_name} {d.last_name}
                              {!d.is_active && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] px-2 py-0 h-4"
                                >
                                  INACTIVO
                                </Badge>
                              )}
                            </div>
                            <p className="text-[12px] text-muted-foreground/60 font-bold tracking-tight">
                              ID: {d.id.substring(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center text-muted-foreground/40">
                            <Phone className="h-4 w-4" />
                          </div>
                          <span className="text-[14px] font-black text-muted-foreground/70">
                            {d.phone}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <Badge
                          variant="outline"
                          className="font-black text-[14px] uppercase px-4 py-1.5 border-2 rounded-xl shadow-inner bg-accent/10 border-accent/20 text-foreground"
                        >
                          {d.motorcycle_plate}
                        </Badge>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-12 w-12 rounded-xl bg-accent/20 hover:bg-orange-500 hover:text-white transition-all shadow-soft border-none"
                            onClick={() => viewHistory(d)}
                            title="Ver Historial"
                          >
                            <Eye className="h-5 w-5" strokeWidth={2.5} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-12 w-12 rounded-xl bg-accent/20 hover:bg-primary hover:text-white transition-all shadow-soft border-none"
                            onClick={() => openEdit(d)}
                            title="Editar domiciliario"
                          >
                            <Pencil className="h-5 w-5" strokeWidth={2.5} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={cn(
                              "h-12 w-12 rounded-xl transition-all shadow-soft border-none",
                              !d.is_active
                                ? "bg-green-500/20 text-green-600 hover:bg-green-500 hover:text-white"
                                : "bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white",
                            )}
                            onClick={() => toggleStatus(d)}
                            title={!d.is_active ? "Activar" : "Inactivar"}
                          >
                            {!d.is_active ? (
                              <Power className="h-5 w-5" strokeWidth={2.5} />
                            ) : (
                              <PowerOff className="h-5 w-5" strokeWidth={2.5} />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="py-32 text-center space-y-8 opacity-20 bg-accent/5">
                <Bike
                  className="h-24 w-24 mx-auto text-muted-foreground animate-pulse"
                  strokeWidth={1}
                />
                <p className="font-black uppercase tracking-[0.5em] text-sm">
                  No se encontraron domiciliarios
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal CRUD */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl rounded-[3.5rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-xl">
            <DialogHeader className="space-y-6 mb-8">
              <div className="h-20 w-20 rounded-4xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-2 shadow-inner border-2 border-orange-500/5">
                <Bike className="h-10 w-10" strokeWidth={3} />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-5xl font-black tracking-tighter text-foreground">
                  {editingDriver ? "Modificar" : "Nuevo Repartidor"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-medium text-xl leading-relaxed">
                  {editingDriver
                    ? "Actualiza los datos del domiciliario seleccionado."
                    : "Registra un nuevo domiciliario para asignar entregas."}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    NOMBRES
                  </Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Carlos"
                    className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-orange-500/20 focus-visible:border-orange-500/30 font-bold text-xl px-6 transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    APELLIDOS
                  </Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Martínez"
                    className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-orange-500/20 focus-visible:border-orange-500/30 font-bold text-xl px-6 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    TELÉFONO / CELULAR
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="300 123 4567"
                    className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-orange-500/20 focus-visible:border-orange-500/30 font-bold text-xl px-6 transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    PLACA DE MOTOCICLETA
                  </Label>
                  <Input
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="XYZ-12A"
                    className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-orange-500/20 focus-visible:border-orange-500/30 font-black text-xl px-6 transition-all uppercase"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-12 gap-6">
              <Button
                variant="ghost"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                className="h-16 rounded-[1.25rem] font-black uppercase tracking-widest text-[11px] px-10 hover:bg-accent/20 transition-all"
              >
                CANCELAR
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSubmitting}
                className="h-16 flex-1 rounded-[1.25rem] bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[11px] px-12 shadow-strong shadow-orange-500/20 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    PROCESANDO...
                  </>
                ) : editingDriver ? (
                  "GUARDAR CAMBIOS"
                ) : (
                  "CONFIRMAR REGISTRO"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Historial */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] p-10 border-none shadow-strong bg-white/95 backdrop-blur-xl">
            <DialogHeader className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-4xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner border-2 border-orange-500/5">
                  <Eye className="h-10 w-10" strokeWidth={2.5} />
                </div>
                <div>
                  <DialogTitle className="text-4xl font-black tracking-tight text-foreground">
                    Historial de Entregas
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground font-bold mt-2 uppercase tracking-widest text-sm flex items-center gap-2">
                    {historyDriver?.first_name} {historyDriver?.last_name}
                    <Badge
                      variant="outline"
                      className="bg-accent/10 border-accent/20 text-[10px] ml-2"
                    >
                      {historyDriver?.motorcycle_plate}
                    </Badge>
                  </DialogDescription>
                </div>
              </div>
              <div className="bg-accent/5 p-4 rounded-3xl border-2 border-accent/10 text-center min-w-37.5">
                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">
                  Total Pedidos
                </p>
                <p className="text-3xl font-black text-orange-500">
                  {driverOrders.length}
                </p>
              </div>
            </DialogHeader>

            <div className="bg-white/50 backdrop-blur-sm rounded-4xl border-2 border-accent/10 overflow-hidden">
              {loadingHistory ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-500 opacity-50" />
                </div>
              ) : driverOrders.length === 0 ? (
                <div className="py-20 text-center space-y-4 opacity-40">
                  <Package
                    className="h-16 w-16 mx-auto text-muted-foreground"
                    strokeWidth={1}
                  />
                  <p className="font-black uppercase tracking-[0.2em] text-xs">
                    No hay pedidos registrados
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-125">
                  <table className="w-full relative">
                    <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10">
                      <tr className="bg-accent/5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b-2 border-accent/10">
                        <th className="px-6 py-5 text-left">Ticket</th>
                        <th className="px-6 py-5 text-left">Fecha y Hora</th>
                        <th className="px-6 py-5 text-left">Dirección</th>
                        <th className="px-6 py-5 text-left">Estado</th>
                        <th className="px-6 py-5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-accent/5">
                      {driverOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-white/80 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className="font-black font-mono text-[11px] bg-accent/5"
                            >
                              #{order.id.substring(0, 8)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-foreground/80">
                              <Calendar className="h-4 w-4 text-orange-500/70" />
                              {new Date(order.created_at).toLocaleDateString(
                                "es-CO",
                                {
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                              <Clock className="h-4 w-4 text-orange-500/70 ml-2" />
                              {new Date(order.created_at).toLocaleTimeString(
                                "es-CO",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-foreground/80 max-w-50 truncate">
                              <MapPin className="h-4 w-4 text-primary/70 shrink-0" />
                              <span className="truncate">
                                {order.delivery_address || "Sin dirección"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-black text-[9px] uppercase tracking-widest",
                                order.status === "entregado"
                                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                                  : order.status === "cancelado"
                                    ? "bg-red-500/10 text-red-600 border-red-500/20"
                                    : "bg-orange-500/10 text-orange-600 border-orange-500/20",
                              )}
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-base text-foreground flex items-center justify-end gap-1">
                              <DollarSign className="h-4 w-4 text-green-500" />
                              {formatPrice(order.total_amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
