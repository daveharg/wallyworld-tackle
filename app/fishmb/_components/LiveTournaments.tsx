"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveTournament {
  id: string;
  name: string;
  status: string;
  lake_ids: string[];
  species: string[];
  starts_at: string;
  ends_at: string;
  entry_count: number;
}

/**
 * Live tournament list — fetched client-side so newly posted tournaments
 * appear immediately, not on the next static rebuild.
 */
export function LiveTournaments() {
  const [tournaments, setTournaments] = useState<LiveTournament[] | null>(null);

  useEffect(() => {
    fetch("/api/fishmb/tournaments")
      .then((r) => r.json())
      .then((d) => {
        const list: LiveTournament[] = (d.tournaments ?? []).filter(
          (t: LiveTournament) => t.status === "upcoming" || t.status === "active"
        );
        setTournaments(list.slice(0, 6));
      })
      .catch(() => setTournaments([]));
  }, []);

  if (tournaments === null) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-pine/10 rounded-2xl p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <p className="text-pine/55 text-sm bg-white border border-pine/10 rounded-2xl p-6">
        No tournaments posted yet —{" "}
        <Link href="/fishmb/dashboard?tab=tournaments" className="text-signal-dark font-bold">
          be the first to run one
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tournaments.map((t) => (
        <Link
          key={t.id}
          href={`/fishmb/tournaments/${t.id}`}
          className="bg-white border border-pine/10 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-signal mb-1.5">
            {t.status === "active" ? "● Happening now" : "Upcoming"}
          </p>
          <h4 className="font-display font-bold text-pine text-lg uppercase tracking-wide leading-tight mb-1">
            {t.name}
          </h4>
          <p className="text-pine/55 text-sm">
            {t.lake_ids?.length > 1
              ? `${t.lake_ids.length} lakes`
              : t.lake_ids?.length === 1
                ? "1 lake"
                : "Open waters"}{" "}
            · {t.species?.length ? t.species.join(", ") : "All species"}
          </p>
          <p className="text-pine/45 text-xs mt-2">
            {new Date(t.starts_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
            {" → "}
            {new Date(t.ends_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}{t.entry_count} {t.entry_count === 1 ? "catch" : "catches"}
          </p>
        </Link>
      ))}
    </div>
  );
}
