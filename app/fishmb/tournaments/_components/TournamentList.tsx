"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface Tournament {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  participant_count: number;
  entry_count: number;
}

interface MyStatus {
  tournament_id: string;
  role: "organizer" | "participant";
}

/**
 * Tournament list with personalized status badges and sorting.
 * Your tournaments (organized or joined) come first; others are hidden
 * behind a "Show all" button.
 */
export function TournamentList({ tournaments }: { tournaments: Tournament[] }) {
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fishFetch("/api/fishmb/tournaments/my-status")
      .then((d) => {
        const data = d as { statuses?: MyStatus[] };
        const m = new Map<string, string>();
        (data.statuses ?? []).forEach((s) => m.set(s.tournament_id, s.role));
        setStatuses(m);
      })
      .catch(() => {});
  }, []);

  const now = Date.now();
  const getTiming = (t: Tournament): { label: string; color: string } => {
    const start = new Date(t.starts_at).getTime();
    const end = new Date(t.ends_at).getTime();
    if (t.status === "completed" || end < now) {
      return { label: "Ended", color: "text-pine/50 bg-pine/10" };
    }
    if (start <= now && end >= now) {
      return { label: "Live", color: "text-white bg-signal" };
    }
    return { label: "Upcoming", color: "text-signal-dark bg-gold/20" };
  };

  const mine = tournaments.filter((t) => statuses.has(t.id));
  const others = tournaments.filter((t) => !statuses.has(t.id));

  const renderBox = (t: Tournament) => {
    const timing = getTiming(t);
    const role = statuses.get(t.id);
    const isLive = timing.label === "Live";
    // Live tournaments you're in get the dedicated live hub page.
    const href = isLive && role ? `/fishmb/tournaments/${t.id}/live` : `/fishmb/tournaments/${t.id}`;
    return (
      <Link
        key={t.id}
        href={href}
        className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${timing.color}`}>
              {timing.label}
            </span>
            {role === "organizer" && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-pine">
                Organizer
              </span>
            )}
            {role === "participant" && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-pine bg-pine/10 border border-pine/20">
                Registered
              </span>
            )}
          </span>
          <span className="block font-bold text-pine truncate">{t.name}</span>
          <span className="block text-xs text-pine/50 mt-0.5">
            {t.participant_count} anglers · {t.entry_count} fish
          </span>
        </span>
        <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
      </Link>
    );
  };

  return (
    <>
      <h2 className="font-display font-bold uppercase text-pine text-3xl tracking-wide mb-2">
        App tournaments
      </h2>
      <p className="text-pine/60 text-sm mb-6 max-w-2xl">
        Run on FishMB — catch-photo format with anti-cheat built in.
      </p>

      {mine.length > 0 && (
        <>
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-pine/45 mb-3">
            Your tournaments
          </h3>
          <div className="space-y-2 mb-8">
            {mine.map(renderBox)}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-pine/45 mb-3">
            Other tournaments
          </h3>
          {!showAll ? (
            <button
              onClick={() => setShowAll(true)}
              className="w-full bg-white border border-pine/10 rounded-2xl px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-pine/60 hover:text-signal hover:border-signal/40 transition-colors"
            >
              Show all {others.length} tournament{others.length === 1 ? "" : "s"}
            </button>
          ) : (
            <>
              <div className="space-y-2">
                {others.map(renderBox)}
              </div>
              <button
                onClick={() => setShowAll(false)}
                className="mt-3 text-sm font-bold uppercase tracking-wider text-pine/50 hover:text-signal"
              >
                Hide
              </button>
            </>
          )}
        </>
      )}
    </>
  );
}
