"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { GpxImport } from "../../profile/_components/GpxImport";
import LakeNotes from "../../dashboard/_components/LakeNotes";
import { formatDist } from "../../profile/_components/geo";
import type { BasemapId } from "../../profile/_components/SpotMap";
import { SPOT_ICON_CHOICES } from "../../profile/_components/spotIcons";
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
  speedOn: boolean;
  onSpeedChange: (v: boolean) => void;
  tempOn: boolean;
  onTempChange: (v: boolean) => void;
  biteOn: boolean;
  onBiteChange: (v: boolean) => void;
  showPublicCatches: boolean;
  onShowPublicCatchesChange: (v: boolean) => void;
  followDot: string;
  onFollowDotChange: (id: string) => void;
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
  speedOn,
  onSpeedChange,
  tempOn,
  onTempChange,
  biteOn,
  onBiteChange,
  showPublicCatches,
  onShowPublicCatchesChange,
  followDot,
  onFollowDotChange,
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
  const [showContoursSoon, setShowContoursSoon] = useState(false);

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
      {/* Map overlay — very first thing, no header */}
      <div>
        <div className="flex bg-pine/5 rounded-full p-1">
          {(
            [
              { id: "satellite", label: "Satellite" },
              { id: "streets", label: "Streets" },
              { id: "contours", label: "Contours" },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                if (b.id === "contours") {
                  setShowContoursSoon(true);
                } else {
                  onBasemapChange(b.id);
                }
              }}
              className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${
                basemap === b.id ? "bg-white text-pine shadow" : "text-pine/50"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        {showContoursSoon && (
          <p className="text-[11px] text-pine/55 mt-2 bg-pine/5 rounded-2xl px-4 py-3">
            Depth contours are coming with the FishMB mobile app (Garmin
            Navionics). Your spots will work on both views.
          </p>
        )}
      </div>
      <Section icon="" title="Catches on map" sub="Show public catches from other anglers as pins on the map.">
        <button
          type="button"
          onClick={() => onShowPublicCatchesChange(!showPublicCatches)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3"
        >
          <span className="text-sm font-bold text-pine">Show others' catches</span>
          <span
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              showPublicCatches ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                showPublicCatches ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-pine/45 mt-2">
          Pins every public catch on the map so you can see where other anglers are landing fish.
        </p>
      </Section>
      <Section icon="" title="Widgets" sub="Floating boxes you can drag anywhere on the map.">
        <button
          type="button"
          onClick={() => onWindChange(!windOn)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3 mt-3"
        >
          <span className="text-sm font-bold text-pine">Wind widget</span>
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
        <p className="text-[11px] text-pine/45 mt-2">
          Live wind speed and direction — drag it anywhere on the map.
        </p>
        <button
          type="button"
          onClick={() => onSpeedChange(!speedOn)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3 mt-3"
        >
          <span className="text-sm font-bold text-pine">Speed widget</span>
          <span
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              speedOn ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                speedOn ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-pine/45 mt-2">
          Floating speedometer — drag it anywhere on the map.
        </p>
        <button
          type="button"
          onClick={() => onTempChange(!tempOn)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3 mt-3"
        >
          <span className="text-sm font-bold text-pine">Temp widget</span>
          <span
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              tempOn ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                tempOn ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-pine/45 mt-2">
          Current temperature at your location — drag it anywhere on the map.
        </p>
        <button
          type="button"
          onClick={() => onBiteChange(!biteOn)}
          className="w-full flex items-center justify-between bg-pine/5 rounded-2xl px-4 py-3 mt-3"
        >
          <span className="text-sm font-bold text-pine">Bite prediction widget</span>
          <span
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              biteOn ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                biteOn ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        <p className="text-[11px] text-pine/45 mt-2">
          Live bite rating from barometric pressure — drag it anywhere on the map.
        </p>
        <p className="text-sm font-bold text-pine mt-4 mb-2">Follow-me dot</p>
        <div className="flex flex-wrap gap-2">
          {SPOT_ICON_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onFollowDotChange(c.id)}
              aria-label={`Follow-me dot: ${c.label}`}
              title={c.label}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl border-2 transition-colors ${
                followDot === c.id ? "border-signal bg-signal/10" : "border-transparent bg-pine/5"
              }`}
            >
              {c.id === "boat" ? (
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden>
                  <path d="M14 1 C18 6, 21 12, 21 18 C21 23, 18 26, 14 26 C10 26, 7 23, 7 18 C7 12, 10 6, 14 1 Z" fill="#1d4d2b" stroke="white" strokeWidth="1.5"/>
                  <rect x="11" y="12" width="6" height="8" rx="1.5" fill="white" opacity="0.9"/>
                </svg>
              ) : (
                c.emoji
              )}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-pine/45 mt-2">
          The marker that shows your location on the map.
        </p>
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
