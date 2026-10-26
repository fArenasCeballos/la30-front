import { getCategoryEmoji } from "./categoryEmoji";

export interface DetailedSaleItem {
  id: string;
  orderId: string;
  orderLocator: string;
  orderDate: string;
  orderStatus: string;
  isDelivery: boolean;
  waiterId: string;
  waiterName: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  quantity: number;
  unitPrice: number;
  extrasTotal: number;
  totalPrice: number;
  notes?: string | null;
}

export interface WaiterProductContribution {
  waiterId: string;
  waiterName: string;
  quantity: number;
  revenue: number;
  sharePct: number;
}

export interface ProductSalesSummary {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  totalQty: number;
  totalRevenue: number;
  avgPrice: number;
  topWaiter?: WaiterProductContribution;
  waiters: WaiterProductContribution[];
}

export interface WaiterProductItem {
  productId: string;
  productName: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  sharePct: number;
}

export interface WaiterCategoryContribution {
  categoryId: string;
  categoryName: string;
  quantity: number;
  revenue: number;
}

export interface WaiterSalesSummary {
  waiterId: string;
  waiterName: string;
  totalQty: number;
  totalRevenue: number;
  orderCount: number;
  topProduct?: WaiterProductItem;
  topCategory?: WaiterCategoryContribution;
  products: WaiterProductItem[];
  categories: WaiterCategoryContribution[];
}

export interface CategorySalesSummary {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  totalQty: number;
  totalRevenue: number;
  productsCount: number;
  topProduct?: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  };
  topWaiter?: {
    waiterId: string;
    waiterName: string;
    quantity: number;
    revenue: number;
    sharePct: number;
  };
  products: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];
  waiters: {
    waiterId: string;
    waiterName: string;
    quantity: number;
    revenue: number;
    sharePct: number;
  }[];
}

export interface DetailedReportFilters {
  waiterId?: string;
  categoryId?: string;
  productId?: string;
  searchTerm?: string;
  sortBy?: "quantity" | "revenue" | "name";
}

/**
 * Filtra los ítems de venta según los criterios seleccionados.
 */
export function filterDetailedItems(
  items: DetailedSaleItem[],
  filters: DetailedReportFilters,
): DetailedSaleItem[] {
  const {
    waiterId = "all",
    categoryId = "all",
    productId = "all",
    searchTerm = "",
  } = filters;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  return items.filter((item) => {
    // 1. Filtro por mesero
    if (
      waiterId !== "all" &&
      item.waiterId !== waiterId &&
      item.waiterName !== waiterId
    ) {
      return false;
    }

    // 2. Filtro por categoría
    if (
      categoryId !== "all" &&
      item.categoryId !== categoryId &&
      item.categoryName !== categoryId
    ) {
      return false;
    }

    // 3. Filtro por producto
    if (productId !== "all" && item.productId !== productId) {
      return false;
    }

    // 4. Búsqueda por texto
    if (normalizedSearch) {
      const matchProduct = item.productName
        .toLowerCase()
        .includes(normalizedSearch);
      const matchWaiter = item.waiterName
        .toLowerCase()
        .includes(normalizedSearch);
      const matchCategory = item.categoryName
        .toLowerCase()
        .includes(normalizedSearch);

      if (!matchProduct && !matchWaiter && !matchCategory) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Agrupa los ítems por producto y calcula el desglose de meseros para cada uno.
 */
export function aggregateByProduct(
  items: DetailedSaleItem[],
  sortBy: "quantity" | "revenue" | "name" = "quantity",
): ProductSalesSummary[] {
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      totalQty: number;
      totalRevenue: number;
      waitersMap: Map<string, { waiterName: string; qty: number; rev: number }>;
    }
  >();

  items.forEach((item) => {
    const key = item.productId || item.productName;
    let entry = productMap.get(key);

    if (!entry) {
      entry = {
        productId: item.productId,
        productName: item.productName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categoryIcon:
          item.categoryIcon ||
          getCategoryEmoji({
            categories: { name: item.categoryName, label: item.categoryName },
            name: item.productName,
          }),
        totalQty: 0,
        totalRevenue: 0,
        waitersMap: new Map(),
      };
      productMap.set(key, entry);
    }

    entry.totalQty += item.quantity;
    entry.totalRevenue += item.totalPrice;

    const waiterKey = item.waiterId || item.waiterName;
    const waiterEntry = entry.waitersMap.get(waiterKey) || {
      waiterName: item.waiterName,
      qty: 0,
      rev: 0,
    };
    waiterEntry.qty += item.quantity;
    waiterEntry.rev += item.totalPrice;
    entry.waitersMap.set(waiterKey, waiterEntry);
  });

  const result: ProductSalesSummary[] = Array.from(productMap.values()).map(
    (entry) => {
      const waitersList: WaiterProductContribution[] = Array.from(
        entry.waitersMap.entries(),
      )
        .map(([wId, wData]) => ({
          waiterId: wId,
          waiterName: wData.waiterName,
          quantity: wData.qty,
          revenue: wData.rev,
          sharePct:
            entry.totalQty > 0
              ? Math.round((wData.qty / entry.totalQty) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

      return {
        productId: entry.productId,
        productName: entry.productName,
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        categoryIcon: entry.categoryIcon,
        totalQty: entry.totalQty,
        totalRevenue: entry.totalRevenue,
        avgPrice:
          entry.totalQty > 0
            ? Math.round(entry.totalRevenue / entry.totalQty)
            : 0,
        topWaiter: waitersList[0],
        waiters: waitersList,
      };
    },
  );

  return sortProducts(result, sortBy);
}

/**
 * Agrupa los ítems por mesero y calcula qué productos vendió más.
 */
export function aggregateByWaiter(
  items: DetailedSaleItem[],
  sortBy: "quantity" | "revenue" | "name" = "quantity",
): WaiterSalesSummary[] {
  const waiterMap = new Map<
    string,
    {
      waiterId: string;
      waiterName: string;
      totalQty: number;
      totalRevenue: number;
      ordersSet: Set<string>;
      productsMap: Map<
        string,
        {
          productName: string;
          categoryName: string;
          qty: number;
          rev: number;
        }
      >;
      categoriesMap: Map<string, { categoryName: string; qty: number; rev: number }>;
    }
  >();

  items.forEach((item) => {
    const key = item.waiterId || item.waiterName;
    let entry = waiterMap.get(key);

    if (!entry) {
      entry = {
        waiterId: item.waiterId,
        waiterName: item.waiterName,
        totalQty: 0,
        totalRevenue: 0,
        ordersSet: new Set(),
        productsMap: new Map(),
        categoriesMap: new Map(),
      };
      waiterMap.set(key, entry);
    }

    entry.totalQty += item.quantity;
    entry.totalRevenue += item.totalPrice;
    if (item.orderId) {
      entry.ordersSet.add(item.orderId);
    }

    // Productos del mesero
    const prodKey = item.productId || item.productName;
    const prodEntry = entry.productsMap.get(prodKey) || {
      productName: item.productName,
      categoryName: item.categoryName,
      qty: 0,
      rev: 0,
    };
    prodEntry.qty += item.quantity;
    prodEntry.rev += item.totalPrice;
    entry.productsMap.set(prodKey, prodEntry);

    // Categorías del mesero
    const catKey = item.categoryId || item.categoryName;
    const catEntry = entry.categoriesMap.get(catKey) || {
      categoryName: item.categoryName,
      qty: 0,
      rev: 0,
    };
    catEntry.qty += item.quantity;
    catEntry.rev += item.totalPrice;
    entry.categoriesMap.set(catKey, catEntry);
  });

  const result: WaiterSalesSummary[] = Array.from(waiterMap.values()).map(
    (entry) => {
      const productsList: WaiterProductItem[] = Array.from(
        entry.productsMap.entries(),
      )
        .map(([pId, pData]) => ({
          productId: pId,
          productName: pData.productName,
          categoryName: pData.categoryName,
          quantity: pData.qty,
          revenue: pData.rev,
          sharePct:
            entry.totalQty > 0
              ? Math.round((pData.qty / entry.totalQty) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

      const categoriesList: WaiterCategoryContribution[] = Array.from(
        entry.categoriesMap.entries(),
      )
        .map(([cId, cData]) => ({
          categoryId: cId,
          categoryName: cData.categoryName,
          quantity: cData.qty,
          revenue: cData.rev,
        }))
        .sort((a, b) => b.quantity - a.quantity);

      return {
        waiterId: entry.waiterId,
        waiterName: entry.waiterName,
        totalQty: entry.totalQty,
        totalRevenue: entry.totalRevenue,
        orderCount: entry.ordersSet.size,
        topProduct: productsList[0],
        topCategory: categoriesList[0],
        products: productsList,
        categories: categoriesList,
      };
    },
  );

  return sortWaiters(result, sortBy);
}

/**
 * Agrupa los ítems por categoría y calcula sus productos y meseros líderes.
 */
export function aggregateByCategory(
  items: DetailedSaleItem[],
  sortBy: "quantity" | "revenue" | "name" = "quantity",
): CategorySalesSummary[] {
  const categoryMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      totalQty: number;
      totalRevenue: number;
      productsMap: Map<string, { productName: string; qty: number; rev: number }>;
      waitersMap: Map<string, { waiterName: string; qty: number; rev: number }>;
    }
  >();

  items.forEach((item) => {
    const key = item.categoryId || item.categoryName;
    let entry = categoryMap.get(key);

    if (!entry) {
      entry = {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categoryIcon:
          item.categoryIcon ||
          getCategoryEmoji({
            categories: { name: item.categoryName, label: item.categoryName },
            name: item.productName,
          }),
        totalQty: 0,
        totalRevenue: 0,
        productsMap: new Map(),
        waitersMap: new Map(),
      };
      categoryMap.set(key, entry);
    }

    entry.totalQty += item.quantity;
    entry.totalRevenue += item.totalPrice;

    // Productos de la categoría
    const prodKey = item.productId || item.productName;
    const prodEntry = entry.productsMap.get(prodKey) || {
      productName: item.productName,
      qty: 0,
      rev: 0,
    };
    prodEntry.qty += item.quantity;
    prodEntry.rev += item.totalPrice;
    entry.productsMap.set(prodKey, prodEntry);

    // Meseros de la categoría
    const waiterKey = item.waiterId || item.waiterName;
    const waiterEntry = entry.waitersMap.get(waiterKey) || {
      waiterName: item.waiterName,
      qty: 0,
      rev: 0,
    };
    waiterEntry.qty += item.quantity;
    waiterEntry.rev += item.totalPrice;
    entry.waitersMap.set(waiterKey, waiterEntry);
  });

  const result: CategorySalesSummary[] = Array.from(categoryMap.values()).map(
    (entry) => {
      const productsList = Array.from(entry.productsMap.entries())
        .map(([pId, pData]) => ({
          productId: pId,
          productName: pData.productName,
          quantity: pData.qty,
          revenue: pData.rev,
        }))
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

      const waitersList = Array.from(entry.waitersMap.entries())
        .map(([wId, wData]) => ({
          waiterId: wId,
          waiterName: wData.waiterName,
          quantity: wData.qty,
          revenue: wData.rev,
          sharePct:
            entry.totalQty > 0
              ? Math.round((wData.qty / entry.totalQty) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

      return {
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        categoryIcon: entry.categoryIcon,
        totalQty: entry.totalQty,
        totalRevenue: entry.totalRevenue,
        productsCount: entry.productsMap.size,
        topProduct: productsList[0],
        topWaiter: waitersList[0],
        products: productsList,
        waiters: waitersList,
      };
    },
  );

  return sortCategories(result, sortBy);
}

function sortProducts(
  list: ProductSalesSummary[],
  sortBy: "quantity" | "revenue" | "name",
): ProductSalesSummary[] {
  return [...list].sort((a, b) => {
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "name") return a.productName.localeCompare(b.productName);
    return b.totalQty - a.totalQty;
  });
}

function sortWaiters(
  list: WaiterSalesSummary[],
  sortBy: "quantity" | "revenue" | "name",
): WaiterSalesSummary[] {
  return [...list].sort((a, b) => {
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "name") return a.waiterName.localeCompare(b.waiterName);
    return b.totalQty - a.totalQty;
  });
}

function sortCategories(
  list: CategorySalesSummary[],
  sortBy: "quantity" | "revenue" | "name",
): CategorySalesSummary[] {
  return [...list].sort((a, b) => {
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "name") return a.categoryName.localeCompare(b.categoryName);
    return b.totalQty - a.totalQty;
  });
}
