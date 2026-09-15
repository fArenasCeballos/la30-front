import React from "react";
import { Package, ListChecks, Sparkles, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ProductsTab } from "@/components/inventory/ProductsTab";
import { CategoriesTab } from "@/components/inventory/CategoriesTab";
import { ExtrasTab } from "@/components/inventory/ExtrasTab";
import { OptionsTab } from "@/components/inventory/OptionsTab";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const INVENTORY_TABS = [
  {
    value: "products",
    label: "Productos & Platos",
    shortLabel: "Productos",
    icon: Package,
    description: "Catálogo y precios",
  },
  {
    value: "categories",
    label: "Categorías",
    shortLabel: "Categorías",
    icon: LayoutGrid,
    description: "Estructura del menú",
  },
  {
    value: "extras",
    label: "Ingredientes & Extras",
    shortLabel: "Extras",
    icon: Sparkles,
    description: "Adicionales y cobros",
  },
  {
    value: "options",
    label: "Variaciones & Opciones",
    shortLabel: "Variaciones",
    icon: ListChecks,
    description: "Términos, salsas y tipos",
  },
] as const;

export default function Inventario() {
  const [activeTab, setActiveTab] = React.useState<string>("products");

  return (
    <ErrorBoundary>
      <div className="min-h-full">
        {/* Sleek Segmented Sub-Navbar */}
        <div className="sticky top-14 sm:top-[61px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-2.5 transition-all">
          <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="bg-slate-100/90 p-1 rounded-xl h-auto flex overflow-x-auto no-scrollbar gap-1.5 justify-start w-full sm:w-auto">
                {INVENTORY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.value;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-3.5 py-2 font-semibold text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs text-slate-600 hover:text-slate-900 flex items-center gap-2 shrink-0 select-none"
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isActive ? "text-teal-600" : "text-slate-400"
                        }`}
                      />
                      <span className="hidden md:inline">{tab.label}</span>
                      <span className="md:hidden">{tab.shortLabel}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-6">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="products" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "products" && <ProductsTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="categories" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "categories" && <CategoriesTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="extras" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "extras" && <ExtrasTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="options" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "options" && <OptionsTab />}
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}
