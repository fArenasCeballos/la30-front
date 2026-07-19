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
  Filter,
} from "lucide-react";

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

  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ["stock_movements", selectedMaterialId],
    queryFn: () => getStockMovements(selectedMaterialId),
    enabled: !!selectedMaterialId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["material_categories", activeStore?.id],
    queryFn: () => getMaterialCategories(activeStore!.id),
    enabled: !!activeStore?.id,
  });

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  const filteredMaterials = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategoryId
      ? m.category_id === activeCategoryId
      : true;
    return matchSearch && matchCat;
  });

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
                  <div className="text-xs font-semibold text-slate-400 uppercase mt-0.5">
                    Stock Actual: {m.current_stock} {m.unit}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Historial de Movimientos (Lado Derecho) */}
      <div className="lg:col-span-2 space-y-4">
        {selectedMaterial ? (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Auditoría de Stock
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                  {selectedMaterial.name} ({selectedMaterial.unit})
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                <Scale className="h-4 w-4" />
                <span>Stock: {selectedMaterial.current_stock}</span>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 border-b text-[10px] uppercase font-black tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Fecha y Hora</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-right">Movimiento</th>
                    <th className="px-6 py-4">Detalle / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingMovements ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-slate-400"
                      >
                        No hay movimientos registrados para este insumo.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => {
                      const isPositive = mov.quantity > 0;
                      return (
                        <tr
                          key={mov.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-slate-600 whitespace-nowrap">
                            {new Date(mov.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              {mov.movement_type === "entry" && "Compra"}
                              {mov.movement_type === "order_deduction" &&
                                "Venta"}
                              {mov.movement_type === "manual_adjustment" &&
                                "Ajuste"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                isPositive ? "text-emerald-500" : "text-red-500"
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {isPositive ? "+" : ""}
                              {mov.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {mov.notes || "-"}
                            {mov.order_id && (
                              <span className="block mt-0.5 text-[10px] uppercase text-primary font-bold">
                                Pedido: {mov.order_id.split("-")[0]}
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
          <div className="h-full min-h-[500px] bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm">
              Selecciona un insumo
            </p>
            <p className="text-xs mt-2">Para ver la trazabilidad de su stock</p>
          </div>
        )}
      </div>
    </div>
  );
}
