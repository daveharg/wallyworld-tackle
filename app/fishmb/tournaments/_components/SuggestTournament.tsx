"use client";

import { useState } from "react";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";
const labelCls =
  "block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5";

/** Login-gated form: suggest a traditional Manitoba tournament for admin review. */
export function SuggestTournament() {
  const { user, openLogin } = useFishAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dates, setDates] = useState("");
  const [location, setLocation] = useState("");
  const [entry, setEntry] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setNote(null);
    try {
      await fishFetch("/api/fishmb/traditional-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dates, location, entry, description, url }),
      });
 setNote("Thanks — we'll verify it before it goes live. ");
      setName("");
      setDates("");
      setLocation("");
      setEntry("");
      setDescription("");
      setUrl("");
      setOpen(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8">
      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-4">{note}</p>
      )}
      {!open ? (
        <button
          onClick={() => (user ? setOpen(true) : openLogin())}
          className="border border-pine/25 text-pine hover:bg-pine/5 font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          ＋ Suggest a tournament
        </button>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 max-w-2xl">
          <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
            Suggest a traditional tournament
          </h3>
          <p className="text-pine/55 text-sm mb-5">
            Know a Manitoba derby or ice-fishing tournament we missed? Send it in —
            only real, verifiable events go live after we check them.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Tournament name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dates</label>
              <input value={dates} onChange={(e) => setDates(e.target.value)} maxLength={120} placeholder="e.g. Feb 14–15, 2027" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location / waterbody</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} placeholder="e.g. Lake Winnipeg, Gimli" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Entry fee</label>
              <input value={entry} onChange={(e) => setEntry(e.target.value)} maxLength={120} placeholder="e.g. $40" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Official URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://…" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={submit}
              disabled={saving || !name.trim()}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full disabled:opacity-50 transition-colors"
            >
              {saving ? "Sending…" : "Submit suggestion"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-pine/60 hover:text-pine font-bold uppercase tracking-wider text-sm px-5 py-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
