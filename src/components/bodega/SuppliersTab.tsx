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
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            <span>{supplier.name}</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            NIT / Identificación: {supplier.nit}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total Comprado
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {formatPrice(totalSpent)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total Despachos
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {totalEntries}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Promedio x Compra
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {formatPrice(avgPerPurchase)}
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-sm text-slate-900">
            Historial de Facturas & Entradas
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Insumo</th>
                <th className="px-5 py-3 text-right">Cantidad</th>
                <th className="px-5 py-3 text-right">Costo Total</th>
                <th className="px-5 py-3">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">Cargando historial...</span>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs">
                    No se registran compras para este proveedor.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-600 text-xs">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 text-xs">
                      {entry.raw_materials?.name}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-teal-700 text-xs">
                      +{entry.quantity} {entry.raw_materials?.unit}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600 text-xs">
                      {formatPrice(entry.total_cost)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs truncate">
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

// ─── Main Component ─────────────────────────────────────────────────────────
export function SuppliersTab() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ nit: "", name: "" });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", activeStore?.id],
    queryFn: () => getSuppliers(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nit.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const createMutation = useMutation({
    mutationFn: (data: SupplierInsert) => createSupplier(data),
    onSuccess: () => {
      toast.success("Proveedor registrado correctamente");
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

  if (detailSupplier) {
    return (
      <SupplierDetail
        supplier={detailSupplier}
        onBack={() => setDetailSupplier(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors"
            strokeWidth={2}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proveedor por NIT o nombre..."
            className="pl-9.5 pr-9 h-10 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
            {filtered.length} {filtered.length === 1 ? "proveedor" : "proveedores"}
          </span>

          <Button
            onClick={() => openModal()}
            className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Nuevo Proveedor</span>
          </Button>
        </div>
      </div>

      {/* Grid of Supplier Cards on Mobile & Tablet / Table on Desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 xl:hidden">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 transition-all duration-200 shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm leading-snug">
                  {item.name}
                </h4>
              </div>
              <p className="text-xs font-mono text-slate-400 pl-10">
                NIT: {item.nit}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetailSupplier(item)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-700 hover:text-teal-600 border-slate-200"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                <span>Ver Compras</span>
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => openModal(item)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Seguro que deseas eliminar este proveedor?",
                    )
                  ) {
                    deleteMutation.mutate(item.id);
                  }
                }}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden xl:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">NIT / Identificación</th>
                <th className="px-6 py-3.5">Razón Social</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">Cargando proveedores...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-xs">
                    No se encontraron proveedores.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-600 text-xs">
                      {item.nit}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-md bg-teal-50 text-teal-600 flex items-center justify-center">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailSupplier(item)}
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Ver Compras</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => openModal(item)}
                          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Seguro que deseas eliminar este proveedor?",
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

      {/* Modal Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-900">
                {editingItem ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  NIT / Identificación *
                </label>
                <Input
                  required
                  type="text"
                  value={formData.nit}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, nit: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-sm font-mono uppercase"
                  placeholder="Ej: 900123456-1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Nombre o Razón Social *
                </label>
                <Input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-sm font-medium uppercase"
                  placeholder="Ej: DISTRIBUIDORA CARNES LA 30 S.A.S"
                />
              </div>

              <div className="pt-3 flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1 h-11 rounded-xl text-xs font-semibold border-slate-200 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingItem ? "Actualizar" : "Guardar Proveedor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
