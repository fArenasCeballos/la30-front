import React from "react";
import { Package, ListChecks, Sparkles, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ProductsTab } from "@/components/inventory/ProductsTab";
import { CategoriesTab } from "@/components/inventory/CategoriesTab";
import { ExtrasTab } from "@/components/inventory/ExtrasTab";
import { OptionsTab } from "@/components/inventory/OptionsTab";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Inventario() {
  const [activeTab, setActiveTab] = React.useState("products");

  return (
    <ErrorBoundary>
      <div className="section-container min-h-[calc(100vh-6rem)] pb-32 animate-in fade-in duration-700">
        {/* Premium Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12 mb-8 lg:mb-20 bg-white/40 backdrop-blur-xl p-6 lg:p-12 rounded-4xl lg:rounded-[3.5rem] border border-white shadow-strong relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />

          <div className="relative space-y-4">
            <div className="flex items-center gap-3 text-primary/60 font-black uppercase tracking-[0.4em] text-[10px]">
              <div className="h-[2px] w-12 bg-primary/30 rounded-full" />
              ADMINISTRACIÓN DE CATÁLOGO
            </div>
            <h1 className="text-4xl lg:text-6xl font-black tracking-tighter flex items-center gap-4 lg:gap-6 text-foreground">
              <div className="bg-primary/10 p-3 lg:p-4 rounded-2xl lg:rounded-3xl group-hover:rotate-6 transition-transform duration-500">
                <Package
                  className="h-8 w-8 lg:h-14 lg:w-14 text-primary"
                  strokeWidth={2.5}
                />
              </div>
              Inventarios
            </h1>
            <p className="text-muted-foreground font-medium text-lg lg:text-xl max-w-lg leading-relaxed">
              Control absoluto sobre{" "}
              <span className="text-primary font-black underline decoration-primary/20 underline-offset-4">
                productos
              </span>
              , categorías y personalizaciones de tu tienda.
            </p>
          </div>
        </div>

        <Tabs
          defaultValue="products"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-8 lg:space-y-16"
        >
          <div className="sticky top-20 lg:top-24 z-40 bg-white/40 backdrop-blur-3xl -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 lg:py-8 border-y-2 border-white shadow-strong rounded-4xl lg:rounded-[2.5rem]">
            <TabsList className="bg-accent/10 p-2 lg:p-3 rounded-2xl lg:rounded-[2.5rem] border-2 border-white shadow-inner flex overflow-x-auto no-scrollbar justify-start lg:justify-center lg:w-max mx-auto h-auto min-w-full lg:min-w-0">
              {[
                { value: "products", label: "Productos", icon: Package },
                { value: "categories", label: "Categorías", icon: LayoutGrid },
                { value: "extras", label: "Ingredientes", icon: Sparkles },
                { value: "options", label: "Variaciones", icon: ListChecks },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-xl lg:rounded-2xl px-6 lg:px-12 py-3 lg:py-5 font-black uppercase tracking-[0.2em] text-[9px] lg:text-[10px] transition-all duration-500 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-strong data-[state=active]:scale-105 flex items-center gap-2 lg:gap-4 group/tab shrink-0"
                >
                  <tab.icon className="h-4 w-4 lg:h-5 lg:w-5 transition-transform group-hover/tab:rotate-12" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both">
            <TabsContent
              value="products"
              className="m-0 border-none p-0 outline-none"
            >
              <ErrorBoundary>
                {activeTab === "products" && <ProductsTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent
              value="categories"
              className="m-0 border-none p-0 outline-none"
            >
              <ErrorBoundary>
                {activeTab === "categories" && <CategoriesTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent
              value="extras"
              className="m-0 border-none p-0 outline-none"
            >
              <ErrorBoundary>
                {activeTab === "extras" && <ExtrasTab />}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent
              value="options"
              className="m-0 border-none p-0 outline-none"
            >
              <ErrorBoundary>
                {activeTab === "options" && <OptionsTab />}
              </ErrorBoundary>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
