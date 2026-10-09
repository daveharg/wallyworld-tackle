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

/** Lakes tab — saved lakes as full-width cards with weather, catches, species. */
export default function LakesTab({
  onFlyToLake,
  onSelectLake,
}: {
  onFlyToLake: (lake: SavedLake) => void;
  onSelectLake: (lake: SavedLake) => void;
}) {
  const [favs, setFavs] = useState<SavedLake[]>([]);
  const [allLakes, setAllLakes] = useState<LakeMeta[]>([]);
  const [cards, setCards] = useState<LakeCardData[]>([]);
  const [addLakeId, setAddLakeId] = useState("");
  const [adding, setAdding] = useState(false);

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
        meta = ((d.lakes ?? []) as LakeMeta[])
          .map((l) => ({ id: l.id, name: l.name, region: l.region, species: l.species ?? [] }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        meta = [];
      }
      setAllLakes(meta);
      const metaById = new Map(meta.map((m) => [m.id, m]));
      const sorted = [...favList].sort((a, b) => a.name.localeCompare(b.name));
      setFavs(sorted);

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
    })();
  }, []);

  const favIds = new Set(favs.map((f) => f.id));

  const addLake = async () => {
    if (!addLakeId || adding || favIds.has(addLakeId)) return;
    setAdding(true);
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: addLakeId }),
      });
      const f = await fishFetch("/api/fishmb/favorite-lakes");
      const sorted = ((f.lakes ?? []) as SavedLake[]).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setFavs(sorted);
      setAddLakeId("");
      // Re-enrich — simplest is a reload of this tab's data.
      window.location.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="pt-1 pb-2">
      {/* Add a lake */}
      <div className="flex gap-2 mb-4">
        <select
          value={addLakeId}
          onChange={(e) => setAddLakeId(e.target.value)}
          className="flex-1 bg-white border border-pine/15 rounded-2xl px-4 py-3 text-[15px] font-semibold text-pine/80"
        >
          <option value="">Add a new lake…</option>
          {allLakes
            .filter((l) => !favIds.has(l.id))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.region ? ` — ${l.region}` : ""}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={addLake}
          disabled={!addLakeId || adding}
          className="shrink-0 bg-pine text-white font-bold rounded-2xl px-5 text-[15px] disabled:opacity-40"
        >
          {adding ? "…" : "Add"}
        </button>
      </div>

      {/* Lake cards — full width */}
      {cards.length === 0 ? (
        <p className="text-center text-pine/50 text-sm py-8">
          No saved lakes yet — add one above to get started.
        </p>
      ) : (
        <div className="-mx-4 space-y-3">
          {cards.map((lake) => (
            <button
              key={lake.id}
              type="button"
              onClick={() => onSelectLake(lake)}
              className="w-full text-left bg-white border-y border-pine/10 px-5 py-4 active:bg-pine/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-pine text-[17px] leading-tight">
                    {lake.name}
                  </p>
                  {lake.region && (
                    <p className="text-xs text-pine/50 font-semibold mt-0.5">
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
                  {lake.catchCount !== null && (
                    <p className="text-xs font-bold text-pine/55 mt-0.5">
 {lake.catchCount} {lake.catchCount === 1 ? "catch" : "catches"}
                    </p>
                  )}
                </div>
              </div>
              {lake.species.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {lake.species.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="text-[11px] font-bold bg-pine/8 text-pine/70 rounded-full px-2.5 py-1"
                    >
                      {s}
                    </span>
                  ))}
                  {lake.species.length > 6 && (
                    <span className="text-[11px] font-bold text-pine/40 px-1 py-1">
                      +{lake.species.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
