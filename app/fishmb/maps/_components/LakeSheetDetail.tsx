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
  limits_zone?: string;
  lodging?: { name: string; detail?: string }[];
  regulations?: {
    division?: string;
    special?: string;
  };
}

interface ZoneLimit {
  species: string;
  limit: string;
  size?: string;
  season?: string;
}

interface RegZone {
  id: string;
  name: string;
  limits: ZoneLimit[];
}

interface StockingEvent {
  date: string;
  species: string;
  size?: string;
  quantity?: number;
}

interface TrophyCatch {
  species: string;
  inch: number;
  cm: number;
  date: string;
  angler: string;
  released: boolean;
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

function formatStockDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Does a division limit row mention any of the lake's species? */
function limitAppliesToLake(limitSpecies: string, lakeSpecies: string[]): boolean {
  const hay = limitSpecies.toLowerCase();
  return lakeSpecies.some((s) => {
    const needle = s.toLowerCase().replace(/s$/, "");
    return needle.length > 3 && hay.includes(needle);
  });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-2">
      {children}
    </p>
  );
}

/**
 * Full lake detail for the maps bottom sheet: regulations, stocking history,
 * trophy catches and nearby lodges — the same data as the main lake pages,
 * organized in compact expandable sections.
 */
export default function LakeSheetDetail({ lake, spots, onBack, onSelectSpot }: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState<LakeMeta | null>(null);
  const [zone, setZone] = useState<RegZone | null>(null);
  const [stocking, setStocking] = useState<StockingEvent[]>([]);
  const [trophies, setTrophies] = useState<TrophyCatch[]>([]);
  const [stockingOpen, setStockingOpen] = useState(false);
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
        if (!cancelled) {
          setMeta(found);
          const zones: RegZone[] = d?.regulations?.zones ?? [];
          const z = zones.find((zz) => zz.id === found?.limits_zone) ?? null;
          setZone(z);
        }
      } catch {
        // Meta stays blank.
      }
      try {
        const r = await fetch("/fishmb/stocking-history.json");
        const d = await r.json();
        if (!cancelled) setStocking((d[lake.id] ?? []) as StockingEvent[]);
      } catch {
        // Stocking stays empty.
      }
      try {
        const r = await fetch("/fishmb/trophy-records.json");
        const d = await r.json();
        if (!cancelled) setTrophies((d[lake.id] ?? []) as TrophyCatch[]);
      } catch {
        // Trophies stay empty.
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
  const matchedLimits = zone
    ? zone.limits.filter((lim) => limitAppliesToLake(lim.species, species))
    : [];
  const shownLimits = matchedLimits.length > 0 ? matchedLimits : (zone?.limits ?? []);
  const latestStock = stocking[0] ?? null;
  const lodges = meta?.lodging ?? [];
  const sortedTrophies = [...trophies].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="pb-6 pt-1">
      {/* Species */}
      {species.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Species</SectionTitle>
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

      {/* Regulations */}
      {(zone || meta?.regulations?.special) && (
        <div className="mb-5">
          <SectionTitle>
            Regulations{zone ? ` · ${zone.name}` : ""}
          </SectionTitle>
          {meta?.regulations?.special && (
            <p className="text-sm text-signal-dark font-semibold leading-relaxed mb-3 bg-signal/10 border border-signal/20 rounded-2xl px-4 py-3">
              {meta.regulations.special}
            </p>
          )}
          {shownLimits.length > 0 && (
            <div className="rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 overflow-hidden">
              {shownLimits.map((lim, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-sm font-bold text-pine">{lim.species}</p>
                  <p className="text-xs text-pine/60 mt-0.5">
                    Limit {lim.limit}
                    {lim.size ? ` · ${lim.size}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stocking history — latest shown, tap to expand the full scrollable list */}
      {stocking.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Stocking history</SectionTitle>
          <button
            type="button"
            onClick={() => setStockingOpen((o) => !o)}
            className="w-full text-left bg-white border border-pine/10 rounded-2xl px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-pine">
                  Latest: {formatStockDate(latestStock!.date)} — {latestStock!.species}
                </p>
                <p className="text-xs text-pine/60 mt-0.5">
                  {latestStock!.quantity != null
                    ? `${latestStock!.quantity.toLocaleString("en-US")} fish`
                    : ""}
                  {latestStock!.size ? ` · ${latestStock!.size}` : ""}
                </p>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-signal-dark shrink-0">
                {stockingOpen ? "Hide" : `All ${stocking.length}`}
              </span>
            </div>
          </button>
          {stockingOpen && (
            <div className="mt-2 rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 max-h-64 overflow-y-auto">
              {stocking.map((e, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-pine">{formatStockDate(e.date)}</p>
                    <p className="text-xs text-pine/60 truncate">
                      {e.species}
                      {e.size ? ` · ${e.size}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-pine tabular-nums whitespace-nowrap">
                    {e.quantity != null ? e.quantity.toLocaleString("en-US") : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trophy catches — newest first */}
      {sortedTrophies.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Trophy catches</SectionTitle>
          <div className="rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 overflow-hidden">
            {sortedTrophies.map((t, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm font-bold text-pine">
                  {t.species} · {t.inch}&Prime; ({t.cm} cm)
                </p>
                <p className="text-xs text-pine/60 mt-0.5">
                  {t.angler}
                  {t.date ? ` · ${t.date}` : ""}
                  {t.released ? " · Released" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nearby lodges */}
      {lodges.length > 0 && (
        <div className="mb-5">
          <SectionTitle>Nearby lodges</SectionTitle>
          <div className="space-y-2">
            {lodges.map((lg, i) =>
              lg.detail ? (
                <a
                  key={i}
                  href={lg.detail}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white border border-pine/10 rounded-2xl px-4 py-3"
                >
                  <p className="text-sm font-bold text-pine">{lg.name}</p>
                </a>
              ) : (
                <div key={i} className="bg-white border border-pine/10 rounded-2xl px-4 py-3">
                  <p className="text-sm font-bold text-pine">{lg.name}</p>
                </div>
              )
            )}
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
          <SectionTitle>Your spots here ({nearbySpots.length})</SectionTitle>
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
