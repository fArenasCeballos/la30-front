import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStore } from "@/context/StoreContext";
import { Badge } from "@/components/ui/badge";

interface StoreMultiSelectProps {
  selectedStoreIds: string[];
  onChange: (ids: string[]) => void;
}

export function StoreMultiSelect({ selectedStoreIds, onChange }: StoreMultiSelectProps) {
  const { stores } = useStore();

  const toggleStore = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onChange(selectedStoreIds.filter((id) => id !== storeId));
    } else {
      onChange([...selectedStoreIds, storeId]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Visibilidad en Tiendas</Label>
        <Badge variant="outline" className="text-[10px]">
          {selectedStoreIds.length} seleccionadas
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 border rounded-lg p-3 bg-muted/20">
        {stores.map((store) => (
          <div key={store.id} className="flex items-center space-x-2">
            <Checkbox
              id={`store-${store.id}`}
              checked={selectedStoreIds.includes(store.id)}
              onCheckedChange={() => toggleStore(store.id)}
            />
            <Label
              htmlFor={`store-${store.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {store.name}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        Selecciona las tiendas donde este elemento será visible.
      </p>
    </div>
  );
}
