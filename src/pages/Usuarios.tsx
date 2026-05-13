import { useState, useMemo, useEffect, useCallback } from "react";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";
import type { Profile, UserRole } from "@/types";
import {
  Users,
  Pencil,
  ShoppingCart,
  Eye,
  EyeOff,
  MapPin,
  Search,
  PlusCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  caja: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  mesero: "bg-green-500/15 text-green-600 border-green-500/30",
  cocina: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  caja: "Cajero/a",
  mesero: "Mesero/a",
  cocina: "Cocina",
};

export default function Usuarios() {
  const { orders } = useOrders();
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("mesero");
  const [formStoreId, setFormStoreId] = useState<string>("all");
  const { stores, activeStore } = useStore();
  const currentStoreId = activeStore?.id;
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("name");
      if (data) {
        const visibleProfiles = (data as Profile[]).filter(
          (p) => p.email !== "andresfelipearenasceballos@gmail.com",
        );
        setProfiles(visibleProfiles);
      }
    } catch (err) {
      toast.error("Error al cargar perfiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchProfiles();
  }, [fetchProfiles, currentUser]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const openCreate = () => {
    setEditingProfile(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("mesero");
    setFormStoreId("all");
    setNewPassword("");
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (p: Profile) => {
    setEditingProfile(p);
    setFormName(p.name || "");
    setFormRole((p.role as UserRole) || "mesero");
    setFormStoreId(p.store_id || "all");
    setNewPassword("");
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nombre es requerido");
      return;
    }

    setIsSubmitting(true);
    if (editingProfile) {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formName,
          role: formRole,
          store_id: formStoreId === "all" ? null : formStoreId,
        })
        .eq("id", editingProfile.id);

      if (error) {
        toast.error(`Error: ${error.message}`);
      } else {
        if (newPassword.trim()) {
          const { error: pwdError } = await supabase.rpc(
            "admin_update_user_password",
            {
              p_user_id: editingProfile.id,
              p_new_password: newPassword.trim(),
            },
          );
          if (pwdError) {
            toast.error(`Error actualizando contraseña: ${pwdError.message}`);
          } else {
            toast.success("Perfil y contraseña actualizados");
          }
        } else {
          toast.success("Perfil actualizado");
        }
        fetchProfiles();
        setShowForm(false);
      }
    } else {
      if (!formEmail.trim() || !formPassword.trim()) {
        toast.error("Email y contraseña son requeridos");
        setIsSubmitting(false);
        return;
      }

      try {
        const { createClient } = await import("@supabase/supabase-js");
        const tempSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          },
        );

        const { error } = await tempSupabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: {
            data: {
              full_name: formName,
              role: formRole,
              store_id: formStoreId === "all" ? null : formStoreId,
            },
          },
        });

        if (error) {
          toast.error(`Error al crear usuario: ${error.message}`);
        } else {
          toast.success("Usuario creado exitosamente.");
          setTimeout(fetchProfiles, 1500);
          setShowForm(false);
        }
      } catch (err) {
        console.error("Critical error creating user:", err);
        toast.error("Error al inicializar cliente de creación");
      }
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">
          Cargando equipo de trabajo...
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="section-container space-y-16 pb-32 animate-in fade-in duration-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 bg-white/40 backdrop-blur-md p-10 rounded-[3.5rem] border-2 border-accent/20 shadow-soft">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-primary/60 font-black uppercase tracking-[0.4em] text-[11px]">
              <div className="h-[3px] w-12 bg-primary/20 rounded-full" />
              TALENTO HUMANO
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-foreground flex items-center gap-6">
              <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Users className="h-10 w-10" strokeWidth={3} />
              </div>
              El Equipo
            </h1>
            <p className="text-muted-foreground font-medium text-xl max-w-xl leading-relaxed">
              Gestiona los accesos, roles y rendimiento de tu equipo de trabajo
              en tiempo real con métricas detalladas.
            </p>
          </div>

          <Button
            size="xl"
            className="rounded-4xl h-20 px-12 bg-primary hover:bg-primary/90 text-white font-black shadow-strong hover:scale-[1.05] active:scale-[0.95] transition-all group text-lg"
            onClick={openCreate}
          >
            <PlusCircle
              className="h-7 w-7 mr-4 group-hover:rotate-90 transition-transform duration-500"
              strokeWidth={2.5}
            />
            REGISTRAR COLABORADOR
          </Button>
        </div>

        <div className="space-y-10">
          <div className="flex items-center gap-4 px-2">
            <div className="h-4 w-4 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/40" />
            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-muted-foreground/60">
              Rendimiento en {activeStore?.name || "la tienda"}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {profiles
              .filter((u) => u.role === "mesero")
              .map((u, idx) => {
                const uStats = (orders || []).reduce(
                  (acc, o) => {
                    if (
                      o &&
                      o.user_id === u.id &&
                      (!currentStoreId || o.store_id === currentStoreId)
                    ) {
                      acc.orders++;
                      acc.total += o.total || 0;
                    }
                    return acc;
                  },
                  { orders: 0, total: 0 },
                );

                return (
                  <div
                    key={u.id}
                    className="pos-card group p-10 flex flex-col border-2 transition-all duration-500 shadow-strong hover:shadow-2xl hover:scale-[1.02] border-transparent hover:border-primary/20"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex items-center gap-6 mb-10">
                      <div className="w-20 h-20 rounded-4xl bg-linear-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center text-white font-black text-4xl shadow-xl shadow-primary/30 group-hover:scale-110 transition-all duration-700 group-hover:rotate-6">
                        {u.name?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <p className="font-black truncate text-2xl leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">
                          {u.name}
                        </p>
                        <Badge className="font-black text-[10px] uppercase px-3 py-1 bg-primary/10 text-primary border-none rounded-lg">
                          MESERO/A
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="bg-accent/10 p-6 rounded-4xl border-2 border-accent/10 shadow-inner group-hover:bg-white group-hover:border-primary/10 transition-all duration-500">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">
                            PEDIDOS COMPLETADOS
                          </p>
                          <ShoppingCart className="h-5 w-5 text-primary opacity-20" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-black text-4xl tracking-tighter text-foreground">
                            {uStats.orders}
                          </span>
                          <span className="text-xs font-black text-muted-foreground/40 uppercase">
                            ORDENES
                          </span>
                        </div>
                      </div>
                      <div className="bg-primary/5 p-6 rounded-4xl border-2 border-primary/10 group-hover:bg-primary/10 transition-all duration-500">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-black uppercase text-primary/40 tracking-[0.2em]">
                            VENTAS GENERADAS
                          </p>
                          <Badge className="bg-primary text-white border-none text-[9px] font-black px-2 py-0.5">
                            TOP
                          </Badge>
                        </div>
                        <p className="font-black text-3xl text-primary truncate tracking-tighter">
                          {formatPrice(uStats.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 px-2">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-6 w-6 text-primary/40" />
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-muted-foreground/60">
                Listado Maestro de Perfiles
              </h3>
            </div>

            <div className="relative w-full md:w-[450px] group">
              <Search
                className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300"
                strokeWidth={3}
              />
              <Input
                placeholder="Buscar por nombre, correo o rol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-16 h-16 rounded-3xl border-2 focus-visible:ring-primary/20 bg-white/60 backdrop-blur-md shadow-soft transition-all font-bold text-lg border-transparent focus:border-primary/30"
              />
            </div>
          </div>

          <div className="bg-white/40 backdrop-blur-md overflow-hidden border-2 shadow-strong rounded-[3rem] border-accent/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-accent/5 text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 border-b-2 border-accent/10">
                    <th className="px-10 py-8 text-left">Colaborador</th>
                    <th className="px-10 py-8 text-left">Rol de Sistema</th>
                    <th className="px-10 py-8 text-left">Tienda Asignada</th>
                    <th className="px-10 py-8 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-accent/5">
                  {filtered.map((u, idx) => (
                    <tr
                      key={u.id}
                      className="group hover:bg-white/80 transition-all duration-300 animate-in fade-in slide-in-from-left-6"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white border-2 border-accent/20 shadow-soft flex items-center justify-center font-black text-primary text-xl group-hover:scale-110 group-hover:border-primary/30 group-hover:rotate-3 transition-all duration-500">
                            {u.name?.charAt(0)}
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-[17px] tracking-tight text-foreground group-hover:text-primary transition-colors">
                              {u.name}
                            </p>
                            <p className="text-[12px] text-muted-foreground/60 font-bold tracking-tight">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-black text-[10px] uppercase px-4 py-1.5 border-2 rounded-xl shadow-inner",
                            ROLE_COLORS[u.role as UserRole],
                          )}
                        >
                          {ROLE_LABELS[u.role as UserRole]}
                        </Badge>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center text-muted-foreground/40">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <span className="text-[14px] font-black text-muted-foreground/70">
                            {u.store_id
                              ? stores.find((s) => s.id === u.store_id)?.name
                              : "Acceso Global"}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-14 w-14 rounded-2xl bg-accent/20 hover:bg-primary hover:text-white transition-all shadow-soft border-none"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-6 w-6" strokeWidth={2.5} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="py-32 text-center space-y-8 opacity-20 bg-accent/5">
                <Users
                  className="h-24 w-24 mx-auto text-muted-foreground animate-pulse"
                  strokeWidth={1}
                />
                <p className="font-black uppercase tracking-[0.5em] text-sm">
                  No se encontraron resultados
                </p>
              </div>
            )}
          </div>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto rounded-[3.5rem] p-12 border-none shadow-strong bg-white/95 backdrop-blur-xl">
            <DialogHeader className="space-y-6 mb-12">
              <div className="h-20 w-20 rounded-4xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner border-2 border-primary/5">
                <Users className="h-10 w-10" strokeWidth={3} />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-5xl font-black tracking-tighter text-foreground">
                  {editingProfile ? "Modificar Perfil" : "Nuevo Miembro"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-medium text-xl leading-relaxed">
                  {editingProfile
                    ? "Actualiza los privilegios y accesos del colaborador seleccionado."
                    : "Crea una nueva cuenta de acceso para un integrante del equipo."}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-10">
              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                  NOMBRE COMPLETO
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 font-bold text-xl px-6 transition-all"
                />
              </div>

              {!editingProfile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                      CORREO ELECTRÓNICO
                    </Label>
                    <Input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="email@la30.com"
                      className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 font-bold text-lg px-6 transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                      CONTRASEÑA
                    </Label>
                    <div className="relative group">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 pr-16 font-bold text-lg px-6 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff size={24} strokeWidth={2.5} />
                        ) : (
                          <Eye size={24} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingProfile && currentUser?.role === "admin" && (
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    NUEVA CONTRASEÑA (OPCIONAL)
                  </Label>
                  <div className="relative group">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Dejar vacío para mantener actual"
                      className="h-16 rounded-[1.25rem] border-2 bg-accent/5 focus-visible:ring-primary/20 border-transparent focus-visible:border-primary/30 pr-16 font-bold text-lg px-6 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff size={24} strokeWidth={2.5} />
                      ) : (
                        <Eye size={24} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    ROL DE ACCESO
                  </Label>
                  <Select
                    value={formRole}
                    onValueChange={(v) => setFormRole(v as UserRole)}
                  >
                    <SelectTrigger className="h-16 rounded-[1.25rem] border-2 bg-accent/5 border-transparent font-bold text-lg px-6 hover:bg-accent/10 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-3xl border-none shadow-strong p-3">
                      <SelectItem
                        value="admin"
                        className="rounded-xl font-black py-4 px-5 text-base"
                      >
                        Administrador
                      </SelectItem>
                      <SelectItem
                        value="caja"
                        className="rounded-xl font-black py-4 px-5 text-base"
                      >
                        Cajero/a
                      </SelectItem>
                      <SelectItem
                        value="mesero"
                        className="rounded-xl font-black py-4 px-5 text-base"
                      >
                        Mesero/a
                      </SelectItem>
                      <SelectItem
                        value="cocina"
                        className="rounded-xl font-black py-4 px-5 text-base"
                      >
                        Cocina
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label className="text-[11px] font-black uppercase tracking-[0.3em] ml-2 text-muted-foreground/60">
                    TIENDA ASIGNADA
                  </Label>
                  <Select value={formStoreId} onValueChange={setFormStoreId}>
                    <SelectTrigger className="h-16 rounded-[1.25rem] border-2 bg-accent/5 border-transparent font-bold text-lg px-6 hover:bg-accent/10 transition-all">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent className="rounded-3xl border-none shadow-strong p-3">
                      <SelectItem
                        value="all"
                        className="rounded-xl font-black py-4 px-5 text-base"
                      >
                        Todas (Acceso Global)
                      </SelectItem>
                      {stores.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          className="rounded-xl font-black py-4 px-5 text-base"
                        >
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-16 gap-6">
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
                className="h-16 flex-1 rounded-[1.25rem] bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] px-12 shadow-strong shadow-primary/20 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    PROCESANDO...
                  </>
                ) : editingProfile ? (
                  "GUARDAR CAMBIOS"
                ) : (
                  "CONFIRMAR REGISTRO"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
