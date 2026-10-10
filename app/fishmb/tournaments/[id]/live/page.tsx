import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament, getLeaderboard, getEntriesForViewer } from "@/lib/fish/tournaments";
import { fishUserFromRequest } from "@/lib/fish/auth";
import { cookies, headers } from "next/headers";
import BackButton from "../../_components/BackButton";
import { CatchesGrid } from "../../_components/CatchesGrid";

export const dynamic = "force-dynamic";

/**
 * Live tournament hub — for anglers registered in a live tournament.
 * Leaderboard, angler stats, catch photos, spots (if shared), full-screen board link.
 */
export default async function LiveTournamentPage({ params }: { params: { id: string } }) {
  const t = await getTournament(params.id);
  if (!t) notFound();

  // Only for live tournaments — redirect others to the normal page.
  const now = Date.now();
  const start = new Date(t.starts_at).getTime();
  const end = new Date(t.ends_at).getTime();
  const isLive = start <= now && end >= now && t.status !== "completed";
  if (!isLive) {
    const { redirect } = await import("next/navigation");
    redirect(`/fishmb/tournaments/${t.id}`);
  }

  const leaderboard = await getLeaderboard(t.id, t.scoring);

  // Angler stats from the leaderboard rows.
  const totalFish = leaderboard.reduce((s, r) => s + r.fish_count, 0);
  const totalAnglers = t.participant_count;

  const scoreLabel =
    t.scoring === "total" ? "in" : t.scoring === "count" ? "fish" : "in";

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <BackButton />
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Live now
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-2">
        {t.name}
      </h1>
      <p className="text-pine/60 text-sm mb-8">
        Ends {new Date(t.ends_at).toLocaleString()} · {totalAnglers} anglers · {totalFish} fish logged
      </p>

      {/* Leaderboard */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide">
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
        <p className="text-pine/55 mb-10">No approved catches yet — the board lights up once the organizer approves entries.</p>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden mb-10">
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

      {/* Angler stats */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-4">
        Angler stats
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {leaderboard.slice(0, 8).map((row) => (
          <Link
            key={row.user_id}
            href={`/fishmb/anglers/${row.user_id}`}
            className="bg-white border border-pine/10 rounded-2xl p-4 hover:border-signal/40 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {row.avatar_url ? (
                <img src={row.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-signal text-white flex items-center justify-center font-bold text-sm">
                  {row.user_name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-bold text-pine text-sm truncate">{row.user_name}</span>
            </div>
            <div className="text-xs text-pine/55 space-y-0.5">
              <p>{row.fish_count} fish</p>
              <p>Best: {row.best_length?.toFixed(1) ?? "—"} in</p>
              <p>Total: {row.total_length?.toFixed(1) ?? "—"} in</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Catches */}
      <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-4">
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
