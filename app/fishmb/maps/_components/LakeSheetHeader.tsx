"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import type { SavedLake } from "./types";

function weatherLabel(code: number | null): string {
  if (code === null) return "";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Storm";
  return "";
}

/** Fixed lake header — name, region, weather + catches. Doesn't scroll. */
export default function LakeSheetHeader({
  lake,
  onBack,
}: {
  lake: SavedLake;
  onBack: () => void;
}) {
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [catchCount, setCatchCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (lake.lat === null || lake.lng === null) return;
    (async () => {
      try {
        const w = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lake.lat}&longitude=${lake.lng}&current=temperature_2m,weather_code&timezone=auto`
        ).then((r) => r.json());
        if (!cancelled) {
          const t = Math.round(w?.current?.temperature_2m ?? NaN);
          setTempC(Number.isNaN(t) ? null : t);
          setWeatherCode(w?.current?.weather_code ?? null);
        }
      } catch {
        // Weather stays blank.
      }
      try {
        const c = await fishFetch(
          `/api/fishmb/map-catches?lat=${lake.lat}&lng=${lake.lng}&radius_km=15&mine=1`
        );
        if (!cancelled) setCatchCount((c.catches ?? []).length);
      } catch {
        // Count stays blank.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lake.id, lake.lat, lake.lng]);

  return (
    <div className="pb-2">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to lakes"
          className="shrink-0 w-10 h-10 rounded-full bg-paper-deep border border-pine/15 flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-pine">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h2 className="font-display font-bold text-2xl text-pine leading-tight truncate">
            {lake.name}
          </h2>
          {lake.region && (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-pine/50">
              {lake.region} Manitoba
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="flex-1 bg-paper-deep border border-pine/10 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-1">
            Now
          </p>
          <p className="text-lg font-extrabold text-pine">
            {tempC !== null ? `${tempC}°C` : "—"}
            {weatherCode !== null && (
              <span className="block text-xs font-semibold text-pine/55">
                {weatherLabel(weatherCode)}
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/fishmb/maps/lake/${lake.id}/catches`}
          className="flex-1 bg-paper-deep border border-pine/10 rounded-2xl px-4 py-3 hover:border-signal/40 transition-colors"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-1">
            Your catches
          </p>
          <p className="text-lg font-extrabold text-pine">
            {catchCount !== null ? catchCount : "—"}
          </p>
        </Link>
      </div>
    </div>
  );
}
