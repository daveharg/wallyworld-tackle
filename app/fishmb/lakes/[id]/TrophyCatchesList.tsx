"use client";

import { useState } from "react";
import type { TrophyCatch } from "@/lib/fishmb";

/** Trophy catches with search + sort — client component for interactivity. */
export function TrophyCatchesList({ catches }: { catches: TrophyCatch[] }) {
  const [sort, setSort] = useState<"date" | "species" | "size">("size");
  const [search, setSearch] = useState("");
  if (catches.length === 0) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? catches.filter(
        (c) =>
          c.species.toLowerCase().includes(q) ||
          c.angler.toLowerCase().includes(q) ||
          c.date.toLowerCase().includes(q)
      )
    : catches;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "date") return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sort === "species") return a.species.localeCompare(b.species) || b.inch - a.inch;
    return b.inch - a.inch;
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide">
          🏆 Trophy catches <span className="text-pine/40 text-lg">({sorted.length})</span>
        </h2>
        <div className="flex gap-1.5">
          {(["size", "date", "species"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1.5 transition-colors ${
                sort === s ? "bg-pine text-white" : "bg-pine/10 text-pine/60 hover:text-pine"
              }`}
            >
              {s === "size" ? "Biggest" : s === "date" ? "Newest" : "Species"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-pine/55 mb-3">
        Every documented trophy catch here, from the Manitoba Master
        Angler record book.
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by species, angler, or year…"
        className="w-full bg-white border border-pine/15 rounded-full px-5 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-3"
      />
      <div className="rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 overflow-hidden max-h-[560px] overflow-y-auto">
        {sorted.map((c, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-pine">
                {c.inch.toFixed(2).replace(/\.?0+$/, "")}″ {c.species}
                {c.released && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-700/10 rounded-full px-2 py-0.5">Released</span>}
              </p>
              <p className="text-xs text-pine/60 truncate">
                {c.angler} · {c.date}
              </p>
            </div>
            <p className="text-xs text-pine/40 whitespace-nowrap tabular-nums">
              {c.cm.toFixed(1)} cm
            </p>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-pine/50">
            No catches match “{search}”.
          </p>
        )}
      </div>
      <p className="text-xs text-pine/40 mt-3">
        Source: Manitoba Master Angler record book (anglers.travelmanitoba.com)
      </p>
    </section>
  );
}
