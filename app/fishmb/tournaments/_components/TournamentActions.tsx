"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { SubmitEntry } from "./SubmitEntry";

interface Detail {
  joined: boolean;
  is_organizer: boolean;
  tournament: { status: string; species: string[]; photo_mode?: string | null; require_hold_photo?: boolean };
}

/** Join / submit-catch / manage buttons on the tournament detail page. */
export function TournamentActions({ tournamentId }: { tournamentId: string }) {
  const { user, openLogin } = useFishAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
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
    if (!code.trim()) {
      setError("Enter the invite code to join.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code.trim() }),
      });
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
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Invite code"
              maxLength={12}
              className="w-32 bg-white border border-pine/20 rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-pine placeholder:text-pine/35 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-signal"
              aria-label="Invite code"
            />
            <button
              onClick={join}
              disabled={joining}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors disabled:opacity-50"
            >
              {joining ? "Joining…" : user ? "Join" : "Log in to join"}
            </button>
          </div>
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
          <SubmitEntry
            tournamentId={tournamentId}
            species={detail.tournament.species}
            photoMode={detail.tournament.photo_mode}
            requireHoldPhoto={detail.tournament.require_hold_photo ?? false}
          />
        </div>
      )}
    </div>
  );
}
