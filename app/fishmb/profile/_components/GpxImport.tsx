"use client";

import { useRef, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface GpxWaypoint {
  lat: number;
  lng: number;
  name: string;
  notes: string | null;
}

/** Parse waypoints out of a GPX document (Navionics markers export as <wpt>). */
function parseGpx(text: string): GpxWaypoint[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("That file isn't a valid GPX file.");
  const out: GpxWaypoint[] = [];
  doc.querySelectorAll("wpt").forEach((w) => {
    const lat = Number(w.getAttribute("lat"));
    const lng = Number(w.getAttribute("lon") ?? w.getAttribute("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const name =
      w.querySelector("name")?.textContent?.trim().slice(0, 80) || "Imported spot";
    const desc = w.querySelector("desc")?.textContent?.trim() || "";
    const cmt = w.querySelector("cmt")?.textContent?.trim() || "";
    const notes = [desc, cmt].filter(Boolean).join(" — ").slice(0, 500) || null;
    out.push({ lat, lng, name, notes });
  });
  return out;
}

/**
 * Import waypoints from a Navionics GPX export into the user's fishing spots.
 * The Navionics Boating app exports markers via its built-in GPX export.
 */
export function GpxImport({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<GpxWaypoint[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const pickFile = () => {
    setNote(null);
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNote(null);
    try {
      const text = await file.text();
      const wpts = parseGpx(text);
      if (wpts.length === 0) {
        setNote("No waypoints found in that file. Export your markers from the Navionics Boating app first.");
        setPreview(null);
        return;
      }
      setFileName(file.name);
      setPreview(wpts);
      setProgress(0);
    } catch (err) {
      setPreview(null);
      setNote(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const doImport = async () => {
    if (!preview || importing) return;
    setImporting(true);
    setNote(null);
    let ok = 0;
    for (let i = 0; i < preview.length; i++) {
      const w = preview[i];
      try {
        await fishFetch("/api/fishmb/spots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: w.name,
            notes: w.notes,
            lat: w.lat,
            lng: w.lng,
            icon: "pin",
          }),
        });
        ok++;
      } catch {
        // keep going — one bad waypoint shouldn't kill the whole import
      }
      setProgress(i + 1);
    }
    setImporting(false);
    setPreview(null);
    onImported();
    setNote(
      ok === preview.length
        ? `Imported ${ok} spot${ok === 1 ? "" : "s"}!`
        : `Imported ${ok} of ${preview.length} spots.`
    );
  };

  return (
    <div className="mt-4">
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={onFile}
      />
      {!preview ? (
        <button
          type="button"
          onClick={pickFile}
          className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-pine border border-pine/20 hover:border-pine/40 rounded-full px-5 py-2.5 transition-colors"
        >
 Import from Navionics (GPX)
        </button>
      ) : (
        <div className="rounded-2xl border border-pine/15 bg-white p-4 text-left">
          <p className="text-sm font-bold text-pine mb-1">
            Found {preview.length} waypoint{preview.length === 1 ? "" : "s"} in {fileName}
          </p>
          <div className="max-h-40 overflow-y-auto rounded-xl bg-pine/5 divide-y divide-pine/10 mb-3">
            {preview.slice(0, 50).map((w, i) => (
              <p key={i} className="px-3 py-1.5 text-xs text-pine/70 truncate">
 {w.name}
              </p>
            ))}
            {preview.length > 50 && (
              <p className="px-3 py-1.5 text-xs text-pine/40">…and {preview.length - 50} more</p>
            )}
          </div>
          {importing ? (
            <div>
              <div className="h-2 rounded-full bg-pine/10 overflow-hidden mb-2">
                <div
                  className="h-full bg-signal rounded-full transition-all"
                  style={{ width: `${Math.round((progress / preview.length) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-pine/60">
                Importing… {progress} of {preview.length}
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doImport}
                className="flex-1 bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider rounded-full px-5 py-2.5 transition-colors"
              >
                Import {preview.length} spot{preview.length === 1 ? "" : "s"}
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-pine rounded-full px-4 py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {note && (
        <p className="text-xs text-pine/70 mt-2">{note}</p>
      )}
      <p className="text-[11px] text-pine/40 mt-2">
        In the Navionics Boating app: Menu → Sync / Export → export your markers as GPX, then import the file here.
      </p>
    </div>
  );
}
