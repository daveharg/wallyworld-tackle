"use client";

import { useCallback, useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface Participant {
  user_id: string;
  name: string;
  avatar_url: string | null;
  joined_at: string;
  paid: boolean;
  paid_at: string | null;
}

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Organizer-only entry-fee tracker. Money stays manual/off-platform — this
 *  records who the organizer confirms as paid; anglers see the confirmation
 *  on the tournament page. */
export function EntryFees({
  tournamentId,
  entryFeeCents,
}: {
  tournamentId: string;
  entryFeeCents: number;
}) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fishFetch(`/api/fishmb/tournaments/${tournamentId}/participants`);
    if (res.ok) {
      const data = await res.json();
      setParticipants(data.participants ?? []);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (p: Participant) => {
    setToggling(p.user_id);
    const res = await fishFetch(
      `/api/fishmb/tournaments/${tournamentId}/participants/${p.user_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !p.paid }),
      }
    );
    setToggling(null);
    if (res.ok) load();
  };

  if (entryFeeCents <= 0 || participants === null) return null;

  const paidCount = participants.filter((p) => p.paid).length;

  return (
    <section className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 mb-8">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
        Entry fees
      </h2>
      <p className="text-pine/55 text-sm mb-1">
        {centsToDollars(entryFeeCents)} per angler · {paidCount} of {participants.length} paid.
        Fees are collected by you directly — tap to confirm who&apos;s paid.
      </p>
      <p className="text-pine/45 text-xs mb-5">
        Anglers see their payment confirmation on the tournament page.
      </p>
      {participants.length === 0 ? (
        <p className="text-pine/55 text-sm">No anglers have joined yet.</p>
      ) : (
        <ul className="divide-y divide-pine/10">
          {participants.map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 py-3">
              <span
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  p.paid ? "bg-emerald-100 text-emerald-800" : "bg-pine/10 text-pine/60"
                }`}
              >
 {p.paid ? "" : p.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-pine text-sm truncate">{p.name}</p>
                <p className="text-pine/50 text-xs">
                  {p.paid && p.paid_at
                    ? `Paid · confirmed ${new Date(p.paid_at).toLocaleDateString()}`
                    : "Not paid yet"}
                </p>
              </div>
              <button
                onClick={() => toggle(p)}
                disabled={toggling === p.user_id}
                className={`shrink-0 font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full transition-colors disabled:opacity-50 ${
                  p.paid
                    ? "border border-pine/20 text-pine/60 hover:bg-pine/5"
                    : "bg-signal hover:bg-signal-dark text-white"
                }`}
              >
                {toggling === p.user_id ? "…" : p.paid ? "Undo" : "Mark paid"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
