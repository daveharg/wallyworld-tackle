"use client";

import { useEffect, useMemo, useState } from "react";

export type WxLoc = { name: string; lat: number; lon: number; kind?: "lake" | "town" };

const STORE_KEY = "fishmb-wx-locs";

export function loadSavedLocs(): WxLoc[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((l) => l && typeof l.name === "string") : [];
  } catch {
    return [];
  }
}

function persistLocs(locs: WxLoc[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(locs));
  } catch {
    // non-fatal
  }
}

function shortLakeName(full: string): string {
  return full.split(",")[0].trim();
}

export default function LocationPicker({
  current,
  onSelect,
  onClose,
}: {
  current: WxLoc;
  onSelect: (loc: WxLoc) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<WxLoc[]>([]);
  const [q, setQ] = useState("");
  const [lakes, setLakes] = useState<WxLoc[]>([]);
  const [towns, setTowns] = useState<WxLoc[]>([]);
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState<"list" | "add">("list");

  useEffect(() => {
    setSaved(loadSavedLocs());
    fetch("/fishmb/lake-coords.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, { lat: number; lng: number; name: string }>) => {
        // Defensive: one malformed record must never wipe out the whole list
        // (that was silently breaking search entirely).
        const list: WxLoc[] = [];
        for (const l of Object.values(d ?? {})) {
          if (!l || typeof l.name !== "string" || !Number.isFinite(l.lat) || !Number.isFinite(l.lng))
            continue;
          const short = shortLakeName(l.name);
          if (!short) continue;
          list.push({ name: short, lat: l.lat, lon: l.lng, kind: "lake" });
        }
        setLakes(list);
      })
      .catch(() => {});
    // Manitoba cities/towns/villages — real coordinates, bundled at build time.
    fetch("/fishmb/mb-places.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: unknown) => {
        const list: WxLoc[] = [];
        if (Array.isArray(d)) {
          for (const p of d) {
            const q = p as { name?: unknown; lat?: unknown; lon?: unknown };
            if (
              typeof q.name === "string" &&
              q.name &&
              Number.isFinite(q.lat) &&
              Number.isFinite(q.lon)
            ) {
              list.push({ name: q.name, lat: q.lat as number, lon: q.lon as number, kind: "town" });
            }
          }
        }
        setTowns(list);
      })
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const match = (l: WxLoc) => l.name.toLowerCase().includes(t);
    // Towns first (exact community match), then lakes; prefix hits rank top.
    const scored = [...towns, ...lakes].filter(match).map((l) => ({
      l,
      score: l.name.toLowerCase().startsWith(t) ? 0 : 1,
    }));
    scored.sort((a, b) => a.score - b.score || a.l.name.localeCompare(b.l.name));
    return scored.slice(0, 12).map((s) => s.l);
  }, [q, lakes, towns]);

  const remember = (loc: WxLoc) => {
    setSaved((prev) => {
      if (prev.some((p) => p.name === loc.name)) return prev;
      const next = [loc, ...prev].slice(0, 20);
      persistLocs(next);
      return next;
    });
  };

  const choose = (loc: WxLoc) => {
    remember(loc);
    onSelect(loc);
    onClose();
  };

  const remove = (name: string) => {
    setSaved((prev) => {
      const next = prev.filter((l) => l.name !== name);
      persistLocs(next);
      return next;
    });
  };

  const useGps = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // Resolve the GPS coords to a real place name so the user can see
        // WHAT location they're getting weather for — not just "Current location".
        let name = "Current location";
        try {
          const r = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          if (r.ok) {
            const d = await r.json();
            const place: string = d.city || d.locality || "";
            const prov: string = d.principalSubdivisionCode || d.principalSubdivision || "";
            if (place) name = prov ? `${place}, ${prov}` : place;
          }
        } catch {
          // Keep the generic label if the lookup fails.
        }
        setLocating(false);
        choose({ name, lat, lon });
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Choose weather location">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#10231c] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">📍 Weather location</h3>
            <p className="text-xs text-white/55 mt-1">
              Showing weather for: <span className="font-bold text-emerald-200">{current.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-lg"
          >
            ✕
          </button>
        </div>

        {mode === "list" ? (
          <>
            <div className="mt-4 space-y-2">
              {saved.length === 0 && (
                <p className="text-sm text-white/50">No saved spots yet — add your lakes below.</p>
              )}
              {saved.map((l) => (
                <div
                  key={l.name}
                  className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${
                    l.name === current.name
                      ? "border-emerald-300/60 bg-emerald-300/10"
                      : "border-white/10 bg-white/[0.05]"
                  }`}
                >
                  <button onClick={() => choose(l)} className="flex-1 text-left">
                    <span className="text-sm font-bold block">{l.name}</span>
                    <span className="text-[11px] text-white/45">
                      {l.lat.toFixed(2)}, {l.lon.toFixed(2)}
                    </span>
                  </button>
                  {l.name === current.name && <span className="text-emerald-300 text-sm">✓</span>}
                  <button
                    onClick={() => remove(l.name)}
                    aria-label={`Remove ${l.name}`}
                    className="w-8 h-8 rounded-full bg-white/10 text-white/60 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={useGps}
                disabled={locating}
                className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm font-bold disabled:opacity-50"
              >
                {locating ? "Locating…" : "📍 Use my GPS"}
              </button>
              <button
                onClick={() => setMode("add")}
                className="rounded-2xl bg-emerald-400/90 text-[#0b1a15] px-4 py-3 text-sm font-black"
              >
                ＋ Add a lake
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setMode("list")}
              className="mt-3 text-xs font-bold text-emerald-200/70"
            >
              ← Back to saved spots
            </button>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Manitoba lakes…"
              className="mt-2 w-full bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-sm placeholder:text-white/35 focus:outline-none focus:border-emerald-300/60"
            />
            <div className="mt-2 space-y-1.5">
              {results.map((l) => (
                <button
                  key={l.name}
                  onClick={() => choose(l)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold hover:bg-white/10"
                >
                  {l.name}
                </button>
              ))}
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="text-sm text-white/50 px-1">No lakes match “{q.trim()}”.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
