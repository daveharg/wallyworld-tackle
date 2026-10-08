"use client";

import { useEffect, useRef, useState } from "react";

export interface SpotPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  created_at: string;
}

interface SpotMapProps {
  spots: SpotPin[];
  /** When true, clicking the map drops a pin and calls onPick. */
  picking?: boolean;
  onPick?: (lat: number, lng: number) => void;
  /** The in-progress manual pin (rendered distinctly). */
  pendingPin?: { lat: number; lng: number } | null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Personal fishing-spots map (Leaflet, dynamically imported so it never runs
 * during SSR). Same pattern as the lake map: pins, popups, fit-to-bounds.
 */
export default function SpotMap({ spots, picking, onPick, pendingPin }: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      const m = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [53.5, -96.5],
        5
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 16,
      }).addTo(m);
      m.on("focus", () => m.scrollWheelZoom.enable());
      m.on("blur", () => m.scrollWheelZoom.disable());
      m.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (pickingRef.current) onPickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      if (!cancelled) setMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render pins when the map exists or spots change.
  const layerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      layerRef.current?.remove();
      const layer = L.layerGroup();
      const pin = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#C2410C;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const bounds: [number, number][] = [];
      for (const s of spots) {
        const marker = L.marker([s.lat, s.lng], { icon: pin }).bindPopup(
          `<strong>${escapeHtml(s.name || "Fishing spot")}</strong><br/>${escapeHtml(
            fmtDate(s.created_at)
          )}${s.notes ? `<br/>${escapeHtml(s.notes)}` : ""}`
        );
        marker.addTo(layer);
        bounds.push([s.lat, s.lng]);
      }
      if (pendingPin) {
        const draft = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#1D4ED8;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([pendingPin.lat, pendingPin.lng], { icon: draft }).addTo(layer);
        bounds.push([pendingPin.lat, pendingPin.lng]);
      }
      layer.addTo(map);
      layerRef.current = layer;
      if (bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 12, { animate: true });
        } else {
          map.fitBounds(L.latLngBounds(bounds).pad(0.15), { animate: true });
        }
      }
    })();
  }, [spots, pendingPin, map]);

  // Cursor feedback while picking a spot.
  useEffect(() => {
    if (map && containerRef.current) {
      containerRef.current.style.cursor = picking ? "crosshair" : "";
    }
  }, [picking, map]);

  return (
    <div className="rounded-3xl overflow-hidden border border-pine/10 shadow-sm">
      <div ref={containerRef} className="h-[300px] md:h-[380px] w-full z-0" />
      <p className="text-xs text-pine/50 px-4 py-2.5 bg-white">
        {picking
          ? "Tap the map to drop your pin."
          : spots.length === 0
            ? "No spots on the map yet."
            : `${spots.length} spot${spots.length === 1 ? "" : "s"} — only you can see them.`}
      </p>
    </div>
  );
}
