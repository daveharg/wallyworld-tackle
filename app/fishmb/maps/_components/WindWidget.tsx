"use client";

import { useEffect, useRef, useState } from "react";

function compass16(deg: number): string {
  const pts = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return pts[Math.round(deg / 22.5) % 16];
}

/**
 * Floating wind readout for the map. Shows live wind speed + the direction
 * it's coming from at the current map centre (Open-Meteo, no key needed).
 */
export default function WindWidget({ lat, lng }: { lat: number; lng: number }) {
  const [wind, setWind] = useState<{ speed: number; dir: number } | null>(null);
  const lastFetch = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const prev = lastFetch.current;
    // Don't refetch for tiny pans (< ~3 km).
    if (prev) {
      const dLat = (lat - prev.lat) * 111;
      const dLng = (lng - prev.lng) * 111 * Math.cos((lat * Math.PI) / 180);
      if (Math.hypot(dLat, dLng) < 3) return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
            3
          )}&longitude=${lng.toFixed(3)}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto`
        );
        const d = await r.json();
        const cur = d?.current;
        if (cur && Number.isFinite(cur.wind_speed_10m) && Number.isFinite(cur.wind_direction_10m)) {
          setWind({ speed: Math.round(cur.wind_speed_10m), dir: cur.wind_direction_10m });
          lastFetch.current = { lat, lng };
        }
      } catch {
        // Wind stays hidden on failure.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [lat, lng]);

  if (!wind) return null;

  return (
    <div className="absolute top-14 left-3 z-20 bg-white/95 backdrop-blur border border-pine/15 rounded-full pl-2.5 pr-3.5 py-2 shadow-lg flex items-center gap-2">
      <span
        className="text-pine text-base inline-block transition-transform"
        style={{ transform: `rotate(${wind.dir + 180}deg)` }}
        aria-hidden
      >
 
      </span>
      <span className="text-xs font-black text-pine tabular-nums whitespace-nowrap">
        {wind.speed} km/h {compass16(wind.dir)}
      </span>
    </div>
  );
}
