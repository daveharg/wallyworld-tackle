"use client";

import type { PayoutTier } from "@/lib/fish/tournaments";

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function potDollars(entryFeeCents: number, participantCount: number): number {
  return (entryFeeCents / 100) * participantCount;
}

export function payoutDollars(
  payouts: PayoutTier[],
  entryFeeCents: number,
  participantCount: number
): { place: number; dollars: number; kind: string }[] {
  const pot = potDollars(entryFeeCents, participantCount);
  return payouts.map((p) => ({
    place: p.place,
    dollars: p.type === "percent" ? (pot * p.value) / 100 : p.value,
    kind: p.type === "percent" ? `${p.value}% of pot` : "fixed",
  }));
}

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: n % 1 ? 2 : 0 });

/** Entry fee + pot + payout breakdown card for the tournament detail page. */
export function PrizePot({
  entryFeeCents,
  participantCount,
  payouts,
}: {
  entryFeeCents: number;
  participantCount: number;
  payouts: PayoutTier[];
}) {
  if (!entryFeeCents && payouts.length === 0) return null;
  const pot = potDollars(entryFeeCents, participantCount);
  const rows = payoutDollars(payouts, entryFeeCents, participantCount);
  return (
    <div className="bg-paper-deep border border-gold/40 rounded-2xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
        Prize pot
      </h3>
      <p className="font-display font-bold text-pine text-3xl">{money(pot)}</p>
      <p className="text-pine/55 text-sm mt-1">
        {entryFeeCents > 0
          ? `${money(entryFeeCents / 100)} × ${participantCount} ${participantCount === 1 ? "angler" : "anglers"}`
          : "No entry fee — prizes from the organizer"}
      </p>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.place} className="flex justify-between text-pine">
              <span className="font-bold">{ordinal(r.place)} place</span>
              <span>
                {money(r.dollars)} <span className="text-pine/45 text-xs">({r.kind})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Licence warning for big tournaments (Dave's rule: over 25 anglers needs a licence). */
export function LicenceNotice({
  participantCount,
  maxParticipants,
}: {
  participantCount: number;
  maxParticipants: number | null;
}) {
  const big = participantCount > 25 || (maxParticipants !== null && maxParticipants > 25);
  return (
    <div
      className={`rounded-2xl p-5 mt-4 text-sm ${
        big ? "bg-signal/10 border border-signal/40" : "bg-pine/5 border border-pine/10"
      }`}
    >
      <p className="font-bold text-pine uppercase tracking-wider text-xs mb-1.5">
        {big ? "⚠️ Tournament licence required" : "Know the law"}
      </p>
      <p className="text-pine/70">
        In Manitoba, fishing tournaments with <strong>more than 25 participants</strong> need a
        provincial tournament licence.{" "}
        <a
          href="https://www.manitobaelicensing.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal-dark font-bold underline"
        >
          Get a licence at manitobaelicensing.ca
        </a>
        .
      </p>
      <p className="text-pine/55 text-xs mt-2">
        FishMB is a listings and leaderboard tool only — organizers are responsible for running a
        legal event. We are not responsible if you break the law.
      </p>
    </div>
  );
}
