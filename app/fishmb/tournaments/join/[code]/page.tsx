import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentByInvite } from "@/lib/fish/tournaments";
import { JoinButton } from "../../_components/JoinButton";
import { PrizePot } from "../../_components/PrizePot";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

function fmt(d: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

/**
 * Shared invite landing page: a full "about the tournament" overview.
 * The invite code is already in the link — the visitor reads the details
 * first, then taps Join to create an account (or log in) and enter.
 */
export default async function JoinTournamentPage({ params }: { params: { code: string } }) {
  const t = await getTournamentByInvite(params.code);
  if (!t) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      {t.cover_photo_url && (
        <div className="rounded-3xl overflow-hidden mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.cover_photo_url} alt={t.name} className="w-full h-56 md:h-72 object-cover" />
        </div>
      )}

      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3 text-center">
        You&apos;re invited
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3 text-center">
        {t.name}
      </h1>
      <p className="text-pine/60 mb-8 text-center">
        Organized by {t.organizer_name} · {t.participant_count}{" "}
        {t.participant_count === 1 ? "angler" : "anglers"} in so far
      </p>

      <div className="bg-white border border-pine/10 rounded-3xl p-6 mb-6 space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-pine text-sm">
          <span>
            📅 <strong>{fmt(t.starts_at)}</strong> → <strong>{fmt(t.ends_at)}</strong>
          </span>
          {t.venue_name && <span>📍 {t.venue_name}</span>}
        </div>
        {t.description && (
          <p className="text-pine/75 leading-relaxed whitespace-pre-line">{t.description}</p>
        )}
        {t.species.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {t.species.map((s) => (
              <span
                key={s}
                className="bg-pine/5 border border-pine/15 text-pine text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              >
                🐟 {s}
              </span>
            ))}
          </div>
        )}
        {t.entry_fee_cents > 0 && (
          <p className="text-pine text-sm">
            Entry: <strong>{money(t.entry_fee_cents / 100)}</strong> per angler
          </p>
        )}
      </div>

      <div className="mb-6">
        <PrizePot
          entryFeeCents={t.entry_fee_cents ?? 0}
          participantCount={t.participant_count}
          payouts={t.payouts ?? []}
        />
      </div>

      {t.rules && (
        <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
            Tournament rules
          </h2>
          <p className="text-pine/80 whitespace-pre-line leading-relaxed text-sm">{t.rules}</p>
        </div>
      )}

      <div className="bg-pine rounded-3xl p-6 md:p-8 text-center mb-8">
        <h2 className="font-display font-bold uppercase text-white text-xl tracking-wide mb-2">
          Ready to fish?
        </h2>
        <p className="text-white/70 text-sm mb-5">
          Create a free FishMB account (or log in) and the invite code{" "}
          <code className="bg-white/10 text-gold font-bold tracking-[0.2em] px-3 py-1 rounded-full">
            {t.invite_code}
          </code>{" "}
          is already applied.
        </p>
        <JoinButton tournamentId={t.id} tournamentName={t.name} inviteCode={params.code} />
      </div>

      <p className="text-center">
        <Link href="/fishmb/tournaments" className="text-sm font-bold text-signal uppercase tracking-wider">
          Browse all tournaments
        </Link>
      </p>
    </div>
  );
}
