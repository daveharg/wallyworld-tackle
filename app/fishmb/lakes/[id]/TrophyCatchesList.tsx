"use client";

import { useState } from "react";
import type { TrophyCatch } from "@/lib/fishmb";

/** Trophy catches — the last 5 years of Master Angler records, most
 *  recent by default, with a button to view all of them. The heading
 *  count is the lake's all-time record-book total. */
export function TrophyCatchesList({
  catches,
  total,
}: {
  catches: TrophyCatch[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  if (catches.length === 0 && total === 0) return null;
  if (catches.length === 0) {
    return (
      <section>
        <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-1">
          Trophy catches <span className="text-pine/40 text-lg">({total})</span>
        </h2>
        <p className="text-sm text-pine/55">
          {total} Master Angler records on file for this lake — none in the
          last 5 years.
        </p>
        <p className="text-xs text-pine/40 mt-3">
          Source: Manitoba Master Angler record book (anglers.travelmanitoba.com)
        </p>
      </section>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? catches.filter(
        (c) =>
          c.species.toLowerCase().includes(q) ||
          c.angler.toLowerCase().includes(q) ||
          c.date.toLowerCase().includes(q)
      )
    : catches;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const visible = showAll ? sorted : sorted.slice(0, 1);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide">
 Trophy catches <span className="text-pine/40 text-lg">({total})</span>
        </h2>
      </div>
      <p className="text-sm text-pine/55 mb-3">
        {total} Master Angler records on file for this lake — showing the
        last 5 years ({catches.length}), newest first.
      </p>
      {showAll && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by species, angler, or year…"
          className="w-full bg-white border border-pine/15 rounded-full px-5 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-3"
        />
      )}
      <div className="rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 overflow-hidden max-h-[560px] overflow-y-auto">
        {visible.map((c, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-pine">
                {c.inch !== null ? `${c.inch.toFixed(2).replace(/\.?0+$/, "")}″ ` : ""}{c.species}
                {c.released && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-700/10 rounded-full px-2 py-0.5">Released</span>}
              </p>
              <p className="text-xs text-pine/60 truncate">
                {c.angler} · {c.date}
              </p>
            </div>
            <p className="text-xs text-pine/40 whitespace-nowrap tabular-nums">
              {c.cm !== null ? `${c.cm.toFixed(1)} cm` : ""}
            </p>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-pine/50">
            No catches match “{search}”.
          </p>
        )}
      </div>
      {sorted.length > 1 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 w-full py-3 rounded-full bg-pine/5 hover:bg-pine/10 text-pine font-bold text-sm uppercase tracking-wider transition-colors"
        >
          {showAll ? "Show less" : `View all ${sorted.length} from the last 5 years`}
        </button>
      )}
      <p className="text-xs text-pine/40 mt-3">
        Source: Manitoba Master Angler record book (anglers.travelmanitoba.com)
      </p>
    </section>
  );
}
