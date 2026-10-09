// "Who sees your stats" editor for your own profile. Each stat tile can be
// hidden from other people — you always see your own full stats.

"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

const OPTIONS: [string, string][] = [
  ["catches", "Catches"],
  ["tournament-catches", "Tournament catches"],
  ["species", "Species"],
  ["tournaments", "Tournaments"],
  ["wins", "Wins"],
  ["posts", "Posts"],
  ["biggest", "Biggest fish"],
];

export default function StatsPrivacyEditor({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/users/${userId}/stats`)
      .then((d) => {
        if (live) setHidden(((d as { stats: { hidden_stats?: string[] } }).stats.hidden_stats ?? []));
      })
      .catch(() => {
        if (live) setHidden([]);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const toggle = (key: string) => {
    setHidden((prev) => {
      const cur = prev ?? [];
      return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    });
    setNote(null);
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const d = await fishFetch(`/api/fishmb/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden_stats: hidden ?? [] }),
      });
      setHidden((d as { hidden_stats: string[] }).hidden_stats);
      setNote("Saved — others see only what you checked off.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-8 bg-white border border-pine/10 rounded-3xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-bold text-pine text-sm">Who sees your stats</span>
        <span className="text-pine/50 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-xs text-pine/55 mb-3">
            Uncheck anything you&apos;d rather keep to yourself. You always see your own full
            stats.
          </p>
          {hidden === null ? (
            <div className="bg-pine/5 rounded-2xl h-24 animate-pulse" />
          ) : (
            <ul className="divide-y divide-pine/8">
              {OPTIONS.map(([key, label]) => {
                const visible = !hidden.includes(key);
                return (
                  <li key={key}>
                    <label className="flex items-center justify-between py-2.5 cursor-pointer">
                      <span className="text-sm font-bold text-pine">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={visible}
                        onClick={(e) => {
                          e.preventDefault();
                          toggle(key);
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          visible ? "bg-signal" : "bg-pine/20"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            visible ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {note && <p className="text-xs text-pine/60 mt-3">{note}</p>}
          <button
            type="button"
            onClick={save}
            disabled={saving || hidden === null}
            className="mt-4 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save choices"}
          </button>
        </div>
      )}
    </div>
  );
}
