"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

/**
 * Invite code stays private: the detail API tells us whether the viewer has
 * joined or is the organizer — only then do we render the code.
 */
export function InviteCodeReveal({ tournamentId }: { tournamentId: string }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    fishFetch(`/api/fishmb/tournaments/${tournamentId}`)
      .then((d) => {
        if ((d.joined || d.is_organizer) && d.tournament?.invite_code)
          setCode(d.tournament.invite_code as string);
      })
      .catch(() => {});
  }, [tournamentId]);

  if (!code) return null;

  return (
    <div className="bg-white border border-pine/10 rounded-2xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
        Your invite code
      </h3>
      <p className="text-pine font-bold tracking-[0.3em] text-lg">{code}</p>
      <p className="text-pine/50 text-xs mt-1">
        Only share it with anglers you want in this tournament.
      </p>
    </div>
  );
}
