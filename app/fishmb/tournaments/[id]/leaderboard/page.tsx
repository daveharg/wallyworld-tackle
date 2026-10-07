"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Row {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  fish_count: number;
  score: number;
}

interface Board {
  tournament: {
    id: string;
    name: string;
    status: string;
    scoring: string;
    starts_at: string;
    ends_at: string;
  };
  leaderboard: Row[];
}

/**
 * Full-screen tournament leaderboard — built to be put on a TV, projector,
 * or phone at the event. Big type, auto-refreshes every 30 seconds.
 */
export default function LeaderboardDisplayPage({ params }: { params: { id: string } }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/fishmb/tournaments/${params.id}/leaderboard`);
      if (!res.ok) return;
      setBoard(await res.json());
      setUpdatedAt(new Date());
    } catch {
      // keep showing the last good board
    }
  }, [params.id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const goFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const scoreLabel =
    board?.tournament.scoring === "total"
      ? "total in."
      : board?.tournament.scoring === "count"
        ? "fish"
        : "best in.";

  return (
    <div className="min-h-screen bg-pine-deep text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-12 pt-6 md:pt-8 pb-4">
        <div>
          <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-1">
            FishMB tournament {board ? `· ${board.tournament.status}` : ""}
          </p>
          <h1 className="font-display font-bold uppercase tracking-wide text-3xl md:text-5xl">
            {board?.tournament.name ?? "Loading…"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-white/40 text-xs uppercase tracking-wider">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ""}
          </span>
          <button
            onClick={goFullscreen}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-full transition-colors"
          >
            ⛶ Full screen
          </button>
          {board && (
            <Link
              href={`/fishmb/tournaments/${board.tournament.id}`}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-full transition-colors"
            >
              ← Tournament
            </Link>
          )}
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 px-6 md:px-12 pb-10">
        {!board ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/20 border-t-gold rounded-full animate-spin" />
          </div>
        ) : board.leaderboard.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <p className="font-display font-bold uppercase text-4xl md:text-6xl text-white/30 tracking-wide">
              No scores yet
            </p>
            <p className="text-white/50 mt-3">
              The board lights up as the organizer approves catches.
            </p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {board.leaderboard.map((row, i) => (
              <div
                key={row.user_id}
                className={`flex items-center gap-4 md:gap-8 px-4 md:px-8 py-4 md:py-6 rounded-2xl mb-3 ${
                  i === 0
                    ? "bg-gold/20 border-2 border-gold/60"
                    : i < 3
                      ? "bg-white/10 border border-white/10"
                      : "bg-white/5 border border-white/5"
                }`}
              >
                <span
                  className={`font-display font-bold w-12 md:w-20 text-4xl md:text-6xl ${
                    i === 0 ? "text-gold" : "text-white/40"
                  }`}
                >
                  {i + 1}
                </span>
                {row.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.avatar_url}
                    alt=""
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-signal flex items-center justify-center font-bold text-xl md:text-2xl">
                    {row.user_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-bold flex-1 text-xl md:text-3xl truncate">
                  {row.user_name}
                </span>
                <span className="text-white/50 text-sm md:text-lg hidden sm:inline">
                  {row.fish_count} fish
                </span>
                <span className="font-display font-bold text-3xl md:text-5xl text-gold">
                  {row.score.toFixed(1)}
                </span>
                <span className="text-white/40 text-xs md:text-sm uppercase tracking-wider hidden md:inline">
                  {scoreLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-6 md:px-12 pb-6 flex items-center justify-between text-white/30 text-xs uppercase tracking-wider">
        <span>FishMB · wallyworldtackle.ca/fishmb</span>
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
          </span>
          Live
        </span>
      </footer>
    </div>
  );
}
