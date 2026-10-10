import { getLakes } from "@/lib/fishmb";
import { TournamentBuilder } from "../_components/TournamentBuilder";
import { LicenceNotice } from "../_components/PrizePot";
import BackButton from "../_components/BackButton";

export default function CreateTournamentPage() {
  const lakes = getLakes().map((l) => ({ id: l.id, name: l.name, region: l.region }));
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <BackButton />
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Organizers
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-4">
        Create a tournament
      </h1>
      <p className="text-pine/65 mb-8">
        Set it up in a couple of minutes. You&apos;ll get an invite code and a
        shareable link — anglers log in (or create a free account) to join, and
        you review every catch before it hits the leaderboard.
      </p>
      <div className="mb-8">
        <LicenceNotice participantCount={0} maxParticipants={null} />
      </div>
      <TournamentBuilder lakes={lakes} />
    </div>
  );
}
