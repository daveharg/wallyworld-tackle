"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LodgeMap, type MapLodge } from "./LodgeMap";
import { RequestLodge } from "./RequestLodge";
import coordsJson from "@/public/fishmb/lodge-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export interface SlimLodge {
  id: string;
  name: string;
  location: string;
  kind: string;
  species: string[];
  ice_fishing: boolean;
}

export default function LodgeDirectory({ lodges }: { lodges: SlimLodge[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("All");

  const kinds = useMemo(
    () => ["All", ...Array.from(new Set(lodges.map((l) => l.kind))).sort()],
    [lodges]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lodges.filter((l) => {
      if (kind !== "All" && l.kind !== kind) return false;
      if (!needle) return true;
      return (
        l.name.toLowerCase().includes(needle) ||
        (l.location ?? "").toLowerCase().includes(needle) ||
        l.species.some((s) => s.toLowerCase().includes(needle))
      );
    });
  }, [q, kind, lodges]);

  const mapLodges: MapLodge[] = useMemo(
    () =>
      filtered
        .filter((l) => COORDS[l.id])
        .map((l) => ({
          id: l.id,
          name: l.name,
          location: l.location,
          lat: COORDS[l.id].lat,
          lng: COORDS[l.id].lng,
        })),
    [filtered]
  );

  return (
    <>
      <div className="mb-8">
        <LodgeMap lodges={mapLodges} />
      </div>

      <div className="bg-white rounded-2xl border border-pine/10 p-4 md:p-5 shadow-sm mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by lodge, location or species…"
          className="w-full bg-paper-deep rounded-xl px-5 py-3.5 text-pine placeholder:text-pine/40 outline-none focus:ring-2 focus:ring-signal/50"
          aria-label="Search lodges"
        />
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors capitalize ${
                kind === k
                  ? "bg-pine text-white"
                  : "bg-paper-deep text-pine/60 hover:text-pine"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-pine/50 mb-5">
        {filtered.length} of {lodges.length} businesses
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((l) => (
          <Link
            key={l.id}
            href={`/fishmb/lodges/${l.id}`}
            className="bg-white rounded-2xl border border-pine/10 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all block"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold mb-1 capitalize">
              {l.kind}
            </p>
            <h3 className="font-display font-bold text-xl text-pine leading-tight mb-1">
              {l.name}
            </h3>
            <p className="text-sm text-pine/55 mb-2">{l.location}</p>
            <p className="text-xs text-pine/50 truncate">
              {l.species.slice(0, 5).join(" · ")}
            </p>
            {l.ice_fishing && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-pine/60 mt-2">
                ❄ Ice fishing
              </p>
            )}
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-pine/60 py-12 text-center">No matches. Try a different search.</p>
      )}
      <RequestLodge />
    </>
  );
}
