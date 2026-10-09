"use client";

import { haversineM, formatDist } from "../../profile/_components/geo";
import type { MapCatch } from "./types";

interface CatchesTabProps {
  mine: MapCatch[];
  nearby: MapCatch[];
  loading: boolean;
  scope: "mine" | "nearby";
  onScopeChange: (s: "mine" | "nearby") => void;
  onSelect: (c: MapCatch) => void;
  myLoc: { lat: number; lng: number } | null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function CatchRow({
  c,
  myLoc,
  onSelect,
}: {
  c: MapCatch;
  myLoc: { lat: number; lng: number } | null;
  onSelect: () => void;
}) {
  const dist =
    myLoc != null
      ? formatDist(haversineM(myLoc.lat, myLoc.lng, c.lat, c.lng))
      : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3 text-left active:scale-[0.99] transition-transform"
    >
      {c.photo_url ? (
        <img
          src={c.photo_url}
          alt={c.species}
          className="w-14 h-14 rounded-xl object-cover shrink-0 bg-pine/5"
          loading="lazy"
        />
      ) : (
        <span className="w-14 h-14 rounded-xl bg-pine/5 flex items-center justify-center text-2xl shrink-0">
          🐟
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-pine truncate">
          {c.species}
          {c.length_in ? <span className="text-pine/50 font-medium"> · {c.length_in}&Prime;</span> : null}
        </span>
        <span className="block text-xs text-pine/50 mt-0.5 truncate">
          {c.mine ? "You" : c.user_name} · {fmtDate(c.caught_at)}
          {dist ? ` · ${dist} away` : ""}
        </span>
      </span>
      <span className="text-pine/30 text-lg shrink-0">›</span>
    </button>
  );
}

/** Catches tab — your GPS catches, plus public catches near the map. */
export default function CatchesTab({
  mine,
  nearby,
  loading,
  scope,
  onScopeChange,
  onSelect,
  myLoc,
}: CatchesTabProps) {
  const list = scope === "mine" ? mine : nearby;
  return (
    <div className="pt-1">
      <div className="flex bg-pine/5 rounded-full p-1 mb-3">
        {(
          [
            { id: "mine", label: `🎣 My catches (${mine.length})` },
            { id: "nearby", label: `🌍 On this lake (${nearby.length})` },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onScopeChange(s.id)}
            className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${
              scope === s.id ? "bg-white text-pine shadow" : "text-pine/50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-pine/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">🎣</p>
          <p className="font-bold text-pine">
            {scope === "mine" ? "No GPS catches yet" : "No public catches here yet"}
          </p>
          <p className="text-pine/55 text-sm mt-1 max-w-xs mx-auto">
            {scope === "mine"
              ? "Log a catch with your location saved and it'll show up on your map."
              : "Pan the map to a lake — public catches from other anglers appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <CatchRow key={c.id} c={c} myLoc={myLoc} onSelect={() => onSelect(c)} />
          ))}
        </div>
      )}
      {scope === "nearby" && list.length > 0 && (
        <p className="text-center text-pine/40 text-[11px] mt-3">
          Only catches anglers chose to share publicly.
        </p>
      )}
    </div>
  );
}
