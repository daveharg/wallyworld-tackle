"use client";

import { useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal";

/** Catch submission: photo + species + length + GPS. Server stamps the time. */
export function SubmitEntry({ tournamentId, species }: { tournamentId: string; species: string[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [fishSpecies, setFishSpecies] = useState(species[0] || "");
  const [length, setLength] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!file) {
      setError("A photo of your catch is required.");
      return;
    }
    if (!fishSpecies.trim()) {
      setError("Tell us the species.");
      return;
    }
    setBusy(true);
    try {
      // 1. Upload the photo.
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");

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
          photo_url: up.url,
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
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">Photo *</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-pine/70"
        />
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
