"use client";

import { useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal";

/** Catch submission: bump board photo (required) + holding photo (optional/required by organizer). */
export function SubmitEntry({
  tournamentId,
  species,
  photoMode,
  requireHoldPhoto = false,
}: {
  tournamentId: string;
  species: string[];
  photoMode?: string | null;
  requireHoldPhoto?: boolean;
}) {
  const [bumpFile, setBumpFile] = useState<File | null>(null);
  const [bumpPreview, setBumpPreview] = useState<string | null>(null);
  const [holdFile, setHoldFile] = useState<File | null>(null);
  const [holdPreview, setHoldPreview] = useState<string | null>(null);
  const [fishSpecies, setFishSpecies] = useState(species[0] || "");
  const [length, setLength] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Strict tournaments only accept in-app-camera entries — the web can't prove
  // camera origin, so the form is replaced with a pointer to the app.
  if (photoMode === "strict") {
    return (
      <div className="bg-white border border-pine/15 rounded-3xl p-6">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-2">
          Log a catch
        </h3>
        <p className="text-sm text-pine/70">
 This is a strict camera-only tournament. Entries must be taken with the FishMB
          app&apos;s in-app camera — please log your catch from the app.
        </p>
      </div>
    );
  }

  const setBump = (f: File | null) => {
    if (bumpPreview) URL.revokeObjectURL(bumpPreview);
    setBumpFile(f);
    setBumpPreview(f ? URL.createObjectURL(f) : null);
  };

  const setHold = (f: File | null) => {
    if (holdPreview) URL.revokeObjectURL(holdPreview);
    setHoldFile(f);
    setHoldPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    setError(null);
    if (!bumpFile) {
      setError("Add a photo of the fish on your bump board — that's the one that counts.");
      return;
    }
    if (requireHoldPhoto && !holdFile) {
      setError("This tournament also needs a photo of you holding the fish.");
      return;
    }
    if (!fishSpecies.trim()) {
      setError("Tell us the species.");
      return;
    }
    setBusy(true);
    try {
      // 1. Upload the photos (compressed), bump board first.
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const photoUrls: string[] = [];
      const toUpload = [bumpFile, holdFile].filter((f): f is File => f !== null);
      for (const file of toUpload) {
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
          bump_photo_url: photoUrls[0],
          hold_photo_url: photoUrls[1] ?? null,
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

  const photoSlot = (
    label: string,
    required: boolean,
    file: File | null,
    preview: string | null,
    onPick: (f: File | null) => void,
    hint: string,
  ) => (
    <div>
      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5">
        {label} {required ? "*" : <span className="normal-case font-normal">(optional)</span>}
      </label>
      <p className="text-xs text-pine/60 bg-pine/5 border border-pine/10 rounded-2xl px-3.5 py-2.5 mb-2">
        {hint}
      </p>
      {preview ? (
        <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-pine/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label={`Remove ${label}`}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-pine-deep/80 text-white text-sm font-bold leading-none"
          >
            ×
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-pine/25 bg-pine/5 text-pine/50 text-sm font-bold cursor-pointer hover:border-pine/40">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onPick(f);
              e.target.value = "";
            }}
          />
          + Add photo
        </label>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-pine/15 rounded-3xl p-6 space-y-4">
      <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide">Log a catch</h3>
      {photoSlot(
        "Bump board photo",
        true,
        bumpFile,
        bumpPreview,
        setBump,
        "Fish on your measuring board, nose against the fence — this is the photo that scores."
      )}
      {photoSlot(
        "Holding photo",
        requireHoldPhoto,
        holdFile,
        holdPreview,
        setHold,
        requireHoldPhoto
          ? "You holding the fish — required by the organizer for this tournament."
          : "You holding the fish — optional, but a nice touch."
      )}
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
