"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { GpxImport } from "../../profile/_components/GpxImport";
import LakeNotes from "../../dashboard/_components/LakeNotes";
import { formatDist } from "../../profile/_components/geo";
import type { BasemapId } from "../../profile/_components/SpotMap";
import type { SavedLake } from "./types";

interface Trail {
  id: string;
  name: string;
  distance_m: number;
}

interface SettingsTabProps {
  basemap: BasemapId;
  onBasemapChange: (b: BasemapId) => void;
  windOn: boolean;
  onWindChange: (v: boolean) => void;
  trails: Trail[];
  overlayTrailId: string;
  onOverlayTrail: (id: string) => void;
  onDeleteTrail: (id: string) => void;
  onTrailsChanged: () => void;
  onFlyToLake: (lake: SavedLake) => void;
}

function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-pine/10 rounded-3xl p-5">
      <h3 className="font-display font-bold uppercase text-pine text-base tracking-wide mb-1">
        {icon} {title}
      </h3>
      {sub && <p className="text-pine/55 text-xs mb-3">{sub}</p>}
      {children}
    </section>
  );
}

/** Settings tab — map options, saved lakes, lake notes, trails, Garmin import. */
export default function SettingsTab({
  basemap,
  onBasemapChange,
  windOn,
  onWindChange,
  trails,
  overlayTrailId,
  onOverlayTrail,
  onDeleteTrail,
  onTrailsChanged,
  onFlyToLake,
}: SettingsTabProps) {
  // Saved lakes
  const [favs, setFavs] = useState<SavedLake[]>([]);
  const [allLakes, setAllLakes] = useState<{ id: string; name: string; region?: string }[]>([]);
  const [addLakeId, setAddLakeId] = useState("");
  const [addingLake, setAddingLake] = useState(false);
  const [selectedFav, setSelectedFav] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const f = await fishFetch("/api/fishmb/favorite-lakes");
        setFavs((f.lakes ?? []) as SavedLake[]);
      } catch {
        // Favorites stay empty.
      }
      try {
        const r = await fetch("/fish-manitoba/data.json");
        const d = await r.json();
        setAllLakes(
          ((d.lakes ?? []) as { id: string; name: string; region?: string }[])
            .map((l) => ({ id: l.id, name: l.name, region: l.region }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch {
        setAllLakes([]);
      }
    })();
  }, []);

  const favIds = new Set(favs.map((f) => f.id));

  const addFavLake = async () => {
    if (!addLakeId || addingLake || favIds.has(addLakeId)) return;
    setAddingLake(true);
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: addLakeId }),
      });
      const f = await fishFetch("/api/fishmb/favorite-lakes");
      setFavs((f.lakes ?? []) as SavedLake[]);
      setAddLakeId("");
      setSelectedFav("");
    } finally {
      setAddingLake(false);
    }
  };

  const removeFav = async (lakeId: string) => {
    try {
      await fishFetch(`/api/fishmb/favorite-lakes/${encodeURIComponent(lakeId)}`, {
        method: "DELETE",
      });
      setFavs(favs.filter((f) => f.id !== lakeId));
      if (selectedFav === lakeId) setSelectedFav("");
    } catch {
      // non-fatal
    }
  };

  const chooseFav = (lakeId: string) => {
    const f = favs.find((x) => x.id === lakeId);
    if (!f || f.lat === null || f.lng === null) return;
    setSelectedFav(lakeId);
    onFlyToLake(f);
  };

  return (
    <div className="pt-1 space-y-4">
 <Section icon="" title="Map options" sub="Tune the map to how you fish.">
        <button
          type="button"
          onClick={() => onWindChange(!windOn)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3 mb-3"
        >
          <span className="text-sm font-bold text-pine">Wind overlay</span>
          <span
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              windOn ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                windOn ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-pine/45 -mt-1 mb-3">
          Shows live wind speed and direction at the centre of your map.
        </p>
        <div className="flex bg-pine/5 rounded-full p-1 mb-3">
          {(
            [
 { id: "streets", label: " Streets" },
 { id: "satellite", label: " Satellite" },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBasemapChange(b.id)}
              className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${
                basemap === b.id ? "bg-white text-pine shadow" : "text-pine/50"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Section>

 <Section icon="" title="Saved lakes" sub="Jump the map straight to a saved lake.">
        <select
          value={selectedFav}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedFav(v);
            if (v && v !== "__add__") chooseFav(v);
          }}
          aria-label="Choose a saved lake"
          className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
        >
          <option value="">
            {favs.length === 0 ? "No saved lakes yet…" : "Choose a saved lake…"}
          </option>
          {favs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
          <option value="__add__">Add a new lake…</option>
        </select>
        {selectedFav && selectedFav !== "__add__" && (
          <button
            type="button"
            onClick={() => removeFav(selectedFav)}
            className="mt-2 w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-2.5 text-signal-dark text-xs font-bold uppercase tracking-wider"
          >
 Remove this lake
          </button>
        )}
        {selectedFav === "__add__" && (
          <div className="mt-2">
            <select
              value={addLakeId}
              onChange={(e) => setAddLakeId(e.target.value)}
              aria-label="Choose a lake to save"
              className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
            >
              <option value="">Pick a lake…</option>
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
              onClick={addFavLake}
              disabled={!addLakeId || addingLake}
              className="mt-2 w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-2xl disabled:opacity-40 transition-colors"
            >
 {addingLake ? "Adding…" : " Add this lake"}
            </button>
          </div>
        )}
      </Section>

 <Section icon="" title="Lake notes" sub="Your private notebook — depths, structure, what's biting.">
        <LakeNotes />
      </Section>

 <Section icon="" title="My trails" sub="Overlay a recorded boat route to retrace it.">
        {trails.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={overlayTrailId}
              onChange={(e) => onOverlayTrail(e.target.value)}
              aria-label="Choose a trail to overlay"
              className="flex-1 min-w-0 bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
            >
              <option value="">No trail overlay</option>
              {trails.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {formatDist(t.distance_m)}
                </option>
              ))}
            </select>
            {overlayTrailId && (
              <button
                type="button"
                onClick={() => onDeleteTrail(overlayTrailId)}
                aria-label="Delete the selected trail"
                className="shrink-0 bg-paper-deep border border-pine/15 rounded-2xl px-4 text-pine/50 hover:text-signal-dark text-sm font-bold"
              >
 
              </button>
            )}
          </div>
        ) : (
          <p className="text-pine/40 text-xs">
            No trails yet — tap <strong>⏺ Record</strong> under the map while boating.
          </p>
        )}
      </Section>

 <Section icon="" title="Garmin import" sub="Bring in tracks and waypoints from your Garmin.">
        <GpxImport onImported={onTrailsChanged} />
      </Section>
    </div>
  );
}
