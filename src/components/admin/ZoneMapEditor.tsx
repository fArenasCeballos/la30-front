import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Polygon,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { formatPrice } from "@/lib/formatPrice";
import type { DeliveryZone, LatLngPoint } from "@/types";

// Pereira / Dosquebradas / Cerritos center coordinates
const MAP_CENTER: L.LatLngExpression = [4.8087, -75.6906];
const MAP_ZOOM = 13;

// Default zone colors palette
const ZONE_COLORS = [
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#10B981",
  "#EF4444",
  "#3B82F6",
  "#F59E0B",
  "#6366F1",
  "#14B8A6",
];

interface ZoneMapEditorProps {
  zones: DeliveryZone[];
  editingZone: DeliveryZone | null;
  onPolygonCreated: (polygon: LatLngPoint[][]) => void;
  onZoneClick: (zone: DeliveryZone) => void;
  draftPolygon?: LatLngPoint[][];
  draftColor?: string;
}

export function ZoneMapEditor({
  zones,
  editingZone,
  onPolygonCreated,
  onZoneClick,
  draftPolygon,
  draftColor,
}: ZoneMapEditorProps) {
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleCreated = useCallback(
    (e: L.LeafletEvent) => {
      const drawEvent = e as L.DrawEvents.Created;
      const layer = drawEvent.layer;
      let polygon: LatLngPoint[][] = [];

      if (drawEvent.layerType === "polygon") {
        const latLngs = (layer as L.Polygon).getLatLngs() as L.LatLng[][];
        polygon = latLngs.map((ring) =>
          (Array.isArray(ring) ? ring : [ring]).map((point: L.LatLng) => ({
            lat: point.lat,
            lng: point.lng,
          })),
        );
      }

      onPolygonCreated(polygon);

      // Remove the drawn layer so we render it as a React component
      if (featureGroupRef.current) {
        featureGroupRef.current.removeLayer(layer);
      }
      setIsDrawing(false);
    },
    [onPolygonCreated],
  );

  // Setup draw control imperatively
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous draw control
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    const fg = featureGroupRef.current;
    if (!fg) return;

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: true,
          showArea: true,
          shapeOptions: {
            color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
            weight: 2,
            fillOpacity: 0.3,
          },
        },
        circle: false,
        rectangle: false,
        polyline: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: fg,
        remove: false,
        edit: false,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.DRAWSTART, () => setIsDrawing(true));
    map.on(L.Draw.Event.DRAWSTOP, () => setIsDrawing(false));

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.DRAWSTART);
      map.off(L.Draw.Event.DRAWSTOP);
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
    };
  }, [handleCreated, zones.length]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-accent/20">
      {isDrawing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-1000 bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl animate-pulse">
          Dibujando zona — Haz clic en el mapa para trazar el polígono
        </div>
      )}

      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        className="h-full w-full"
        ref={mapRef}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup ref={featureGroupRef}>
          {/* This FeatureGroup is used by leaflet-draw for new drawings */}
        </FeatureGroup>

        {/* Render existing zones as polygons */}
        {zones.map((zone) => {
          const isEditing = editingZone?.id === zone.id;
          
          // If we are editing this zone, we will render it using the draft polygon/color below
          if (isEditing) return null;

          const positions: L.LatLngExpression[][] = zone.polygon.map((ring) =>
            ring.map((point): L.LatLngExpression => [point.lat, point.lng]),
          );

          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.2,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onZoneClick(zone),
              }}
            >
              <Tooltip
                direction="center"
                permanent
                className="bg-transparent! border-none! shadow-none! p-0!"
              >
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-md border text-center">
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

        {/* Render the draft/editing polygon */}
        {draftPolygon && draftPolygon.length > 0 && (
          <Polygon
            positions={draftPolygon.map((ring) =>
              ring.map((point): L.LatLngExpression => [point.lat, point.lng]),
            )}
            pathOptions={{
              color: draftColor || "#000",
              fillColor: draftColor || "#000",
              fillOpacity: 0.45,
              weight: 3,
              dashArray: "5 5",
            }}
          >
            <Tooltip
              direction="center"
              permanent
              className="bg-transparent! border-none! shadow-none! p-0!"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-md border text-center border-purple-400 shadow-purple-500/20">
                <p className="text-[10px] font-black text-purple-700 leading-tight">
                  ZONA EN EDICIÓN
                </p>
              </div>
            </Tooltip>
          </Polygon>
        )}
      </MapContainer>
    </div>
  );
}

export { ZONE_COLORS };
