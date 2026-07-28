import { useState } from "react";
import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { DeliveryZone, LatLngPoint } from "@/types";

interface DeliveryZoneComboboxProps {
  onSelect: (zone: DeliveryZone | null) => void;
  selectedZoneId?: string;
}

interface DeliveryZoneRow {
  id: string;
  name: string;
  price: number;
  polygon: LatLngPoint[][];
  color: string;
  is_active: boolean;
  created_at: string;
}

export function DeliveryZoneCombobox({
  onSelect,
  selectedZoneId,
}: DeliveryZoneComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data: zones = [] } = useQuery<DeliveryZone[]>({
    queryKey: ["delivery-zones-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (data as unknown as DeliveryZoneRow[]).map(
        (row): DeliveryZone => ({
          id: row.id,
          name: row.name,
          price: Number(row.price),
          polygon: row.polygon,
          color: row.color,
          is_active: row.is_active,
          created_at: row.created_at,
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  const handleSelect = (zoneId: string) => {
    if (zoneId === selectedZoneId) {
      onSelect(null);
    } else {
      const zone = zones.find((z) => z.id === zoneId);
      if (zone) onSelect(zone);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border-2 bg-background px-3 py-2 text-sm font-bold transition-all",
            "hover:border-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2",
            selectedZone
              ? "border-purple-400 text-foreground"
              : "border-input text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPin
              className={cn(
                "h-4 w-4 shrink-0",
                selectedZone ? "text-purple-500" : "text-muted-foreground/40",
              )}
            />
            {selectedZone ? (
              <span className="truncate">
                {selectedZone.name} •{" "}
                <span className="font-black text-purple-600">
                  {formatPrice(selectedZone.price)}
                </span>
              </span>
            ) : (
              <span>Seleccionar zona de envío...</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedZone && (
              <span
                role="button"
                tabIndex={0}
                className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleClear(e as unknown as React.MouseEvent);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0 rounded-xl border-2 shadow-xl">
        <Command>
          <CommandInput placeholder="Buscar zona, barrio o lugar..." />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs font-bold text-muted-foreground/60">
              No se encontraron zonas
            </CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone.id}
                  value={zone.name}
                  onSelect={() => handleSelect(zone.id)}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0 border"
                    style={{ backgroundColor: zone.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{zone.name}</p>
                  </div>
                  <span className="font-black text-xs text-purple-600 shrink-0">
                    {formatPrice(zone.price)}
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedZoneId === zone.id
                        ? "opacity-100 text-purple-600"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
