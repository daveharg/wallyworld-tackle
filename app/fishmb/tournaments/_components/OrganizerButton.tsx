// "Manage my tournament" button — shows for organizers on the tournaments page.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

export function OrganizerButton() {
  const { user } = useFishAuth();
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fishFetch("/api/fishmb/tournaments?mine=1")
      .then((d: { tournaments?: { id: string; organizer_id: string; ends_at: string }[] }) => {
        const list = (d.tournaments ?? []) as {
          id: string;
          organizer_id: string;
          ends_at: string;
        }[];
        // Prefer a live tournament the user organizes, else any organized one.
        const now = Date.now();
        const mine = list.filter((t) => t.organizer_id === user.id);
        const live = mine.find((t) => new Date(t.ends_at).getTime() >= now);
        setTournamentId((live ?? mine[0])?.id ?? null);
      })
      .catch(() => {});
  }, [user]);

  if (!user || !tournamentId) return null;

  return (
    <Link
      href={`/fishmb/tournaments/${tournamentId}/manage`}
      className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
    >
      ⚙️ Manage my tournament
    </Link>
  );
}
