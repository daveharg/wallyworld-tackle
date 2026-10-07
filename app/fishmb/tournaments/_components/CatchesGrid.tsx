"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { formatDateTime } from "../../_components/formatDate";

interface Entry {
  id: string;
  photo_url: string;
  species: string;
  length_inches: number | null;
  user_name: string;
  status: string;
  created_at: string;
}

/** Catches grid: approved for everyone, plus your own pending entries with a badge. */
export function CatchesGrid({ tournamentId }: { tournamentId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fishFetch(`/api/fishmb/tournaments/${tournamentId}/entries`)
      .then((d) => {
        if (!cancelled) setEntries(d.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  if (entries === null) {
    return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="aspect-square bg-pine/5 rounded-2xl animate-pulse" />
      ))}
    </div>;
  }

  if (entries.length === 0) {
    return <p className="text-pine/55">Nothing here yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {entries.map((e) => (
        <div key={e.id} className="bg-white border border-pine/10 rounded-2xl overflow-hidden">
          <div className="aspect-square bg-pine-deep/10 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.photo_url}
              alt={`${e.species} caught by ${e.user_name}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {e.status === "pending" && (
              <span className="absolute top-2 left-2 bg-gold text-pine text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                Waiting for review
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="font-bold text-pine text-sm">
              {e.species}
              {e.length_inches ? ` · ${Number(e.length_inches).toFixed(1)}"` : ""}
            </p>
            <p className="text-pine/55 text-xs mt-1">
              {e.user_name} · {formatDateTime(e.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
