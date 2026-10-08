"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

/**
 * Single-use entry key redemption on a tournament's join page.
 * The organizer hands each angler a key after they pay; redeeming it
 * joins the angler (the key is consumed exactly once).
 */
export function RedeemKey({ tournamentId }: { tournamentId: string }) {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async () => {
    if (!user) {
      openLogin();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const d = await fishFetch(`/api/fishmb/tournaments/${tournamentId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      router.push(`/fishmb/tournaments/${d.tournament_id ?? tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not redeem that key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 bg-paper-deep border border-pine/10 rounded-3xl p-6 max-w-md mx-auto">
      <h2 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-1">
        Have an entry key?
      </h2>
      <p className="text-pine/55 text-sm mb-4">
        Got a key from the organizer after paying? Enter it here — each key
        joins one angler, once.
      </p>
      <div className="flex gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="e.g. X7KQ2M9P"
          maxLength={16}
          className="flex-1 min-w-0 bg-white border border-pine/20 rounded-full px-5 py-3 text-pine font-bold tracking-[0.2em] uppercase placeholder:text-pine/30 placeholder:tracking-normal focus:outline-none focus:border-signal"
        />
        <button
          onClick={redeem}
          disabled={busy || !key.trim()}
          className="shrink-0 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : "Redeem"}
        </button>
      </div>
      {error && <p className="text-signal-dark text-sm mt-3">{error}</p>}
    </div>
  );
}
