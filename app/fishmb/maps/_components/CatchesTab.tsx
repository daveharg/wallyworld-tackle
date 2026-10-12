"use client";

import { useEffect, useState } from "react";
import { haversineM, formatDist } from "../../profile/_components/geo";
import type { MapCatch } from "./types";

export type CatchScope = "mine" | "friends" | "all";

interface CatchesTabProps {
  mine: MapCatch[];
  nearby: MapCatch[];
  // Every visible catch province-wide (own + public + friends') — the All
  // and Friends lists come from here, not the radius-limited nearby set.
  allCatches: MapCatch[];
  loading: boolean;
  scope: CatchScope;
  onScopeChange: (s: CatchScope) => void;
  onSelect: (c: MapCatch) => void;
  myLoc: { lat: number; lng: number } | null;
  showOnMap: boolean;
  onShowOnMapChange: (v: boolean) => void;
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

/** Approx km between two lat/lng points. */
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (aLat - bLat) * 111;
  const dLng = (aLng - bLng) * 111 * Math.cos((bLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

interface LakeCoord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** How far from the lake's centre point a catch can be and still belong
   *  to this lake — scaled by the lake's size (great lakes run huge). */
  reach: number;
}

/** Per-lake reach (km) from its size text: big lakes get a long reach so
 *  their far shores still group under them; small lakes stay at 15 km. */
function lakeReachKm(sizeText: string | undefined): number {
  if (!sizeText) return 15;
  const area = sizeText.match(/([\d,]+(?:\.\d+)?)\s*km(?:2|²)/);
  if (area) {
    const km2 = parseFloat(area[1].replace(/,/g, ""));
    if (Number.isFinite(km2) && km2 > 0) {
      return Math.max(15, Math.min(230, Math.sqrt(km2) * 1.35));
    }
  }
  const dim = sizeText.match(/([\d.]+)\s*km\s*(?:north-south|x|×|by)/i);
  if (dim) {
    const km = parseFloat(dim[1]);
    if (Number.isFinite(km) && km > 0) {
      return Math.max(15, Math.min(200, km * 0.65));
    }
  }
  return 15;
}

/** Ponds and creeks are minor waters — they only claim catches that are
 *  genuinely right at them, never a great lake's shoreline catch. */
function isMinorWater(name: string): boolean {
  return /\b(pond|creek)\b/i.test(name);
}

/** Catches tab — three top tabs: My catches, Friends, and All (every catch
 *  shared with you, grouped by lake with lake headers). */
export default function CatchesTab({
  mine,
  nearby,
  allCatches,
  loading,
  scope,
  onScopeChange,
  onSelect,
  myLoc,
  showOnMap,
  onShowOnMapChange,
}: CatchesTabProps) {
  const [lakes, setLakes] = useState<LakeCoord[]>([]);
  // How the catches lists are grouped: by lake or by fish type.
  const [groupMode, setGroupMode] = useState<"lake" | "species">(() => {
    try {
      return localStorage.getItem("fishmb-catches-group") === "species" ? "species" : "lake";
    } catch {
      return "lake";
    }
  });
  const changeGroupMode = (m: "lake" | "species") => {
    setGroupMode(m);
    try {
      localStorage.setItem("fishmb-catches-group", m);
    } catch {
      // Best effort.
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [coordsRes, metaRes] = await Promise.all([
          fetch("/fishmb/lake-coords.json"),
          fetch("/fish-manitoba/data.json"),
        ]);
        const coords = (await coordsRes.json()) as Record<string, { lat: number; lng: number }>;
        const meta = (await metaRes.json()) as {
          lakes?: { id: string; name: string; size_text?: string }[];
        };
        const nameById = new Map((meta.lakes ?? []).map((l) => [l.id, l.name]));
        const reachById = new Map((meta.lakes ?? []).map((l) => [l.id, lakeReachKm(l.size_text)]));
        setLakes(
          Object.entries(coords)
            .filter(([, c]) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
            .map(([id, c]) => ({
              id,
              name: nameById.get(id) ?? id,
              lat: c.lat,
              lng: c.lng,
              reach: reachById.get(id) ?? 15,
            }))
        );
      } catch {
        // Lake grouping stays off.
      }
    })();
  }, []);

  const friends = allCatches.filter((c) => c.friend);
  const all: MapCatch[] = [];
  {
    const seen = new Set<string>();
    for (const c of [...mine, ...allCatches]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      all.push(c);
    }
  }
  const list = scope === "mine" ? mine : scope === "friends" ? friends : all;

  // Group a list by lake, lakes sorted A–Z. Assignment is tiered:
  //  1. the nearest water within 15 km — unless it's a pond/creek and a
  //     great lake's territory covers the point (a harbour catch on Lake
  //     Winnipeg is not a "Gull Pond" catch);
  //  2. a great lake (reach ≥ 40 km) whose territory covers the point;
  //  3. the nearest proper lake within 25 km (river-chain lakes);
  //  otherwise the catch stays in "Other waters".
  const groupByLake = (items: MapCatch[]) => {
    const lakeFor = (c: MapCatch): LakeCoord | null => {
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || lakes.length === 0) return null;
      const dists = lakes.map((l) => ({ l, d: kmBetween(c.lat, c.lng, l.lat, l.lng) }));
      // Great lakes (reach ≥ 40 km) whose territory covers the point; the
      // nearest qualifying one wins.
      const greatClaim = (): LakeCoord | null => {
        let best: LakeCoord | null = null;
        let bestD = Infinity;
        for (const { l, d } of dists) {
          if (l.reach < 40) continue;
          if (d <= l.reach * 0.95 && d < bestD) {
            bestD = d;
            best = l;
          }
        }
        return best;
      };
      let nearest: LakeCoord | null = null;
      let nearestD = Infinity;
      let nearestProper: LakeCoord | null = null;
      let nearestProperD = Infinity;
      for (const { l, d } of dists) {
        if (d < nearestD) {
          nearestD = d;
          nearest = l;
        }
        if (!isMinorWater(l.name) && d < nearestProperD) {
          nearestProperD = d;
          nearestProper = l;
        }
      }
      if (nearest && nearestD <= 15) {
        if (isMinorWater(nearest.name)) {
          // A pond/creek point beside real water: prefer a proper lake
          // right there, else a great lake whose shore this is.
          if (nearestProper && nearestProperD <= 15) return nearestProper;
          const g = greatClaim();
          if (g) return g;
        }
        return nearest;
      }
      const g = greatClaim();
      if (g) return g;
      return nearestProper && nearestProperD <= 25 ? nearestProper : null;
    };
    const groupById = new Map<string, { lake: LakeCoord | null; catches: MapCatch[] }>();
    const groups: { lake: LakeCoord | null; catches: MapCatch[] }[] = [];
    const sorted = [...items].sort(
      (a, b) => new Date(b.caught_at).getTime() - new Date(a.caught_at).getTime()
    );
    for (const c of sorted) {
      const lake = lakeFor(c);
      const key = lake ? lake.id : "__other";
      let g = groupById.get(key);
      if (!g) {
        g = { lake, catches: [] };
        groupById.set(key, g);
        groups.push(g);
      }
      g.catches.push(c);
    }
    groups.sort((a, b) => {
      if (!a.lake) return 1;
      if (!b.lake) return -1;
      return a.lake.name.localeCompare(b.lake.name);
    });
    return groups;
  };

  // Group by fish type (species A–Z), newest first within each group.
  const groupBySpecies = (items: MapCatch[]) => {
    const groupById = new Map<string, { title: string; catches: MapCatch[] }>();
    const sorted = [...items].sort(
      (a, b) => new Date(b.caught_at).getTime() - new Date(a.caught_at).getTime()
    );
    for (const c of sorted) {
      const title = (c.species || "Fish").trim() || "Fish";
      const key = title.toLowerCase();
      let g = groupById.get(key);
      if (!g) {
        g = { title, catches: [] };
        groupById.set(key, g);
      }
      g.catches.push(c);
    }
    return [...groupById.values()].sort((a, b) => a.title.localeCompare(b.title));
  };

  const renderGroups = (groups: { key: string; title: string; catches: MapCatch[] }[]) => (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2 px-1">
            {g.title} <span className="text-pine/30">({g.catches.length})</span>
          </h3>
          <div className="space-y-2">
            {g.catches.map((c) => (
              <CatchRow key={c.id} c={c} myLoc={myLoc} onSelect={() => onSelect(c)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderList = () => {
    if (groupMode === "species") {
      return renderGroups(
        groupBySpecies(list).map((g) => ({
          key: `sp:${g.title.toLowerCase()}`,
          title: g.title,
          catches: g.catches,
        }))
      );
    }
    // Lake mode — flat list only until the lake data loads.
    if (lakes.length === 0) {
      return (
        <div className="space-y-2">
          {list.map((c) => (
            <CatchRow key={c.id} c={c} myLoc={myLoc} onSelect={() => onSelect(c)} />
          ))}
        </div>
      );
    }
    return renderGroups(
      groupByLake(list).map((g) => ({
        key: g.lake ? g.lake.id : "__other",
        title: g.lake ? g.lake.name : "Other waters",
        catches: g.catches,
      }))
    );
  };

  const emptyTitle =
    scope === "mine"
      ? "No GPS catches yet"
      : scope === "friends"
        ? "No friends' catches near here yet"
        : "No catches shared with you here yet";
  const emptyBody =
    scope === "mine"
      ? "Log a catch with your location saved and it'll show up on your map."
      : scope === "friends"
        ? "When your friends share a catch with friends, it shows up here."
        : "Pan the map — catches shared by you, your friends and other anglers appear here, grouped by lake.";

  return (
    <div className="pt-1">
      <div className="flex bg-pine/5 rounded-full p-1 mb-3">
        {(
          [
            { id: "mine", label: `My catches (${mine.length})` },
            { id: "friends", label: `Friends (${friends.length})` },
            { id: "all", label: `All (${all.length})` },
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
      {/* Grouping: by lake or by fish type */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-xs font-black uppercase tracking-wider text-pine/45">
          Group by
        </span>
        <div className="flex bg-pine/5 rounded-full p-0.5">
          {(
            [
              { id: "lake", label: "🏞 Lake" },
              { id: "species", label: "🐟 Fish type" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => changeGroupMode(m.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                groupMode === m.id ? "bg-white text-pine shadow" : "text-pine/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onShowOnMapChange(!showOnMap)}
        className="w-full flex items-center justify-between py-2 px-1 mb-2"
      >
        <span className="text-sm font-bold text-pine">Show on map</span>
        <span
          className={`w-11 h-6 rounded-full p-1 transition-colors ${
            showOnMap ? "bg-signal" : "bg-pine/15"
          }`}
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
              showOnMap ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-pine/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-10">
          <p className="font-bold text-pine">{emptyTitle}</p>
          <p className="text-pine/55 text-sm mt-1 max-w-xs mx-auto">{emptyBody}</p>
        </div>
      ) : (
        renderList()
      )}
      {scope !== "mine" && list.length > 0 && (
        <p className="text-center text-pine/40 text-[11px] mt-3">
          {scope === "friends"
            ? "Catches your friends shared with friends or everyone."
            : "Every catch shared with you — yours, your friends' and public catches."}
        </p>
      )}
    </div>
  );
}
