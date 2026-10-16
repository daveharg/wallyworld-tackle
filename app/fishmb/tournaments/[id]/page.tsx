import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament, getLeaderboard } from "@/lib/fish/tournaments";
import { getLakes } from "@/lib/fishmb";
import { TournamentActions } from "../_components/TournamentActions";
import { CatchesGrid } from "../_components/CatchesGrid";
import { PrizePot, LicenceNotice } from "../_components/PrizePot";
import { MyPaymentStatus } from "../_components/MyPaymentStatus";
import { formatDateTime } from "../../_components/formatDate";

export const dynamic = "force-dynamic";
export const revalidate = 30;

/**
 * Share card for challenge links: when an angler shares a tournament,
 * chat apps unfurl THIS page — the card carries the tournament's name,
 * dates, species, entry fee and its cover photo (or the generated
 * brand card from opengraph-image.tsx when it has no photo).
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const t = await getTournament(params.id);
  if (!t) return { title: "Tournament not found" };
  const url = `https://www.fishmb.ca/fishmb/tournaments/${t.id}`;
  const fee = t.entry_fee_cents ?? 0;
  const description =
    `${t.name} — a FishMB fishing tournament. ` +
    `${formatDateTime(t.starts_at)} → ${formatDateTime(t.ends_at)} · ` +
    `${t.species.join(", ") || "All species"}` +
    (fee > 0
      ? ` · Entry $${(fee / 100).toFixed(fee % 100 === 0 ? 0 : 2)}`
      : " · Free entry") +
    `. Tap to accept the challenge and join.`;
  const image = t.cover_photo_url ?? `${url}/opengraph-image`;
  return {
    title: `${t.name} — FishMB tournament`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${t.name} | FishMB`,
      description,
      url,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: t.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${t.name} | FishMB`,
      description,
      images: [image],
    },
  };
}

function scoringLabel(scoring: string, scoringCount: number | null): string {
  if (scoring === "heaviest") return "Biggest fish (heaviest)";
  if (scoring === "longest") return "Biggest fish (longest)";
  if (scoring === "total")
    return scoringCount ? `Total length (top ${scoringCount})` : "Total length (all fish)";
  if (scoring === "count") return "Most fish";
  return scoring;
}

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const t = await getTournament(params.id);
  if (!t) notFound();
  const scoringCount = (t as any).scoring_count ?? null;
  const leaderboard = await getLeaderboard(t.id, t.scoring, scoringCount);
  const lakeNames = new Map(getLakes().map((l) => [l.id, l.name]));

  const scoreLabel =
    t.scoring === "total" ? "Total in." : t.scoring === "count" ? "Fish" : t.scoring === "heaviest" ? "Best lbs" : "Best in.";
  const venueQuery = [t.venue_name, t.venue_address].filter(Boolean).join(", ");
  const mapsUrl = venueQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`
    : null;
  const watersLabel = t.lake_ids.length
    ? t.lake_ids.map((id) => lakeNames.get(id) || id).join(", ")
    : "All of Manitoba";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 pb-32">
      <Link
        href="/fishmb/dashboard?tab=tournaments"
        className="inline-flex items-center gap-1.5 text-pine/60 hover:text-pine font-bold text-sm mb-4 transition-colors"
      >
        <span className="text-lg leading-none">‹</span> Tournaments
      </Link>

      {/* Cover hero — matches the builder preview */}
      {t.cover_photo_url ? (
        <div className="relative rounded-3xl overflow-hidden bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.cover_photo_url} alt={t.name} className="w-full h-48 md:h-64 object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pine-deep/90 via-pine-deep/40 to-transparent pt-16 pb-5 px-5">
            <p className="text-gold font-bold uppercase tracking-[0.24em] text-xs mb-1.5">{t.status}</p>
            <h1 className="font-display font-bold uppercase text-white text-3xl md:text-4xl tracking-wide">
              {t.name}
            </h1>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-signal font-bold uppercase tracking-[0.24em] text-xs mb-1.5">{t.status}</p>
          <h1 className="font-display font-bold uppercase text-pine text-3xl md:text-4xl tracking-wide">
            {t.name}
          </h1>
        </div>
      )}

      <p className="text-pine/60 text-sm mt-3">
        Organized by {t.organizer_name} · {t.participant_count}{" "}
        {t.participant_count === 1 ? "angler" : "anglers"} · {formatDateTime(t.starts_at)} →{" "}
        {formatDateTime(t.ends_at)}
      </p>

      {/* App landing — shared challenge links land on this page when
          the app doesn't claim them (no app, older build, desktop).
          With the app installed, the fishmb:// link jumps straight
          to the tournament's Accept challenge screen. */}
      <div className="bg-pine-deep rounded-3xl px-5 py-4 mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-white font-bold text-sm flex-1">
          🎣 Challenged? Fish this tournament in the FishMB app.
        </p>
        <div className="flex gap-2">
          <a
            href={`fishmb://tournaments/${t.id}?challenge=1`}
            className="bg-gold text-pine-deep text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full text-center"
          >
            Open in the app
          </a>
          <Link
            href="/fishmb/app"
            className="border border-white/40 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full text-center"
          >
            Get the app
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {t.photo_mode === "measure_only" && (
          <span className="text-xs font-bold uppercase tracking-wider text-pine bg-pine/10 rounded-full px-4 py-2">
            Measure-only photos — no posed photo with the fish needed
          </span>
        )}
        {t.photo_mode === "strict" && (
          <span className="text-xs font-bold uppercase tracking-wider text-pine bg-pine/10 rounded-full px-4 py-2">
            Strict camera-only — entries must be taken with the FishMB app&apos;s in-app camera
          </span>
        )}
        {t.photo_mode === "no_measure" && (
          <span className="text-xs font-bold uppercase tracking-wider text-pine bg-pine/10 rounded-full px-4 py-2">
            No measuring needed — just a clear fish photo
          </span>
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-pine bg-pine/10 rounded-full px-4 py-2">
          {scoringLabel(t.scoring, scoringCount)}
        </span>
      </div>

      <div className="mt-4">
        <TournamentActions tournamentId={t.id} />
      </div>

      {t.description && (
        <p className="text-pine/75 mt-6 whitespace-pre-line">{t.description}</p>
      )}

      {/* Where */}
      {(t.venue_name || t.venue_address) && (
        <div className="bg-white border border-pine/10 rounded-2xl p-5 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">Where</h3>
          {t.venue_name && <p className="text-pine font-bold text-lg">{t.venue_name}</p>}
          {t.venue_address && <p className="text-pine/60 text-sm">{t.venue_address}</p>}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline"
            >
              Open in Google Maps →
            </a>
          )}
        </div>
      )}

      {/* Waters / Species / Invite */}
      <div className="grid grid-cols-1 gap-3 mt-4">
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Waters</h3>
          <p className="text-pine text-sm">{watersLabel}</p>
        </div>
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Species</h3>
          <p className="text-pine text-sm">{t.species.join(", ") || "All species"}</p>
        </div>
      </div>

      <div className="mt-4">
        <LicenceNotice participantCount={t.participant_count} maxParticipants={t.max_participants} />
      </div>

      {/* Rules */}
      {t.rules && (
        <div className="mt-8">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
            Tournament rules
          </h2>
          <div className="bg-white border border-pine/10 rounded-3xl p-6">
            <p className="text-pine/80 whitespace-pre-line leading-relaxed text-sm">{t.rules}</p>
          </div>
        </div>
      )}

      {/* Prize pot */}
      {(t.entry_fee_cents ?? 0) > 0 || (t.payouts ?? []).length > 0 ? (
        <div className="mt-6">
          <PrizePot
            entryFeeCents={t.entry_fee_cents ?? 0}
            participantCount={t.participant_count}
            payouts={t.payouts ?? []}
          />
          <MyPaymentStatus tournamentId={t.id} entryFeeCents={t.entry_fee_cents ?? 0} />
        </div>
      ) : null}

      {/* Leaderboard */}
      <div className="flex items-center justify-between mt-10 mb-3">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
          Leaderboard
        </h2>
        <Link
          href={`/fishmb/tournaments/${t.id}/leaderboard`}
          className="bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-pine transition-colors"
        >
          Full-screen board
        </Link>
      </div>
      {leaderboard.length === 0 ? (
        <p className="text-pine/55 text-sm bg-white border border-pine/10 rounded-2xl p-5">
          No approved catches yet — the board lights up once the organizer approves entries.
        </p>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
          {leaderboard.map((row, i) => (
            <div key={row.user_id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-pine/10" : ""}`}>
              <span className={`font-display font-bold text-2xl w-10 ${i === 0 ? "text-gold" : "text-pine/40"}`}>{i + 1}</span>
              <Link href={`/fishmb/anglers/${row.user_id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
                    {row.user_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-bold text-pine flex-1 truncate group-hover:text-signal-dark">{row.user_name}</span>
              </Link>
              <span className="text-pine/55 text-sm">{row.fish_count} fish</span>
              <span className="font-display font-bold text-pine text-xl w-28 text-right">
                {row.score.toFixed(1)} <span className="text-xs text-pine/50 font-body">{scoreLabel}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Catches */}
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mt-10 mb-3">
        Catches
      </h2>
      {t.hide_locations && (
        <p className="text-pine/60 text-sm mb-4 bg-pine/5 border border-pine/10 rounded-2xl px-4 py-3">
          Catch spots are private in this tournament — the app confirms each catch is inside
          the tournament waters, but exact locations are never shown to other anglers.
        </p>
      )}
      <CatchesGrid tournamentId={t.id} />
    </div>
  );
}
