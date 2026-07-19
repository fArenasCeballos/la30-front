import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  getSupplierPurchaseHistory,
} from "@/lib/inventoryService";
import type { Supplier, SupplierInsert, SupplierUpdate } from "@/types";
import { toast } from "sonner";
import { formatPrice } from "@/lib/formatPrice";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  ArrowLeft,
  Eye,
  DollarSign,
  Package,
  TrendingUp,
} from "lucide-react";

// ─── Detail View ────────────────────────────────────────────────────────────
function SupplierDetail({
  supplier,
  onBack,
}: {
  supplier: Supplier;
  onBack: () => void;
}) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["supplier_history", supplier.id],
    queryFn: () => getSupplierPurchaseHistory(supplier.id),
    enabled: !!supplier.id,
  });

  const totalSpent = history.reduce((sum, e) => sum + e.total_cost, 0);
  const totalEntries = history.length;
  const avgPerPurchase = totalEntries > 0 ? totalSpent / totalEntries : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {supplier.name}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            NIT: {supplier.nit}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Comprado
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {formatPrice(totalSpent)}
          </p>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Compras
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {totalEntries}
          </p>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-violet-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Promedio por Compra
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {formatPrice(avgPerPurchase)}
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
            Historial de Compras
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b text-[10px] uppercase font-black tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Insumo</th>
                <th className="px-6 py-4 text-right">Cantidad</th>
                <th className="px-6 py-4 text-right">Costo Unit.</th>
                <th className="px-6 py-4 text-right">Costo Total</th>
                <th className="px-6 py-4">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Cargando historial...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No hay compras registradas con este proveedor.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {new Date(entry.entry_date).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {entry.raw_materials?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-700">
                      +{entry.quantity}{" "}
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {entry.raw_materials?.unit ?? ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-500">
                      {formatPrice(entry.unit_cost)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      {formatPrice(entry.total_cost)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs max-w-[200px] truncate">
                      {entry.notes || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────────────────
export function SuppliersTab() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    nit: "",
    name: "",
  });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", activeStore?.id],
    queryFn: () => getSuppliers(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data: SupplierInsert) => createSupplier(data),
    onSuccess: () => {
      toast.success("Proveedor creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierUpdate }) =>
      updateSupplier(id, data),
    onSuccess: () => {
      toast.success("Proveedor actualizado");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deactivateSupplier(id),
    onSuccess: () => {
      toast.success("Proveedor eliminado");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          nit: formData.nit.trim(),
          name: formData.name.trim(),
        },
      });
    } else {
      createMutation.mutate({
        store_id: activeStore.id,
        nit: formData.nit.trim(),
        name: formData.name.trim(),
      });
    }
  };

  const openModal = (item?: Supplier) => {
    if (item) {
      setEditingItem(item);
      setFormData({ nit: item.nit, name: item.name });
    } else {
      setEditingItem(null);
      setFormData({ nit: "", name: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // ── If viewing detail, render full-screen detail ──
  if (detailSupplier) {
    return (
      <SupplierDetail
        supplier={detailSupplier}
        onBack={() => setDetailSupplier(null)}
      />
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar proveedor por NIT o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <button
          onClick={() => openModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm font-bold text-sm"
        >
          <Plus className="h-4 w-4" />
          Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b text-[10px] uppercase font-black tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">NIT / ID</th>
                <th className="px-6 py-4">Razón Social</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    Cargando proveedores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    No se encontraron proveedores.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-500">
                      {item.nit}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        {item.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDetailSupplier(item)}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openModal(item)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("¿Seguro que deseas eliminar este proveedor?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">
                {editingItem ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  NIT / ID de Empresa
                </label>
                <input
                  required
                  type="text"
                  value={formData.nit}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, nit: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                  placeholder="Ej: 900123456-1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Nombre / Razón Social
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                  placeholder="Ej: DISMA S.A.S"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {editingItem ? "Actualizar" : "Guardar Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
