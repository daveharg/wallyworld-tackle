"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface License {
  user_id: string;
  file_url: string;
  file_type: string;
  expiry_date: string | null;
  updated_at: string;
}

const CACHE_NAME = "fishmb-license";

function fmtDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusOf(expiry: string | null): {
  label: string;
  cls: string;
} {
  if (!expiry) {
    return {
      label: "No expiry date set",
      cls: "bg-pine/10 text-pine/70 border-pine/20",
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00");
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) {
    return {
      label: `Expired ${fmtDate(expiry)}`,
      cls: "bg-signal/10 text-signal-dark border-signal/30",
    };
  }
  if (days <= 30) {
    return {
      label: `Expires ${fmtDate(expiry)} — renew soon`,
      cls: "bg-gold/15 text-gold-dark border-gold/40",
    };
  }
  return {
    label: `Valid until ${fmtDate(expiry)}`,
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
}

/**
 * Fishing-licence wallet on the profile. The angler uploads their own
 * government-issued digital licence (JPEG/PNG/PDF from manitobaelicensing.ca);
 * FishMB just holds it and shows it on demand. The file is cached on-device
 * so "Show licence" works with no signal.
 */
export default function LicenseWallet({ embedded = false }: { embedded?: boolean }) {
  const [lic, setLic] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    fishFetch("/api/fishmb/license")
      .then((d) => {
        const l = (d.license ?? null) as License | null;
        setLic(l);
        if (l?.expiry_date) setExpiry(l.expiry_date);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cache the licence file on-device for offline display.
  const cacheFile = async (url: string) => {
    try {
      if (!("caches" in window)) return;
      const cache = await caches.open(CACHE_NAME);
      await cache.add(url);
    } catch {
      // Offline caching is best-effort.
    }
  };

  const save = async () => {
    if (!file || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (expiry.trim()) form.append("expiry_date", expiry.trim());
      const d = await fishFetch("/api/fishmb/license", {
        method: "POST",
        body: form,
      });
      const l = d.license as License;
      setLic(l);
      setFile(null);
      cacheFile(l.file_url);
      setNote("Licence saved — it's now one tap away, even with no signal.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the licence.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove your saved licence from FishMB?")) return;
    try {
      await fishFetch("/api/fishmb/license", { method: "DELETE" });
      setLic(null);
      setExpiry("");
      if ("caches" in window) {
        try {
          await caches.delete(CACHE_NAME);
        } catch {}
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not remove the licence.");
    }
  };

  const openViewer = async () => {
    if (!lic) return;
    let src = lic.file_url;
    try {
      if ("caches" in window) {
        const cache = await caches.open(CACHE_NAME);
        const res = await cache.match(lic.file_url);
        if (res) src = URL.createObjectURL(await res.blob());
      }
    } catch {
      // Fall back to the network URL.
    }
    setViewerSrc(src);
    setViewerOpen(true);
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm focus:outline-none focus:border-signal";

  if (loading) return null;

  const status = statusOf(lic?.expiry_date ?? null);
  const isPdf = lic?.file_type === "application/pdf";

  return (
    <section className={embedded ? "" : "max-w-3xl mx-auto px-4 mt-10"}>
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-1">
 Fishing licence
      </h2>
      <p className="text-pine/60 text-sm mb-4">
        Your digital licence, one tap away — works even with no signal.
      </p>
      {note && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-3 mb-4">
          {note}
        </p>
      )}

      {lic ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <span
              className={`text-xs font-bold uppercase tracking-wider border rounded-full px-3 py-1.5 ${status.cls}`}
            >
              {status.label}
            </span>
            <div className="flex gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-pine cursor-pointer px-3 py-2">
                Replace
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setNote(null);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={remove}
                className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-signal-dark px-3 py-2"
              >
                Remove
              </button>
            </div>
          </div>

          {file ? (
            <div className="bg-paper-deep border border-pine/10 rounded-2xl p-4 mb-4">
              <p className="text-sm text-pine font-bold truncate">{file.name}</p>
              <p className="text-xs text-pine/50 mt-1">
                Ready to replace your saved licence.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save new licence"}
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-pine/60 text-xs font-bold uppercase tracking-wider px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openViewer}
              className="w-full bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-base px-6 py-5 rounded-3xl transition-colors"
            >
 Show my licence
            </button>
          )}
          <p className="text-xs text-pine/45 mt-3">
            Saved {fmtDate(lic.updated_at.slice(0, 10))} · your government-issued
            document — FishMB only holds your copy.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl p-6">
          <p className="text-sm text-pine/70 leading-relaxed mb-4">
            Download your licence from your{" "}
            <span className="font-bold">manitobaelicensing.ca</span> account
            (JPEG, PNG or PDF — the formats conservation officers accept), then
            save it here. It stays on your phone so you can pull it up even with
            no bars.
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-pine/60">
                Licence file
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-pine/70 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-pine file:text-white hover:file:bg-pine-deep"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-pine/60">
                Expiry date (optional — for renewal reminders)
              </span>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={!file || saving}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save my licence"}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewerOpen && viewerSrc && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white/80 text-sm font-bold">My fishing licence</p>
            <button
              type="button"
              onClick={() => {
                setViewerOpen(false);
                if (viewerSrc.startsWith("blob:")) URL.revokeObjectURL(viewerSrc);
                setViewerSrc(null);
              }}
              className="text-white text-sm font-bold uppercase tracking-wider bg-white/15 rounded-full px-5 py-2.5"
            >
 Close
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2">
            {isPdf ? (
              <iframe
                src={viewerSrc}
                title="Fishing licence"
                className="w-full h-full bg-white"
              />
            ) : (
              <img
                src={viewerSrc}
                alt="Fishing licence"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
