import { useState, useMemo, useEffect, useCallback } from "react";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Profile, UserRole } from "@/types";
import {
  Users,
  Pencil,
  Eye,
  EyeOff,
  MapPin,
  Search,
  PlusCircle,
  Loader2,
  UserX,
  UserCheck,
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
  useOrders();
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
  const { stores } = useStore();
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
    const load = async () => {
      await fetchProfiles();
    };
    load();
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

  const toggleUserStatus = async (p: Profile) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas ${
          p.is_active ? "inactivar" : "activar"
        } a ${p.name}?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.rpc("update_user", {
        p_user_id: p.id,
        p_is_active: !p.is_active,
      });

      if (error) {
        // Fallback to table update if RPC doesn't work or isn't handling is_active correctly
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ is_active: !p.is_active })
          .eq("id", p.id);
          
        if (updateError) throw updateError;
      }
      
      toast.success(
        `Usuario ${!p.is_active ? "activado" : "inactivado"} correctamente`
      );
      fetchProfiles();
    } catch (err: any) {
      toast.error(`Error al cambiar estado: ${err.message}`);
    }
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
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-4">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Users className="h-7 w-7" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">
                  Equipo de Trabajo
                </h1>
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                  {profiles.length} Colaboradores Registrados
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 lg:max-w-3xl justify-end">
              <div className="relative w-full sm:max-w-md group">
                <Search
                  className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300"
                  strokeWidth={3}
                />
                <Input
                  placeholder="Buscar colaborador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-2 focus-visible:ring-primary/20 bg-white/60 backdrop-blur-md shadow-soft transition-all font-bold border-transparent focus:border-primary/30"
                />
              </div>

              <Button
                size="lg"
                className="w-full sm:w-auto h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black shadow-strong hover:scale-[1.02] active:scale-[0.98] transition-all group px-8"
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
                      className={cn(
                        "group transition-all duration-300 animate-in fade-in slide-in-from-left-6",
                        u.is_active === false ? "opacity-60 bg-accent/5 grayscale-[0.5]" : "hover:bg-white/80"
                      )}
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-white border-2 border-accent/20 shadow-soft flex items-center justify-center font-black text-primary text-xl group-hover:scale-110 group-hover:border-primary/30 group-hover:rotate-3 transition-all duration-500">
                            {u.name?.charAt(0)}
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-[17px] tracking-tight text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                              {u.name}
                              {u.is_active === false && (
                                <Badge variant="destructive" className="text-[9px] px-2 py-0 h-4">
                                  INACTIVO
                                </Badge>
                              )}
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
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-14 w-14 rounded-2xl bg-accent/20 hover:bg-primary hover:text-white transition-all shadow-soft border-none"
                            onClick={() => openEdit(u)}
                            title="Editar usuario"
                          >
                            <Pencil className="h-6 w-6" strokeWidth={2.5} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className={cn(
                              "h-14 w-14 rounded-2xl transition-all shadow-soft border-none",
                              u.is_active === false
                                ? "bg-green-500/20 text-green-600 hover:bg-green-500 hover:text-white"
                                : "bg-red-500/20 text-red-600 hover:bg-red-500 hover:text-white"
                            )}
                            onClick={() => toggleUserStatus(u)}
                            title={u.is_active === false ? "Activar usuario" : "Inactivar usuario"}
                          >
                            {u.is_active === false ? (
                              <UserCheck className="h-6 w-6" strokeWidth={2.5} />
                            ) : (
                              <UserX className="h-6 w-6" strokeWidth={2.5} />
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
                    onValueChange={(v) => {
                      setFormRole(v as UserRole);
                      if (v !== "admin" && formStoreId === "all") {
                        setFormStoreId(stores.length > 0 ? stores[0].id : "");
                      }
                    }}
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
                      {formRole === "admin" && (
                        <SelectItem
                          value="all"
                          className="rounded-xl font-black py-4 px-5 text-base"
                        >
                          Todas (Acceso Global)
                        </SelectItem>
                      )}
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
