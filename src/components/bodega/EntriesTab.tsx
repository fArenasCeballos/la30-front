import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import {
  getRawMaterials,
  getMaterialEntries,
  addMaterialEntry,
  getSuppliers,
  createSupplier,
  getMaterialCategories,
} from "@/lib/inventoryService";
import type { RawMaterialEntryInsert } from "@/types/inventory.types";
import { toast } from "sonner";
import { formatPrice } from "@/lib/formatPrice";
import {
  Plus,
  Search,
  Receipt,
  Scale,
  X,
  Loader2,
  PackagePlus
} from "lucide-react";
import { getCompatibleUnits, convertToBase } from "@/lib/unitConversions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EntriesTab() {
  const { activeStore } = useStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    quantity: "",
    unit_id: "",
    unit_cost: "",
    supplier_nit: "",
    supplier_name: "",
    notes: "",
  });

  // 1. Fetch materials
  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  // 2. Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["material_categories", activeStore?.id],
    queryFn: () => getMaterialCategories(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  // 3. Fetch entries for selected material
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["material_entries", selectedMaterialId],
    queryFn: () => getMaterialEntries(selectedMaterialId),
    enabled: !!selectedMaterialId,
  });

  // 4. Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", activeStore?.id],
    queryFn: () => getSuppliers(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const filteredMaterials = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategoryId
      ? m.category_id === activeCategoryId
      : true;
    return matchSearch && matchCat;
  });

  // Auto-select first material if none selected and materials available
  const effectiveSelectedMaterialId =
    selectedMaterialId || (filteredMaterials[0]?.id ?? "");

  const selectedMaterial = materials.find(
    (m) => m.id === effectiveSelectedMaterialId,
  );

  // Mutation
  const createMutation = useMutation({
    mutationFn: (data: RawMaterialEntryInsert) => addMaterialEntry(data),
    onSuccess: () => {
      toast.success("Entrada registrada y stock actualizado con éxito");
      queryClient.invalidateQueries({ queryKey: ["material_entries"] });
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || !user || !activeStore) return;

    const inputQty = Number(formData.quantity);
    if (!inputQty || inputQty <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }

    const baseQty = convertToBase(inputQty, formData.unit_id);
    const totalCost = inputQty * Number(formData.unit_cost);
    const baseUnitCost = baseQty > 0 ? totalCost / baseQty : 0;

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
        try {
          const newSup = await createSupplier({
            store_id: activeStore.id,
            nit: formData.supplier_nit.trim(),
            name: finalSupplierName,
          });
          supplierId = newSup.id;
        } catch {
          toast.error("No se pudo crear el proveedor automáticamente");
        }
      }
    }

    const purchaseNotes =
      `Comprado en: ${inputQty} ${formData.unit_id} a ${formatPrice(Number(formData.unit_cost))} c/u.\n${formData.notes || ""}`.trim();

    createMutation.mutate({
      raw_material_id: effectiveSelectedMaterialId,
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

  const openModal = () => {
    if (!selectedMaterial) return;
    setFormData({
      quantity: "",
      unit_id: selectedMaterial.unit,
      unit_cost: "",
      supplier_nit: "",
      supplier_name: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Selector de Insumo (Columna Izquierda) */}
      <div className="lg:col-span-1 space-y-3">
        <div className="bg-white p-4 sm:p-5 border border-slate-200/80 rounded-2xl shadow-xs flex flex-col h-auto max-h-[280px] sm:max-h-[340px] lg:max-h-[800px]">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-teal-600" />
              <span>Insumos ({filteredMaterials.length})</span>
            </h3>
          </div>

          <div className="space-y-2.5 mb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9.5 rounded-xl border border-slate-200/80 bg-slate-50/60 text-xs"
              />
            </div>

            <select
              value={activeCategoryId}
              onChange={(e) => setActiveCategoryId(e.target.value)}
              className="w-full h-9.5 px-3 bg-slate-50/60 border border-slate-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500/30 text-slate-700"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* List of raw materials */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
            {isLoadingMaterials ? (
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : filteredMaterials.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No se encontraron insumos.
              </p>
            ) : (
              filteredMaterials.map((m) => {
                const isSelected = effectiveSelectedMaterialId === m.id;
                const isLow = m.current_stock <= m.min_stock;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMaterialId(m.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                      isSelected
                        ? "border-teal-600 bg-teal-50/60 shadow-2xs"
                        : "border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-800 truncate">
                        {m.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Stock: {m.current_stock} {m.unit}
                        </span>
                        {m.raw_material_categories && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white"
                            style={{
                              backgroundColor: m.raw_material_categories.color,
                            }}
                          >
                            {m.raw_material_categories.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {isLow && (
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" title="Stock Bajo" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Historial y Acciones de Compra (Columna Derecha) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedMaterial ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[500px]">
            {/* Header with action */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {selectedMaterial.name}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Stock actual:{" "}
                      <span className="font-bold text-slate-800">
                        {selectedMaterial.current_stock} {selectedMaterial.unit}
                      </span>{" "}
                      (Mínimo: {selectedMaterial.min_stock} {selectedMaterial.unit})
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={openModal}
                className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                <span>Registrar Compra</span>
              </Button>
            </div>

            {/* Purchases Table / List */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Proveedor</th>
                    <th className="px-5 py-3 text-right">Cantidad Base</th>
                    <th className="px-5 py-3 text-right">Costo Total</th>
                    <th className="px-5 py-3">Detalle / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingEntries ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mb-2" />
                        <span className="text-xs font-medium">
                          Cargando historial de compras...
                        </span>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-slate-400"
                      >
                        <PackagePlus className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-xs text-slate-600">
                          Sin compras registradas aún
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Haz clic en "Registrar Compra" para ingresar una factura
                          o remisión.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-slate-600 text-xs whitespace-nowrap">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 text-xs">
                          {entry.supplier_name || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-teal-700 text-xs whitespace-nowrap">
                          +{entry.quantity} {selectedMaterial.unit}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-600 text-xs whitespace-nowrap">
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
        ) : (
          <div className="h-full min-h-[500px] bg-white border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-bold text-slate-700 text-sm">
              Selecciona un insumo
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Selecciona un ítem de la lista para consultar su historial o
              ingresar facturas.
            </p>
          </div>
        )}
      </div>

      {/* Modal Registrar Compra */}
      {isModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Registrar Compra / Entrada
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedMaterial.name} (Unidad base: {selectedMaterial.unit})
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Unidad de Compra *
                  </label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, unit_id: e.target.value }))
                    }
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {getCompatibleUnits(selectedMaterial.unit).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} ({u.short})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Cantidad ({formData.unit_id || selectedMaterial.unit}) *
                  </label>
                  <Input
                    required
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, quantity: e.target.value }))
                    }
                    className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                    placeholder="Ej: 10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Costo Unitario por {formData.unit_id || selectedMaterial.unit} ($ COP) *
                </label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, unit_cost: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-sm font-semibold"
                  placeholder="Ej: 28000"
                />
              </div>

              {/* Conversion and Total Preview */}
              {formData.quantity && formData.unit_cost && (
                <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200/60 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-teal-900 font-medium">
                    <span>Conversión a stock base:</span>
                    <span className="font-bold">
                      {convertToBase(Number(formData.quantity), formData.unit_id)}{" "}
                      {selectedMaterial.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-teal-200/40 font-bold text-teal-900">
                    <span>Costo Total Compra:</span>
                    <span className="text-sm">
                      {formatPrice(
                        Number(formData.quantity) * Number(formData.unit_cost),
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    NIT Proveedor
                  </label>
                  <Input
                    type="text"
                    list="suppliersList"
                    value={formData.supplier_nit}
                    onChange={(e) => handleNitChange(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 text-xs font-mono"
                    placeholder="900.123.456"
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
                  <label className="text-xs font-semibold text-slate-700">
                    Nombre Proveedor
                  </label>
                  <Input
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
                    className="h-11 rounded-xl border border-slate-200 text-xs"
                    placeholder="Distribuidora S.A.S"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Notas o Factura
                </label>
                <Input
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="h-11 rounded-xl border border-slate-200 text-xs"
                  placeholder="Ej: Factura #98234 - Despacho bodega central"
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
                  disabled={createMutation.isPending}
                  className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {createMutation.isPending ? "Registrando..." : "Registrar Entrada"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
