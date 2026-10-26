import { useMemo, useState } from "react";
import {
  DollarSign,
  ShoppingBag,
  Award,
  User,
  Users,
  Search,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  UtensilsCrossed,
  Filter,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  filterDetailedItems,
  aggregateByProduct,
  aggregateByWaiter,
  aggregateByCategory,
  type DetailedSaleItem,
  type ProductSalesSummary,
  type WaiterSalesSummary,
  type CategorySalesSummary,
} from "@/lib/detailedSalesReportUtils";
import { format } from "date-fns";

interface CategoryMeta {
  id: string;
  name: string;
  label?: string | null;
  icon?: string | null;
}

interface ProductMeta {
  id: string;
  name: string;
  category_id?: string | null;
  price?: number;
}

interface ProductStaffTabProps {
  soldItems: DetailedSaleItem[];
  allCategories: CategoryMeta[];
  allProducts: ProductMeta[];
  isLoading: boolean;
  activeStoreName?: string;
}

type ViewMode = "products" | "waiters" | "categories";
type SortOption = "quantity" | "revenue" | "name";

export function ProductStaffTab({
  soldItems,
  allCategories,
  allProducts,
  isLoading,
  activeStoreName = "Sede Actual",
}: ProductStaffTabProps) {
  // ── Filters & Controls State ──────────────────────────────────────────────────
  const [selectedWaiter, setSelectedWaiter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("quantity");
  const [viewMode, setViewMode] = useState<ViewMode>("products");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // ── Unique Available Options from Data ───────────────────────────────────────
  const uniqueWaiters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    soldItems.forEach((item) => {
      const id = item.waiterId || item.waiterName;
      const current = map.get(id) || {
        id,
        name: item.waiterName,
        count: 0,
      };
      current.count += item.quantity;
      map.set(id, current);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [soldItems]);

  const uniqueCategories = useMemo(() => {
    const detected = new Map<
      string,
      { id: string; label: string; icon?: string }
    >();

    // Primero las categorías oficiales
    allCategories.forEach((c) => {
      detected.set(c.id, {
        id: c.id,
        label: c.label || c.name,
        icon: c.icon || "",
      });
    });

    // Añadir categorías que vengan en los ítems
    soldItems.forEach((item) => {
      if (item.categoryId && !detected.has(item.categoryId)) {
        detected.set(item.categoryId, {
          id: item.categoryId,
          label: item.categoryName,
          icon: item.categoryIcon,
        });
      }
    });

    return Array.from(detected.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [allCategories, soldItems]);

  const availableProducts = useMemo(() => {
    // Si hay una categoría seleccionada, filtrar productos por esa categoría
    let prods = allProducts;
    if (selectedCategory !== "all") {
      prods = prods.filter((p) => p.category_id === selectedCategory);
    }

    // Complementar con productos detectados en los ítems si aplica
    const map = new Map<string, { id: string; name: string }>();
    prods.forEach((p) => map.set(p.id, { id: p.id, name: p.name }));

    soldItems.forEach((item) => {
      if (
        selectedCategory === "all" ||
        item.categoryId === selectedCategory ||
        item.categoryName === selectedCategory
      ) {
        if (!map.has(item.productId)) {
          map.set(item.productId, {
            id: item.productId,
            name: item.productName,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allProducts, soldItems, selectedCategory]);

  // ── Apply Filters ─────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return filterDetailedItems(soldItems, {
      waiterId: selectedWaiter,
      categoryId: selectedCategory,
      productId: selectedProduct,
      searchTerm,
    });
  }, [
    soldItems,
    selectedWaiter,
    selectedCategory,
    selectedProduct,
    searchTerm,
  ]);

  // ── Aggregations ─────────────────────────────────────────────────────────────
  const productSummaries: ProductSalesSummary[] = useMemo(() => {
    return aggregateByProduct(filteredItems, sortBy);
  }, [filteredItems, sortBy]);

  const waiterSummaries: WaiterSalesSummary[] = useMemo(() => {
    return aggregateByWaiter(filteredItems, sortBy);
  }, [filteredItems, sortBy]);

  const categorySummaries: CategorySalesSummary[] = useMemo(() => {
    return aggregateByCategory(filteredItems, sortBy);
  }, [filteredItems, sortBy]);

  // ── General Metrics from Filtered Data ───────────────────────────────────────
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalUnits = 0;
    const ordersSet = new Set<string>();

    filteredItems.forEach((item) => {
      totalRevenue += item.totalPrice;
      totalUnits += item.quantity;
      if (item.orderId) ordersSet.add(item.orderId);
    });

    const avgPrice = totalUnits > 0 ? Math.round(totalRevenue / totalUnits) : 0;

    const topProduct = productSummaries[0];
    const topWaiter = waiterSummaries[0];

    return {
      totalRevenue,
      totalUnits,
      ordersCount: ordersSet.size,
      avgPrice,
      topProduct,
      topWaiter,
    };
  }, [filteredItems, productSummaries, waiterSummaries]);

  // ── Selected Product or Category Spotlight Data ──────────────────────────────
  const spotlightData = useMemo(() => {
    // Si se seleccionó un producto específico o una categoría específica,
    // mostrar el ranking de qué meseros vendieron más ese ítem/categoría
    if (selectedProduct !== "all") {
      const prod = productSummaries.find(
        (p) => p.productId === selectedProduct,
      );
      if (prod) {
        return {
          title: `Meseros que más vendieron "${prod.productName}"`,
          subtitle: `Desglose de colaboradores para este producto (${prod.totalQty} unidades vendidas - ${formatPrice(prod.totalRevenue)})`,
          chartData: prod.waiters.map((w) => ({
            name: w.waiterName,
            unidades: w.quantity,
            total: w.revenue,
          })),
          waiters: prod.waiters,
        };
      }
    }

    if (selectedCategory !== "all") {
      const cat = categorySummaries.find(
        (c) =>
          c.categoryId === selectedCategory ||
          c.categoryName === selectedCategory,
      );
      if (cat) {
        return {
          title: `Meseros que más vendieron en "${cat.categoryName}"`,
          subtitle: `Desglose de colaboradores para esta categoría (${cat.totalQty} unidades - ${formatPrice(cat.totalRevenue)})`,
          chartData: cat.waiters.map((w) => ({
            name: w.waiterName,
            unidades: w.quantity,
            total: w.revenue,
          })),
          waiters: cat.waiters,
        };
      }
    }

    return null;
  }, [selectedProduct, selectedCategory, productSummaries, categorySummaries]);

  // ── Chart Data for Active View ───────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (spotlightData) {
      return spotlightData.chartData;
    }

    if (viewMode === "products") {
      return productSummaries.slice(0, 10).map((p) => ({
        name:
          p.productName.length > 20
            ? `${p.productName.slice(0, 20)}...`
            : p.productName,
        unidades: p.totalQty,
        total: p.totalRevenue,
      }));
    }

    if (viewMode === "waiters") {
      return waiterSummaries.map((w) => ({
        name: w.waiterName,
        unidades: w.totalQty,
        total: w.totalRevenue,
      }));
    }

    return categorySummaries.map((c) => ({
      name: c.categoryName,
      unidades: c.totalQty,
      total: c.totalRevenue,
    }));
  }, [
    spotlightData,
    viewMode,
    productSummaries,
    waiterSummaries,
    categorySummaries,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const hasActiveFilters =
    selectedWaiter !== "all" ||
    selectedCategory !== "all" ||
    selectedProduct !== "all" ||
    searchTerm.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedWaiter("all");
    setSelectedCategory("all");
    setSelectedProduct("all");
    setSearchTerm("");
    setExpandedId(null);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedProduct("all"); // Reset producto al cambiar categoría
    setExpandedId(null);
  };

  // ── Export to Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (filteredItems.length === 0) return;
    setIsExporting(true);

    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = `La 30 POS - ${activeStoreName}`;
      wb.created = new Date();

      // ── HOJA 1: RESUMEN PRODUCTOS Y MESEROS ──
      const wsSummary = wb.addWorksheet("Productos y Meseros", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      wsSummary.columns = [
        { header: "PRODUCTO", key: "product", width: 32 },
        { header: "CATEGORÍA", key: "category", width: 22 },
        { header: "UNIDADES VENDIDAS", key: "qty", width: 18 },
        { header: "PRECIO PROMEDIO", key: "avg_price", width: 18 },
        { header: "TOTAL RECAUDADO", key: "revenue", width: 20 },
        { header: "MESERO TOP", key: "top_waiter", width: 26 },
        { header: "UDS MESERO TOP", key: "top_waiter_qty", width: 18 },
        { header: "% PARTICIPACIÓN", key: "top_waiter_pct", width: 18 },
      ];

      wsSummary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsSummary.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D9488" }, // Teal 600
      };
      wsSummary.getRow(1).height = 24;

      productSummaries.forEach((p) => {
        const row = wsSummary.addRow({
          product: p.productName,
          category: p.categoryName,
          qty: p.totalQty,
          avg_price: p.avgPrice,
          revenue: p.totalRevenue,
          top_waiter: p.topWaiter ? p.topWaiter.waiterName : "N/A",
          top_waiter_qty: p.topWaiter ? p.topWaiter.quantity : 0,
          top_waiter_pct: p.topWaiter ? `${p.topWaiter.sharePct}%` : "0%",
        });

        row.getCell("avg_price").numFmt = '"$"#,##0';
        row.getCell("revenue").numFmt = '"$"#,##0';
      });

      // ── HOJA 2: RANKING DE MESEROS ──
      const wsWaiters = wb.addWorksheet("Ranking Meseros", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      wsWaiters.columns = [
        { header: "COLABORADOR / MESERO", key: "name", width: 28 },
        { header: "COMANDAS", key: "orders", width: 16 },
        { header: "UNIDADES TOTALES", key: "qty", width: 18 },
        { header: "TOTAL VENTAS", key: "revenue", width: 20 },
        { header: "PRODUCTO ESTRELLA", key: "top_product", width: 30 },
        { header: "UDS PRODUCTO ESTRELLA", key: "top_prod_qty", width: 22 },
        { header: "CATEGORÍA LÍDER", key: "top_cat", width: 22 },
      ];

      wsWaiters.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsWaiters.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" }, // Slate 900
      };
      wsWaiters.getRow(1).height = 24;

      waiterSummaries.forEach((w) => {
        const row = wsWaiters.addRow({
          name: w.waiterName,
          orders: w.orderCount,
          qty: w.totalQty,
          revenue: w.totalRevenue,
          top_product: w.topProduct ? w.topProduct.productName : "N/A",
          top_prod_qty: w.topProduct ? w.topProduct.quantity : 0,
          top_cat: w.topCategory ? w.topCategory.categoryName : "N/A",
        });

        row.getCell("revenue").numFmt = '"$"#,##0';
      });

      // ── HOJA 3: DETALLE COMPLETO DE ÍTEMS ──
      const wsItems = wb.addWorksheet("Detalle Transaccional", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      wsItems.columns = [
        { header: "FECHA", key: "date", width: 22 },
        { header: "ORDEN / LOC", key: "loc", width: 16 },
        { header: "MESERO", key: "waiter", width: 24 },
        { header: "CATEGORÍA", key: "category", width: 20 },
        { header: "PRODUCTO", key: "product", width: 30 },
        { header: "CANTIDAD", key: "qty", width: 14 },
        { header: "PRECIO UNIT", key: "price", width: 16 },
        { header: "EXTRAS", key: "extras", width: 14 },
        { header: "TOTAL", key: "total", width: 18 },
        { header: "CANAL", key: "channel", width: 14 },
      ];

      wsItems.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsItems.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
      };
      wsItems.getRow(1).height = 24;

      filteredItems.forEach((i) => {
        const row = wsItems.addRow({
          date: format(new Date(i.orderDate), "yyyy-MM-dd HH:mm"),
          loc: `#${i.orderLocator}`,
          waiter: i.waiterName,
          category: i.categoryName,
          product: i.productName,
          qty: i.quantity,
          price: i.unitPrice,
          extras: i.extrasTotal,
          total: i.totalPrice,
          channel: i.isDelivery ? "DOMICILIO" : "CAJA",
        });

        row.getCell("price").numFmt = '"$"#,##0';
        row.getCell("extras").numFmt = '"$"#,##0';
        row.getCell("total").numFmt = '"$"#,##0';
      });

      // Estilos de bordes y alineación
      [wsSummary, wsWaiters, wsItems].forEach((ws) => {
        ws.eachRow((row, rowNumber) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
            if (rowNumber > 1) {
              cell.alignment = { vertical: "middle" };
            }
          });
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const cleanStore = activeStoreName
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, "_")
        .trim();
      saveAs(
        blob,
        `Reporte_Productos_Meseros_${cleanStore}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`,
      );
    } catch (e) {
      console.error("Error al exportar reporte detallado:", e);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && soldItems.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="size-8 animate-spin text-teal-600" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Cargando análisis de productos y meseros...
        </p>
      </div>
    );
  }

  const maxProductQty = Math.max(...productSummaries.map((p) => p.totalQty), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Toolbar de Filtros Interactivos & Segmentación ── */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-700 flex items-center justify-center shrink-0">
              <Filter className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  Filtros de Análisis: Meseros, Categorías & Productos
                </h3>
                {activeStoreName && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold text-teal-700 bg-teal-50 border-teal-200/80 px-2 py-0.5 rounded-full"
                  >
                    {activeStoreName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Explora qué meseros impulsaron cada plato o qué categorías
                lideran las ventas en {activeStoreName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 gap-1.5 h-8.5 rounded-xl cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Restablecer Filtros</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting || filteredItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 h-8.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              <Download className="size-3.5" />
              <span>Exportar Selección</span>
            </Button>
          </div>
        </div>

        {/* Controles de Selección de Filtros (Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filtro: Colaborador / Mesero */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="size-3 text-teal-600" />
              Colaborador / Mesero
            </label>
            <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold">
                <SelectValue placeholder="Todos los colaboradores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">
                  🌟 Todos los colaboradores ({uniqueWaiters.length})
                </SelectItem>
                {uniqueWaiters.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">
                    {w.name} ({w.count} uds)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Categoría de Producto */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <UtensilsCrossed className="size-3 text-teal-600" />
              Categoría
            </label>
            <Select
              value={selectedCategory}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">
                  🍽️ Todas las categorías ({uniqueCategories.length})
                </SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Producto Específico */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShoppingBag className="size-3 text-teal-600" />
              Producto
            </label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold">
                <SelectValue placeholder="Todos los productos" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all" className="text-xs font-bold">
                  🍔 Todos los productos ({availableProducts.length})
                </SelectItem>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buscador de Texto Rápido */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Search className="size-3 text-teal-600" />
              Búsqueda en Vivo
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar plato o mesero..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
              />
              <Search className="size-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fila Inferior: Modo de Visualización (Pestañas internas) & Orden */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Segmentos de Vista */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => {
                setViewMode("products");
                setExpandedId(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === "products"
                  ? "bg-white text-teal-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <UtensilsCrossed className="size-3.5" />
              <span>Por Producto</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-black">
                {productSummaries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode("waiters");
                setExpandedId(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === "waiters"
                  ? "bg-white text-teal-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Users className="size-3.5" />
              <span>Por Mesero</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-black">
                {waiterSummaries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode("categories");
                setExpandedId(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === "categories"
                  ? "bg-white text-teal-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <ShoppingBag className="size-3.5" />
              <span>Por Categoría</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-black">
                {categorySummaries.length}
              </span>
            </button>
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">
              Ordenar por:
            </span>
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setSortBy("quantity")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  sortBy === "quantity"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                Más vendidos
              </button>
              <button
                type="button"
                onClick={() => setSortBy("revenue")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  sortBy === "revenue"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                Mayor ingreso ($)
              </button>
              <button
                type="button"
                onClick={() => setSortBy("name")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  sortBy === "name"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                A-Z
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Tarjetas de Métricas Ejecutivas Reactivas a los Filtros ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5">
        {/* KPI 1: Ventas Filtradas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
              Recaudo Filtrado
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(metrics.totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              En {metrics.ordersCount} comandas procesadas
            </p>
          </div>
        </div>

        {/* KPI 2: Unidades Vendidas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="size-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
              Unidades
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {metrics.totalUnits} uds
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Promedio: {formatPrice(metrics.avgPrice)} / ítem
            </p>
          </div>
        </div>

        {/* KPI 3: Producto Estrella */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-600 flex items-center justify-center shrink-0">
              <Award className="size-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
              Plato Estrella
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm sm:text-base font-black text-slate-900 truncate">
              {metrics.topProduct
                ? metrics.topProduct.productName
                : "Sin datos"}
            </p>
            <p className="text-xs text-purple-700 font-bold mt-1">
              {metrics.topProduct
                ? `${metrics.topProduct.totalQty} uds (${formatPrice(metrics.topProduct.totalRevenue)})`
                : "0 uds"}
            </p>
          </div>
        </div>

        {/* KPI 4: Mesero Líder */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="size-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Colaborador Top
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm sm:text-base font-black text-slate-900 truncate">
              {metrics.topWaiter ? metrics.topWaiter.waiterName : "Sin datos"}
            </p>
            <p className="text-xs text-emerald-700 font-bold mt-1">
              {metrics.topWaiter
                ? `${metrics.topWaiter.totalQty} uds (${formatPrice(metrics.topWaiter.totalRevenue)})`
                : "0 uds"}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Sección Spotlight: Foco Específico en Producto o Categoría ── */}
      {spotlightData && (
        <section className="bg-linear-to-br from-teal-900 via-slate-900 to-slate-900 border border-teal-700/40 rounded-3xl p-5 sm:p-6 text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                🏆
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight uppercase flex items-center gap-2">
                  {spotlightData.title}
                </h3>
                <p className="text-xs text-teal-200/80 font-medium">
                  {spotlightData.subtitle}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white/10 text-teal-300 px-2.5 py-1 rounded-full border border-white/10 self-start sm:self-auto">
              {spotlightData.waiters.length} meseros participaron
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            {/* Lista Top 3 Meseros */}
            <div className="space-y-2 lg:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                Podio de Ventas
              </p>
              <div className="space-y-2">
                {spotlightData.waiters.slice(0, 3).map((w, idx) => (
                  <div
                    key={w.waiterId}
                    className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "size-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                          idx === 0
                            ? "bg-amber-400 text-slate-950 shadow-xs"
                            : idx === 1
                              ? "bg-slate-300 text-slate-900"
                              : "bg-amber-700 text-white",
                        )}
                      >
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {w.waiterName}
                        </p>
                        <p className="text-[11px] text-teal-200">
                          {w.quantity} uds ({w.sharePct}% del plato)
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-300 shrink-0">
                      {formatPrice(w.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico Comparativo del Spotlight */}
            <div className="lg:col-span-2 h-48 w-full bg-slate-950/40 rounded-2xl p-3 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={spotlightData.chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={{ stroke: "#475569" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "14px",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                    formatter={(val: number, name: string) => [
                      name === "unidades" ? `${val} uds` : formatPrice(val),
                      name === "unidades" ? "Unidades" : "Ventas",
                    ]}
                  />
                  <Bar
                    dataKey="unidades"
                    fill="#14b8a6"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Gráfico Comparativo Dinámico ── */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <BarChart3 className="size-4 text-teal-600" />
              {viewMode === "products"
                ? "Top 10 Productos con Mayor Demanda"
                : viewMode === "waiters"
                  ? "Comparativa de Unidades por Colaborador"
                  : "Distribución por Categorías de Menú"}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Volumen de unidades despachadas según el criterio activo
            </p>
          </div>
          <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full border border-teal-200/60">
            {chartData.length} ítems graficados
          </span>
        </div>

        <div className="h-64 sm:h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderRadius: "14px",
                    border: "none",
                    color: "#fff",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "unidades" ? `${value} uds` : formatPrice(value),
                    name === "unidades" ? "Cantidad" : "Total",
                  ]}
                />
                <Bar
                  dataKey="unidades"
                  fill="#0d9488"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
              No hay datos para mostrar en este gráfico con los filtros actuales
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Listado Detallado con Acordeón Interactivo ── */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              {viewMode === "products"
                ? "Desglose por Producto & Quién los Vendió"
                : viewMode === "waiters"
                  ? "Desglose por Mesero & Qué Productos Vendió"
                  : "Desglose por Categoría & Liderazgos"}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Toca cada tarjeta para desplegar el detalle completo del cruce
            </p>
          </div>
          <span className="text-xs font-bold text-teal-600">
            {viewMode === "products"
              ? `${productSummaries.length} productos`
              : viewMode === "waiters"
                ? `${waiterSummaries.length} meseros`
                : `${categorySummaries.length} categorías`}
          </span>
        </div>

        {/* ── VISTA 1: POR PRODUCTO ── */}
        {viewMode === "products" && (
          <div className="space-y-3">
            {productSummaries.length > 0 ? (
              productSummaries.map((p, idx) => {
                const isExpanded = expandedId === p.productId;
                const share = Math.round((p.totalQty / maxProductQty) * 100);
                const isPodium = idx < 3;

                return (
                  <div
                    key={p.productId}
                    className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-teal-200 transition-all space-y-3 shadow-2xs"
                  >
                    {/* Fila Principal */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "size-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
                            idx === 0
                              ? "bg-amber-400 text-slate-900"
                              : idx === 1
                                ? "bg-slate-300 text-slate-800"
                                : idx === 2
                                  ? "bg-amber-700/20 text-amber-800"
                                  : "bg-white text-slate-500 border border-slate-200",
                          )}
                        >
                          #{idx + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {p.productName}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                              {p.categoryIcon} {p.categoryName}
                            </span>
                          </div>

                          {p.topWaiter && (
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                              <span className="text-amber-600 font-bold">
                                ★ Mesero líder:
                              </span>
                              <span className="font-semibold text-slate-800">
                                {p.topWaiter.waiterName}
                              </span>
                              <span className="text-slate-400">
                                ({p.topWaiter.quantity} uds •{" "}
                                {p.topWaiter.sharePct}%)
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Totales y Botón Expandir */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">
                            {formatPrice(p.totalRevenue)}
                          </p>
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                            {p.totalQty} unidades
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : p.productId)
                          }
                          className="h-9 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer border-slate-200 hover:border-teal-500"
                        >
                          <span>{isExpanded ? "Ocultar" : "Ver Meseros"}</span>
                          {isExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPodium ? "bg-teal-600" : "bg-slate-400",
                        )}
                        style={{ width: `${share}%` }}
                      />
                    </div>

                    {/* Detalle Desplegable: Ranking de Meseros para este producto */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2">
                          <span>Colaborador / Mesero</span>
                          <span>Unidades / Total / Participación</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {p.waiters.map((w, wIdx) => (
                            <div
                              key={w.waiterId}
                              className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    "size-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0",
                                    wIdx === 0
                                      ? "bg-amber-400 text-slate-900"
                                      : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  {wIdx + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {w.waiterName}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs font-black text-slate-900">
                                  {w.quantity} uds
                                </p>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {formatPrice(w.revenue)} ({w.sharePct}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No se encontraron productos con los filtros seleccionados
              </div>
            )}
          </div>
        )}

        {/* ── VISTA 2: POR MESERO ── */}
        {viewMode === "waiters" && (
          <div className="space-y-3">
            {waiterSummaries.length > 0 ? (
              waiterSummaries.map((w, idx) => {
                const isExpanded = expandedId === w.waiterId;

                return (
                  <div
                    key={w.waiterId}
                    className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-teal-200 transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "size-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
                            idx === 0
                              ? "bg-amber-400 text-slate-900"
                              : idx === 1
                                ? "bg-slate-300 text-slate-800"
                                : idx === 2
                                  ? "bg-amber-700/20 text-amber-800"
                                  : "bg-white text-slate-500 border border-slate-200",
                          )}
                        >
                          #{idx + 1}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {w.waiterName}
                          </h4>
                          {w.topProduct && (
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                              <span className="text-teal-600 font-bold">
                                ★ Más vendido:
                              </span>
                              <span className="font-semibold text-slate-800">
                                {w.topProduct.productName}
                              </span>
                              <span className="text-slate-400">
                                ({w.topProduct.quantity} uds)
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">
                            {formatPrice(w.totalRevenue)}
                          </p>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {w.totalQty} unidades • {w.orderCount} comandas
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : w.waiterId)
                          }
                          className="h-9 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer border-slate-200 hover:border-teal-500"
                        >
                          <span>{isExpanded ? "Ocultar" : "Ver Platos"}</span>
                          {isExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Detalle Desplegable: Productos que vendió este mesero */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2">
                          <span>Platos vendidos por {w.waiterName}</span>
                          <span>Cantidad / Total</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {w.products.map((prod, pIdx) => (
                            <div
                              key={prod.productId}
                              className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="size-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">
                                  {pIdx + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {prod.productName}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-xs font-black text-slate-900">
                                  {prod.quantity} uds
                                </span>
                                <p className="text-[10px] font-semibold text-slate-400">
                                  {formatPrice(prod.revenue)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No se encontraron meseros con los filtros seleccionados
              </div>
            )}
          </div>
        )}

        {/* ── VISTA 3: POR CATEGORÍA ── */}
        {viewMode === "categories" && (
          <div className="space-y-3">
            {categorySummaries.length > 0 ? (
              categorySummaries.map((c) => {
                const isExpanded = expandedId === c.categoryId;

                return (
                  <div
                    key={c.categoryId}
                    className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-teal-200 transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-800 flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
                          {c.categoryIcon || "🍽️"}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {c.categoryName}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                            {c.topProduct && (
                              <span>
                                Top plato:{" "}
                                <strong className="text-slate-800">
                                  {c.topProduct.productName}
                                </strong>{" "}
                                ({c.topProduct.quantity} uds)
                              </span>
                            )}
                            {c.topWaiter && (
                              <span>
                                Top mesero:{" "}
                                <strong className="text-slate-800">
                                  {c.topWaiter.waiterName}
                                </strong>{" "}
                                ({c.topWaiter.quantity} uds)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">
                            {formatPrice(c.totalRevenue)}
                          </p>
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                            {c.totalQty} unidades • {c.productsCount} platos
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : c.categoryId)
                          }
                          className="h-9 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer border-slate-200 hover:border-teal-500"
                        >
                          <span>{isExpanded ? "Ocultar" : "Ver Detalle"}</span>
                          {isExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Detalle Desplegable: Platos y Meseros de la Categoría */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-150">
                        {/* Subcolumna 1: Productos de la categoría */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Platos en {c.categoryName}
                          </p>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {c.products.map((p, pIdx) => (
                              <div
                                key={p.productId}
                                className="bg-white border border-slate-200/80 rounded-xl p-2 flex items-center justify-between text-xs"
                              >
                                <span className="font-semibold text-slate-800 truncate">
                                  #{pIdx + 1} {p.productName}
                                </span>
                                <span className="font-black text-teal-700 shrink-0">
                                  {p.quantity} uds ({formatPrice(p.revenue)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Subcolumna 2: Meseros que vendieron esta categoría */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Meseros que más vendieron {c.categoryName}
                          </p>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {c.waiters.map((w, wIdx) => (
                              <div
                                key={w.waiterId}
                                className="bg-white border border-slate-200/80 rounded-xl p-2 flex items-center justify-between text-xs"
                              >
                                <span className="font-semibold text-slate-800 truncate">
                                  #{wIdx + 1} {w.waiterName}
                                </span>
                                <span className="font-black text-emerald-700 shrink-0">
                                  {w.quantity} uds ({formatPrice(w.revenue)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No se encontraron categorías con los filtros seleccionados
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
