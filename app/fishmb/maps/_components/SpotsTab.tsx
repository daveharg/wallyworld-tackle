import { useEffect, useState } from "react";
import type { SpotPin } from "../../profile/_components/SpotMap";
import { SPOT_ICON_CHOICES } from "../../profile/_components/spotIcons";

export interface Spot extends SpotPin {
  user_id: string;
  catch_id: string | null;
  lake_id?: string | null;
}

interface SpotsTabProps {
  spots: Spot[];
  onSelect: (s: Spot) => void;
  onNavigate: (s: Spot) => void;
  onEdit: (id: string, patch: { name: string; notes: string | null; icon: string; lake_id: string | null }) => Promise<void>;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  sharingId: string | null;
  onAddSpot: () => void;
}

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

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
}

/** Saved spots tab — grouped by nearest lake, newest first within each group. */
export default function SpotsTab({
  spots,
  onSelect,
  onNavigate,
  onEdit,
  onDelete,
  onShare,
  sharingId,
  onAddSpot,
}: SpotsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLakeId, setEditLakeId] = useState<string | null>(null);
  const [editIcon, setEditIcon] = useState("pin");
  const [saving, setSaving] = useState(false);
  const [lakes, setLakes] = useState<LakeCoord[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [coordsRes, metaRes] = await Promise.all([
          fetch("/fishmb/lake-coords.json"),
          fetch("/fish-manitoba/data.json"),
        ]);
        const coords = (await coordsRes.json()) as Record<string, { lat: number; lng: number }>;
        const meta = (await metaRes.json()) as { lakes?: { id: string; name: string }[] };
        const nameById = new Map((meta.lakes ?? []).map((l) => [l.id, l.name]));
        setLakes(
          Object.entries(coords)
            .filter(([, c]) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
            .map(([id, c]) => ({
              id,
              name: nameById.get(id) ?? id,
              lat: c.lat,
              lng: c.lng,
            }))
        );
      } catch {
        // Lake grouping stays off; spots list flat.
      }
    })();
  }, []);

  const startEdit = (s: Spot) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditNotes(s.notes ?? "");
    setEditLakeId(s.lake_id ?? null);
    setEditIcon(s.icon ?? "pin");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await onEdit(id, {
        name: editName.trim() || "Fishing spot",
        notes: editNotes.trim() || null,
        icon: editIcon,
        lake_id: editLakeId,
      });
      setEditingId(null);
    } catch {
      // onEdit already surfaced the error; keep the editor open.
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...spots].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Group spots by lake: an explicit lake_id (set when the spot was saved, or
  // chosen by the angler) always wins; otherwise fall back to nearest lake
  // centre within 15 km; the rest under "Other spots".
  const nearestLake = (s: Spot): LakeCoord | null => {
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lakes.length === 0) return null;
    let best: LakeCoord | null = null;
    let bestD = 15;
    for (const l of lakes) {
      const d = kmBetween(lat, lng, l.lat, l.lng);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  };

  const lakeFor = (s: Spot): LakeCoord | null => {
    if (s.lake_id) {
      const explicit = lakes.find((l) => l.id === s.lake_id);
      if (explicit) return explicit;
    }
    return nearestLake(s);
  };

  const groups: { lake: LakeCoord | null; spots: Spot[] }[] = [];
  const groupById = new Map<string, { lake: LakeCoord | null; spots: Spot[] }>();
  for (const s of sorted) {
    const lake = lakeFor(s);
    const key = lake ? lake.id : "__other";
    let g = groupById.get(key);
    if (!g) {
      g = { lake, spots: [] };
      groupById.set(key, g);
      groups.push(g);
    }
    g.spots.push(s);
  }
  // Lake groups alphabetically; "Other spots" last.
  groups.sort((a, b) => {
    if (!a.lake) return 1;
    if (!b.lake) return -1;
    return a.lake.name.localeCompare(b.lake.name);
  });

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onAddSpot}
        className="w-full mb-4 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full transition-colors shadow-lg"
      >
 Add a spot — tap and hold the map
      </button>

      {spots.length === 0 ? (
        <div className="text-center py-10">
          <p className="font-bold text-pine">No saved spots yet</p>
          <p className="text-pine/55 text-sm mt-1 max-w-xs mx-auto">
            Press and hold anywhere on the map to drop a pin and save your first spot.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.lake ? g.lake.id : "__other"}>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-2 px-1">
                {g.lake ? g.lake.name : "Other spots"}
              </p>
              <div className="space-y-2.5">
                {g.spots.map((s) =>
            editingId === s.id ? (
                    <div key={s.id} className="bg-white border border-signal/40 rounded-2xl p-4 space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={80}
                        placeholder="Spot name"
                        className={inputCls}
                      />
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        maxLength={500}
                        placeholder="Notes (optional)"
                        className={inputCls}
                      />
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
                          Lake
                        </label>
                        <select
                          value={editLakeId ?? ""}
                          onChange={(e) => setEditLakeId(e.target.value || null)}
                          className={inputCls}
                        >
                          <option value="">Auto (nearest lake)</option>
                          {[...lakes]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
                          Icon
                        </label>
                        <div className="flex gap-2">
                          {SPOT_ICON_CHOICES.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setEditIcon(c.id)}
                              title={c.label}
                              className={`w-11 h-11 rounded-2xl border-2 text-2xl flex items-center justify-center transition-colors ${
                                editIcon === c.id
                                  ? "border-signal bg-signal/10"
                                  : "border-pine/15 bg-white"
                              }`}
                            >
                              {c.emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(s.id)}
                          disabled={saving}
                          className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-pine/60 text-xs font-bold uppercase tracking-wider px-4 py-2.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={s.id}
                      className="bg-white border border-pine/10 rounded-2xl px-3 py-2 flex items-center gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(s)}
                        className="flex-1 min-w-0 text-left py-1"
                      >
                        <span className="font-bold text-pine text-sm truncate block">
                          {s.name || "Fishing spot"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(s)}
                        className="shrink-0 bg-pine text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                      >
                        Go
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        aria-label="Edit spot"
                        className="shrink-0 w-8 h-8 rounded-full bg-pine/5 text-pine flex items-center justify-center"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onShare(s.id)}
                        disabled={sharingId === s.id}
                        aria-label="Share spot"
                        className="shrink-0 w-8 h-8 rounded-full bg-pine/5 text-pine flex items-center justify-center disabled:opacity-40"
                      >
                        {sharingId === s.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(s.id)}
                        aria-label="Delete spot"
                        className="shrink-0 w-8 h-8 rounded-full bg-pine/5 text-signal-dark flex items-center justify-center"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
