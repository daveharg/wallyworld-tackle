"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import FishingStats from "../../profile/_components/FishingStats";

interface Friend {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface LeaderRow {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  value: number;
}

interface Catch {
  id: string;
  species: string;
  length_in: string | null;
  photo_hold_url: string | null;
  photo_measure_url: string | null;
  caught_at: string;
  tournament_id: string | null;
  tournament_name: string | null;
  visibility?: string;
  personal_record?: boolean;
  lat: number | null;
  lng: number | null;
}

type CatchSort = "size" | "species" | "newest" | "oldest";

function sortCatches(list: Catch[], sort: CatchSort): Catch[] {
  const arr = [...list];
  const sizeOf = (c: Catch) => parseFloat(c.length_in ?? "0") || 0;
  switch (sort) {
    case "size":
      // Largest first, then species A–Z.
      return arr.sort((a, b) => sizeOf(b) - sizeOf(a) || a.species.localeCompare(b.species));
    case "species":
      // Species A–Z, then largest first.
      return arr.sort((a, b) => a.species.localeCompare(b.species) || sizeOf(b) - sizeOf(a));
    case "oldest":
      return arr.sort((a, b) => new Date(a.caught_at).getTime() - new Date(b.caught_at).getTime());
    case "newest":
    default:
      return arr.sort((a, b) => new Date(b.caught_at).getTime() - new Date(a.caught_at).getTime());
  }
}

function LeaderboardList({ rows, unit }: { rows: LeaderRow[]; unit: string }) {
  if (rows.length === 0) {
    return <p className="text-pine/50 text-sm">No rankings yet — log a catch to get on the board.</p>;
  }
  return (
    <div className="bg-white border border-pine/10 rounded-2xl overflow-hidden">
      {rows.map((r, i) => (
        <Link
          key={r.user_id}
          href={`/fishmb/anglers/${r.user_id}`}
          className={`flex items-center gap-3 px-4 py-3 hover:bg-pine/[0.03] transition-colors ${
            i > 0 ? "border-t border-pine/8" : ""
          }`}
        >
          <span
            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black ${
              i === 0
                ? "bg-gold/20 text-gold"
                : i === 1
                  ? "bg-pine/10 text-pine/70"
                  : i === 2
                    ? "bg-signal/10 text-signal-dark"
                    : "bg-pine/5 text-pine/50"
            }`}
          >
            {i + 1}
          </span>
          {r.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-pine/10 flex items-center justify-center font-bold text-sm shrink-0">
              {r.user_name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="flex-1 min-w-0 text-sm font-bold text-pine truncate">{r.user_name}</span>
          <span className="text-xs font-bold text-pine/60 tabular-nums whitespace-nowrap">
            {r.value} {unit}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Dashboard stats: your numbers plus any friend's, side by side. */
export default function DashboardStats() {
  const { user } = useFishAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [topAnglers, setTopAnglers] = useState<LeaderRow[]>([]);
  const [topFriends, setTopFriends] = useState<LeaderRow[]>([]);
  const [catches, setCatches] = useState<Catch[]>([]);
  const [catchFilter, setCatchFilter] = useState<"all" | "shared" | "not-shared" | "personal" | "tournament">("all");
  const [catchSort, setCatchSort] = useState<CatchSort>("size");
  const [catchesExpanded, setCatchesExpanded] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const shareCatch = async (c: Catch) => {
    if (sharingId) return;
    setSharingId(c.id);
    try {
      await fishFetch(`/api/fish/catches/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal_record: false, visibility: "public" }),
      });
      setCatches((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, personal_record: false, visibility: "public" } : x))
      );
    } catch {
      // Leave the catch as-is on failure.
    } finally {
      setSharingId(null);
    }
  };

  const isShared = (c: Catch) =>
    c.tournament_id == null && c.personal_record !== true && c.visibility !== "private";

  useEffect(() => {
    fishFetch("/api/fish/friends")
      .then((d) => setFriends((d.friends ?? []) as Friend[]))
      .catch(() => {});
    // Top Manitoba anglers by fish logged.
    fishFetch("/api/fishmb/leaderboards?category=most")
      .then((d) => setTopAnglers(((d.rows ?? []) as LeaderRow[]).slice(0, 5)))
      .catch(() => {});
    // My catches (regular + tournament).
    fishFetch("/api/fishmb/my-catches")
      .then((d) => setCatches((d.catches ?? []) as Catch[]))
      .catch(() => {});
  }, []);

  // Top friends: rank the user's friends by fish logged.
  useEffect(() => {
    if (friends.length === 0) return;
    fishFetch("/api/fishmb/leaderboards?category=most")
      .then((d) => {
        const rows = (d.rows ?? []) as LeaderRow[];
        const friendIds = new Set(friends.map((f) => f.id));
        setTopFriends(rows.filter((r) => friendIds.has(r.user_id)).slice(0, 5));
      })
      .catch(() => {});
  }, [friends]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <FishingStats userId={user.id} hideTitle />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
            Friends' stats
          </h2>
          <Link
            href="/fishmb/friends?tab=add"
            className="text-signal-dark font-bold text-sm uppercase tracking-wider hover:underline"
          >
            + Add friends
          </Link>
        </div>
        {friends.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-6 text-center">
            <p className="text-pine/70 font-bold">No friends yet</p>
            <p className="text-pine/50 text-sm mt-1 mb-4">
              Add fishing friends to compare stats.
            </p>
            <Link
              href="/fishmb/friends?tab=add"
              className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Find friends
            </Link>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelected(f)}
                  className={`shrink-0 flex items-center gap-2 rounded-full pl-1 pr-4 py-1 border transition-colors ${
                    selected?.id === f.id
                      ? "bg-signal text-white border-signal"
                      : "bg-white text-pine border-pine/15 hover:border-signal"
                  }`}
                >
                  {f.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-pine/10 flex items-center justify-center font-bold text-sm">
                      {f.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-bold max-w-[140px] truncate">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <div>
                <p className="text-pine/60 text-sm mb-2">
                  Showing stats for{" "}
                  <Link
                    href={`/fishmb/anglers/${selected.id}`}
                    className="font-bold text-signal-dark hover:underline"
                  >
                    {selected.name}
                  </Link>
                </p>
                <FishingStats userId={selected.id} />
              </div>
            ) : (
              <p className="text-pine/50 text-sm">
                Tap a friend above to see their stats.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
          Top Manitoba anglers
        </h2>
        <LeaderboardList rows={topAnglers} unit="fish" />
      </div>

      {friends.length > 0 && (
        <div>
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            Top friends
          </h2>
          <LeaderboardList rows={topFriends} unit="fish" />
        </div>
      )}

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
          My catches
        </h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(
            [
              { id: "all", label: "All" },
              { id: "shared", label: "Shared" },
              { id: "not-shared", label: "Not shared" },
              { id: "personal", label: "Personal" },
              { id: "tournament", label: "Tournament" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCatchFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                catchFilter === f.id
                  ? "bg-pine text-white"
                  : "bg-white border border-pine/15 text-pine/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Sort options */}
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine/45">Sort:</span>
          {(
            [
              { id: "size", label: "Size" },
              { id: "species", label: "Species" },
              { id: "newest", label: "Newest" },
              { id: "oldest", label: "Oldest" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCatchSort(s.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                catchSort === s.id
                  ? "bg-pine text-white"
                  : "bg-white border border-pine/15 text-pine/70"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {(() => {
          const filtered = catches.filter((c) =>
            catchFilter === "all"
              ? true
              : catchFilter === "tournament"
                ? c.tournament_id != null
                : catchFilter === "shared"
                  ? isShared(c)
                  : catchFilter === "personal"
                    ? c.personal_record === true
                    : !isShared(c) && c.tournament_id == null
          );
          if (filtered.length === 0) {
            return (
              <p className="text-pine/50 text-sm">
                No catches yet — log one from the feed or join a tournament.
              </p>
            );
          }
          const sorted = sortCatches(filtered, catchSort);
          const visible = catchesExpanded ? sorted : sorted.slice(0, 3);
          return (
            <>
              <div className="flex flex-col gap-2">
                {visible.map((c) => (
                  <div
                    key={`${c.tournament_id ?? "r"}:${c.id}`}
                    className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-2.5"
                  >
                    {/* Thumbnail */}
                    {c.photo_hold_url || c.photo_measure_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photo_hold_url ?? c.photo_measure_url ?? ""}
                        alt={c.species}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-pine/5 flex items-center justify-center text-2xl shrink-0">
                        🐟
                      </div>
                    )}
                    {/* Species + size + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-pine truncate">
                        {c.species}
                        {c.length_in ? <span className="font-normal text-pine/60"> · {c.length_in}"</span> : null}
                      </p>
                      <p className="text-[11px] text-pine/50 truncate">
                        {new Date(c.caught_at).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {c.tournament_name ? ` · 🏆 ${c.tournament_name}` : ""}
                        {c.personal_record === true ? " · 🔒 Personal" : ""}
                      </p>
                      {c.tournament_id == null && !isShared(c) && (
                        <button
                          type="button"
                          onClick={() => shareCatch(c)}
                          disabled={sharingId === c.id}
                          className="mt-1 text-[11px] font-bold text-signal-dark disabled:opacity-40"
                        >
                          {sharingId === c.id ? "Sharing…" : "📤 Share to feed"}
                        </button>
                      )}
                    </div>
                    {/* Go to location */}
                    {c.lat !== null && c.lat !== undefined && c.lng !== null && c.lng !== undefined ? (
                      <Link
                        href={`/fishmb/maps?lat=${c.lat}&lng=${c.lng}`}
                        className="shrink-0 text-[11px] font-bold text-pine/60 hover:text-pine bg-pine/5 hover:bg-pine/10 rounded-full px-3 py-2 whitespace-nowrap"
                      >
                        📍 Map
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
              {sorted.length > 3 && (
                <button
                  type="button"
                  onClick={() => setCatchesExpanded((v) => !v)}
                  className="mt-3 w-full text-sm font-bold text-pine/60 hover:text-pine bg-pine/5 hover:bg-pine/10 rounded-2xl py-2.5 transition-colors"
                >
                  {catchesExpanded ? "Show less" : `Show ${sorted.length - 3} more`}
                </button>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
