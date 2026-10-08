"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface Note {
  lake_id: string;
  lake_name: string;
  notes: string;
  updated_at: string;
}

interface LakeResult {
  id: string;
  name: string;
  region?: string;
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

/** Personal lake notes — the angler's private notebook per lake. */
export default function LakeNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  const [lakeQuery, setLakeQuery] = useState("");
  const [lakeResults, setLakeResults] = useState<LakeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<LakeResult | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fishFetch("/api/fishmb/lake-notes")
      .then((d) => setNotes((d.notes ?? []) as Note[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const startFor = (lake: LakeResult, existing?: Note) => {
    setPicked(lake);
    setText(existing?.notes ?? "");
    setEditingId(existing?.lake_id ?? null);
    setLakeQuery("");
    setLakeResults([]);
    setNote(null);
  };

  const save = async () => {
    if (!picked || !text.trim() || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/lake-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: picked.id, notes: text.trim() }),
      });
      const saved = d.note as Note;
      setNotes((prev) => {
        const rest = prev.filter((n) => n.lake_id !== saved.lake_id);
        return [saved, ...rest];
      });
      setPicked(null);
      setText("");
      setEditingId(null);
      setNote(`Notes saved for ${saved.lake_name}.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save notes.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lakeId: string, lakeName: string) => {
    if (!window.confirm(`Delete your notes for ${lakeName}?`)) return;
    try {
      await fishFetch(`/api/fishmb/lake-notes/${encodeURIComponent(lakeId)}`, {
        method: "DELETE",
      });
      setNotes(notes.filter((n) => n.lake_id !== lakeId));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete notes.");
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <div>
      {note && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-3 mb-4">
          {note}
        </p>
      )}

      {/* Add / edit */}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mb-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-3">
          {editingId ? "Edit notes" : "Add lake notes"}
        </h3>
        {!picked ? (
          <>
            <input
              value={lakeQuery}
              onChange={(e) => setLakeQuery(e.target.value)}
              placeholder="Search for a lake…"
              className={inputCls}
            />
            {searching && <p className="text-pine/50 text-xs mt-2">Searching…</p>}
            {!searching && lakeResults.length > 0 && (
              <div className="mt-2 bg-paper-deep border border-pine/10 rounded-2xl overflow-hidden">
                {lakeResults.map((l) => {
                  const existing = notes.find((n) => n.lake_id === l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => startFor(l, existing)}
                      className="w-full text-left px-4 py-2.5 border-b border-pine/5 last:border-0 hover:bg-pine/5"
                    >
                      <p className="text-pine text-sm font-bold">{l.name}</p>
                      <p className="text-pine/50 text-xs">
                        {l.region}
                        {existing ? " · has notes — tap to edit" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-pine">{picked.name}</p>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setText("");
                  setEditingId(null);
                }}
                className="text-pine/50 text-xs font-bold uppercase tracking-wider"
              >
                Change lake
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="What works here — spots, depths, presentations, seasons…"
              className={`${inputCls} resize-y`}
            />
            <button
              type="button"
              onClick={save}
              disabled={!text.trim() || saving}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save notes"}
            </button>
          </div>
        )}
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="h-32 bg-pine/10 rounded-3xl animate-pulse" />
      ) : notes.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
          <p className="text-4xl mb-3">📓</p>
          <p className="text-pine/70 font-bold">No lake notes yet</p>
          <p className="text-pine/50 text-sm mt-1">
            Search a lake above and jot down what works there.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n.lake_id}
              className="bg-white border border-pine/10 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/fishmb/lakes/${n.lake_id}`}
                    className="font-bold text-pine hover:text-signal-dark"
                  >
                    📓 {n.lake_name}
                  </Link>
                  <p className="text-xs text-pine/50 mt-0.5">
                    Updated {fmtDate(n.updated_at)}
                  </p>
                  <p className="text-sm text-pine/70 mt-2 whitespace-pre-wrap">
                    {n.notes}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      startFor({ id: n.lake_id, name: n.lake_name }, n)
                    }
                    aria-label={`Edit notes for ${n.lake_name}`}
                    className="text-pine/50 hover:text-pine text-sm font-bold px-2 py-1"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.lake_id, n.lake_name)}
                    aria-label={`Delete notes for ${n.lake_name}`}
                    className="text-pine/50 hover:text-signal-dark text-sm font-bold px-2 py-1"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
