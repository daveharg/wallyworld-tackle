import Link from "next/link";
import { listTournaments } from "@/lib/fish/tournaments";
import { getLakes, getTournaments as getTraditionalTournaments } from "@/lib/fishmb";
import { JoinByCode } from "./_components/JoinByCode";

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
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-4">
        Fishing tournaments
      </h1>
      <p className="text-pine/65 max-w-2xl mb-6">
        Run your own catch-photo tournament with real anti-cheat — phone-timestamped
        catches, GPS stamps, duplicate-photo detection and
        organizer review — or join one below. No entry caps, no platform cut.
      </p>

      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/fishmb/tournaments/create"
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          Create a tournament
        </Link>
        <JoinByCode />
      </div>

      {tournaments.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60 text-lg mb-2">No tournaments yet.</p>
          <p className="text-pine/50 text-sm">
            Be the first — set one up for your lake, club or crew in a couple
            of minutes.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/fishmb/tournaments/${t.id}`}
              className="bg-white border border-pine/10 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <p className="text-signal font-bold uppercase tracking-[0.2em] text-xs mb-2">
                {t.status}
              </p>
              <h2 className="font-display font-bold text-pine text-2xl uppercase tracking-wide mb-1">
                {t.name}
              </h2>
              <p className="text-pine/55 text-sm mb-3">
                by {t.organizer_name} · {t.participant_count} anglers ·{" "}
                {t.entry_count} fish
              </p>
              <p className="text-pine/70 text-sm line-clamp-2 mb-3">
                {t.description || "No description yet."}
              </p>
              {t.lake_ids.length > 0 && (
                <p className="text-pine/50 text-xs">
                  {t.lake_ids.slice(0, 3).map((id) => lakeNames.get(id) || id).join(" · ")}
                  {t.lake_ids.length > 3 ? ` +${t.lake_ids.length - 3} more` : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Traditional (non-digital) Manitoba tournaments */}
      {traditional.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display font-bold uppercase text-pine text-3xl tracking-wide mb-2">
            Traditional tournaments
          </h2>
          <p className="text-pine/60 text-sm mb-6 max-w-2xl">
            Classic Manitoba derbies and ice-fishing tournaments run by local
            organizers — weigh-ins, prizes and all. Always confirm dates and
            entry details with the organizer.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {traditional.map((t) => (
              <a
                key={t.name}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-paper-deep border border-pine/10 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <p className="text-signal font-bold uppercase tracking-[0.2em] text-xs mb-2">
                  {t.dates}
                </p>
                <h3 className="font-display font-bold text-pine text-2xl uppercase tracking-wide mb-1">
                  {t.name}
                </h3>
                <p className="text-pine/55 text-sm mb-3 font-bold">{t.location}</p>
                <p className="text-pine/70 text-sm line-clamp-3 mb-3">{t.description}</p>
                {t.entry && <p className="text-pine/55 text-sm">Entry: {t.entry}</p>}
                <span className="text-signal-dark text-sm font-bold uppercase tracking-wider mt-3 inline-block">
                  Details →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-pine/50 mt-12 max-w-2xl mx-auto">
        📱 The full FishMB app is coming soon — with tournaments that work
        without cell service. For now this page works like an app on your phone:
        add it to your Home Screen (Share → Add to Home Screen on iPhone,
        Menu → Install app on Android).
      </p>
    </div>
  );
}
