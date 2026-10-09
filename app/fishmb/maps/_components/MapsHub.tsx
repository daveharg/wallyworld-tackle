"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  BasemapId,
  CatchPin,
  SpotPin,
  TrailPoint,
} from "../../profile/_components/SpotMap";
import { fishFetch } from "../../_components/fishFetch";
import { SPOT_ICON_CHOICES } from "../../profile/_components/spotIcons";
import {
  haversineM,
  bearingDeg,
  compassLabel,
  formatDist,
} from "../../profile/_components/geo";
import MapSheet, { type SheetTab } from "./MapSheet";
import CatchesTab from "./CatchesTab";
import SpotsTab, { type Spot } from "./SpotsTab";
import LakesTab from "./LakesTab";
import SettingsTab from "./SettingsTab";
import MapSearch from "./MapSearch";
import WindWidget from "./WindWidget";
import type { MapCatch, SavedLake } from "./types";

const SpotMap = dynamic(
  () => import("../../profile/_components/SpotMap"),
  { ssr: false }
);

interface Trail {
  id: string;
  name: string;
  points: TrailPoint[];
  distance_m: number;
}

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

/**
 * Maps hub — fullscreen map of your current location with a peeking bottom
 * sheet (Catches / Saved spots / Settings). Swipe up to expand, down to peek.
 */
export default function MapsHub() {
  const searchParams = useSearchParams();

  // Sheet
  const [tab, setTab] = useState<SheetTab>("catches");
  const [expanded, setExpanded] = useState(false);

  // Map state
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; speed: number | null } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 53.5, lng: -96.5 });
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string; zoom?: number } | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("streets");
  const [windOn, setWindOn] = useState(false);
  const centeredOnGps = useRef(false);
  const urlPlaced = useRef(false);

  // Spots: picking + quick add
  const [picking, setPicking] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ lat: number; lng: number } | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [quickIcon, setQuickIcon] = useState("pin");
  const [quickSaving, setQuickSaving] = useState(false);
  const [sharedSpot, setSharedSpot] = useState<SpotPin | null>(null);

  // Trails + navigation
  const [trails, setTrails] = useState<Trail[]>([]);
  const [overlayTrailId, setOverlayTrailId] = useState("");
  const [goTo, setGoTo] = useState<Spot | null>(null);

  // Catches
  const [catchScope, setCatchScope] = useState<"mine" | "nearby">("mine");
  const [myCatches, setMyCatches] = useState<MapCatch[]>([]);
  const [nearbyCatches, setNearbyCatches] = useState<MapCatch[]>([]);
  const [catchesLoading, setCatchesLoading] = useState(true);

  // Spot sharing
  const [sharingId, setSharingId] = useState<string | null>(null);

  // ---- data loading ----
  useEffect(() => {
    (async () => {
      try {
        const d = await fishFetch("/api/fishmb/spots");
        setSpots((d.spots ?? []) as Spot[]);
      } catch {
        // Map shows the friendly empty state.
      } finally {
        setLoading(false);
      }
    })();
    loadTrails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrails = async () => {
    try {
      const d = await fishFetch("/api/fishmb/trails");
      setTrails((d.trails ?? []) as Trail[]);
    } catch {
      // Trails stay empty.
    }
  };

  // Live GPS — the map opens on your current location (unless a URL
  // deep-link already placed it).
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
        };
        setMyLoc(loc);
        if (!centeredOnGps.current && !urlPlaced.current) {
          centeredOnGps.current = true;
          setFocus({ lat: loc.lat, lng: loc.lng, key: `gps:init`, zoom: 11 });
          setMapCenter({ lat: loc.lat, lng: loc.lng });
        }
      },
      () => {
        // Permission denied — map stays where it is.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Manual "find me" — single-shot GPS fix that flies the map to you.
  // (Covers denied-then-granted permission and slow first fixes.)
  const [locating, setLocating] = useState(false);
  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setNote("Your device doesn't support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLoc((prev) => ({ ...loc, speed: prev?.speed ?? null }));
        setMapCenter(loc);
        setFocus({ lat: loc.lat, lng: loc.lng, key: `gps:manual:${Date.now()}`, zoom: 12 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNote("Couldn't get your location — check permission in Settings.");
        setTimeout(() => setNote(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Deep link from a shared spot in the feed: ?spot=lat,lng&name=…
  // Also supports ?lat=&lng=&z= for "open large map" links (e.g. lake pages).
  useEffect(() => {
    const raw = searchParams.get("spot");
    if (raw) {
      const [la, ln] = raw.split(",").map(Number);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
      const name = searchParams.get("name") || "Shared spot";
      const pin: SpotPin = {
        id: `shared:${la},${ln}`,
        name,
        lat: la,
        lng: ln,
        notes: "Shared from the feed",
        icon: "pin",
        created_at: new Date().toISOString(),
      };
      setSharedSpot(pin);
      urlPlaced.current = true;
      setFocus({ lat: la, lng: ln, key: pin.id, zoom: 15 });
      return;
    }
    const qLat = Number(searchParams.get("lat"));
    const qLng = Number(searchParams.get("lng"));
    if (Number.isFinite(qLat) && Number.isFinite(qLng)) {
      const qZoom = Math.min(Math.max(Number(searchParams.get("z")) || 11, 3), 18);
      urlPlaced.current = true;
      setFocus({ lat: qLat, lng: qLng, key: `url:${qLat},${qLng}`, zoom: qZoom });
      setMapCenter({ lat: qLat, lng: qLng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- catches ----
  const loadMyCatches = async (lat: number, lng: number) => {
    try {
      const d = await fishFetch(
        `/api/fishmb/map-catches?lat=${lat}&lng=${lng}&radius_km=500&mine=1`
      );
      setMyCatches((d.catches ?? []) as MapCatch[]);
    } catch {
      // Catches stay empty.
    }
  };

  const loadNearbyCatches = async (lat: number, lng: number) => {
    try {
      const d = await fishFetch(
        `/api/fishmb/map-catches?lat=${lat}&lng=${lng}&radius_km=40`
      );
      setNearbyCatches(
        ((d.catches ?? []) as MapCatch[]).filter((c) => !c.mine)
      );
    } catch {
      // Catches stay empty.
    }
  };

  // Initial catch load once we have a location (GPS or default).
  const catchesInit = useRef(false);
  useEffect(() => {
    if (catchesInit.current) return;
    catchesInit.current = true;
    (async () => {
      const c = mapCenter;
      await Promise.all([loadMyCatches(c.lat, c.lng), loadNearbyCatches(c.lat, c.lng)]);
      setCatchesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload catches around the real GPS position once it locks.
  const gpsCatchesLoaded = useRef(false);
  useEffect(() => {
    if (!myLoc || gpsCatchesLoaded.current) return;
    gpsCatchesLoaded.current = true;
    (async () => {
      setCatchesLoading(true);
      await Promise.all([
        loadMyCatches(myLoc.lat, myLoc.lng),
        loadNearbyCatches(myLoc.lat, myLoc.lng),
      ]);
      setCatchesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLoc]);

  // Refresh nearby catches as the map moves (debounced).
  const nearbyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoveEnd = (center: { lat: number; lng: number }) => {
    setMapCenter(center);
    if (nearbyTimer.current) clearTimeout(nearbyTimer.current);
    nearbyTimer.current = setTimeout(() => loadNearbyCatches(center.lat, center.lng), 800);
  };

  const catchPins: CatchPin[] = (catchScope === "mine" ? myCatches : nearbyCatches).map(
    (c) => ({
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      species: c.species,
      length_in: c.length_in,
      mine: c.mine,
    })
  );

  const flyTo = (lat: number, lng: number, key: string, zoom = 13) => {
    setFocus({ lat, lng, key: `${key}:${Date.now()}`, zoom });
    setExpanded(false);
  };

  // ---- spot CRUD ----
  const onMapLongPress = (lat: number, lng: number) => {
    setPicking(false);
    setQuickName("");
    setQuickNotes("");
    setQuickIcon("pin");
    setQuickAdd({ lat, lng });
  };

  const saveQuickAdd = async () => {
    if (!quickAdd || quickSaving) return;
    setQuickSaving(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickName.trim() || "Fishing spot",
          notes: quickNotes.trim() || null,
          lat: quickAdd.lat,
          lng: quickAdd.lng,
          icon: quickIcon,
        }),
      });
      setSpots([(d.spot as Spot), ...spots]);
      setQuickAdd(null);
      setQuickName("");
      setQuickNotes("");
      setQuickIcon("pin");
 setNote("Spot saved! ");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the spot.");
    } finally {
      setQuickSaving(false);
    }
  };

  const editSpot = async (
    id: string,
    patch: { name: string; notes: string | null; icon: string }
  ) => {
    try {
      const d = await fishFetch(`/api/fishmb/spots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSpots(spots.map((s) => (s.id === id ? (d.spot as Spot) : s)));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save changes.");
      throw e;
    }
  };

  const removeSpot = async (id: string) => {
    if (!window.confirm("Delete this spot?")) return;
    try {
      await fishFetch(`/api/fishmb/spots/${id}`, { method: "DELETE" });
      setSpots(spots.filter((s) => s.id !== id));
      if (goTo?.id === id) setGoTo(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the spot.");
    }
  };

  const shareSpot = async (id: string) => {
    if (
      !window.confirm(
        "Share this spot with your friends on the feed? They\u2019ll see its location."
      )
    )
      return;
    setSharingId(id);
    try {
      await fishFetch(`/api/fishmb/spots/${id}/share`, { method: "POST" });
 setNote("Spot shared to the feed! ");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not share the spot.");
    } finally {
      setSharingId(null);
    }
  };

  const deleteTrail = async (id: string) => {
    if (!window.confirm("Delete this trail?")) return;
    try {
      await fishFetch(`/api/fishmb/trails/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setTrails(trails.filter((t) => t.id !== id));
      if (overlayTrailId === id) setOverlayTrailId("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the trail.");
    }
  };

  const flyToLake = (lake: SavedLake) => {
    if (lake.lat === null || lake.lng === null) {
      setNote("No map coordinates for that lake yet.");
      return;
    }
    flyTo(lake.lat, lake.lng, `lake:${lake.id}`, 11);
  };

  return (
    <div className="fixed inset-0 top-0 md:top-16 bottom-0 overflow-hidden bg-paper">
      <div className="absolute inset-0">
        {/* Its own Suspense boundary so a slow map chunk never blanks the sheet */}
        <Suspense
          fallback={<div className="absolute inset-0 bg-pine/5 animate-pulse" />}
        >
          <SpotMap
            fill
            spots={sharedSpot ? [...spots, sharedSpot] : spots}
            picking={picking}
            onPick={(lat, lng) => {
              setPicking(false);
              onMapLongPress(lat, lng);
            }}
            onLongPress={onMapLongPress}
            focus={focus}
            myLoc={myLoc}
            overlayTrail={
              overlayTrailId
                ? (trails.find((t) => t.id === overlayTrailId)?.points ?? null)
                : null
            }
            goTo={goTo ? { lat: Number(goTo.lat), lng: Number(goTo.lng) } : null}
            onTrailSaved={loadTrails}
            catchPins={catchPins}
            basemap={basemap}
            onMoveEnd={onMoveEnd}
          />
        </Suspense>
        {loading && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="bg-white/90 rounded-full px-5 py-2.5 shadow-lg text-sm font-bold text-pine flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-pine/30 border-t-pine rounded-full animate-spin" />
              Loading map…
            </div>
          </div>
        )}
      </div>

      {/* Wind overlay */}
      {windOn && <WindWidget lat={mapCenter.lat} lng={mapCenter.lng} />}

      {/* Lake / town / city search */}
      <MapSearch
        onSelect={(lat, lng, label) => {
          setMapCenter({ lat, lng });
          setFocus({ lat, lng, key: `search:${label}:${Date.now()}`, zoom: 11 });
          setNote(`Showing ${label}`);
          setTimeout(() => setNote(null), 2500);
        }}
      />

      {/* Manual locate button */}
      <button
        type="button"
        onClick={locateMe}
        aria-label="Center on my location"
        title="Center on my location"
        className="absolute top-14 right-3 z-20 w-11 h-11 rounded-full bg-white/95 backdrop-blur border border-pine/15 shadow-lg text-pine text-xl flex items-center justify-center active:scale-95 transition-transform"
      >
        {locating ? (
          <span className="w-5 h-5 border-2 border-pine/30 border-t-pine rounded-full animate-spin" />
        ) : (
          "◎"
        )}
      </button>

      {/* Map settings — opens the sheet's Settings tab */}
      <button
        type="button"
        onClick={() => {
          setTab("settings");
          setExpanded(true);
        }}
        aria-label="Map settings"
        title="Map settings"
        className="absolute top-[7.5rem] right-3 z-20 w-11 h-11 rounded-full bg-white/95 backdrop-blur border border-pine/15 shadow-lg text-pine flex items-center justify-center active:scale-95 transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Picking banner */}
      {picking && (
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-pine-deep/90 text-white text-xs font-bold rounded-full px-4 py-2.5 shadow-lg whitespace-nowrap"
        >
          Tap the map to drop your pin · tap here to cancel
        </button>
      )}

      {/* Go-to navigation bar */}
      {goTo && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-3 bg-pine text-white rounded-2xl px-4 py-3 shadow-xl">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{goTo.name || "Fishing spot"}</p>
            <p className="text-xs text-white/70 tabular-nums">
              {myLoc
                ? `${formatDist(
                    haversineM(myLoc.lat, myLoc.lng, Number(goTo.lat), Number(goTo.lng))
                  )} · ${compassLabel(
                    bearingDeg(myLoc.lat, myLoc.lng, Number(goTo.lat), Number(goTo.lng))
                  )}`
                : "Waiting for GPS…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGoTo(null)}
            aria-label="Stop navigating"
            className="text-white/70 hover:text-white font-black px-1"
          >
 
          </button>
        </div>
      )}

      {/* Toast */}
      {note && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 max-w-[90vw]">
          <p className="text-sm text-signal-dark bg-white border border-signal/30 rounded-2xl px-4 py-2.5 shadow-xl whitespace-nowrap overflow-hidden text-ellipsis">
            {note}
            <button
              type="button"
              onClick={() => setNote(null)}
              className="ml-3 font-black text-pine/40"
              aria-label="Dismiss"
            >
 
            </button>
          </p>
        </div>
      )}

      {/* Bottom sheet */}
      <MapSheet
        tab={tab}
        onTabChange={setTab}
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        {tab === "catches" && (
          <CatchesTab
            mine={myCatches}
            nearby={nearbyCatches}
            loading={catchesLoading}
            scope={catchScope}
            onScopeChange={setCatchScope}
            onSelect={(c) => flyTo(c.lat, c.lng, `catch:${c.id}`, 14)}
            myLoc={myLoc}
          />
        )}
        {tab === "spots" && (
          <SpotsTab
            spots={spots}
            myLoc={myLoc}
            onSelect={(s) => flyTo(Number(s.lat), Number(s.lng), `spot:${s.id}`, 15)}
            onNavigate={(s) => {
              setGoTo(s);
              flyTo(Number(s.lat), Number(s.lng), `spot:${s.id}`, 15);
            }}
            onEdit={editSpot}
            onDelete={removeSpot}
            onShare={shareSpot}
            sharingId={sharingId}
            onAddSpot={() => {
              setExpanded(false);
              setPicking(true);
 setNote("Tap the map to drop your pin ");
              setTimeout(() => setNote(null), 3500);
            }}
          />
        )}
        {tab === "lakes" && <LakesTab onFlyToLake={flyToLake} />}
        {tab === "settings" && (
          <SettingsTab
            basemap={basemap}
            onBasemapChange={setBasemap}
            windOn={windOn}
            onWindChange={setWindOn}
            trails={trails}
            overlayTrailId={overlayTrailId}
            onOverlayTrail={setOverlayTrailId}
            onDeleteTrail={deleteTrail}
            onTrailsChanged={loadTrails}
            onFlyToLake={flyToLake}
          />
        )}
      </MapSheet>

      {/* Quick-add modal after a map long-press / tap-to-drop */}
      {quickAdd && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-pine-deep/60 backdrop-blur-sm"
          onClick={() => setQuickAdd(null)}
        >
          <div
            className="bg-paper rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
 Mark this spot
            </h3>
            <p className="text-pine/50 text-xs mb-4 tabular-nums">
              {quickAdd.lat.toFixed(5)}, {quickAdd.lng.toFixed(5)}
            </p>
            <input
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              maxLength={80}
              placeholder="Spot name (e.g. North point)"
              className={inputCls}
              autoFocus
            />
            <input
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              maxLength={500}
              placeholder="Notes (optional)"
              className={`${inputCls} mt-2`}
            />
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-pine/55 mb-2">
                Spot icon
              </p>
              <div className="flex gap-2">
                {SPOT_ICON_CHOICES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQuickIcon(c.id)}
                    title={c.label}
                    aria-label={`Spot icon: ${c.label}`}
                    className={`w-11 h-11 rounded-2xl border-2 text-xl flex items-center justify-center transition-colors ${
                      quickIcon === c.id
                        ? "border-signal bg-signal/10"
                        : "border-pine/15 bg-white hover:border-pine/30"
                    }`}
                  >
                    {c.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setQuickAdd(null)}
                className="flex-1 bg-pine/10 hover:bg-pine/20 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveQuickAdd}
                disabled={quickSaving}
                className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full disabled:opacity-50 transition-colors"
              >
                {quickSaving ? "Saving…" : "Save spot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
