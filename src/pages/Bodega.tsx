import React from "react";
import {
  PackagePlus,
  ListChecks,
  History,
  Scale,
  Building2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RawMaterialsTab } from "@/components/bodega/RawMaterialsTab";
import { EntriesTab } from "@/components/bodega/EntriesTab";
import { RecipesTab } from "@/components/bodega/RecipesTab";
import { MovementsTab } from "@/components/bodega/MovementsTab";
import { SuppliersTab } from "@/components/bodega/SuppliersTab";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const BODEGA_TABS = [
  {
    value: "raw_materials",
    label: "Materia Prima & Insumos",
    shortLabel: "Insumos",
    icon: Scale,
    description: "Control de stock e insumos base",
  },
  {
    value: "entries",
    label: "Compras & Entradas",
    shortLabel: "Compras",
    icon: PackagePlus,
    description: "Registro de facturas y compras",
  },
  {
    value: "recipes",
    label: "Ficha Técnica & Recetas",
    shortLabel: "Recetas",
    icon: ListChecks,
    description: "Ingredientes por plato y porciones",
  },
  {
    value: "movements",
    label: "Kardex & Movimientos",
    shortLabel: "Kardex",
    icon: History,
    description: "Auditoría de entradas y salidas",
  },
  {
    value: "suppliers",
    label: "Proveedores",
    shortLabel: "Proveedores",
    icon: Building2,
    description: "Directorio de proveedores y NITs",
  },
] as const;

export default function Bodega() {
  const [activeTab, setActiveTab] = React.useState<string>("raw_materials");

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
                {BODEGA_TABS.map((tab) => {
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
            <TabsContent value="raw_materials" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "raw_materials" && <RawMaterialsTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="entries" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "entries" && <EntriesTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="recipes" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "recipes" && <RecipesTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="movements" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "movements" && <MovementsTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="suppliers" className="m-0 outline-none">
              <ErrorBoundary>
                {activeTab === "suppliers" && <SuppliersTab />}
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}
