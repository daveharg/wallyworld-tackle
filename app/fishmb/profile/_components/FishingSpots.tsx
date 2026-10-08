"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { fishFetch } from "../../_components/fishFetch";
import type { SpotPin } from "./SpotMap";

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

interface LakeResult {
  id: string;
  name: string;
  region?: string;
  lat: number | null;
  lng: number | null;
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
        }),
      });
      setSpots([(d.spot as Spot), ...spots]);
      setQuickAdd(null);
      setQuickName("");
      setQuickNotes("");
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
    setManualLat(null);
    setManualLng(null);
  };

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Favorite lakes + map focus
  const [favs, setFavs] = useState<FavLake[]>([]);
  const [lakeQuery, setLakeQuery] = useState("");
  const [lakeResults, setLakeResults] = useState<LakeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [selectedFav, setSelectedFav] = useState("");
  const autoLoadedFav = useRef(false);

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
  }, []);

  // Debounced lake search.
  useEffect(() => {
    const q = lakeQuery.trim();
    if (q.length < 2) {
      setLakeResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const d = await fishFetch(`/api/fishmb/search?q=${encodeURIComponent(q)}`);
        setLakeResults((d.lakes ?? []) as LakeResult[]);
      } catch {
        setLakeResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [lakeQuery]);

  const favIds = new Set(favs.map((f) => f.id));

  const addFav = async (lake: LakeResult) => {
    if (favIds.has(lake.id)) return;
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: lake.id }),
      });
      setFavs([...favs, { id: lake.id, name: lake.name, region: lake.region, lat: lake.lat, lng: lake.lng }]);
      setLakeQuery("");
      setLakeResults([]);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the lake.");
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

  const focusOn = (lat: number | null, lng: number | null, key: string) => {
    if (lat === null || lng === null) {
      setNote("No map coordinates for that lake yet.");
      return;
    }
    setFocus({ lat, lng, key });
  };

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
        }),
      });
      setSpots([(d.spot as Spot), ...spots]);
      setName("");
      setNotes("");
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
  };

  const saveEdit = async (id: string) => {
    try {
      const d = await fishFetch(`/api/fishmb/spots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), notes: editNotes.trim() || null }),
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
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the spot.");
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <section className="max-w-3xl mx-auto px-4 mt-10">
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-1">
        📍 My fishing spots
      </h2>
      <p className="text-pine/60 text-sm mb-4">
        Your private GPS spots — only you can see them. Save one from a catch
        or add one below.
      </p>
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
          <SpotMap
            spots={spots}
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
          />
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

      {/* Favorite lakes — quick map navigation */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
          ⭐ Saved locations
        </h3>
        <p className="text-pine/55 text-xs mb-3">
          Jump the map straight to a saved lake.
        </p>
        {favs.length > 0 ? (
          <div className="flex gap-2 mb-3">
            <select
              value={selectedFav}
              onChange={(e) => chooseFav(e.target.value)}
              aria-label="Choose a saved lake"
              className="flex-1 min-w-0 bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm font-bold focus:outline-none focus:border-signal"
            >
              <option value="">Choose a saved lake…</option>
              {favs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {selectedFav && (
              <button
                type="button"
                onClick={() => removeFav(selectedFav)}
                aria-label="Remove the selected lake"
                title="Remove the selected lake"
                className="shrink-0 bg-paper-deep border border-pine/15 rounded-2xl px-4 text-pine/50 hover:text-signal-dark text-sm font-bold"
              >
                🗑️
              </button>
            )}
          </div>
        ) : (
          <p className="text-pine/40 text-xs mb-3">No saved lakes yet — search below to add some.</p>
        )}
        <input
          value={lakeQuery}
          onChange={(e) => setLakeQuery(e.target.value)}
          placeholder="Search lakes to add…"
          className={inputCls}
        />
        {searching && <p className="text-pine/50 text-xs mt-2">Searching…</p>}
        {!searching && lakeResults.length > 0 && (
          <div className="mt-2 bg-paper-deep border border-pine/10 rounded-2xl overflow-hidden">
            {lakeResults.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-pine/5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-pine text-sm font-bold truncate">{l.name}</p>
                  {l.region && <p className="text-pine/50 text-xs">{l.region}</p>}
                </div>
                {favIds.has(l.id) ? (
                  <span className="text-gold text-xs font-bold shrink-0">★ Saved</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addFav(l)}
                    className="text-xs font-bold uppercase tracking-wider text-pine border border-pine/20 rounded-full px-3 py-1.5 hover:border-gold hover:text-gold-dark shrink-0"
                  >
                    ★ Save
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual add */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
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

      {/* Spot list */}
      {spots.length > 0 && (
        <div className="mt-4 space-y-2">
          {spots.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-pine/10 rounded-2xl p-4"
            >
              {editingId === s.id ? (
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(s.id)}
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
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => focusOn(Number(s.lat), Number(s.lng), `spot:${s.id}`)}
                    className="min-w-0 text-left flex-1"
                    title="Show on map"
                  >
                    <p className="font-bold text-pine truncate hover:text-gold-dark">
                      📍 {s.name || "Fishing spot"}
                    </p>
                    <p className="text-xs text-pine/50 mt-0.5">
                      {fmtDate(s.created_at)} ·{" "}
                      <span className="tabular-nums">
                        {Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}
                      </span>
                    </p>
                    {s.notes && <p className="text-sm text-pine/70 mt-1">{s.notes}</p>}
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(s)}
                      aria-label={`Rename ${s.name}`}
                      className="text-pine/50 hover:text-pine text-sm font-bold px-2 py-1"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeSpot(s.id)}
                      aria-label={`Delete ${s.name}`}
                      className="text-pine/50 hover:text-signal-dark text-sm font-bold px-2 py-1"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
