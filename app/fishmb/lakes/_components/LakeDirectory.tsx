"use client";

import { useMemo, useState } from "react";
import { LakeCard, type LakeCardLake } from "../../_components/Cards";
import { LakeMap, type MapLake } from "./LakeMap";
import { RequestLake } from "./RequestLake";
import { searchLakes } from "@/lib/fishmb-search";
import { LAKE_REGIONS } from "@/lib/fishmb-constants";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export default function LakeDirectory({ lakes, initialQuery = "" }: { lakes: LakeCardLake[]; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [region, setRegion] = useState("All");
  const [stockedOnly, setStockedOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = lakes;
    if (region !== "All") list = list.filter((l) => l.region === region);
    if (stockedOnly) list = list.filter((l) => l.stocked);
    if (q.trim()) list = searchLakes(list, q);
    return list;
  }, [q, region, stockedOnly, lakes]);

  const mapLakes: MapLake[] = useMemo(
    () =>
      filtered
        .filter((l) => COORDS[l.id])
        .map((l) => ({
          id: l.id,
          name: l.name,
          region: l.region,
          lat: COORDS[l.id].lat,
          lng: COORDS[l.id].lng,
        })),
    [filtered]
  );

  return (
    <>
      <div id="map" className="mb-8 scroll-mt-24">
        <LakeMap lakes={mapLakes} />
      </div>

      <div className="bg-white rounded-2xl border border-pine/10 p-4 md:p-5 shadow-sm mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by lake name, region or species…"
          className="w-full bg-paper-deep rounded-xl px-5 py-3.5 text-pine placeholder:text-pine/40 outline-none focus:ring-2 focus:ring-signal/50"
          aria-label="Search lakes"
        />
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {["All", ...LAKE_REGIONS].map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors ${
                region === r
                  ? "bg-pine text-white"
                  : "bg-paper-deep text-pine/60 hover:text-pine"
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setStockedOnly((v) => !v)}
            className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors ${
              stockedOnly
                ? "bg-[#5E8F3E] text-white"
                : "bg-paper-deep text-pine/60 hover:text-pine"
            }`}
          >
            Stocked only
          </button>
        </div>
      </div>

      <p className="text-sm text-pine/50 mb-5">
        {filtered.length} of {lakes.length} lakes
      </p>

      {filtered.length === 0 ? (
        <p className="text-pine/60 py-12 text-center">
          No lakes match. Try a different search — or request it below.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((l) => (
            <LakeCard key={l.id} lake={l} className="w-full" />
          ))}
        </div>
      )}

      <RequestLake />
    </>
  );
}
