import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import {
  getMaterialEntries,
  getMaterialCategories,
  getSuppliers,
  createSupplier,
  getRawMaterials,
  addMaterialEntry,
} from "@/lib/inventoryService";
import type { RawMaterialEntryInsert } from "@/types";
import { toast } from "sonner";
import { Plus, Receipt, Search, Filter } from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import {
  getCompatibleUnits,
  convertToBase,
  calculateBaseUnitCost,
} from "@/lib/unitConversions";

export function EntriesTab() {
  const { activeStore } = useStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  const [formData, setFormData] = useState({
    quantity: "",
    unit_id: "",
    unit_cost: "",
    supplier_nit: "",
    supplier_name: "",
    notes: "",
  });

  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", activeStore?.id],
    queryFn: () => getSuppliers(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["material_categories", activeStore?.id],
    queryFn: () => getMaterialCategories(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const filteredMaterials = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategoryId
      ? m.category_id === activeCategoryId
      : true;
    return matchSearch && matchCat;
  });

  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["raw_material_entries", selectedMaterialId],
    queryFn: () => getMaterialEntries(selectedMaterialId),
    enabled: !!selectedMaterialId,
  });

  const createMutation = useMutation({
    mutationFn: (data: RawMaterialEntryInsert) => addMaterialEntry(data),
    onSuccess: () => {
      toast.success("Entrada registrada correctamente");
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
      queryClient.invalidateQueries({ queryKey: ["raw_material_entries"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || !user || !activeStore) return;

    // Convert inputs from "Purchase Unit" to "Base Unit"
    const inputQty = Number(formData.quantity);
    const totalCost = inputQty * Number(formData.unit_cost);

    // DB expects quantity and cost in BASE unit
    const baseQty = convertToBase(inputQty, formData.unit_id);
    const baseUnitCost = calculateBaseUnitCost(
      totalCost,
      inputQty,
      formData.unit_id,
    );

    let supplierId = null;
    let finalSupplierName = formData.supplier_name.trim();

    if (formData.supplier_nit.trim()) {
      const existing = suppliers.find(
        (s) => s.nit === formData.supplier_nit.trim(),
      );
      if (existing) {
        supplierId = existing.id;
        finalSupplierName = existing.name;
      } else if (finalSupplierName) {
        // Create it on the fly
        try {
          const newSup = await createSupplier({
            store_id: activeStore.id,
            nit: formData.supplier_nit.trim(),
            name: finalSupplierName,
          });
          supplierId = newSup.id;
        } catch (err) {
          toast.error("No se pudo crear el proveedor automáticamente");
        }
      }
    }

    // Save the original input context in notes
    const purchaseNotes =
      `Comprado en: ${inputQty} ${formData.unit_id} a ${formatPrice(Number(formData.unit_cost))} c/u.\n${formData.notes || ""}`.trim();

    createMutation.mutate({
      raw_material_id: selectedMaterialId,
      quantity: baseQty,
      unit_cost: baseUnitCost,
      supplier_id: supplierId || undefined,
      supplier_name: finalSupplierName || undefined,
      notes: purchaseNotes,
      created_by: user.id,
    });
  };

  const handleNitChange = (nit: string) => {
    const existing = suppliers.find((s) => s.nit === nit);
    setFormData((prev) => ({
      ...prev,
      supplier_nit: nit,
      supplier_name: existing ? existing.name : prev.supplier_name,
    }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      quantity: "",
      unit_id: selectedMaterial?.unit || "",
      unit_cost: "",
      supplier_nit: "",
      supplier_name: "",
      notes: "",
    });
  };

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Selector de Insumo (Lado Izquierdo) */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-6 border rounded-2xl shadow-sm flex flex-col h-full max-h-[800px]">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 shrink-0">
            Seleccionar Insumo
          </h3>

          <div className="space-y-3 mb-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={activeCategoryId}
                onChange={(e) => setActiveCategoryId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-slate-600"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto premium-scrollbar pr-2 space-y-2">
            {isLoadingMaterials ? (
              <p className="text-sm text-slate-400">Cargando...</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No se encontraron insumos.
              </p>
            ) : (
              filteredMaterials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMaterialId(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedMaterialId === m.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-slate-100 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="font-bold text-slate-700">{m.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Stock: {m.current_stock} {m.unit}
                    </span>
                    {m.raw_material_categories && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white"
                          style={{
                            backgroundColor: m.raw_material_categories.color,
                          }}
                        >
                          {m.raw_material_categories.name}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Historial y Acciones (Lado Derecho) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedMaterial ? (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Historial de Entradas
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                  {selectedMaterial.name} ({selectedMaterial.unit})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-sm font-bold text-sm"
              >
                <Plus className="h-4 w-4" />
                Registrar Compra
              </button>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 border-b text-[10px] uppercase font-black tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Proveedor</th>
                    <th className="px-6 py-4 text-right">Cantidad</th>
                    <th className="px-6 py-4 text-right">Costo Unit.</th>
                    <th className="px-6 py-4 text-right">Costo Total</th>
                    <th className="px-6 py-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingEntries ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        Cargando historial...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        No hay registros de compras para este insumo.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-slate-600">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 text-xs">
                          {entry.supplier_name || "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-700">
                          +{entry.quantity}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-500">
                          {formatPrice(entry.unit_cost)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                          {formatPrice(entry.total_cost)}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {entry.notes || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm">
              Selecciona un insumo
            </p>
            <p className="text-xs mt-2">
              Para ver su historial y registrar compras
            </p>
          </div>
        )}
      </div>

      {isModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-800">
                  Registrar Compra
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
                  {selectedMaterial.name}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Unidad de Compra
                  </label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit_id: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {getCompatibleUnits(selectedMaterial.unit).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} ({u.short})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Cantidad ({formData.unit_id || selectedMaterial.unit})
                  </label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, quantity: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: 500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Costo Unit. por {formData.unit_id || selectedMaterial.unit}{" "}
                    ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit_cost: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ej: 1500"
                  />
                </div>
              </div>

              {formData.quantity && formData.unit_cost && (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex justify-between items-center">
                  <span className="text-xs font-bold text-primary uppercase">
                    Costo Total Calculado:
                  </span>
                  <span className="text-lg font-black text-primary">
                    {formatPrice(
                      Number(formData.quantity) * Number(formData.unit_cost),
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    NIT Proveedor (Opcional)
                  </label>
                  <input
                    type="text"
                    list="suppliersList"
                    value={formData.supplier_nit}
                    onChange={(e) => handleNitChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Buscar o crear..."
                  />
                  <datalist id="suppliersList">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.nit}>
                        {s.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Nombre Proveedor
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        supplier_name: e.target.value,
                      }))
                    }
                    disabled={
                      !!suppliers.find((s) => s.nit === formData.supplier_nit)
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    placeholder="Nombre del proveedor"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-20"
                  placeholder="Ej: Factura #1234"
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
                  disabled={createMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  Registrar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
