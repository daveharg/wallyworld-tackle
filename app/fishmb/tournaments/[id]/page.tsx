import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament, getLeaderboard } from "@/lib/fish/tournaments";
import { getLakes } from "@/lib/fishmb";
import { TournamentActions } from "../_components/TournamentActions";
import { CatchesGrid } from "../_components/CatchesGrid";
import { PrizePot, LicenceNotice } from "../_components/PrizePot";
import { formatDateTime } from "../../_components/formatDate";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const t = await getTournament(params.id);
  if (!t) notFound();
  const leaderboard = await getLeaderboard(t.id, t.scoring);
  const lakeNames = new Map(getLakes().map((l) => [l.id, l.name]));

  const scoreLabel = t.scoring === "total" ? "Total in." : t.scoring === "count" ? "Fish" : "Best in.";
  const venueQuery = [t.venue_name, t.venue_address].filter(Boolean).join(", ");
  const mapsUrl = venueQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/tournaments" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← All tournaments
      </Link>

      {/* Cover hero */}
      {t.cover_photo_url ? (
        <div className="relative mt-4 rounded-3xl overflow-hidden bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.cover_photo_url} alt={t.name} className="w-full h-64 md:h-96 object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pine-deep/90 via-pine-deep/40 to-transparent pt-24 pb-6 px-6 md:px-10">
            <p className="text-gold font-bold uppercase tracking-[0.24em] text-xs mb-2">{t.status}</p>
            <h1 className="font-display font-bold uppercase text-white text-4xl md:text-6xl tracking-wide">
              {t.name}
            </h1>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          {!t.cover_photo_url && (
            <>
              <p className="text-signal font-bold uppercase tracking-[0.24em] text-xs mb-2">{t.status}</p>
              <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide">
                {t.name}
              </h1>
            </>
          )}
          <p className="text-pine/60 mt-2">
            Organized by {t.organizer_name} · {t.participant_count} anglers · {formatDateTime(t.starts_at)} → {formatDateTime(t.ends_at)}
          </p>
        </div>
        <TournamentActions tournamentId={t.id} />
      </div>

      {t.description && <p className="text-pine/75 mt-6 max-w-3xl whitespace-pre-line">{t.description}</p>}

      {/* Where — venue name + address with a map link */}
      {(t.venue_name || t.venue_address) && (
        <div className="bg-white border border-pine/10 rounded-2xl p-6 mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">📍 Where</h3>
            {t.venue_name && <p className="text-pine font-bold text-lg">{t.venue_name}</p>}
            {t.venue_address && <p className="text-pine/60 text-sm">{t.venue_address}</p>}
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full transition-colors"
            >
              Open in Google Maps →
            </a>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Waters</h3>
          <p className="text-pine text-sm">{t.lake_ids.length ? t.lake_ids.map((id) => lakeNames.get(id) || id).join(", ") : "Any Manitoba water"}</p>
        </div>
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Species</h3>
          <p className="text-pine text-sm">{t.species.join(", ") || "All species"}</p>
        </div>
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Invite code</h3>
          <p className="text-pine font-bold tracking-[0.3em] text-lg">{t.invite_code}</p>
        </div>
      </div>

      {/* Rules — dedicated section */}
      {t.rules && (
        <section className="mt-10">
          <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-4">
            Tournament rules
          </h2>
          <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 md:p-8">
            <p className="text-pine/80 whitespace-pre-line leading-relaxed">{t.rules}</p>
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <PrizePot
          entryFeeCents={t.entry_fee_cents ?? 0}
          participantCount={t.participant_count}
          payouts={t.payouts ?? []}
        />
      </div>
      <LicenceNotice participantCount={t.participant_count} maxParticipants={t.max_participants} />

      {/* Leaderboard */}
      <div className="flex items-center justify-between mt-12 mb-4">
        <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide">
          Leaderboard
        </h2>
        <Link
          href={`/fishmb/tournaments/${t.id}/leaderboard`}
          className="bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-pine transition-colors"
        >
          ⛶ Full-screen board
        </Link>
      </div>
      {leaderboard.length === 0 ? (
        <p className="text-pine/55">No approved catches yet — the board lights up once the organizer approves entries.</p>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
          {leaderboard.map((row, i) => (
            <div key={row.user_id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-pine/10" : ""}`}>
              <span className={`font-display font-bold text-2xl w-10 ${i === 0 ? "text-gold" : "text-pine/40"}`}>{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {row.avatar_url ? (
                <img src={row.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
                  {row.user_name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-bold text-pine flex-1">{row.user_name}</span>
              <span className="text-pine/55 text-sm">{row.fish_count} fish</span>
              <span className="font-display font-bold text-pine text-xl w-28 text-right">
                {row.score.toFixed(1)} <span className="text-xs text-pine/50 font-body">{scoreLabel}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Catches */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mt-12 mb-4">
        Catches
      </h2>
      <CatchesGrid tournamentId={t.id} />
    </div>
  );
}
