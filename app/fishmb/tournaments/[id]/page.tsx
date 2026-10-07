import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament, getLeaderboard, getEntries } from "@/lib/fish/tournaments";
import { getLakes } from "@/lib/fishmb";
import { TournamentActions } from "../_components/TournamentActions";
import { formatDateTime } from "../../_components/formatDate";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const t = await getTournament(params.id);
  if (!t) notFound();
  const leaderboard = await getLeaderboard(t.id, t.scoring);
  const entries = await getEntries(t.id, ["approved"]);
  const lakeNames = new Map(getLakes().map((l) => [l.id, l.name]));

  const scoreLabel = t.scoring === "total" ? "Total in." : t.scoring === "count" ? "Fish" : "Best in.";

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/tournaments" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← All tournaments
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-signal font-bold uppercase tracking-[0.24em] text-xs mb-2">{t.status}</p>
          <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide">
            {t.name}
          </h1>
          <p className="text-pine/60 mt-2">
            Organized by {t.organizer_name} · {t.participant_count} anglers · {formatDateTime(t.starts_at)} → {formatDateTime(t.ends_at)}
          </p>
        </div>
        <TournamentActions tournamentId={t.id} />
      </div>

      {t.description && <p className="text-pine/75 mt-6 max-w-3xl whitespace-pre-line">{t.description}</p>}

      <div className="grid md:grid-cols-3 gap-4 mt-6">
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

      {t.rules && (
        <div className="bg-paper-deep border border-pine/10 rounded-2xl p-6 mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">Rules</h3>
          <p className="text-pine/75 text-sm whitespace-pre-line">{t.rules}</p>
        </div>
      )}

      {/* Leaderboard */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mt-12 mb-4">
        Leaderboard
      </h2>
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

      {/* Approved catches */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mt-12 mb-4">
        Catches
      </h2>
      {entries.length === 0 ? (
        <p className="text-pine/55">Nothing approved yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {entries.map((e) => (
            <div key={e.id} className="bg-white border border-pine/10 rounded-2xl overflow-hidden">
              <div className="aspect-square bg-pine-deep/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.photo_url} alt={`${e.species} caught by ${e.user_name}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-4">
                <p className="font-bold text-pine text-sm">{e.species}{e.length_inches ? ` · ${Number(e.length_inches).toFixed(1)}"` : ""}</p>
                <p className="text-pine/55 text-xs mt-1">{e.user_name} · {formatDateTime(e.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
