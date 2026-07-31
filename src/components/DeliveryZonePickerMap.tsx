import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatPrice } from "@/lib/formatPrice";
import type { DeliveryZone, LatLngPoint } from "@/types";
import { Map, MapPin } from "lucide-react";

const MAP_CENTER: L.LatLngExpression = [4.8087, -75.6906];
const MAP_ZOOM = 13;

interface DeliveryZonePickerMapProps {
  zones: DeliveryZone[];
  onSelectZone: (zone: DeliveryZone) => void;
  selectedZoneId?: string;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Forces Leaflet to recalculate tile positions after the modal renders
function MapResizeWatcher() {
  const map = useMapEvents({});
  map.invalidateSize();
  return null;
}

export function DeliveryZonePickerMap({
  zones,
  onSelectZone,
  selectedZoneId,
}: DeliveryZonePickerMapProps) {
  const [open, setOpen] = useState(false);
  const [outsideZone, setOutsideZone] = useState(false);

  const isPointInPolygon = (
    point: L.LatLng,
    polygon: LatLngPoint[],
  ): boolean => {
    const x = point.lng;
    const y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleMapClick = (latlng: L.LatLng) => {
    setOutsideZone(false);
    for (const zone of zones) {
      for (const ring of zone.polygon) {
        if (isPointInPolygon(latlng, ring)) {
          onSelectZone(zone);
          setOpen(false);
          return;
        }
      }
    }
    setOutsideZone(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-10 border-2 font-bold text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border-purple-200 rounded-2xl"
        >
          <Map className="w-4 h-4 mr-2" />
          Escoger en el mapa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-180 p-0 gap-0 overflow-hidden rounded-2xl border-2 shadow-2xl">
        <DialogHeader className="px-5 py-4 border-b-2 bg-white">
          <DialogTitle className="font-black text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            Toca dentro de una zona para seleccionarla
          </DialogTitle>
        </DialogHeader>

        {outsideZone && (
          <div className="px-5 py-2 bg-red-50 border-b-2 border-red-200 text-xs font-bold text-red-600">
            ⚠️ Esta ubicación no está en ninguna zona configurada. Intenta
            dentro de las áreas coloreadas.
          </div>
        )}

        <div style={{ height: "60vh", minHeight: 380, width: "100%" }}>
          {/* Only mount MapContainer when dialog is open to avoid tile layout bugs */}
          {open && (
            <MapContainer
              key="delivery-picker-map"
              center={MAP_CENTER}
              zoom={MAP_ZOOM}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapResizeWatcher />
              <MapClickHandler onMapClick={handleMapClick} />

              {zones.map((zone) => {
                const positions: L.LatLngExpression[][] = zone.polygon.map(
                  (ring) =>
                    ring.map(
                      (point): L.LatLngExpression => [point.lat, point.lng],
                    ),
                );
                const isSelected = selectedZoneId === zone.id;
                return (
                  <Polygon
                    key={zone.id}
                    positions={positions}
                    pathOptions={{
                      color: zone.color,
                      fillColor: zone.color,
                      fillOpacity: isSelected ? 0.55 : 0.25,
                      weight: isSelected ? 4 : 2,
                    }}
                  >
                    <Tooltip
                      direction="center"
                      permanent
                      className="bg-transparent! border-none! shadow-none! p-0!"
                    >
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-md border text-center pointer-events-none">
                        <p className="text-[10px] font-black text-gray-800 leading-tight">
                          {zone.name}
                        </p>
                        <p
                          className="text-[9px] font-black leading-tight"
                          style={{ color: zone.color }}
                        >
                          {formatPrice(zone.price)}
                        </p>
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </MapContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
