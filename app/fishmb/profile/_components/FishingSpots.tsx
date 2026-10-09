"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { fishFetch } from "../../_components/fishFetch";
import { GpxImport } from "./GpxImport";
import type { SpotPin, TrailPoint } from "./SpotMap";
import { SPOT_ICON_CHOICES } from "./spotIcons";
import { haversineM, bearingDeg, compassLabel, formatDist } from "./geo";

const SpotMap = dynamic(() => import("./SpotMap"), { ssr: false });

interface Spot extends SpotPin {
  user_id: string;
  catch_id: string | null;
}

interface FavLake {
  id: string;
  name: string;
  region?: string;
  lat: number | null;
  lng: number | null;
}

interface Trail {
  id: string;
  name: string;
  points: TrailPoint[];
  distance_m: number;
}

function spotEmoji(icon: string | null | undefined): string {
  return SPOT_ICON_CHOICES.find((c) => c.id === icon)?.emoji ?? "📍";
}

/** Row of icon choices for a spot (pin / fish / rock / weeds). */
function IconPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-2">
      {SPOT_ICON_CHOICES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          title={c.label}
          aria-label={`Spot icon: ${c.label}`}
          className={`w-11 h-11 rounded-2xl border-2 text-xl flex items-center justify-center transition-colors ${
            value === c.id
              ? "border-signal bg-signal/10"
              : "border-pine/15 bg-white hover:border-pine/30"
          }`}
        >
          {c.emoji}
        </button>
      ))}
    </div>
  );
}

const FAV_LAST_KEY = "fishmb-maps-last-lake";

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

/**
 * "My fishing spots" — the signed-in user's private GPS spots. Map with pins,
 * manual add (current location or tap-to-drop), rename and delete.
 * Rendered on the OWN profile only; the API is owner-scoped.
 */
export default function FishingSpots() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  // Manual-add form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLng, setManualLng] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick-add via map long-press
  const [quickAdd, setQuickAdd] = useState<{ lat: number; lng: number } | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const onMapLongPress = (lat: number, lng: number) => {
    setManualLat(lat);
    setManualLng(lng);
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
      setManualLat(null);
      setManualLng(null);
      setNote("Spot saved!");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the spot.");
    } finally {
      setQuickSaving(false);
    }
  };

  const cancelQuickAdd = () => {
    setQuickAdd(null);
    setQuickName("");
    setQuickNotes("");
    setQuickIcon("pin");
    setManualLat(null);
    setManualLng(null);
  };

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIcon, setEditIcon] = useState("pin");

  // Icon choices for the quick-add and manual-add forms
  const [quickIcon, setQuickIcon] = useState("pin");
  const [manualIcon, setManualIcon] = useState("pin");

  // Live GPS position (person marker on the map, go-to navigation)
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; speed: number | null } | null>(null);

  // Saved boat trails + overlay + go-to navigation target
  const [trails, setTrails] = useState<Trail[]>([]);
  const [overlayTrailId, setOverlayTrailId] = useState("");
  const [goTo, setGoTo] = useState<Spot | null>(null);

  // Favorite lakes + map focus
  const [favs, setFavs] = useState<FavLake[]>([]);
  const [allLakes, setAllLakes] = useState<{ id: string; name: string; region?: string }[]>([]);
  const [addLakeId, setAddLakeId] = useState("");
  const [addingLake, setAddingLake] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string; zoom?: number } | null>(null);
  const [selectedFav, setSelectedFav] = useState("");
  const autoLoadedFav = useRef(false);
  // Saved-spots dropdown selection (mirrors the saved-lakes dropdown).
  const [selectedSpotId, setSelectedSpotId] = useState("");
  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;

  const load = async () => {
    try {
      const d = await fishFetch("/api/fishmb/spots");
      setSpots((d.spots ?? []) as Spot[]);
    } catch {
      // Leave empty; map shows the friendly empty state.
    } finally {
      setLoading(false);
    }
    try {
      const f = await fishFetch("/api/fishmb/favorite-lakes");
      setFavs((f.lakes ?? []) as FavLake[]);
    } catch {
      // Favorites stay empty.
    }
  };

  useEffect(() => {
    load();
    loadTrails();
  }, []);

  // Live GPS: the person marker on the map follows you whenever the page is open.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setMyLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
        }),
      () => {
        // Permission denied or unavailable — the map simply shows no marker.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const loadTrails = async () => {
    try {
      const d = await fishFetch("/api/fishmb/trails");
      setTrails((d.trails ?? []) as Trail[]);
    } catch {
      // Trails stay empty.
    }
  };

  const deleteTrail = async (id: string) => {
    if (!window.confirm("Delete this trail?")) return;
    try {
      await fishFetch(`/api/fishmb/trails/${encodeURIComponent(id)}`, { method: "DELETE" });
      setTrails(trails.filter((t) => t.id !== id));
      if (overlayTrailId === id) setOverlayTrailId("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the trail.");
    }
  };

  // Full lake directory for the add-lake dropdown (no text search needed).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/fish-manitoba/data.json");
        const d = await r.json();
        const lakes = (d.lakes ?? [])
          .map((l: { id: string; name: string; region?: string }) => ({
            id: l.id,
            name: l.name,
            region: l.region,
          }))
          .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        setAllLakes(lakes);
      } catch {
        setAllLakes([]);
      }
    })();
  }, []);

  const favIds = new Set(favs.map((f) => f.id));

  const addFavLake = async () => {
    if (!addLakeId || addingLake) return;
    if (favIds.has(addLakeId)) {
      setAddLakeId("");
      return;
    }
    setAddingLake(true);
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: addLakeId }),
      });
      // Re-fetch so the new lake has full details (coords for map focus).
      const f = await fishFetch("/api/fishmb/favorite-lakes");
      setFavs((f.lakes ?? []) as FavLake[]);
      setAddLakeId("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the lake.");
    } finally {
      setAddingLake(false);
    }
  };

  const removeFav = async (lakeId: string) => {
    try {
      await fishFetch(`/api/fishmb/favorite-lakes/${encodeURIComponent(lakeId)}`, { method: "DELETE" });
      setFavs(favs.filter((f) => f.id !== lakeId));
      if (selectedFav === lakeId) setSelectedFav("");
      try {
        if (localStorage.getItem(FAV_LAST_KEY) === lakeId) localStorage.removeItem(FAV_LAST_KEY);
      } catch {
        // non-fatal
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not remove the lake.");
    }
  };

  const chooseFav = (lakeId: string) => {
    const f = favs.find((x) => x.id === lakeId);
    if (!f) return;
    setSelectedFav(lakeId);
    try {
      localStorage.setItem(FAV_LAST_KEY, lakeId);
    } catch {
      // non-fatal
    }
    focusOn(f.lat, f.lng, `lake:${f.id}`);
  };

  // Auto-load the last chosen saved lake when the page opens.
  useEffect(() => {
    if (autoLoadedFav.current || favs.length === 0) return;
    autoLoadedFav.current = true;
    try {
      const lastId = localStorage.getItem(FAV_LAST_KEY);
      if (!lastId) return;
      const f = favs.find((x) => x.id === lastId);
      if (f && f.lat !== null && f.lng !== null) {
        setSelectedFav(lastId);
        setFocus({ lat: f.lat, lng: f.lng, key: `lake:${f.id}:init` });
      }
    } catch {
      // non-fatal
    }
  }, [favs]);

  const focusOn = (lat: number | null, lng: number | null, key: string, zoom?: number) => {
    if (lat === null || lng === null) {
      setNote("No map coordinates for that lake yet.");
      return;
    }
    setFocus({ lat, lng, key, zoom });
    // Bring the map back into view — the spot list sits below it.
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Deep link from a shared spot in the feed: ?spot=lat,lng&name=…
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const [sharedSpot, setSharedSpot] = useState<SpotPin | null>(null);
  useEffect(() => {
    const raw = searchParams.get("spot");
    if (!raw) return;
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
    setFocus({ lat: la, lng: ln, key: pin.id, zoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setNote("Your device doesn't support location.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualLat(pos.coords.latitude);
        setManualLng(pos.coords.longitude);
        setPicking(false);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNote("Couldn't get your location — check permission.");
      },
      { timeout: 10000 }
    );
  };

  const saveManual = async () => {
    if (manualLat === null || manualLng === null || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Fishing spot",
          notes: notes.trim() || null,
          lat: manualLat,
          lng: manualLng,
          icon: manualIcon,
        }),
      });
      setSpots([(d.spot as Spot), ...spots]);
      setName("");
      setNotes("");
      setManualIcon("pin");
      setManualLat(null);
      setManualLng(null);
      setPicking(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the spot.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: Spot) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditNotes(s.notes ?? "");
    setEditIcon(s.icon ?? "pin");
  };

  const saveEdit = async (id: string) => {
    try {
      const d = await fishFetch(`/api/fishmb/spots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), notes: editNotes.trim() || null, icon: editIcon }),
      });
      setSpots(spots.map((s) => (s.id === id ? (d.spot as Spot) : s)));
      setEditingId(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save changes.");
    }
  };

  const removeSpot = async (id: string) => {
    if (!window.confirm("Delete this spot?")) return;
    try {
      await fishFetch(`/api/fishmb/spots/${id}`, { method: "DELETE" });
      setSpots(spots.filter((s) => s.id !== id));
      if (selectedSpotId === id) {
        setSelectedSpotId("");
        setEditingId(null);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the spot.");
    }
  };

  const [sharingSpot, setSharingSpot] = useState<string | null>(null);
  const shareSpot = async (id: string) => {
    if (!window.confirm("Share this spot with your friends on the feed? They\u2019ll see its location.")) return;
    setSharingSpot(id);
    try {
      await fishFetch(`/api/fishmb/spots/${id}/share`, { method: "POST" });
      setNote("Spot shared to the feed! 🎣");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not share the spot.");
    } finally {
      setSharingSpot(null);
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <section className="max-w-3xl mx-auto px-4 mt-2">
      <div className="text-center mb-5">
        <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide">
          📍 My fishing spots
        </h2>
        <p className="text-pine/60 text-sm mt-1.5 mb-4">
          Your private GPS spots — only you can see them.
        </p>
        <button
          type="button"
          onClick={() => {
            useCurrentLocation();
            document.getElementById("add-spot-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          disabled={locating}
          className="bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-8 py-3.5 rounded-full disabled:opacity-50 transition-colors shadow-lg"
        >
          {locating ? "Getting location…" : "📍 Mark my current location"}
        </button>
        <GpxImport onImported={load} />
      </div>
      {note && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 mb-4">
          {note}
        </p>
      )}

      {loading ? (
        <div className="h-64 bg-pine/10 rounded-3xl animate-pulse" />
      ) : (
        <>
          {spots.length === 0 && !picking && manualLat === null && (
            <p className="text-center text-pine/60 text-sm mb-3">
              📍 No spots yet — <strong>hold your finger down</strong> on the
              map to mark your first one.
            </p>
          )}
          {goTo && (
            <div className="flex items-center gap-3 bg-pine text-white rounded-2xl px-4 py-3 mb-3">
              <span className="text-xl shrink-0">🧭</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {goTo.name || "Fishing spot"}
                </p>
                <p className="text-xs text-white/70 tabular-nums">
                  {myLoc
                    ? `${formatDist(haversineM(myLoc.lat, myLoc.lng, Number(goTo.lat), Number(goTo.lng)))} · ${compassLabel(bearingDeg(myLoc.lat, myLoc.lng, Number(goTo.lat), Number(goTo.lng)))}`
                    : "Waiting for GPS…"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGoTo(null)}
                aria-label="Stop navigating"
                className="text-white/70 hover:text-white font-black px-1"
              >
                ✕
              </button>
            </div>
          )}
          <div ref={mapRef} className="scroll-mt-4">
          <SpotMap
            spots={sharedSpot ? [...spots, sharedSpot] : spots}
            picking={picking}
            onPick={(lat, lng) => {
              setManualLat(lat);
              setManualLng(lng);
              setPicking(false);
            }}
            onLongPress={onMapLongPress}
            pendingPin={
              manualLat !== null && manualLng !== null
                ? { lat: manualLat, lng: manualLng }
                : null
            }
            focus={focus}
            myLoc={myLoc}
            overlayTrail={
              overlayTrailId
                ? (trails.find((t) => t.id === overlayTrailId)?.points ?? null)
                : null
            }
            goTo={goTo ? { lat: Number(goTo.lat), lng: Number(goTo.lng) } : null}
            onTrailSaved={loadTrails}
          />
          </div>
          <p className="text-center text-pine/50 text-xs mt-2 mb-1">
            💡 Tip: <strong>press and hold</strong> anywhere on the map to drop a pin and save a spot there.
          </p>
        </>
      )}

      {/* Quick-add popup after a map long-press */}
      {quickAdd && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-pine-deep/60 backdrop-blur-sm"
          onClick={cancelQuickAdd}
        >
          <div
            className="bg-paper rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
              📍 Mark this spot
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
              <IconPicker value={quickIcon} onChange={setQuickIcon} />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={cancelQuickAdd}
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

      {/* Saved lakes — quick map navigation */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
          ⭐ Saved lakes
        </h3>
        <p className="text-pine/55 text-xs mb-3">
          Jump the map straight to a saved lake.
        </p>
        {favs.length > 0 ? (
          <div>
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
              <option value="">Choose a saved lake…</option>
              {favs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="__add__">➕ Add a new lake…</option>
            </select>
            {selectedFav && selectedFav !== "__add__" && (
              <button
                type="button"
                onClick={() => removeFav(selectedFav)}
                className="mt-2 w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-2.5 text-signal-dark text-xs font-bold uppercase tracking-wider"
              >
                🗑️ Remove this lake
              </button>
            )}
          </div>
        ) : (
          <select
            value={selectedFav}
            onChange={(e) => setSelectedFav(e.target.value)}
            aria-label="Saved lakes"
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
          >
            <option value="">No saved lakes yet…</option>
            <option value="__add__">➕ Add a new lake…</option>
          </select>
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
              onClick={async () => {
                await addFavLake();
                setSelectedFav("");
              }}
              disabled={!addLakeId || addingLake}
              className="mt-2 w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-2xl disabled:opacity-40 transition-colors"
            >
              {addingLake ? "Adding…" : "★ Add this lake"}
            </button>
          </div>
        )}
      </div>

      {/* Saved spots — dropdown, works just like saved lakes */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
          📍 Saved spots
        </h3>
        <p className="text-pine/55 text-xs mb-3">
          Jump the map straight to a saved spot.
        </p>
        <select
          value={selectedSpotId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedSpotId(v);
            const s = spots.find((x) => x.id === v);
            if (s) {
              setGoTo(s);
              focusOn(Number(s.lat), Number(s.lng), `spot:${s.id}`, 15);
            }
          }}
          aria-label="Choose a saved spot"
          className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
        >
          <option value="">
            {spots.length === 0 ? "No saved spots yet…" : "Choose a saved spot…"}
          </option>
          {spots.map((s) => (
            <option key={s.id} value={s.id}>
              {spotEmoji(s.icon)} {s.name || "Fishing spot"}
            </option>
          ))}
        </select>
        {selectedSpot && (
          <div className="mt-3 bg-paper-deep border border-pine/10 rounded-2xl p-4">
            {editingId === selectedSpot.id ? (
              <div className="space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={80}
                  className={inputCls}
                />
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Notes (optional)"
                  className={inputCls}
                />
                <IconPicker value={editIcon} onChange={setEditIcon} />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(selectedSpot.id)}
                    className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-pine/60 text-xs font-bold uppercase tracking-wider px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-pine">
                  {spotEmoji(selectedSpot.icon)} {selectedSpot.name || "Fishing spot"}
                </p>
                <p className="text-xs text-pine/50 mt-0.5">
                  {fmtDate(selectedSpot.created_at)} ·{" "}
                  <span className="tabular-nums">
                    {Number(selectedSpot.lat).toFixed(5)}, {Number(selectedSpot.lng).toFixed(5)}
                  </span>
                </p>
                {selectedSpot.notes && (
                  <p className="text-sm text-pine/70 mt-1">{selectedSpot.notes}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGoTo(selectedSpot);
                      focusOn(Number(selectedSpot.lat), Number(selectedSpot.lng), `spot:${selectedSpot.id}`, 15);
                    }}
                    className="flex-1 bg-pine text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-2xl"
                  >
                    🧭 Navigate
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(selectedSpot)}
                    className="flex-1 bg-white border border-pine/15 text-pine text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-2xl"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => shareSpot(selectedSpot.id)}
                    disabled={sharingSpot === selectedSpot.id}
                    className="flex-1 bg-white border border-pine/15 text-pine text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-2xl disabled:opacity-40"
                  >
                    {sharingSpot === selectedSpot.id ? "…" : "📤 Share"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSpot(selectedSpot.id)}
                    className="flex-1 bg-white border border-pine/15 text-signal-dark text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-2xl"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recorded boat trails — overlay one to retrace your route */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
          🛥️ My trails
        </h3>
        <p className="text-pine/55 text-xs mb-3">
          Recorded boat routes — overlay one on the map to retrace it.
        </p>
        {trails.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={overlayTrailId}
              onChange={(e) => setOverlayTrailId(e.target.value)}
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
                onClick={() => deleteTrail(overlayTrailId)}
                aria-label="Delete the selected trail"
                title="Delete the selected trail"
                className="shrink-0 bg-paper-deep border border-pine/15 rounded-2xl px-4 text-pine/50 hover:text-signal-dark text-sm font-bold"
              >
                🗑️
              </button>
            )}
          </div>
        ) : (
          <p className="text-pine/40 text-xs">
            No trails yet — tap <strong>⏺ Record</strong> on the map while boating.
          </p>
        )}
      </div>

      {/* Manual add */}
      <div id="add-spot-form" className="bg-white border border-pine/10 rounded-3xl p-6 mt-4 scroll-mt-24">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-4">
          Add a spot manually
        </h3>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Spot name — e.g. North bay point"
            className={inputCls}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Notes — depth, structure, what bit… (optional)"
            className={`${inputCls} resize-none`}
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-pine/55 mb-2">
              Spot icon
            </p>
            <IconPicker value={manualIcon} onChange={setManualIcon} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="bg-pine hover:bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-50 transition-colors"
            >
              {locating ? "Getting location…" : "📍 Use my current location"}
            </button>
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full border transition-colors ${
                picking
                  ? "bg-signal text-white border-signal"
                  : "bg-paper-deep border-pine/15 text-pine/70 hover:border-signal"
              }`}
            >
              {picking ? "Tap the map… (tap again to cancel)" : "🗺️ Tap map to drop pin"}
            </button>
          </div>
          {manualLat !== null && manualLng !== null && (
            <p className="text-sm text-pine/70">
              Pin: <strong className="text-pine tabular-nums">{manualLat.toFixed(5)}, {manualLng.toFixed(5)}</strong>
              <button
                type="button"
                onClick={() => {
                  setManualLat(null);
                  setManualLng(null);
                }}
                className="ml-2 text-xs font-bold text-pine/50 hover:text-signal-dark"
              >
                clear
              </button>
            </p>
          )}
          <button
            onClick={saveManual}
            disabled={saving || manualLat === null || manualLng === null}
            className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save spot"}
          </button>
        </div>
      </div>

    </section>
  );
}
