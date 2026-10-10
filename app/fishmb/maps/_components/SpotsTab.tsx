"use client";

import { useState } from "react";
import type { SpotPin } from "../../profile/_components/SpotMap";

export interface Spot extends SpotPin {
  user_id: string;
  catch_id: string | null;
}

interface SpotsTabProps {
  spots: Spot[];
  onSelect: (s: Spot) => void;
  onNavigate: (s: Spot) => void;
  onEdit: (id: string, patch: { name: string; notes: string | null; icon: string }) => Promise<void>;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  sharingId: string | null;
  onAddSpot: () => void;
}

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

/** Saved spots tab — one clean box per spot, newest first. */
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
  const [saving, setSaving] = useState(false);

  const startEdit = (s: Spot) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditNotes(s.notes ?? "");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await onEdit(id, {
        name: editName.trim() || "Fishing spot",
        notes: editNotes.trim() || null,
        icon: "pin",
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
        <div className="space-y-3">
          {sorted.map((s) =>
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
      )}
    </div>
  );
}
