// Floating temperature readout for the map — current temp at your GPS location.

"use client";

import { useEffect, useState } from "react";

export default function TempWidget({ lat, lng }: { lat: number; lng: number }) {
  const [temp, setTemp] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
            3
          )}&longitude=${lng.toFixed(3)}&current=temperature_2m&timezone=auto`
        );
        const d = await r.json();
        const t2 = d?.current?.temperature_2m;
        if (!cancelled && Number.isFinite(t2)) setTemp(Math.round(t2));
      } catch {
        // Temp stays hidden on failure.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [lat, lng]);

  if (temp === null) return null;

  return (
    <div className="bg-white/95 backdrop-blur border border-pine/15 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1d4d2b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>
      <span className="text-xs font-black text-pine tabular-nums whitespace-nowrap">
        {temp}°C
      </span>
    </div>
  );
}
