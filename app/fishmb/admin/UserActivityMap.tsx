"use client";

import { useEffect, useRef } from "react";
import type { MapCell } from "@/app/api/fishmb/admin/user-map/route";

/**
 * Admin map of angler activity — aggregated grid cells only, never individual
 * spots. Bubble size = distinct anglers in that area. Helps Dave decide where
 * to host fishing tournaments.
 */
export function UserActivityMap({ cells }: { cells: MapCell[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const m = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [53.5, -97.5], // Manitoba
        6
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(m);
      mapRef.current = m;

      const max = Math.max(1, ...cells.map((c) => c.anglers));
      cells.forEach((c) => {
        const radius = 8 + (c.anglers / max) * 28;
        const circle = L.circleMarker([c.lat, c.lng], {
          radius,
          color: "#d9481c",
          weight: 2,
          fillColor: "#d9481c",
          fillOpacity: 0.45,
        }).addTo(m);
        circle.bindTooltip(
          `<b>${c.anglers} angler${c.anglers === 1 ? "" : "s"}</b><br/>${c.pins} saved spot${c.pins === 1 ? "" : "s"}`,
          { sticky: true }
        );
      });

      if (cells.length > 0) {
        const bounds = L.latLngBounds(cells.map((c) => [c.lat, c.lng] as [number, number]));
        m.fitBounds(bounds.pad(0.3));
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [cells]);

  if (cells.length === 0) {
    return (
      <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
        <p className="text-pine/60 text-sm">
          Not enough location data yet — once anglers save spots and log catches
          with GPS, activity areas will appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[420px] rounded-3xl border border-pine/10 overflow-hidden z-0"
    />
  );
}
