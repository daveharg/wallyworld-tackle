"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../../_components/FishAuth";
import { fishFetch, formatDateTime } from "../../../_components/fishFetch";
import { compressImage } from "../../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import { CatchMap } from "../../_components/CatchMap";
import { EntryKeys } from "../../_components/EntryKeys";
import { EntryFees } from "../../_components/EntryFees";
import { PayoutEditor } from "../../_components/PayoutEditor";
import type { PayoutTier } from "@/lib/fish/tournaments";

interface Entry {
  id: string;
  user_name: string;
  photo_url: string;
  photo_urls: string[] | null;
  species: string;
  length_inches: number | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  notes: string;
  duplicate_of: string | null;
  similar_photo_of: string | null;
  similar_catch_of: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  captured_at: string | null;
  time_flag: string | null;
  lake_distance_km: number | null;
  location_flag: string | null;
}

interface Detail {
  tournament: {
    id: string;
    name: string;
    description: string;
    organizer_id: string;
    starts_at: string;
    ends_at: string;
    invite_code: string;
    status: string;
    scoring: string;
    rules: string;
    species: string[];
    lake_ids: string[];
    entry_fee_cents: number;
    payouts: PayoutTier[];
    auto_approve_entries: boolean;
    photo_mode?: string | null;
    cover_photo_url: string | null;
    venue_name: string | null;
    venue_address: string | null;
  };
  entries: Entry[];
  is_organizer: boolean;
}

/** ISO timestamp → value for <input type="datetime-local">. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Search-as-you-type lake picker; selected lakes show as removable chips. */
function LakePicker({
  selected,
  onChange,
}: {
  selected: { id: string; name: string }[];
  onChange: (v: { id: string; name: string }[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; region: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      fishFetch(`/api/fishmb/search?q=${encodeURIComponent(q.trim())}`)
        .then((d) => {
          setHits((d.lakes ?? []) as { id: string; name: string; region: string }[]);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = (lake: { id: string; name: string }) => {
    if (!selected.some((s) => s.id === lake.id)) onChange([...selected, lake]);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.length === 0 && <span className="text-pine/40 text-sm">Any Manitoba water</span>}
        {selected.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(selected.filter((s) => s.id !== l.id))}
            className="bg-pine/10 text-pine text-xs font-bold px-3 py-1.5 rounded-full hover:bg-signal/10 hover:text-signal-dark"
            title="Remove"
          >
            {l.name} ✕
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a lake name to add…"
        className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
      />
      {open && hits.length > 0 && (
        <div className="absolute z-20 inset-x-0 mt-1 bg-white border border-pine/15 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => add(h)}
              className="w-full text-left px-4 py-2.5 hover:bg-paper-deep text-sm text-pine"
            >
              <span className="font-bold">{h.name}</span>
              {h.region && <span className="text-pine/50"> · {h.region}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";
const labelCls =
  "block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5";

/** Full tournament editor — the organizer can fix any mistake made at creation. */
function EditTournament({ tournament, onSaved }: { tournament: Detail["tournament"]; onSaved: () => void }) {
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(tournament.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(tournament.ends_at));
  const [status, setStatus] = useState(tournament.status);
  const [scoring, setScoring] = useState(tournament.scoring);
  const [rules, setRules] = useState(tournament.rules ?? "");
  const [speciesText, setSpeciesText] = useState((tournament.species ?? []).join(", "));
  const [lakes, setLakes] = useState<{ id: string; name: string }[]>(
    (tournament.lake_ids ?? []).map((id) => ({ id, name: id }))
  );
  const [entryFee, setEntryFee] = useState(
    tournament.entry_fee_cents ? (tournament.entry_fee_cents / 100).toFixed(2).replace(/\.00$/, "") : ""
  );
  const [payouts, setPayouts] = useState<PayoutTier[]>(tournament.payouts ?? []);
  const [autoApprove, setAutoApprove] = useState(!!tournament.auto_approve_entries);
  const [photoMode, setPhotoMode] = useState(tournament.photo_mode === "measure_only" ? "measure_only" : "standard");
  const [cover, setCover] = useState<string | null>(tournament.cover_photo_url ?? null);
  const [venueName, setVenueName] = useState(tournament.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(tournament.venue_address ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Resolve names for the lakes already attached to this tournament.
  useEffect(() => {
    const ids = (tournament.lake_ids ?? []).filter(Boolean);
    if (ids.length === 0) return;
    fishFetch(`/api/fishmb/search?ids=${encodeURIComponent(ids.join(","))}`)
      .then((d) => {
        const rows = (d.lakes ?? []) as { id: string; name: string }[];
        if (rows.length) setLakes(rows.map((r) => ({ id: r.id, name: r.name })));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadCover = async (file: File) => {
    setUploading(true);
    setNote(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
      setCover(up.url as string);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not upload the cover photo.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const startIso = startsAt ? new Date(startsAt).toISOString() : "";
      const endIso = endsAt ? new Date(endsAt).toISOString() : "";
      if (!name.trim()) throw new Error("Give the tournament a name.");
      if (!startIso || !endIso) throw new Error("Set a start and end date/time.");
      if (new Date(endIso) <= new Date(startIso))
        throw new Error("The end must be after the start.");
      await fishFetch(`/api/fishmb/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          starts_at: startIso,
          ends_at: endIso,
          status,
          scoring,
          rules,
          species: speciesText.split(",").map((s) => s.trim()).filter(Boolean),
          lake_ids: lakes.map((l) => l.id),
          entry_fee_cents: Math.max(0, Math.round((parseFloat(entryFee) || 0) * 100)),
          payouts,
          auto_approve_entries: autoApprove,
          photo_mode: photoMode,
          cover_photo_url: cover ?? "",
          venue_name: venueName,
          venue_address: venueAddress,
        }),
      });
      setNote("Tournament updated!");
      onSaved();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 mb-8">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
        Edit tournament
      </h2>
      <p className="text-pine/55 text-sm mb-6">
        Fix anything — details, dates, waters, fees, payouts. One save updates the whole tournament.
      </p>
      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-5">{note}</p>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Tournament name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Starts</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ends</label>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Scoring</label>
          <select value={scoring} onChange={(e) => setScoring(e.target.value)} className={inputCls}>
            <option value="longest">Longest fish</option>
            <option value="total">Total length</option>
            <option value="count">Most fish</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Entry fee (dollars, blank = free)</label>
          <input
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            inputMode="decimal"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Waters (search Manitoba lakes)</label>
          <LakePicker selected={lakes} onChange={setLakes} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Species (comma-separated, blank = all)</label>
          <input
            value={speciesText}
            onChange={(e) => setSpeciesText(e.target.value)}
            placeholder="Walleye, Northern pike"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Rules</label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={5000}
            rows={4}
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Payouts</label>
          <PayoutEditor value={payouts} onChange={setPayouts} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Catch photos</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["standard", "📸 Standard", "Your rules decide — hero shots welcome"],
              ["measure_only", "📏 Measure only", "Just the fish on the board — no posed photo needed"],
            ].map(([v, l, d]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPhotoMode(v)}
                className={`py-3 px-3 rounded-2xl text-sm font-bold transition-colors text-left ${photoMode === v ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine/70"}`}
              >
                {l}
                <span className={`block text-xs font-normal mt-1 ${photoMode === v ? "text-white/85" : "text-pine/50"}`}>
                  {d}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="w-5 h-5 accent-[#1d4d2b]"
            />
            <span className="text-pine text-sm font-bold">
              Auto-approve catches{" "}
              <span className="font-normal text-pine/55">
                (entries hit the leaderboard instantly, no review)
              </span>
            </span>
          </label>
        </div>
        <div>
          <label className={labelCls}>Cover photo</label>
          {cover ? (
            <div className="relative rounded-2xl overflow-hidden border border-pine/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="Tournament cover" className="w-full h-40 object-cover" />
              <button
                onClick={() => setCover(null)}
                className="absolute top-2 right-2 bg-pine-deep/80 text-white text-xs font-bold px-3 py-1.5 rounded-full"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 bg-paper-deep border border-dashed border-pine/30 rounded-2xl px-4 py-8 text-sm text-pine/60 cursor-pointer hover:border-signal transition-colors">
              {uploading ? "Uploading…" : "📷 Upload a cover photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                }}
              />
            </label>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Venue name</label>
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Selkirk Park"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Venue address</label>
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              maxLength={200}
              placeholder="e.g. 112 Main St, Selkirk MB"
              className={inputCls}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-full disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}


export default function ManageTournamentPage({ params }: { params: { id: string } }) {  const { user, openLogin } = useFishAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fishFetch(`/api/fishmb/tournaments/${params.id}/entries`);
      setDetail(d as Detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    }
  }, [params.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const review = async (entryId: string, status: "approved" | "rejected") => {
    const note = status === "rejected" ? window.prompt("Reason for rejection (shown to the angler):") ?? "" : "";
    setReviewing(entryId);
    try {
      await fishFetch(`/api/fishmb/tournaments/${params.id}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_note: note }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setReviewing(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-3xl mb-4">Organizer dashboard</h1>
        <p className="text-pine/60 mb-6">Log in to manage your tournament.</p>
        <button onClick={openLogin} className="bg-signal text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full">
          Log in
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-signal-dark">{error}</p>
        <Link href="/fishmb/tournaments" className="text-signal font-bold text-sm uppercase tracking-wider">← Back to tournaments</Link>
      </div>
    );
  }

  if (!detail) {
    return <div className="max-w-5xl mx-auto px-4 py-16"><div className="h-64 bg-pine/5 rounded-3xl animate-pulse" /></div>;
  }

  if (!detail.is_organizer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-3xl mb-4">Not your tournament</h1>
        <p className="text-pine/60 mb-6">Only the organizer can open this dashboard.</p>
        <Link href={`/fishmb/tournaments/${params.id}`} className="text-signal font-bold text-sm uppercase tracking-wider">View tournament →</Link>
      </div>
    );
  }

  const t = detail.tournament;
  const pending = detail.entries.filter((e) => e.status === "pending");
  const decided = detail.entries.filter((e) => e.status !== "pending");
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/fishmb/tournaments/join/${t.invite_code}` : "";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <Link href={`/fishmb/tournaments/${t.id}`} className="text-sm font-bold text-signal uppercase tracking-wider">
        ← View tournament
      </Link>
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mt-4 mb-2">{t.name}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <p className="text-pine/60">Organizer dashboard</p>
        <Link
          href={`/fishmb/tournaments/${t.id}/leaderboard`}
          className="bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-pine transition-colors"
        >
          ⛶ Full-screen board
        </Link>
      </div>

      {/* Catch map — every GPS-stamped catch plotted, for boundary checks */}
      <section className="mb-8">
        <CatchMap
          pins={detail.entries
            .filter((e) => e.latitude !== null && e.longitude !== null)
            .map((e) => ({
              id: e.id,
              lat: e.latitude as number,
              lng: e.longitude as number,
              label: `${e.user_name} — ${e.species}${e.length_inches ? ` ${e.length_inches}″` : ""}`,
              status: e.status,
            }))}
        />
      </section>

      {/* Invite */}
      <section className="bg-pine rounded-3xl p-6 md:p-8 mb-8">
        <h2 className="font-display font-bold uppercase text-white text-xl tracking-wide mb-2">Invite anglers</h2>
        <p className="text-white/70 text-sm mb-4">Share this link — anglers see the full tournament details first, then create a free account and join with one tap. The invite code is already in the link.</p>
        <div className="flex flex-wrap gap-3 items-center">
          <code className="bg-white/10 text-gold font-bold tracking-[0.2em] px-5 py-3 rounded-full text-lg">{t.invite_code}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `Join ${t.name} on FishMB`,
                    text: `You're invited to ${t.name} on FishMB — create a free account and join with the code ${t.invite_code}.`,
                    url: inviteUrl,
                  });
                } catch {
                  /* user dismissed the share sheet */
                }
              } else {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="bg-white/15 hover:bg-white/25 text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
          >
            📤 Share
          </button>
        </div>
      </section>

      {/* Entry fees — organizer tracks who has paid */}
      <EntryFees tournamentId={t.id} entryFeeCents={t.entry_fee_cents} />

      {/* Full tournament editor */}
      <EditTournament tournament={t} onSaved={load} />

      {/* Single-use entry keys */}
      <EntryKeys tournamentId={t.id} />

      {/* Pending review */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-4">
        Needs review ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="text-pine/55 mb-8">Nothing waiting — every catch has been reviewed.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {pending.map((e) => (
            <div key={e.id} className="bg-white border border-gold/50 rounded-3xl overflow-hidden">
              {(() => {
                const photos = e.photo_urls && e.photo_urls.length > 0 ? e.photo_urls : [e.photo_url];
                return (
                  <div className="flex gap-2 overflow-x-auto bg-pine-deep/10 p-2 snap-x">
                    {photos.map((src, i) => (
                      <a
                        key={i}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="snap-start shrink-0 w-40 aspect-video rounded-xl overflow-hidden bg-pine-deep/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`${e.species} by ${e.user_name} — photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                );
              })()}
              <div className="p-5">
                <p className="font-bold text-pine">{e.species}{e.length_inches ? ` · ${Number(e.length_inches).toFixed(1)}"` : ""}</p>
                <p className="text-pine/55 text-xs mt-1">{e.user_name}</p>
                <p className="text-pine/70 text-xs mt-1">
                  📸 Caught:{" "}
                  {e.captured_at ? (
                    <span className="font-bold text-pine">{formatDateTime(e.captured_at)}</span>
                  ) : (
                    <span className="text-pine/50">No capture time recorded</span>
                  )}{" "}
                  <span className="text-pine/45">(official time)</span>
                </p>
                <p className="text-pine/45 text-xs">Uploaded: {formatDateTime(e.created_at)}</p>
                {e.captured_at ? (
                  (() => {
                    const c = new Date(e.captured_at as string).getTime();
                    const inside =
                      !isNaN(c) &&
                      c >= new Date(t.starts_at).getTime() &&
                      c <= new Date(t.ends_at).getTime();
                    return inside ? (
                      <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2">
                        ✓ Inside tournament window
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                        ⚠ Outside tournament window — verify before approving.
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-xs font-bold text-pine/50 bg-pine/5 rounded-xl px-3 py-2 mt-2">
                    Time not recorded
                  </p>
                )}
                {e.latitude !== null && e.longitude !== null ? (
                  <a
                    href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-signal-dark text-xs font-bold underline"
                  >
                    📍 {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}{e.gps_accuracy ? ` (±${Math.round(e.gps_accuracy)}m)` : ""}
                  </a>
                ) : (
                  <p className="text-xs text-pine/45">No GPS attached</p>
                )}
                {e.duplicate_of && (
                  <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                    ⚠ Duplicate photo — this exact image was already submitted in this tournament.
                  </p>
                )}
                {e.similar_photo_of && (
                  <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                    ⚠ Possible same fish — this photo looks very similar to another entry&apos;s
                    photo. Could be two pictures of one fish. Compare before approving.
                  </p>
                )}
                {e.similar_catch_of && (
                  <p className="text-xs font-bold text-gold-dark bg-gold/15 border border-gold/40 rounded-xl px-3 py-2 mt-2">
                    🐟 Possible duplicate catch — same angler, same species, nearly the same
                    length, caught within 30 minutes of another entry. Verify it&apos;s a
                    different fish before approving.
                  </p>
                )}
                {e.time_flag === "future_timestamp" && (
                  <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                    ⚠ Clock flag — the phone claimed a capture time in the future. Verify before approving.
                  </p>
                )}
                {e.location_flag === "outside-lake" && (
                  <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                    ⚠ Outside tournament waters — caught{" "}
                    {e.lake_distance_km !== null ? `${Number(e.lake_distance_km).toFixed(0)} km ` : ""}from the
                    nearest chosen lake. Verify before approving.
                  </p>
                )}
                {e.location_flag === "no-gps" && (
                  <p className="text-xs font-bold text-gold-dark bg-gold/15 border border-gold/40 rounded-xl px-3 py-2 mt-2">
                    📍 No location to verify — this catch has no GPS, so it couldn&apos;t be checked
                    against the tournament waters.
                  </p>
                )}
                {e.lake_distance_km !== null && e.location_flag !== "outside-lake" && (
                  <p className="text-xs text-pine/55 mt-2">
                    ✓ {Number(e.lake_distance_km).toFixed(1)} km from tournament waters
                  </p>
                )}
                {e.notes && <p className="text-xs text-pine/60 mt-2">“{e.notes}”</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => review(e.id, "approved")}
                    disabled={reviewing === e.id}
                    className="flex-1 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded-full disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(e.id, "rejected")}
                    disabled={reviewing === e.id}
                    className="flex-1 border border-signal/50 text-signal-dark hover:bg-signal/10 font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded-full disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decided */}
      {decided.length > 0 && (
        <>
          <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-4">Reviewed</h2>
          <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden mb-8">
            {decided.map((e, i) => (
              <div key={e.id} className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? "border-t border-pine/10" : ""}`}>
                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${e.status === "approved" ? "bg-pine/10 text-pine" : "bg-signal/10 text-signal-dark"}`}>
                  {e.status}
                </span>
                <span className="text-sm text-pine flex-1">{e.user_name} — {e.species}{e.length_inches ? ` ${Number(e.length_inches).toFixed(1)}"` : ""}</span>
                {e.status === "approved" ? (
                  <button onClick={() => review(e.id, "rejected")} className="text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline">Disqualify</button>
                ) : (
                  <button onClick={() => review(e.id, "approved")} className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:underline">Reinstate</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
