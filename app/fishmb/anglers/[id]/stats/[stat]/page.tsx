// Stat detail page: tap a stat tile (catches, species, tournaments, wins…)
// and see the items behind the number. Works for your own stats and a
// friend's — privacy is enforced server-side by the stat-items API.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../../../_components/fishFetch";

const TITLES: Record<string, string> = {
  catches: "🎣 Catches",
  "tournament-catches": "🏆 Tournament catches",
  species: "🐟 Species",
  tournaments: "🏆 Tournaments",
  wins: "🥇 Tournament wins",
  posts: "💬 Posts",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface BoardRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  value: number;
  is_you: boolean;
}

export default function StatDetailPage({
  params,
}: {
  params: { id: string; stat: string };
}) {
  const { id, stat } = params;
  const title = TITLES[stat];
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [name, setName] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [res, user, lb] = await Promise.all([
          fishFetch(`/api/fishmb/users/${id}/stat-items?stat=${stat}`),
          fishFetch(`/api/fishmb/users/${id}`).catch(() => null),
          fishFetch(`/api/fishmb/users/${id}/stat-leaderboard?stat=${stat}`).catch(() => null),
        ]);
        if (!live) return;
        setItems((res as { items: Record<string, unknown>[] }).items);
        const u = (user as { user?: { name?: string } } | null)?.user;
        if (u?.name) setName(u.name);
        const rows = (lb as { rows?: BoardRow[] } | null)?.rows;
        if (rows) setBoard(rows);
      } catch (e) {
        if (!live) return;
        if (e instanceof Error && /private/i.test(e.message)) setIsPrivate(true);
        else setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, stat]);

  if (!title) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-pine/60 mb-4">Unknown stat.</p>
        <Link href={`/fishmb/anglers/${id}`} className="text-signal font-bold">
          ← Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <Link
        href={`/fishmb/anglers/${id}`}
        className="text-sm font-bold text-signal hover:text-signal-dark"
      >
        ← {name || "Profile"}
      </Link>
      <h1 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mt-3 mb-1">
        {title}
      </h1>
      {name && <p className="text-sm text-pine/55 mb-6">{name}</p>}

      {failed ? (
        <p className="text-pine/60">Couldn&apos;t load these right now.</p>
      ) : isPrivate ? (
        <p className="text-pine/60">🔒 {name || "This angler"} keeps this stat private.</p>
      ) : items === null ? (
        <div className="bg-pine/5 rounded-3xl h-32 animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-pine/60">Nothing here yet.</p>
      ) : (
        <div className="space-y-3">
          {stat === "catches" &&
            items.map((c) => (
              <div
                key={String(c.id)}
                className="bg-white border border-pine/10 rounded-3xl p-4 flex gap-4"
              >
                {typeof c.photo_hold_url === "string" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo_hold_url}
                    alt={String(c.species)}
                    className="w-20 h-20 rounded-2xl object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-pine">{String(c.species)}</p>
                  <p className="text-sm text-pine/70">
                    {Number(c.length_in).toFixed(1)}″
                    {c.weight_lb != null && ` · ${Number(c.weight_lb).toFixed(1)} lb`}
                  </p>
                  <p className="text-xs text-pine/50 mt-1">
                    {fmtDate(c.caught_at as string | null)}
                  </p>
                  {typeof c.note === "string" && c.note && (
                    <p className="text-sm text-pine/70 mt-1 line-clamp-2">{c.note}</p>
                  )}
                </div>
              </div>
            ))}

          {stat === "tournament-catches" &&
            items.map((e) => (
              <Link
                key={String(e.id)}
                href={`/fishmb/tournaments/${e.tournament_id}`}
                className="bg-white border border-pine/10 rounded-3xl p-4 flex gap-4 hover:border-signal/40 transition-colors"
              >
                {typeof e.photo_url === "string" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.photo_url}
                    alt={String(e.species)}
                    className="w-20 h-20 rounded-2xl object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-signal">
                    {String(e.tournament_name)}
                  </p>
                  <p className="font-bold text-pine mt-0.5">{String(e.species)}</p>
                  <p className="text-sm text-pine/70">
                    {e.length_inches != null
                      ? `${Number(e.length_inches).toFixed(1)}″`
                      : "—"}
                    {" · "}
                    {fmtDate(e.created_at as string | null)}
                  </p>
                </div>
              </Link>
            ))}

          {stat === "species" &&
            items.map((s) => (
              <div
                key={String(s.species)}
                className="bg-white border border-pine/10 rounded-3xl px-5 py-4 flex items-center justify-between"
              >
                <span className="font-bold text-pine">{String(s.species)}</span>
                <span className="text-sm text-pine/70">
                  {Number(s.count)} caught
                  {s.best_in != null && ` · best ${Number(s.best_in).toFixed(1)}″`}
                </span>
              </div>
            ))}

          {(stat === "tournaments" || stat === "wins") &&
            items.map((t) => (
              <Link
                key={String(t.id)}
                href={`/fishmb/tournaments/${t.id}`}
                className="bg-white border border-pine/10 rounded-3xl p-5 flex items-center justify-between hover:border-signal/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-pine truncate">{String(t.name)}</p>
                  <p className="text-xs text-pine/55 mt-1">
                    {fmtDate(t.starts_at as string | null)}
                    {t.ends_at ? ` – ${fmtDate(t.ends_at as string | null)}` : ""} ·{" "}
                    {String(t.status)}
                  </p>
                </div>
                <span className="text-xs font-bold text-pine/60 shrink-0 ml-3">
                  {Number(t.participant_count)} anglers
                </span>
              </Link>
            ))}

          {stat === "posts" &&
            items.map((p) => (
              <div
                key={String(p.id)}
                className="bg-white border border-pine/10 rounded-3xl p-5"
              >
                <p className="text-sm text-pine/80 whitespace-pre-wrap line-clamp-6">
                  {String(p.body)}
                </p>
                <p className="text-xs text-pine/50 mt-2">
                  {fmtDate(p.created_at as string | null)}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* You vs friends leaderboard for this stat */}
      {board !== null && board.length > 1 && (
        <section className="mt-10">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            🏆 You vs friends
          </h2>
          <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
            <ul className="divide-y divide-pine/8">
              {board.map((r, i) => (
                <li key={r.user_id}>
                  <Link
                    href={`/fishmb/anglers/${r.user_id}`}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-pine/5 transition-colors ${
                      r.is_you ? "bg-gold/15" : ""
                    }`}
                  >
                    <span
                      className={`font-display font-bold w-7 text-center ${
                        i === 0 ? "text-gold" : "text-pine/40"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 font-bold text-pine text-sm truncate">
                      {r.is_you ? "You" : r.name}
                    </span>
                    <span className="font-display font-bold text-pine text-lg tabular-nums">
                      {r.value}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
