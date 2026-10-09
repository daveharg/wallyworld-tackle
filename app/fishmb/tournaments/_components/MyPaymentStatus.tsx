"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** What a joined angler sees about their own entry-fee payment. Shown only
 *  for paid tournaments the viewer has joined. */
export function MyPaymentStatus({
  tournamentId,
  entryFeeCents,
}: {
  tournamentId: string;
  entryFeeCents: number;
}) {
  const [state, setState] = useState<{ joined: boolean; paid: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fishFetch(`/api/fishmb/tournaments/${tournamentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setState({
          joined: !!d.joined && !d.is_organizer,
          paid: !!d.my_payment?.paid,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tournamentId]);

  if (!state || !state.joined || entryFeeCents <= 0) return null;

  return state.paid ? (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mt-4">
      <p className="text-emerald-800 font-bold text-sm">
 Entry fee {centsToDollars(entryFeeCents)} — paid and confirmed by the organizer.
      </p>
    </div>
  ) : (
    <div className="bg-gold/15 border border-gold/40 rounded-2xl px-5 py-4 mt-4">
      <p className="text-pine font-bold text-sm">
        Entry fee {centsToDollars(entryFeeCents)} — payment pending.
      </p>
      <p className="text-pine/60 text-xs mt-1">
        Pay the organizer directly. They&apos;ll confirm it here once received.
      </p>
    </div>
  );
}
