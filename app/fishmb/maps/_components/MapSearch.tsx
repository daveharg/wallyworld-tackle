"use client";

import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  kind: "lake" | "place";
}

interface LakeEntry {
  id: string;
  name: string;
  region?: string;
}

/**
 * Top-left map search — finds Manitoba lakes (local database) plus
 * towns/cities (OpenStreetMap Nominatim). Tapping a result flies the map there.
 */
export default function MapSearch({
  onSelect,
}: {
  onSelect: (lat: number, lng: number, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const lakes = useRef<(LakeEntry & { lat: number | null; lng: number | null })[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the local lake index + coordinates once.
  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([
          fetch("/fish-manitoba/data.json").then((x) => x.json()),
          fetch("/fishmb/lake-coords.json")
            .then((x) => x.json())
            .catch(() => ({})),
        ]);
        const coords = c as Record<string, { lat: number; lng: number }>;
        lakes.current = ((r.lakes ?? []) as LakeEntry[]).map((l) => ({
          id: l.id,
          name: l.name,
          region: l.region,
          lat: coords[l.id]?.lat ?? null,
          lng: coords[l.id]?.lng ?? null,
        }));
      } catch {
        lakes.current = [];
      }
    })();
  }, []);

  // Close on outside tap.
  useEffect(() => {
    const h = (e: Event) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("touchstart", h);
    document.addEventListener("mousedown", h);
    return () => {
      document.removeEventListener("touchstart", h);
      document.removeEventListener("mousedown", h);
    };
  }, []);

  const runSearch = (term: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    const t = term.trim();
    if (t.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    // Instant local lake matches (only lakes we have coordinates for).
    const lower = t.toLowerCase();
    const lakeHits: SearchResult[] = lakes.current
      .filter(
        (l) =>
          l.lat !== null &&
          l.lng !== null &&
          l.name.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .map((l) => ({
        id: `lake:${l.id}`,
        name: l.name,
        detail: l.region ? `${l.region} · Lake` : "Lake",
        lat: l.lat as number,
        lng: l.lng as number,
        kind: "lake" as const,
      }));
    setResults(lakeHits);
    setOpen(true);

    // Remote town/city search (debounced).
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&viewbox=-102,60,-88,48&bounded=1&q=${encodeURIComponent(
            t
          )}`,
          { headers: { Accept: "application/json" } }
        );
        const d = (await r.json()) as {
          display_name: string;
          lat: string;
          lon: string;
          type: string;
        }[];
        const placeHits: SearchResult[] = (Array.isArray(d) ? d : [])
          .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
          .map((p, i) => ({
            id: `place:${i}:${p.lat},${p.lon}`,
            name: p.display_name.split(",")[0],
            detail: p.display_name.split(",").slice(1, 3).join(",").trim(),
            lat: Number(p.lat),
            lng: Number(p.lon),
            kind: "place" as const,
          }));
        setResults((prev) => {
          const lakeIds = new Set(prev.map((x) => x.id));
          return [...prev, ...placeHits.filter((p) => !lakeIds.has(p.id))];
        });
      } catch {
        // Local results still stand.
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const pick = (r: SearchResult) => {
    setOpen(false);
    setQ(r.name);
    onSelect(r.lat, r.lng, r.name);
  };

  return (
    <div ref={boxRef} className="absolute top-3 left-3 z-20 w-56 max-w-[60vw]">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          runSearch(e.target.value);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Search lake, town, city…"
        className="w-full bg-white/95 backdrop-blur border border-pine/15 rounded-full pl-4 pr-4 py-2.5 text-sm font-semibold text-pine placeholder:text-pine/40 shadow-lg focus:outline-none focus:border-pine/40"
      />
      {open && (results.length > 0 || searching) && (
        <div className="mt-2 bg-white rounded-2xl shadow-xl border border-pine/10 overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-pine/5 active:bg-pine/10 border-b border-pine/5 last:border-0"
            >
              <p className="text-sm font-bold text-pine leading-tight">{r.name}</p>
              <p className="text-[11px] text-pine/50 font-semibold">{r.detail}</p>
            </button>
          ))}
          {searching && (
            <p className="px-4 py-2.5 text-xs font-bold text-pine/40">Searching…</p>
          )}
        </div>
      )}
    </div>
  );
}
