"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface SavedLake {
  id: string;
  name: string;
  region?: string;
  lat: number | null;
  lng: number | null;
}

interface LakeMeta {
  id: string;
  name: string;
  region?: string;
  species?: string[];
}

interface LakeCardData extends SavedLake {
  species: string[];
  tempC: number | null;
  weatherCode: number | null;
  catchCount: number | null;
}

function weatherEmoji(code: number | null): string {
 if (code === null) return "";
 if (code === 0) return "";
 if (code <= 3) return "";
 if (code <= 48) return "";
 if (code <= 67) return "";
 if (code <= 77) return "";
 if (code <= 82) return "";
 if (code <= 86) return "";
 return "";
}

interface LakeUsage {
  count: number;
  last: number;
}

function getUsage(): Record<string, LakeUsage> {
  try {
    return JSON.parse(localStorage.getItem("fishmb-lake-usage") ?? "{}");
  } catch {
    return {};
  }
}

function recordUsage(lakeId: string) {
  try {
    const u = getUsage();
    const prev = u[lakeId] ?? { count: 0, last: 0 };
    u[lakeId] = { count: prev.count + 1, last: Date.now() };
    localStorage.setItem("fishmb-lake-usage", JSON.stringify(u));
  } catch {
    // Usage tracking is best-effort.
  }
}

/** Lakes tab — saved lakes as full-width cards, most-used first. */
export default function LakesTab({
  onFlyToLake,
  onSelectLake,
}: {
  onFlyToLake: (lake: SavedLake) => void;
  onSelectLake: (lake: SavedLake) => void;
}) {
  const [cards, setCards] = useState<LakeCardData[]>([]);
  const [allLakes, setAllLakes] = useState<{ id: string; name: string; region?: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [addId, setAddId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      let favList: SavedLake[] = [];
      try {
        const f = await fishFetch("/api/fishmb/favorite-lakes");
        favList = (f.lakes ?? []) as SavedLake[];
      } catch {
        favList = [];
      }
      let meta: LakeMeta[] = [];
      try {
        const r = await fetch("/fish-manitoba/data.json");
        const d = await r.json();
        meta = ((d.lakes ?? []) as LakeMeta[]).map((l) => ({
          id: l.id,
          name: l.name,
          region: l.region,
          species: l.species ?? [],
        }));
      } catch {
        meta = [];
      }
      const metaById = new Map(meta.map((m) => [m.id, m]));
      // Most-used first (open count, then recency); never-opened lakes last.
      const usage = getUsage();
      const sorted = [...favList].sort((a, b) => {
        const ua = usage[a.id] ?? { count: 0, last: 0 };
        const ub = usage[b.id] ?? { count: 0, last: 0 };
        if (ub.count !== ua.count) return ub.count - ua.count;
        return ub.last - ua.last;
      });

      // Enrich each lake with weather + catch count in parallel.
      const enriched = await Promise.all(
        sorted.map(async (lake): Promise<LakeCardData> => {
          const species = metaById.get(lake.id)?.species ?? [];
          let tempC: number | null = null;
          let weatherCode: number | null = null;
          let catchCount: number | null = null;
          if (lake.lat !== null && lake.lng !== null) {
            try {
              const w = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lake.lat}&longitude=${lake.lng}&current=temperature_2m,weather_code&timezone=auto`
              ).then((r) => r.json());
              tempC = Math.round(w?.current?.temperature_2m ?? NaN);
              weatherCode = w?.current?.weather_code ?? null;
              if (Number.isNaN(tempC)) tempC = null;
            } catch {
              // Weather stays blank.
            }
            try {
              const c = await fishFetch(
                `/api/fishmb/map-catches?lat=${lake.lat}&lng=${lake.lng}&radius_km=15&mine=1`
              );
              catchCount = (c.catches ?? []).length;
            } catch {
              // Count stays blank.
            }
          }
          return { ...lake, species, tempC, weatherCode, catchCount };
        })
      );
      setCards(enriched);
      // All lakes for the add-lake picker (excluding already-saved).
      setAllLakes(meta.map((m) => ({ id: m.id, name: m.name, region: m.region })));
    })();
  }, []);

  const addLake = async () => {
    if (!addId || saving) return;
    setSaving(true);
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: addId }),
      });
      // Refresh the list.
      const f = await fishFetch("/api/fishmb/favorite-lakes");
      const favList = (f.lakes ?? []) as SavedLake[];
      const metaRes = await fetch("/fish-manitoba/data.json").then((r) => r.json()).catch(() => ({ lakes: [] }));
      const metaById = new Map(((metaRes.lakes ?? []) as { id: string; species?: string[] }[]).map((m) => [m.id, m]));
      const usage = getUsage();
      const sorted = [...favList].sort((a, b) => {
        const ua = usage[a.id] ?? { count: 0, last: 0 };
        const ub = usage[b.id] ?? { count: 0, last: 0 };
        if (ub.count !== ua.count) return ub.count - ua.count;
        return ub.last - ua.last;
      });
      setCards(
        sorted.map((lake) => ({
          ...lake,
          species: metaById.get(lake.id)?.species ?? [],
          tempC: null,
          weatherCode: null,
          catchCount: null,
        }))
      );
      setAdding(false);
      setAddId("");
    } catch {
      // Stay open on error.
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (lake: SavedLake) => {
    recordUsage(lake.id);
    onSelectLake(lake);
  };

  return (
    <div className="pt-1 pb-2">
      {/* Lake cards — full width, most-used on top */}
      {cards.length === 0 ? (
        <p className="text-center text-pine/50 text-sm py-8">
          No saved lakes yet.
        </p>
      ) : (
        <div className="-mx-4 space-y-2.5">
          {cards.map((lake) => (
            <button
              key={lake.id}
              type="button"
              onClick={() => handleSelect(lake)}
              className="w-full text-left bg-white border-y border-pine/10 px-5 py-3 active:bg-pine/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-pine text-[16px] leading-tight truncate">
                    {lake.name}
                  </p>
                  {lake.region && (
                    <p className="text-[11px] text-pine/50 font-semibold mt-0.5">
                      {lake.region}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {lake.tempC !== null ? (
                    <p className="text-[15px] font-extrabold text-pine">
                      {weatherEmoji(lake.weatherCode)} {lake.tempC}°
                    </p>
                  ) : (
                    <p className="text-[15px] font-extrabold text-pine/30">—</p>
                  )}
                  {lake.catchCount !== null && lake.catchCount > 0 && (
                    <p className="text-[11px] font-bold text-pine/55 mt-0.5">
 {lake.catchCount} {lake.catchCount === 1 ? "catch" : "catches"}
                    </p>
                  )}
                </div>
              </div>
              {lake.species.length > 0 && (
                <p className="text-[11px] text-pine/55 font-semibold mt-1 truncate">
                  {lake.species.slice(0, 4).join(" · ")}
                  {lake.species.length > 4 ? ` · +${lake.species.length - 4}` : ""}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Small add-lake button below the last lake */}
      <div className="mt-3 px-4">
        {adding ? (
          <div className="space-y-2">
            <select
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              aria-label="Choose a lake to save"
              className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
            >
              <option value="">Pick a lake…</option>
              {allLakes
                .filter((l) => !cards.some((c) => c.id === l.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.region ? ` — ${l.region}` : ""}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addLake}
                disabled={!addId || saving}
                className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
              >
                {saving ? "Adding…" : "Add lake"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setAddId("");
                }}
                className="text-pine/60 text-xs font-bold uppercase tracking-wider px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full text-center text-signal-dark text-xs font-bold uppercase tracking-wider py-2.5 hover:text-signal transition-colors"
          >
            ＋ Add lake
          </button>
        )}
      </div>
    </div>
  );
}
