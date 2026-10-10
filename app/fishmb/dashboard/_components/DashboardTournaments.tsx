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

interface Standing {
  tournamentId: string;
  rank: number;
  total: number;
  score: number;
  scoring: string;
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
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fishFetch("/api/fishmb/tournaments?mine=1")
      .then(async (d) => {
        const list = (d.tournaments ?? []) as MyTournament[];
        setTournaments(list);
        // Fetch current standings for live tournaments.
        const now = Date.now();
        const liveIds = list
          .filter((t) => new Date(t.ends_at).getTime() >= now)
          .map((t) => t.id);
        const results: Standing[] = [];
        await Promise.all(
          liveIds.map(async (id) => {
            try {
              const b = await fishFetch(`/api/fishmb/tournaments/${id}/leaderboard`);
              const board = (b.leaderboard ?? []) as {
                user_id: string;
                score: number;
              }[];
              const idx = board.findIndex((r) => r.user_id === user?.id);
              if (idx >= 0) {
                results.push({
                  tournamentId: id,
                  rank: idx + 1,
                  total: board.length,
                  score: board[idx].score,
                  scoring: (b.tournament as { scoring?: string })?.scoring ?? "longest",
                });
              }
            } catch {
              // Standings are nice-to-have; the tournament list still shows.
            }
          })
        );
        setStandings(results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const now = Date.now();
  const live = tournaments.filter((t) => new Date(t.ends_at).getTime() >= now);
  const past = tournaments.filter((t) => new Date(t.ends_at).getTime() < now);

  const row = (t: MyTournament, isPast = false) => {
    const standing = standings.find((s) => s.tournamentId === t.id);
    return (
      <Link
        key={t.id}
        href={`/fishmb/tournaments/${t.id}`}
        className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
      >
        {standing && !isPast && (
          <span className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center font-black text-pine text-sm shrink-0">
            #{standing.rank}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-pine truncate">{t.name}</span>
          <span className="block text-xs text-pine/50 mt-0.5">
            {fmtRange(t.starts_at, t.ends_at)}
            {standing && !isPast && (
              <span className="font-bold text-signal-dark"> · {standing.total} anglers</span>
            )}
          </span>
        </span>
        <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-pine/45">
            Your tournaments
          </h3>
          <Link
            href="/fishmb/tournaments/how-it-works"
            aria-label="How tournaments work"
            className="w-5 h-5 rounded-full bg-pine/10 hover:bg-pine/20 text-pine/60 text-xs font-black flex items-center justify-center transition-colors"
          >
            ?
          </Link>
        </div>
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
          {live.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Current tournaments
              </h3>
              <div className="space-y-2">{live.map((t) => row(t, false))}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Past tournaments
              </h3>
              <div className="space-y-2 opacity-75">{past.map((t) => row(t, true))}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
