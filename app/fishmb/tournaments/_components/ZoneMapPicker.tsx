"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface ZoneBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ZonePoint {
  lat: number;
  lng: number;
}

/**
 * Small map for drawing a tournament fishing zone.
 * Tap to place polygon vertices around the zone; drag points to adjust.
 * Can expand to a fullscreen map with a back button.
 * Reports back a bounding box and polygon points.
 */
export default function ZoneMapPicker({
  initialBox,
  initialPolygon,
  focusLake,
  onChange,
}: {
  initialBox: ZoneBox;
  initialPolygon: ZonePoint[] | null;
  focusLake: { lat: number; lng: number; key: string } | null;
  onChange: (box: ZoneBox, polygon: ZonePoint[] | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const polyObj = useRef<L.Polygon | null>(null);
  const polyMarkers = useRef<L.Marker[]>([]);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const [expanded, setExpanded] = useState(false);
  const [polygon, setPolygon] = useState<ZonePoint[]>(initialPolygon ?? []);
  const boxRef = useRef(initialBox);
  const polyRef = useRef(polygon);
  polyRef.current = polygon;

  const emit = (p: ZonePoint[] | null) => changeRef.current(boxRef.current, p);

  // Rebuild the polygon overlay.
  const renderPolygon = (map: L.Map, pts: ZonePoint[]) => {
    polyObj.current?.remove();
    polyMarkers.current.forEach((m) => m.remove());
    polyMarkers.current = [];
    if (pts.length === 0) return;
    const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
    polyObj.current = L.polygon(latlngs, {
      color: "#e4572e",
      weight: 2,
      fillColor: "#e4572e",
      fillOpacity: 0.15,
    }).addTo(map);
    pts.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#12322b;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);
      m.on("dragend", () => {
        const np = m.getLatLng();
        const next = [...polyRef.current];
        next[i] = { lat: np.lat, lng: np.lng };
        setPolygon(next);
        emit(next.length >= 3 ? next : null);
        const mm = mapObj.current;
        if (mm) renderPolygon(mm, next);
      });
      polyMarkers.current.push(m);
    });
  };

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      [(initialBox.north + initialBox.south) / 2, (initialBox.west + initialBox.east) / 2],
      5
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const next = [...polyRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }];
      setPolygon(next);
      emit(next.length >= 3 ? next : null);
      const mm = mapObj.current;
      if (mm) renderPolygon(mm, next);
    });

    renderPolygon(map, polyRef.current);

    mapObj.current = map;
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the map when expanding/collapsing (container size changes).
  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    setTimeout(() => {
      map.invalidateSize();
      renderPolygon(map, polyRef.current);
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Fly to a picked lake when it changes.
  const lastFocusKey = useRef<string | null>(null);
  useEffect(() => {
    if (!mapObj.current || !focusLake) return;
    if (lastFocusKey.current === focusLake.key) return;
    lastFocusKey.current = focusLake.key;
    mapObj.current.flyTo([focusLake.lat, focusLake.lng], 10, { duration: 1 });
  }, [focusLake]);

  const undoPoint = () => {
    const map = mapObj.current;
    if (!map) return;
    const next = polyRef.current.slice(0, -1);
    setPolygon(next);
    emit(next.length >= 3 ? next : null);
    renderPolygon(map, next);
  };

  const clearPolygon = () => {
    const map = mapObj.current;
    if (!map) return;
    setPolygon([]);
    emit(null);
    renderPolygon(map, []);
  };

  const mapUi = (
    <>
      <div
        ref={mapRef}
        className={expanded ? "w-full h-full" : "w-full h-64 rounded-2xl border border-pine/15"}
        style={expanded ? undefined : { zIndex: 0 }}
      />
      {expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="absolute top-4 left-4 z-[1000] bg-pine text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2"
        >
          ← Back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute top-2 right-2 z-[1000] bg-white/95 text-pine text-xs font-bold px-3 py-2 rounded-full shadow border border-pine/15"
        >
          ⤢ Expand
        </button>
      )}
    </>
  );

  return (
    <div>
      {expanded ? (
        <div className="fixed inset-0 z-[2000] bg-pine-deep/60 flex flex-col">
          <div className="relative flex-1 m-3 rounded-3xl overflow-hidden">
            {mapUi}
          </div>
          <div className="px-4 pb-6 pt-1">
            <p className="text-white/80 text-xs text-center mb-2">
              Tap the map to place points around your zone. Drag points to adjust.
            </p>
            {polygon.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoPoint}
                  className="flex-1 py-2.5 rounded-full text-xs font-bold bg-white text-pine"
                >
                  ↩ Undo point
                </button>
                <button
                  type="button"
                  onClick={clearPolygon}
                  className="flex-1 py-2.5 rounded-full text-xs font-bold bg-white text-pine"
                >
                  🗑 Clear
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          {mapUi}
          <p className="text-[11px] text-pine/50 mt-1.5">
            Tap the map to place points around your zone. Drag points to adjust.
          </p>
          {polygon.length > 0 && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={undoPoint}
                className="flex-1 py-2 rounded-full text-xs font-bold bg-white border border-pine/20 text-pine/70"
              >
                ↩ Undo point
              </button>
              <button
                type="button"
                onClick={clearPolygon}
                className="flex-1 py-2 rounded-full text-xs font-bold bg-white border border-pine/20 text-pine/70"
              >
                🗑 Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
