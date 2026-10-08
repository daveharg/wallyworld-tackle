// Dashboard "Tournaments" tab — the tournaments I'm in (organizing or joined).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

interface MyTournament {
  id: string;
  name: string;
  organizer_id: string;
  organizer_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  participant_count: number;
}

function fmtRange(start: string, end: string): string {
  try {
    const s = new Date(start).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const e = new Date(end).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  } catch {
    return "";
  }
}

export default function DashboardTournaments() {
  const { user } = useFishAuth();
  const [tournaments, setTournaments] = useState<MyTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fishFetch("/api/fishmb/tournaments?mine=1")
      .then((d) => setTournaments((d.tournaments ?? []) as MyTournament[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const now = Date.now();
  const live = tournaments.filter((t) => new Date(t.ends_at).getTime() >= now);
  const past = tournaments.filter((t) => new Date(t.ends_at).getTime() < now);

  const row = (t: MyTournament) => {
    const mine = t.organizer_id === user.id;
    return (
      <Link
        key={t.id}
        href={`/fishmb/tournaments/${t.id}`}
        className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-4 hover:border-signal/40 transition-colors"
      >
        <span className="w-11 h-11 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center text-xl shrink-0">
          🏆
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-pine truncate">{t.name}</span>
          <span className="block text-xs text-pine/50 mt-0.5">
            {fmtRange(t.starts_at, t.ends_at)} · {t.participant_count} angler{t.participant_count === 1 ? "" : "s"}
            {mine ? " · organized by you" : ` · by ${t.organizer_name}`}
          </span>
        </span>
        {mine && (
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-pine text-white rounded-full px-2.5 py-1">
            Organizer
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
          🏆 My tournaments
        </h2>
        <Link
          href="/fishmb/tournaments/create"
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          ＋ Start one
        </Link>
      </div>

      {loading ? (
        <div className="h-32 bg-pine/10 rounded-3xl animate-pulse" />
      ) : tournaments.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-pine/70 font-bold">No tournaments yet</p>
          <p className="text-pine/50 text-sm mt-1 mb-4">
            Run your own or join one with an invite link.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/fishmb/tournaments/create"
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Start a tournament
            </Link>
            <Link
              href="/fishmb/tournaments"
              className="bg-pine/10 hover:bg-pine/20 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Browse
            </Link>
          </div>
        </div>
      ) : (
        <>
          {live.length > 0 && <div className="space-y-2">{live.map(row)}</div>}
          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Past
              </h3>
              <div className="space-y-2 opacity-75">{past.map(row)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
