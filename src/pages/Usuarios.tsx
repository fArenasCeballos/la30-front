import { useState, useMemo } from "react";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { MOCK_USERS } from "@/data/mock";
import { formatPrice } from "@/data/mock";
import type { User, UserRole } from "@/types";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  ShoppingCart,
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
  DialogFooter,
} from "@/components/ui/dialog";
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
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("mesero");

  const userStats = useMemo(() => {
    const stats: Record<
      string,
      { orders: number; total: number; items: number }
    > = {};
    orders.forEach((o) => {
      const key = o.createdBy;
      if (!stats[key]) stats[key] = { orders: 0, total: 0, items: 0 };
      stats[key].orders++;
      stats[key].total += o.total;
      stats[key].items += o.items.reduce((s, i) => s + i.quantity, 0);
    });
    return stats;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.includes(q),
    );
  }, [users, search]);

  const openCreate = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("mesero");
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }
    if (editingUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: formName, email: formEmail, role: formRole }
            : u,
        ),
      );
      toast.success("Usuario actualizado");
    } else {
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: formName,
        email: formEmail,
        role: formRole,
        token: `mock-jwt-${Date.now()}`,
      };
      setUsers((prev) => [...prev, newUser]);
      toast.success("Usuario creado");
    }
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    toast.success("Usuario eliminado");
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl font-bold">
            Gestión de Usuarios
          </h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre, email o rol..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Stats cards for waiters */}
      <div>
        <h3 className="font-display font-bold mb-3">Rendimiento de meseros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users
            .filter((u) => u.role === "mesero")
            .map((u) => {
              //const s = userStats[u.role] ||
              userStats[u.name.toLowerCase()] || {
                orders: 0,
                total: 0,
                items: 0,
              };
              // Match by createdBy field
              const uStats = orders.reduce(
                (acc, o) => {
                  if (o.createdBy === u.role || o.createdBy === u.name) {
                    acc.orders++;
                    acc.total += o.total;
                    acc.items += o.items.reduce(
                      (sum, i) => sum + i.quantity,
                      0,
                    );
                  }
                  return acc;
                },
                { orders: 0, total: 0, items: 0 },
              );

              return (
                <div key={u.id} className="pos-card flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                        {uStats.orders} pedidos
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
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
        <h3 className="font-display font-bold mb-4">Todos los usuarios</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-semibold">Nombre</th>
              <th className="pb-3 font-semibold">Email</th>
              <th className="pb-3 font-semibold">Rol</th>
              <th className="pb-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-3 font-display font-bold">{u.name}</td>
                <td className="py-3 text-muted-foreground">{u.email}</td>
                <td className="py-3">
                  <Badge variant="outline" className={ROLE_COLORS[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(u)}
                    >
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

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@la30.com"
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={formRole}
                onValueChange={(v) => setFormRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingUser ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a <strong>{deleteTarget?.name}</strong> (
              {deleteTarget?.email}). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
