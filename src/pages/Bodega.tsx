import React from "react";
import { Boxes, PackagePlus, ListChecks, History, Scale, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RawMaterialsTab } from "@/components/bodega/RawMaterialsTab";
import { EntriesTab } from "@/components/bodega/EntriesTab";
import { RecipesTab } from "@/components/bodega/RecipesTab";
import { MovementsTab } from "@/components/bodega/MovementsTab";
import { SuppliersTab } from "@/components/bodega/SuppliersTab";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Bodega() {
  const [activeTab, setActiveTab] = React.useState("raw_materials");

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50/50">
        <div className="sticky top-14 lg:top-16 2xl:top-20 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-2 shadow-sm">
          <div className="max-w-[1800px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                <Boxes className="h-5 w-5" strokeWidth={3} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-black tracking-tight text-foreground leading-none">
                  Bodega
                </h1>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                  Gestión de Insumos
                </p>
              </div>
            </div>

            <Tabs
              defaultValue="raw_materials"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-slate-100/50 p-1 rounded-xl h-11 flex overflow-x-auto no-scrollbar justify-start">
                {[
                  { value: "raw_materials", label: "Materia Prima", icon: Scale },
                  { value: "suppliers", label: "Proveedores", icon: Building2 },
                  { value: "entries", label: "Compras", icon: PackagePlus },
                  { value: "recipes", label: "Recetas", icon: ListChecks },
                  { value: "movements", label: "Movimientos", icon: History },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg px-4 py-1.5 font-bold text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm flex items-center gap-2 group/tab shrink-0"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          <Tabs value={activeTab} className="w-full">
            <div className="animate-in fade-in duration-500">
              <TabsContent value="raw_materials" className="m-0 outline-none">
                <ErrorBoundary>{activeTab === "raw_materials" && <RawMaterialsTab />}</ErrorBoundary>
              </TabsContent>
              <TabsContent value="entries" className="m-0 outline-none">
                <ErrorBoundary>{activeTab === "entries" && <EntriesTab />}</ErrorBoundary>
              </TabsContent>
              <TabsContent value="suppliers" className="m-0 outline-none">
                <ErrorBoundary>{activeTab === "suppliers" && <SuppliersTab />}</ErrorBoundary>
              </TabsContent>
              <TabsContent value="recipes" className="m-0 outline-none">
                <ErrorBoundary>{activeTab === "recipes" && <RecipesTab />}</ErrorBoundary>
              </TabsContent>
              <TabsContent value="movements" className="m-0 outline-none">
                <ErrorBoundary>{activeTab === "movements" && <MovementsTab />}</ErrorBoundary>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}
