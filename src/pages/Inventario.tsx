import React from 'react';
import { Package, ListChecks, Sparkles, LayoutGrid } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ProductsTab } from '@/components/inventory/ProductsTab';
import { CategoriesTab } from '@/components/inventory/CategoriesTab';
import { ExtrasTab } from '@/components/inventory/ExtrasTab';
import { OptionsTab } from '@/components/inventory/OptionsTab';

export default function Inventario() {
  const [activeTab, setActiveTab] = React.useState('products');

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="font-display text-xl sm:text-2xl font-bold">Inventario</h1>
      </div>

      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-xl flex-nowrap min-w-max">
            <TabsTrigger value="products" className="flex-1 rounded-lg py-2.5 touch-target data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Package className="h-4 w-4 mr-2" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex-1 rounded-lg py-2.5 touch-target data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Categorías
            </TabsTrigger>
            <TabsTrigger value="extras" className="flex-1 rounded-lg py-2.5 touch-target data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Sparkles className="h-4 w-4 mr-2" />
              Extras
            </TabsTrigger>
            <TabsTrigger value="options" className="flex-1 rounded-lg py-2.5 touch-target data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <ListChecks className="h-4 w-4 mr-2" />
              Personalización
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'products' && <ProductsTab />}
        </TabsContent>
        
        <TabsContent value="categories" className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'categories' && <CategoriesTab />}
        </TabsContent>

        <TabsContent value="extras" className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'extras' && <ExtrasTab />}
        </TabsContent>

        <TabsContent value="options" className="mt-4 sm:mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'options' && <OptionsTab />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
