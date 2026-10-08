"use client";

import { useEffect, useState } from "react";
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
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not remove the lake.");
    }
  };

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
      ) : spots.length === 0 && !picking && manualLat === null ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-pine/70 font-bold">No spots yet</p>
          <p className="text-pine/50 text-sm mt-1">
            Save one from a catch or add one below.
          </p>
        </div>
      ) : (
        <SpotMap
          spots={spots}
          picking={picking}
          onPick={(lat, lng) => {
            setManualLat(lat);
            setManualLng(lng);
            setPicking(false);
          }}
          pendingPin={
            manualLat !== null && manualLng !== null
              ? { lat: manualLat, lng: manualLng }
              : null
          }
          focus={focus}
        />
      )}

      {/* Favorite lakes — quick map navigation */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
          ⭐ Favorite lakes
        </h3>
        <p className="text-pine/55 text-xs mb-3">
          Save lakes to jump the map straight to them.
        </p>
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
        {favs.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {favs.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 bg-gold/15 border border-gold/40 rounded-full pl-3 pr-1.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => focusOn(f.lat, f.lng, `lake:${f.id}`)}
                  className="text-pine text-xs font-bold hover:text-gold-dark"
                >
                  ★ {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeFav(f.id)}
                  aria-label={`Remove ${f.name} from favorites`}
                  className="text-pine/40 hover:text-signal-dark text-xs font-bold px-1"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-pine/40 text-xs mt-3">No favorite lakes yet — search above to add some.</p>
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
