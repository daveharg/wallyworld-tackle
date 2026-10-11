"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Small catch-location map. Tapping it opens the main map zoomed to the spot. */
export default function CatchLocationMap({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([lat, lng], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;border-radius:50%;background:#e4572e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([lat, lng], { icon, interactive: false }).addTo(map);
    mapObj.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href={`/fishmb/maps?lat=${lat}&lng=${lng}&zoom=13`}
      className="block rounded-3xl overflow-hidden border border-pine/10 relative"
      aria-label="Open in full map"
    >
      <div ref={mapRef} className="w-full h-48 pointer-events-none" />
      <span className="absolute bottom-2 right-2 bg-pine/85 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
        Open in map →
      </span>
    </Link>
  );
}
