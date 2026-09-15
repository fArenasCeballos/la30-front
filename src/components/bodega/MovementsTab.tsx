import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/context/StoreContext";
import {
  getRawMaterials,
  getStockMovements,
  getMaterialCategories,
} from "@/lib/inventoryService";
import {
  Search,
  History,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  Loader2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function MovementsTab() {
  const { activeStore } = useStore();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ["raw_materials", activeStore?.id],
    queryFn: () => getRawMaterials(activeStore!.id),
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

  const effectiveSelectedMaterialId =
    selectedMaterialId || (filteredMaterials[0]?.id ?? "");

  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ["stock_movements", effectiveSelectedMaterialId],
    queryFn: () => getStockMovements(effectiveSelectedMaterialId),
    enabled: !!effectiveSelectedMaterialId,
  });

  const selectedMaterial = materials.find(
    (m) => m.id === effectiveSelectedMaterialId,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Selector de Insumo (Lado Izquierdo) */}
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
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMaterialId(m.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2",
                      isSelected
                        ? "border-teal-600 bg-teal-50/60 shadow-2xs text-teal-950"
                        : "border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60 text-slate-800",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate">{m.name}</div>
                      <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Stock: {m.current_stock} {m.unit}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Historial de Movimientos (Lado Derecho) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedMaterial ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[500px]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {selectedMaterial.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Trazabilidad de movimientos y auditoría de stock
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <Scale className="h-3.5 w-3.5 text-teal-600" />
                <span>
                  Stock Actual:{" "}
                  <strong className="text-slate-900">
                    {selectedMaterial.current_stock} {selectedMaterial.unit}
                  </strong>
                </span>
              </div>
            </div>

            {/* Movements Table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Fecha y Hora</th>
                    <th className="px-5 py-3">Tipo de Movimiento</th>
                    <th className="px-5 py-3 text-right">Cantidad</th>
                    <th className="px-5 py-3">Detalle / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingMovements ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mb-2" />
                        <span className="text-xs font-medium">
                          Cargando movimientos...
                        </span>
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-16 text-center text-slate-400"
                      >
                        <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-xs text-slate-600">
                          Sin movimientos registrados
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Los cambios por ventas o compras aparecerán aquí
                          automáticamente.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => {
                      const isPositive = mov.quantity > 0;
                      return (
                        <tr
                          key={mov.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-slate-600 text-xs whitespace-nowrap">
                            {new Date(mov.created_at).toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5">
                            {mov.movement_type === "entry" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                Compra / Entrada
                              </span>
                            )}
                            {mov.movement_type === "order_deduction" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                                Consumo en Venta
                              </span>
                            )}
                            {mov.movement_type === "manual_adjustment" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                                Ajuste de Inventario
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-xs whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                isPositive ? "text-emerald-600" : "text-rose-600",
                              )}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              <span>
                                {isPositive ? "+" : ""}
                                {mov.quantity} {selectedMaterial.unit}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs">
                            {mov.notes || "—"}
                            {mov.order_id && (
                              <span className="block mt-0.5 text-[10px] uppercase text-teal-700 font-semibold font-mono">
                                Pedido #{mov.order_id.split("-")[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
              Para ver la auditoría de entradas y salidas de stock.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
