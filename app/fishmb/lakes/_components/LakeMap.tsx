"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface MapLake {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
}

/**
 * Manitoba lake map (Leaflet). Search results appear as pins; clicking a
 * pin opens the lake page. Leaflet is loaded dynamically so it never runs
 * during SSR.
 */
export function LakeMap({ lakes }: { lakes: MapLake[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      const m = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([53.5, -96.5], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 12,
      }).addTo(m);
      m.on("focus", () => m.scrollWheelZoom.enable());
      m.on("blur", () => m.scrollWheelZoom.disable());
      if (!cancelled) setMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render pins once the map exists, and re-render when results change.
  const layerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      layerRef.current?.remove();
      const layer = L.layerGroup();
      const bounds: [number, number][] = [];
      for (const lake of lakes.slice(0, 200)) {
        const marker = L.marker([lake.lat, lake.lng]).bindPopup(
          `<strong>${escapeHtml(lake.name)}</strong><br/>${escapeHtml(lake.region)}<br/><a href="/fishmb/lakes/${lake.id}">View lake →</a>`
        );
        marker.addTo(layer);
        bounds.push([lake.lat, lake.lng]);
      }
      layer.addTo(map);
      layerRef.current = layer;
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.15), { animate: true });
      }
    })();
  }, [lakes, map]);

  return (
    <div className="rounded-3xl overflow-hidden border border-pine/10 shadow-sm">
      <div ref={containerRef} className="h-[320px] md:h-[420px] w-full z-0" />
      <p className="text-xs text-pine/50 px-4 py-2.5 bg-white">
        Showing {Math.min(lakes.length, 200)} of {lakes.length} lakes on the map.{" "}
        {lakes.length === 0 && "Search above to find lakes."}
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Small "view on map" link used elsewhere. */
export function MapCta() {
  return (
    <Link href="/fishmb/lakes#map" className="text-signal-dark font-bold text-sm uppercase tracking-wider">
      View on map →
    </Link>
  );
}
