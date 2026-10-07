"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { SubmitEntry } from "./SubmitEntry";

interface Detail {
  joined: boolean;
  is_organizer: boolean;
  tournament: { status: string; species: string[] };
}

/** Join / submit-catch / manage buttons on the tournament detail page. */
export function TournamentActions({ tournamentId }: { tournamentId: string }) {
  const { user, openLogin } = useFishAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fishFetch(`/api/fishmb/tournaments/${tournamentId}`)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tournamentId, user]);

  const join = async () => {
    if (!user) {
      openLogin();
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/join`, { method: "POST" });
      const d = await fishFetch(`/api/fishmb/tournaments/${tournamentId}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  };

  if (!detail) {
    return <span className="w-40 h-12 rounded-full bg-pine/10 animate-pulse" />;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {detail.is_organizer && (
          <Link
            href={`/fishmb/tournaments/${tournamentId}/manage`}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
          >
            Manage
          </Link>
        )}
        {!detail.joined ? (
          <button
            onClick={join}
            disabled={joining}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors disabled:opacity-50"
          >
            {joining ? "Joining…" : user ? "Join tournament" : "Log in to join"}
          </button>
        ) : (
          !detail.is_organizer && (
            <button
              onClick={() => setShowSubmit((s) => !s)}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              {showSubmit ? "Close" : "Log a catch"}
            </button>
          )
        )}
      </div>
      {error && <p className="text-signal-dark text-xs">{error}</p>}
      {showSubmit && detail.joined && (
        <div className="w-full max-w-md mt-2">
          <SubmitEntry tournamentId={tournamentId} species={detail.tournament.species} />
        </div>
      )}
    </div>
  );
}
