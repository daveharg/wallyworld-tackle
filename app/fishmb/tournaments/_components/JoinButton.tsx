"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

export function JoinButton({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!user) {
      openLogin();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/join`, { method: "POST" });
      router.push(`/fishmb/tournaments/${tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={join}
        disabled={busy}
        className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider px-8 py-4 rounded-full transition-colors disabled:opacity-50 text-base"
      >
        {busy ? "Joining…" : user ? `Join ${tournamentName}` : "Log in & join"}
      </button>
      {!user && (
        <p className="text-pine/55 text-sm mt-4">
          You&apos;ll log in with Google (or create a free account) — the same account as the FishMB app.
        </p>
      )}
      {error && <p className="text-signal-dark text-sm mt-3">{error}</p>}
    </div>
  );
}
