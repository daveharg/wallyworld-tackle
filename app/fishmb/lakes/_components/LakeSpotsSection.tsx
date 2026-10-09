"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface Spot {
  id: string;
  name: string;
  lat: number | string;
  lng: number | string;
  icon?: string;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * "Your saved spots" section for a lake page: mini map with spot pins plus
 * the spot list. Tapping the map returns to the large map.
 */
export function LakeSpotsSection({
  lakeId,
  lakeName,
  lat,
  lng,
}: {
  lakeId: string;
  lakeName: string;
  lat: number;
  lng: number;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await fishFetch("/api/fishmb/spots");
        const all = (d.spots ?? []) as Spot[];
        setSpots(
          all.filter((s) => {
            const sla = Number(s.lat);
            const sln = Number(s.lng);
            return (
              Number.isFinite(sla) &&
              Number.isFinite(sln) &&
              haversineKm(lat, lng, sla, sln) <= 15
            );
          })
        );
      } catch {
        setSpots([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, [lat, lng]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;
      const m = L.map(mapRef.current, {
        scrollWheelZoom: false,
        dragging: false,
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:#1d4d2b;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      spots.forEach((s) => {
        L.marker([Number(s.lat), Number(s.lng)], { icon })
          .addTo(m)
          .bindTooltip(s.name || "Spot", { permanent: false });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, spots, lat, lng]);

  if (!loaded) return null;
  if (spots.length === 0) return null;

  return (
    <section>
      <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-3">
        Your saved spots
      </h2>
      <Link
        href={`/fishmb/maps?lat=${lat}&lng=${lng}&z=11`}
        className="block rounded-3xl overflow-hidden border border-pine/10 relative h-52 mb-4"
        title="Open in the large map"
      >
        <div ref={mapRef} className="absolute inset-0" />
        <span className="absolute bottom-3 right-3 bg-pine-deep/85 text-white text-xs font-bold rounded-full px-3.5 py-2">
          Open large map
        </span>
      </Link>
      <ul className="space-y-2">
        {spots.map((s) => (
          <li
            key={s.id}
            className="bg-white border border-pine/10 rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span className="font-bold text-pine text-[15px]">{s.name || "Spot"}</span>
            <Link
              href={`/fishmb/maps?lat=${s.lat}&lng=${s.lng}&z=14`}
              className="text-sm font-bold text-signal"
            >
              View
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-pine/45 mt-3">
        {spots.length} saved {spots.length === 1 ? "spot" : "spots"} on {lakeName}.
      </p>
    </section>
  );
}
