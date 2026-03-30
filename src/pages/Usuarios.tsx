import { useState, useMemo, useEffect, useCallback } from 'react';
import { useOrders } from '@/context/OrderContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/formatPrice';
import type { Profile, UserRole } from '@/types';
import { Users, Pencil, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary/15 text-primary border-primary/30',
  caja: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  mesero: 'bg-green-500/15 text-green-600 border-green-500/30',
  cocina: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  caja: 'Cajero/a',
  mesero: 'Mesero/a',
  cocina: 'Cocina',
};

export default function Usuarios() {
  const { orders } = useOrders();
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [search, setSearch] = useState('');

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('mesero');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('name');
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchProfiles();
    };
    load();
  }, [fetchProfiles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.role?.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const openCreate = () => {
    setEditingProfile(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('mesero');
    setShowForm(true);
  };

  const openEdit = (p: Profile) => {
    setEditingProfile(p);
    setFormName(p.name || '');
    setFormRole((p.role as UserRole) || 'mesero');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Nombre es requerido');
      return;
    }
    
    setIsSubmitting(true);
    if (editingProfile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('profiles') as any)
        .update({ 
          name: formName, 
          role: formRole 
        })
        .eq('id', editingProfile.id);

      if (error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.success('Perfil actualizado');
        fetchProfiles();
        setShowForm(false);
      }
    } else {
      // Create new user via Auth
      if (!formEmail.trim() || !formPassword.trim()) {
        toast.error('Email y contraseña son requeridos');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: {
          data: {
            full_name: formName,
            role: formRole
          }
        }
      });

      if (error) {
        toast.error(`Error al crear usuario: ${error.message}`);
      } else {
        toast.success('Usuario creado. Los perfiles se sincronizan automáticamente.');
        // If it was a success but no session (needs confirmation), we might not see the profile immediately
        setTimeout(fetchProfiles, 1500); 
        setShowForm(false);
      }
    }
    setIsSubmitting(false);
  };

  if (loading) return <div className="p-6 text-center">Cargando usuarios...</div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl font-bold">Gestión de Usuarios</h1>
        </div>
        <Button onClick={openCreate}>
          Comenzar Registro
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre o rol..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Stats cards for waiters */}
      <div>
        <h3 className="font-display font-bold mb-3">Rendimiento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.filter(u => u.role === 'mesero').map(u => {
            const uStats = orders.reduce((acc, o) => {
              if (o.created_by === u.id) {
                acc.orders++;
                acc.total += o.total;
                acc.items += (o.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0);
              }
              return acc;
            }, { orders: 0, total: 0, items: 0 });

            return (
              <div key={u.id} className="pos-card flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {u.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      {uStats.orders} pedidos
                    </span>
                    <span className="flex items-center gap-1 text-primary font-semibold">
                      {formatPrice(uStats.total)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users table */}
      <div className="pos-card overflow-x-auto">
        <h3 className="font-display font-bold mb-4">Todos los perfiles</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-semibold">Nombre</th>
              <th className="pb-3 font-semibold">Rol</th>
              <th className="pb-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-3 font-display font-bold">{u.name}</td>
                <td className="py-3">
                  <Badge variant="outline" className={ROLE_COLORS[u.role as UserRole]}>
                    {ROLE_LABELS[u.role as UserRole]}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(u)}
                      disabled={u.id === currentUser?.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre completo</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre completo" />
            </div>
            {!editingProfile && (
              <>
                <div>
                  <Label>Correo electrónico</Label>
                  <Input 
                    type="email" 
                    value={formEmail} 
                    onChange={e => setFormEmail(e.target.value)} 
                    placeholder="email@la30.com" 
                  />
                </div>
                <div>
                  <Label>Contraseña</Label>
                  <Input 
                    type="password" 
                    value={formPassword} 
                    onChange={e => setFormPassword(e.target.value)} 
                    placeholder="Contraseña mínima 6 caracteres" 
                  />
                </div>
              </>
            )}
            <div>
              <Label>Rol</Label>
              <Select value={formRole} onValueChange={v => setFormRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="caja">Cajero/a</SelectItem>
                  <SelectItem value="mesero">Mesero/a</SelectItem>
                  <SelectItem value="cocina">Cocina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editingProfile ? 'Guardar Cambios' : 'Crear Usuario')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete clarification */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Información</AlertDialogTitle>
            <AlertDialogDescription>
              Para eliminar un usuario de forma segura y permanente, debes hacerlo desde el panel de control de Supabase Authentication. Esto asegura que se eliminen también sus credenciales de acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteTarget(null)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
