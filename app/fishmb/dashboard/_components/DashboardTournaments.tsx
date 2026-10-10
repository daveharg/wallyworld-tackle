// Dashboard "Tournaments" tab — the tournaments I'm in (organizing or joined).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { JoinByCode } from "../../tournaments/_components/JoinByCode";
import TournamentCreateSection from "./TournamentCreateSection";

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
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fishFetch("/api/fishmb/tournaments?mine=1")
      .then(async (d) => {
        const list = (d.tournaments ?? []) as MyTournament[];
        setTournaments(list);
        // Fetch current standings for all tournaments (live and past).
        const ids = list.map((t) => t.id);
        const results: Standing[] = [];
        await Promise.all(
          ids.map(async (id) => {
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
  const getStatus = (t: MyTournament): { label: string; color: string } => {
    const start = new Date(t.starts_at).getTime();
    const end = new Date(t.ends_at).getTime();
    if (t.status === "completed" || end < now) {
      return { label: "Done", color: "text-pine/50 bg-pine/10" };
    }
    if (start <= now && end >= now) {
      return { label: "Live", color: "text-white bg-signal" };
    }
    return { label: "Upcoming", color: "text-signal-dark bg-gold/20" };
  };

  const live = tournaments.filter((t) => getStatus(t).label === "Live");
  const upcoming = tournaments.filter((t) => getStatus(t).label === "Upcoming");
  const past = tournaments.filter((t) => getStatus(t).label === "Done");
  const [showOthers, setShowOthers] = useState(false);
  const [otherTournaments, setOtherTournaments] = useState<MyTournament[]>([]);

  useEffect(() => {
    if (!showOthers || otherTournaments.length > 0) return;
    fishFetch("/api/fishmb/tournaments")
      .then((d) => {
        const all = (d.tournaments ?? []) as MyTournament[];
        const mine = new Set(tournaments.map((t) => t.id));
        setOtherTournaments(all.filter((t) => !mine.has(t.id)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOthers]);

  const row = (t: MyTournament, isPast = false) => {
    const standing = standings.find((s) => s.tournamentId === t.id);
    const status = getStatus(t);
    const isOrganizer = t.organizer_id === user?.id;
    // Live tournaments you're in go to the live hub.
    const href = status.label === "Live" ? `/fishmb/tournaments/${t.id}/live` : `/fishmb/tournaments/${t.id}`;
    return (
      <Link
        key={t.id}
        href={href}
        className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
      >
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
            standing
              ? "bg-gold/20 border border-gold/40 text-pine"
              : "bg-pine/5 border border-pine/10 text-pine/30"
          }`}
        >
          {standing ? `#${standing.rank}` : "NR"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
            {isOrganizer && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-pine">
                Organizer
              </span>
            )}
          </span>
          <span className="block font-bold text-pine truncate">{t.name}</span>
          <span className="block text-xs text-pine/50 mt-0.5">
            {fmtRange(t.starts_at, t.ends_at)}
            {standing ? (
              <span className="font-bold text-signal-dark">
                {" "}· Rank {standing.rank} of {standing.total}
              </span>
            ) : (
              <span className="text-pine/40"> · Not ranked yet</span>
            )}
          </span>
        </span>
        <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
      </Link>
    );
  };

  // Summary leaderboard across all tournaments with a known standing.
  const rankedStandings = standings
    .map((s) => ({ ...s, t: tournaments.find((t) => t.id === s.tournamentId) }))
    .filter((s) => s.t && !isNaN(new Date(s.t.ends_at).getTime()))
    .sort((a, b) => a.rank - b.rank);

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
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          {creating ? "✕ Cancel" : "＋ Start one"}
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5">
          <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            Create a tournament
          </h3>
          <TournamentCreateSection />
        </div>
      )}

      {/* Join with a code */}
      <div className="bg-white border border-pine/10 rounded-3xl p-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-3">
          Join with a code
        </h3>
        <JoinByCode />
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
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Start a tournament
            </button>
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
          {rankedStandings.length > 0 && (
            <div className="bg-pine rounded-3xl p-5 text-white shadow-lg">
              <h3 className="text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                🏆 Your standings
              </h3>
              <div className="space-y-2">
                {rankedStandings.map((s) => (
                  <Link
                    key={s.tournamentId}
                    href={`/fishmb/tournaments/${s.tournamentId}`}
                    className="flex items-center gap-3 bg-white/10 hover:bg-white/15 rounded-2xl px-3 py-2.5 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-gold/25 border border-gold/50 flex items-center justify-center font-black text-gold text-sm shrink-0">
                      {s.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-sm truncate">{s.t!.name}</span>
                      <span className="block text-xs text-white/50">
                        Rank {s.rank} of {s.total}
                      </span>
                    </span>
                    <span className="text-white/30 text-lg leading-none shrink-0">›</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {live.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Live now
              </h3>
              <div className="space-y-2">{live.map((t) => row(t, false))}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Upcoming
              </h3>
              <div className="space-y-2">{upcoming.map((t) => row(t, false))}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-pine/45 mb-2">
                Done
              </h3>
              <div className="space-y-2 opacity-75">{past.map((t) => row(t, true))}</div>
            </div>
          )}
          {/* Other tournaments you haven't joined */}
          <div>
            <button
              onClick={() => setShowOthers((s) => !s)}
              className="w-full flex items-center justify-between bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
            >
              <span className="text-xs font-black uppercase tracking-wider text-pine/45">
                Other tournaments
              </span>
              <span className="text-pine/40 text-lg leading-none">{showOthers ? "▾" : "▸"}</span>
            </button>
            {showOthers && (
              <div className="space-y-2 mt-2">
                {otherTournaments.length === 0 ? (
                  <p className="text-pine/50 text-sm text-center py-4">No other tournaments right now.</p>
                ) : (
                  otherTournaments.map((t) => {
                    const status = getStatus(t);
                    return (
                      <Link
                        key={t.id}
                        href={`/fishmb/tournaments/${t.id}`}
                        className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="block font-bold text-pine truncate">{t.name}</span>
                          <span className="block text-xs text-pine/50 mt-0.5">
                            {t.participant_count} anglers · {fmtRange(t.starts_at, t.ends_at)}
                          </span>
                        </span>
                        <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
