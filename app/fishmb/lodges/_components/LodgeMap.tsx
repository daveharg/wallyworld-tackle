"use client";

import { useEffect, useRef } from "react";

export interface MapLodge {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
}

/** Manitoba lodge/guide map (Leaflet). Search results appear as pins. */
export function LodgeMap({ lodges }: { lodges: MapLodge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([53.5, -96.5], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 12,
      }).addTo(map);
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (!map) return;
      layerRef.current?.remove();
      const layer = L.layerGroup();
      const bounds: [number, number][] = [];
      for (const lodge of lodges.slice(0, 200)) {
        const marker = L.marker([lodge.lat, lodge.lng]).bindPopup(
          `<strong>${escapeHtml(lodge.name)}</strong><br/>${escapeHtml(lodge.location)}<br/><a href="/fishmb/lodges/${lodge.id}">View →</a>`
        );
        marker.addTo(layer);
        bounds.push([lodge.lat, lodge.lng]);
      }
      layer.addTo(map);
      layerRef.current = layer;
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.15), { animate: true });
      }
    })();
  }, [lodges]);

  return (
    <div className="rounded-3xl overflow-hidden border border-pine/10 shadow-sm">
      <div ref={containerRef} className="h-[320px] md:h-[420px] w-full z-0" />
      <p className="text-xs text-pine/50 px-4 py-2.5 bg-white">
        Showing {Math.min(lodges.length, 200)} of {lodges.length} on the map.{" "}
        {lodges.length === 0 && "Search above to find lodges & guides."}
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
