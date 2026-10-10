"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Small map for manually picking a catch location. Tap/drag to set the pin. */
export default function CatchMapPicker({
  lat,
  lng,
  avatarUrl,
  userName,
  onPick,
  onClose,
}: {
  lat: number | null;
  lng: number | null;
  avatarUrl?: string | null;
  userName?: string | null;
  onPick: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markerObj = useRef<L.Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const startLat = lat ?? 49.9;
    const startLng = lng ?? -97.1;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([startLat, startLng], lat !== null ? 12 : 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const setPin = (la: number, ln: number) => {
      // Profile-pic pin — no default Leaflet images (they 404 as "?" boxes).
      const initial = (userName ?? "?").trim().charAt(0).toUpperCase() || "?";
      const icon = L.divIcon({
        className: "",
        html: avatarUrl
          ? `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:3px solid #e4572e;box-shadow:0 2px 8px rgba(0,0,0,0.4);background:#12322b;"><img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" /></div>`
          : `<div style="width:36px;height:36px;border-radius:50%;background:#e4572e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:17px;">${initial}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      if (markerObj.current) {
        markerObj.current.setLatLng([la, ln]);
      } else {
        markerObj.current = L.marker([la, ln], { draggable: true, icon }).addTo(map);
        markerObj.current.on("dragend", () => {
          const p = markerObj.current!.getLatLng();
          pickRef.current(p.lat, p.lng);
        });
      }
    };
    if (lat !== null && lng !== null) setPin(lat, lng);

    map.on("click", (e: L.LeafletMouseEvent) => {
      setPin(e.latlng.lat, e.latlng.lng);
      pickRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapObj.current = map;
    // Fix tiles when the modal animates open.
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      mapObj.current = null;
      markerObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Pick catch location">
      <div className="absolute inset-0 bg-pine-deep/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-paper rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-display font-bold text-pine text-lg">Pick location</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-pine/10 hover:bg-pine/20 text-pine font-black flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="px-5 pb-3 text-xs text-pine/60">Tap the map to drop a pin, or drag the pin to fine-tune.</p>
        <div ref={mapRef} className="w-full h-72 sm:h-80" />
        <div className="p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
