"use client";

import { useEffect, useRef } from "react";

export interface CatchPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: string;
}

/** Organizer view: every catch with GPS plotted on a map. */
export function CatchMap({ pins }: { pins: CatchPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [53.5, -96.5],
        5
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 14,
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
      // Clear old pins.
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      const bounds: [number, number][] = [];
      for (const pin of pins) {
        const color = pin.status === "approved" ? "green" : pin.status === "rejected" ? "red" : "orange";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([pin.lat, pin.lng], { icon })
          .bindPopup(`<strong>${escapeHtml(pin.label)}</strong><br/>${pin.status}`)
          .addTo(map);
        bounds.push([pin.lat, pin.lng]);
      }
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.2));
      }
    })();
  }, [pins]);

  if (pins.length === 0) return null;

  return (
    <div className="rounded-3xl overflow-hidden border border-pine/10">
      <div ref={containerRef} className="h-[300px] w-full z-0" />
      <p className="text-xs text-pine/50 px-4 py-2.5 bg-white">
        {pins.length} {pins.length === 1 ? "catch" : "catches"} with GPS —{" "}
        <span className="text-green-700 font-bold">●</span> approved{" "}
        <span className="text-orange-500 font-bold">●</span> pending{" "}
        <span className="text-red-600 font-bold">●</span> rejected
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
