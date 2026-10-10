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
 * Two modes: "box" (draggable/resizable rectangle) and "draw" (tap to place
 * polygon vertices). Reports back a bounding box and/or polygon points.
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
  const boxRect = useRef<L.Rectangle | null>(null);
  const cornerMarkers = useRef<L.Marker[]>([]);
  const polyObj = useRef<L.Polygon | null>(null);
  const polyMarkers = useRef<L.Marker[]>([]);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const [mode, setMode] = useState<"box" | "draw">(
    initialPolygon && initialPolygon.length >= 3 ? "draw" : "box"
  );
  const [box, setBox] = useState<ZoneBox>(initialBox);
  const [polygon, setPolygon] = useState<ZonePoint[]>(initialPolygon ?? []);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const boxRef = useRef(box);
  boxRef.current = box;
  const polyRef = useRef(polygon);
  polyRef.current = polygon;

  const emit = (b: ZoneBox, p: ZonePoint[] | null) => changeRef.current(b, p);

  // Rebuild the box overlay (rectangle + 4 draggable corners).
  const renderBox = (map: L.Map, b: ZoneBox) => {
    boxRect.current?.remove();
    cornerMarkers.current.forEach((m) => m.remove());
    cornerMarkers.current = [];
    const bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
    boxRect.current = L.rectangle(bounds, {
      color: "#e4572e",
      weight: 2,
      fillColor: "#e4572e",
      fillOpacity: 0.12,
    }).addTo(map);
    const corners: [number, number][] = [
      [b.north, b.west],
      [b.north, b.east],
      [b.south, b.east],
      [b.south, b.west],
    ];
    corners.forEach(([la, ln], i) => {
      const m = L.marker([la, ln], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#e4572e;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        const nb = { ...boxRef.current };
        if (i === 0) { nb.north = p.lat; nb.west = p.lng; }
        if (i === 1) { nb.north = p.lat; nb.east = p.lng; }
        if (i === 2) { nb.south = p.lat; nb.east = p.lng; }
        if (i === 3) { nb.south = p.lat; nb.west = p.lng; }
        // Keep the box valid.
        if (nb.north <= nb.south || nb.east <= nb.west) return;
        setBox(nb);
        emit(nb, null);
        renderBox(map, nb);
      });
      cornerMarkers.current.push(m);
    });
  };

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
        emit(boxRef.current, next.length >= 3 ? next : null);
        renderPolygon(map, next);
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
      if (modeRef.current !== "draw") return;
      const next = [...polyRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }];
      setPolygon(next);
      emit(boxRef.current, next.length >= 3 ? next : null);
      renderPolygon(map, next);
    });

    if (modeRef.current === "box") renderBox(map, boxRef.current);
    else renderPolygon(map, polyRef.current);

    mapObj.current = map;
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to a picked lake when it changes.
  const lastFocusKey = useRef<string | null>(null);
  useEffect(() => {
    if (!mapObj.current || !focusLake) return;
    if (lastFocusKey.current === focusLake.key) return;
    lastFocusKey.current = focusLake.key;
    mapObj.current.flyTo([focusLake.lat, focusLake.lng], 10, { duration: 1 });
  }, [focusLake]);

  // Switch modes: clear the other overlay.
  const switchMode = (m: "box" | "draw") => {
    setMode(m);
    const map = mapObj.current;
    if (!map) return;
    if (m === "box") {
      polyObj.current?.remove();
      polyMarkers.current.forEach((mk) => mk.remove());
      polyMarkers.current = [];
      setPolygon([]);
      renderBox(map, boxRef.current);
      emit(boxRef.current, null);
    } else {
      boxRect.current?.remove();
      cornerMarkers.current.forEach((mk) => mk.remove());
      cornerMarkers.current = [];
      renderPolygon(map, polyRef.current);
    }
  };

  const undoPoint = () => {
    const map = mapObj.current;
    if (!map) return;
    const next = polyRef.current.slice(0, -1);
    setPolygon(next);
    emit(boxRef.current, next.length >= 3 ? next : null);
    renderPolygon(map, next);
  };

  const clearPolygon = () => {
    const map = mapObj.current;
    if (!map) return;
    setPolygon([]);
    emit(boxRef.current, null);
    renderPolygon(map, []);
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => switchMode("box")}
          className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "box" ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine/70"
          }`}
        >
          ⬛ Box zone
        </button>
        <button
          type="button"
          onClick={() => switchMode("draw")}
          className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "draw" ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine/70"
          }`}
        >
          ✏️ Draw zone
        </button>
      </div>
      <div ref={mapRef} className="w-full h-64 rounded-2xl border border-pine/15 z-0" />
      <p className="text-[11px] text-pine/50 mt-1.5">
        {mode === "box"
          ? "Drag the orange dots to resize the zone."
          : "Tap the map to place points around your zone. Drag points to adjust."}
      </p>
      {mode === "draw" && polygon.length > 0 && (
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
  );
}
