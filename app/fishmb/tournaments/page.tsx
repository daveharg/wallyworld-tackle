import Link from "next/link";
import { listTournaments } from "@/lib/fish/tournaments";
import { getLakes, getTournaments as getTraditionalTournaments } from "@/lib/fishmb";
import { JoinByCode } from "./_components/JoinByCode";
import { SuggestTournament } from "./_components/SuggestTournament";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function TournamentsPage() {
  const tournaments = await listTournaments();
  const lakeNames = new Map(getLakes().map((l) => [l.id, l.name]));
  const traditional = getTraditionalTournaments().tournaments;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Compete
      </p>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide">
          Fishing tournaments
        </h1>
        <Link
          href="/fishmb/tournaments/how-it-works"
          aria-label="How tournaments work"
          title="How tournaments work"
          className="w-9 h-9 shrink-0 rounded-full bg-pine/10 hover:bg-pine/20 flex items-center justify-center text-pine font-black text-lg transition-colors"
        >
          ?
        </Link>
      </div>
      <p className="text-pine/65 max-w-2xl mb-6">
        Run your own catch-photo tournament with real anti-cheat — phone-timestamped
        catches, GPS stamps, tournament-waters checks, duplicate-photo detection and
        organizer review — or join one below. No entry caps, no platform cut.
      </p>

      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/fishmb/tournaments/create"
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          Create a tournament
        </Link>
        <Link
          href="/fishmb/tournaments/how-it-works"
          className="border-2 border-pine/20 hover:border-pine/40 text-pine font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          Learn more
        </Link>
        <JoinByCode />
      </div>

      {tournaments.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-2xl p-10 text-center">
          <p className="text-pine/60 text-lg mb-2">No tournaments yet.</p>
          <p className="text-pine/50 text-sm">
            Be the first — set one up for your lake, club or crew in a couple
            of minutes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/fishmb/tournaments/${t.id}`}
              className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-pine truncate">{t.name}</span>
                <span className="block text-xs text-pine/50 mt-0.5">
                  {t.participant_count} anglers · {t.entry_count} fish
                </span>
              </span>
              <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
            </Link>
          ))}
        </div>
      )}

      {/* Traditional (non-digital) Manitoba tournaments */}
      <div className="mt-16">
        <h2 className="font-display font-bold uppercase text-pine text-3xl tracking-wide mb-2">
          Traditional tournaments
        </h2>
        <p className="text-pine/60 text-sm mb-6 max-w-2xl">
          Classic Manitoba derbies and ice-fishing tournaments run by local
          organizers — weigh-ins, prizes and all. Always confirm dates and
          entry details with the organizer.
        </p>
        {traditional.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {traditional.map((t) => (
              <a
                key={t.name}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:border-signal/40 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-pine truncate">{t.name}</span>
                  <span className="block text-xs text-pine/50 mt-0.5">
                    {t.dates} · {t.location}
                  </span>
                </span>
                <span className="text-pine/25 text-xl leading-none shrink-0">›</span>
              </a>
            ))}
          </div>
        )}
        <SuggestTournament />
      </div>

      <p className="text-center text-sm text-pine/50 mt-12 max-w-2xl mx-auto">
 The full FishMB app is coming soon — with tournaments that work
        without cell service. For now this page works like an app on your phone:
        add it to your Home Screen (Share → Add to Home Screen on iPhone,
        Menu → Install app on Android).
      </p>
    </div>
  );
}
