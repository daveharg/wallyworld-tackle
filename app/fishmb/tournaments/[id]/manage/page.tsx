"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../../_components/FishAuth";
import { fishFetch, formatDateTime } from "../../../_components/fishFetch";

interface Entry {
  id: string;
  user_name: string;
  photo_url: string;
  species: string;
  length_inches: number | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  notes: string;
  duplicate_of: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  captured_at: string | null;
  time_flag: string | null;
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
  };
  entries: Entry[];
  is_organizer: boolean;
}

export default function ManageTournamentPage({ params }: { params: { id: string } }) {
  const { user, openLogin } = useFishAuth();
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
      <p className="text-pine/60 mb-8">Organizer dashboard</p>

      {/* Invite */}
      <section className="bg-pine rounded-3xl p-6 md:p-8 mb-8">
        <h2 className="font-display font-bold uppercase text-white text-xl tracking-wide mb-2">Invite anglers</h2>
        <p className="text-white/70 text-sm mb-4">Share this link — anglers log in (or create a free account) and join with one tap.</p>
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
        </div>
      </section>

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
              <div className="aspect-video bg-pine-deep/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.photo_url} alt={`${e.species} by ${e.user_name}`} className="w-full h-full object-cover" />
              </div>
              <div className="p-5">
                <p className="font-bold text-pine">{e.species}{e.length_inches ? ` · ${Number(e.length_inches).toFixed(1)}"` : ""}</p>
                <p className="text-pine/55 text-xs mt-1">
                  {e.user_name} · server time {formatDateTime(e.created_at)}
                </p>
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
                {e.time_flag === "future_timestamp" && (
                  <p className="text-xs font-bold text-signal-dark bg-signal/10 rounded-xl px-3 py-2 mt-2">
                    ⚠ Clock flag — the phone claimed a capture time in the future. Verify before approving.
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
