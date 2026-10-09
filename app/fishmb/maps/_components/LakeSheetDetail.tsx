"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fishFetch } from "../../_components/fishFetch";
import type { SavedLake } from "./types";

interface LakeMeta {
  id: string;
  name: string;
  region?: string;
  species?: string[];
  description?: string;
  size_text?: string;
}

interface Spot {
  id: string;
  name: string;
  lat: string | number;
  lng: string | number;
}

interface Props {
  lake: SavedLake;
  spots: Spot[];
  onBack: () => void;
  onSelectSpot: (s: Spot) => void;
}

function weatherLabel(code: number | null): string {
  if (code === null) return "";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Storm";
}

/**
 * Lake detail page designed for the maps bottom sheet. At the half snap the
 * lake is centred on the map above while this page fills the bottom half;
 * drag up for the full page, down for the full map.
 */
export default function LakeSheetDetail({ lake, spots, onBack, onSelectSpot }: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState<LakeMeta | null>(null);
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [catchCount, setCatchCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/fish-manitoba/data.json");
        const d = await r.json();
        const found = (d.lakes ?? []).find((l: LakeMeta) => l.id === lake.id) ?? null;
        if (!cancelled) setMeta(found);
      } catch {
        // Meta stays blank.
      }
      if (lake.lat !== null && lake.lng !== null) {
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lake.id, lake.lat, lake.lng]);

  // Spots near this lake (within ~15 km).
  const nearbySpots = spots.filter((s) => {
    if (lake.lat === null || lake.lng === null) return false;
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const dLat = (lat - lake.lat) * 111;
    const dLng = (lng - lake.lng) * 111 * Math.cos((lake.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng) <= 15;
  });

  const species = meta?.species ?? [];

  return (
    <div className="pb-6">
      {/* Header */}
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

      {/* Weather + catches strip */}
      <div className="flex gap-2.5 mb-5">
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
        <div className="flex-1 bg-paper-deep border border-pine/10 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-1">
            Your catches
          </p>
          <p className="text-lg font-extrabold text-pine">
            {catchCount !== null ? catchCount : "—"}
          </p>
        </div>
        {meta?.size_text && (
          <div className="flex-1 bg-paper-deep border border-pine/10 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-1">
              Size
            </p>
            <p className="text-sm font-extrabold text-pine leading-snug">{meta.size_text}</p>
          </div>
        )}
      </div>

      {/* Species */}
      {species.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-2">
            Species
          </p>
          <div className="flex flex-wrap gap-2">
            {species.map((s) => (
              <span
                key={s}
                className="bg-pine/10 text-pine text-xs font-bold rounded-full px-3.5 py-1.5"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {meta?.description && (
        <p className="text-sm text-pine/70 leading-relaxed mb-5">
          {meta.description.length > 280
            ? `${meta.description.slice(0, 280)}…`
            : meta.description}
        </p>
      )}

      {/* Your spots on this lake */}
      {nearbySpots.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-2">
            Your spots here ({nearbySpots.length})
          </p>
          <div className="space-y-2">
            {nearbySpots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSpot(s)}
                className="w-full text-left bg-white border border-pine/10 rounded-2xl px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm font-bold text-pine truncate">{s.name}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-signal-dark shrink-0 ml-3">
                  Go to
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full lake page */}
      <button
        type="button"
        onClick={() => router.push(`/fishmb/lakes/${lake.id}`)}
        className="w-full bg-pine text-white font-black uppercase tracking-wider text-sm rounded-full py-3.5"
      >
        Open full lake page
      </button>
    </div>
  );
}
