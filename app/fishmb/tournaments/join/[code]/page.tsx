import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentByInvite } from "@/lib/fish/tournaments";
import { JoinButton } from "../../_components/JoinButton";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function JoinTournamentPage({ params }: { params: { code: string } }) {
  const t = await getTournamentByInvite(params.code);
  if (!t) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        You&apos;re invited
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-4">
        {t.name}
      </h1>
      <p className="text-pine/60 mb-2">Organized by {t.organizer_name}</p>
      <p className="text-pine/60 mb-8">
        {t.participant_count} {t.participant_count === 1 ? "angler" : "anglers"} in so far
      </p>
      <JoinButton tournamentId={t.id} tournamentName={t.name} inviteCode={params.code} />
      <p className="mt-6">
        <Link href="/fishmb/tournaments" className="text-sm font-bold text-signal uppercase tracking-wider">
          Browse all tournaments
        </Link>
      </p>
    </div>
  );
}
