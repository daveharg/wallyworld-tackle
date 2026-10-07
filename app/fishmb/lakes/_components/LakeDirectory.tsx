"use client";

import { useMemo, useState } from "react";
import { LakeCard, type LakeCardLake } from "../../_components/Cards";
import { LAKE_REGIONS } from "@/lib/fishmb-constants";

export default function LakeDirectory({ lakes }: { lakes: LakeCardLake[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("All");
  const [stockedOnly, setStockedOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lakes.filter((l) => {
      if (region !== "All" && l.region !== region) return false;
      if (stockedOnly && !l.stocked) return false;
      if (!needle) return true;
      return (
        l.name.toLowerCase().includes(needle) ||
        l.region.toLowerCase().includes(needle) ||
        l.species.some((s) => s.toLowerCase().includes(needle))
      );
    });
  }, [q, region, stockedOnly, lakes]);

  return (
    <>
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
          No lakes match. Try a different search.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((l) => (
            <LakeCard key={l.id} lake={l} className="w-full" />
          ))}
        </div>
      )}
    </>
  );
}
