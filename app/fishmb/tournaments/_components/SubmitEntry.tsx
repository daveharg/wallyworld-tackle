"use client";

import { useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal";

/** Catch submission: up to 4 photos + species + length + GPS. Server stamps the time. */
export function SubmitEntry({
  tournamentId,
  species,
  photoMode,
}: {
  tournamentId: string;
  species: string[];
  photoMode?: string | null;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fishSpecies, setFishSpecies] = useState(species[0] || "");
  const [length, setLength] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files, ...Array.from(picked)].slice(0, 4);
    setFiles(next);
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return next.map((f) => URL.createObjectURL(f));
    });
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return next.map((f, j) => (j < i ? prev[j] : URL.createObjectURL(f)));
    });
  };

  const submit = async () => {
    setError(null);
    if (files.length === 0) {
      setError("A photo of your catch is required.");
      return;
    }
    if (!fishSpecies.trim()) {
      setError("Tell us the species.");
      return;
    }
    setBusy(true);
    try {
      // 1. Upload the photos (compressed), one at a time.
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const photoUrls: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", await compressImage(file));
        const upRes = await fetch("/api/fish/photos/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
        photoUrls.push(up.url as string);
      }

      // 2. Grab a GPS fix (best effort — the organizer sees it).
      let lat: number | null = null;
      let lng: number | null = null;
      let acc: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        acc = pos.coords.accuracy;
      } catch {
        // No GPS — entry still accepted; organizer reviews it.
      }

      // 3. Submit. The server stamps the official catch time.
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_urls: photoUrls,
          species: fishSpecies.trim(),
          length_inches: length ? parseFloat(length) : null,
          latitude: lat,
          longitude: lng,
          gps_accuracy: acc,
          notes: notes.trim(),
        }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your catch.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white border border-pine/15 rounded-3xl p-6 text-center">
        <p className="font-display font-bold uppercase text-pine text-xl mb-2">Catch submitted!</p>
        <p className="text-pine/60 text-sm">
          The organizer reviews every catch before it hits the leaderboard. Tight lines!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-pine/15 rounded-3xl p-6 space-y-4">
      <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide">Log a catch</h3>
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">
          Photos * <span className="normal-case font-normal">(up to 4)</span>
        </label>
        {photoMode === "measure_only" && (
          <p className="text-xs text-pine/60 bg-pine/5 border border-pine/10 rounded-2xl px-3.5 py-2.5 mb-2">
            📏 Just the fish on your measuring board — no posed photo with the fish needed. Extra
            photos are optional.
          </p>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="text-sm text-pine/70"
        />
        {previews.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {previews.map((src, i) => (
              <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-pine/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Catch photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-pine-deep/80 text-white text-xs font-bold leading-none"
                >
                  ✕
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 bg-gold text-pine-deep text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Main
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">Species *</label>
        <input value={fishSpecies} onChange={(e) => setFishSpecies(e.target.value)} list="tourney-species" className={inputCls} />
        <datalist id="tourney-species">
          {species.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">Length (inches)</label>
        <input value={length} onChange={(e) => setLength(e.target.value)} type="number" step="0.5" min="0" placeholder="e.g. 24.5" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the organizer should know" className={inputCls} />
      </div>
      <p className="text-xs text-pine/50">
        Your location is attached automatically when available, and our server stamps the official catch time.
      </p>
      {error && <p className="text-sm text-signal-dark">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full transition-colors disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit catch"}
      </button>
    </div>
  );
}
