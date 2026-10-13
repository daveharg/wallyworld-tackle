// Site-owner dashboard: stats, business claims, ad submissions.
// Access gated by ADMIN_EMAILS env (see lib/fish/business.ts isAdminEmail).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { UserActivityMap } from "./UserActivityMap";

interface MapCell {
  lat: number;
  lng: number;
  anglers: number;
  pins: number;
}

interface UserMapData {
  cells: MapCell[];
  totalAnglers: number;
  totalPins: number;
}

interface Claim {
  id: string;
  business_name: string;
  card_photo_url: string;
  message: string;
  status: string;
  user_name: string;
  user_email: string;
  created_at: string;
}

interface Ad {
  id: string;
  slot: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  price_cents: number;
  status: string;
  user_name: string;
  user_email: string;
  business_name: string | null;
  created_at: string;
}

interface Stats {
  users: number;
  businesses: number;
  pendingClaims: number;
  pendingAds: number;
  activeAds: number;
  tournaments: number;
  classifieds: number;
}

interface TraditionalSuggestion {
  id: string;
  name: string;
  dates: string;
  location: string;
  entry: string;
  description: string;
  url: string;
  user_name: string;
  created_at: string;
}

interface AnglerStatsRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  total_catches: number;
  tournament_catches: number;
  species_count: number;
  biggest: { species: string; length_in: number }[];
  tournaments_joined: number;
  tournament_wins: number;
  posts_count: number;
  tips_count: number;
  member_since: string | null;
}

interface ContactMsg {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface ManagedUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  suspended: boolean;
  suspended_reason: string;
  is_demo: boolean;
  post_count: string;
  catch_count: string;
}

interface GrowthDay {
  day: string;
  signups: number;
  posts: number;
  catches: number;
}

interface VisitWindowStats {
  sessions: number;
  page_views: number;
  signed_in_visitors: number;
  avg_duration_s: number;
  median_duration_s: number;
}

interface VisitStatsData {
  last_24h: VisitWindowStats;
  last_7d: VisitWindowStats;
  last_30d: VisitWindowStats;
  daily: { day: string; sessions: number; page_views: number }[];
  top_pages_7d: { path: string; views: number }[];
}

interface RecommendationItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  name: string;
  email: string | null;
  kind: string;
  subject: string;
  message: string;
  page: string | null;
  status: string;
  created_at: string;
}

const RECOMMENDATION_KIND_LABELS: Record<string, string> = {
  general: "General",
  lake: "Lake",
  lodge: "Lodge",
  guide: "Guide",
  feature: "Feature idea",
  correction: "Correction",
};

/** Recommendations tab: everything the "give a recommendation" boxes
 *  collect — lakes, lodges, guides, feature ideas, corrections. */
function RecommendationsPanel({
  items,
  onStatus,
}: {
  items: RecommendationItem[];
  onStatus: (id: string, status: string) => void;
}) {
  if (items.length === 0)
    return (
      <p className="text-pine/60 text-sm bg-white border border-pine/10 rounded-2xl px-5 py-6">
        No recommendations yet — the boxes are on the Contact page and every lake page.
      </p>
    );
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div
          key={r.id}
          className={`bg-white border rounded-2xl px-5 py-4 ${
            r.status === "new" ? "border-signal ring-1 ring-signal/40" : "border-pine/10"
          }`}
        >
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <p className="font-bold text-pine">
                {r.subject || "(no title)"}
                <span className="ml-2 align-middle text-[10px] font-black uppercase tracking-wider bg-lake-mist text-pine/70 rounded-full px-2 py-0.5">
                  {RECOMMENDATION_KIND_LABELS[r.kind] ?? r.kind}
                </span>
                {r.status === "new" && (
                  <span className="ml-1.5 align-middle text-[10px] font-black uppercase tracking-wider bg-signal text-pine-dark rounded-full px-2 py-0.5">
                    New
                  </span>
                )}
                {r.status === "done" && (
                  <span className="ml-1.5 align-middle text-[10px] font-black uppercase tracking-wider bg-pine text-white rounded-full px-2 py-0.5">
                    Done
                  </span>
                )}
              </p>
              <p className="text-xs text-pine/55 mt-0.5">
                {r.user_name ?? (r.name || "Anonymous")}
                {r.email ? ` · ${r.email}` : ""} · {timeAgo(r.created_at)}
                {r.page ? ` · from ${r.page}` : ""}
              </p>
              <p className="text-sm text-pine/80 mt-2 whitespace-pre-wrap">{r.message}</p>
            </div>
          </div>
          {r.status !== "done" && r.status !== "dismissed" && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {r.status === "new" && (
                <button
                  onClick={() => onStatus(r.id, "read")}
                  className="text-xs font-bold uppercase tracking-wider bg-pine/5 hover:bg-pine/10 text-pine px-3.5 py-2 rounded-full"
                >
                  Mark read
                </button>
              )}
              <button
                onClick={() => onStatus(r.id, "done")}
                className="text-xs font-bold uppercase tracking-wider bg-pine text-white px-3.5 py-2 rounded-full"
              >
                ✓ Done
              </button>
              <button
                onClick={() => onStatus(r.id, "dismissed")}
                className="text-xs font-bold uppercase tracking-wider bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-2 rounded-full"
              >
                Dismiss
              </button>
            </div>
          )}
          {(r.status === "done" || r.status === "dismissed") && (
            <button
              onClick={() => onStatus(r.id, "read")}
              className="mt-3 text-xs font-bold text-pine/50 underline"
            >
              Reopen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m ${rest}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Visits tab: first-party page-view + duration stats (no third-party
 *  trackers). Durations run from first page load to the last heartbeat;
 *  averages skip sub-5-second bounces. */
function VisitsPanel({ stats }: { stats: VisitStatsData | null }) {
  if (!stats)
    return (
      <p className="text-pine/60 text-sm bg-white border border-pine/10 rounded-2xl px-5 py-6">
        No visit data yet — visits are counted from when this shipped.
      </p>
    );
  const windows: [string, VisitWindowStats][] = [
    ["Last 24 hours", stats.last_24h],
    ["Last 7 days", stats.last_7d],
    ["Last 30 days", stats.last_30d],
  ];
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.sessions));
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-3">
        {windows.map(([label, w]) => (
          <div key={label} className="bg-white border border-pine/10 rounded-2xl px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mb-2">{label}</p>
            <p className="font-display font-bold text-pine text-3xl leading-none">
              {w.sessions.toLocaleString()}
              <span className="text-sm font-bold text-pine/50 ml-2">visits</span>
            </p>
            <div className="text-sm text-pine/70 mt-3 space-y-1">
              <p>{w.page_views.toLocaleString()} page views</p>
              <p>
                Avg stay <strong className="text-pine">{fmtDuration(w.avg_duration_s)}</strong>
                {" · "}median {fmtDuration(w.median_duration_s)}
              </p>
              <p>{w.signed_in_visitors.toLocaleString()} signed-in anglers</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-pine/10 rounded-2xl px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mb-3">
          Visits per day (14 days)
        </p>
        <div className="space-y-1.5">
          {stats.daily.map((d) => (
            <div key={d.day} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-pine/55 tabular-nums">{d.day.slice(5)}</span>
              <span className="flex-1 h-4 bg-pine/5 rounded-full overflow-hidden">
                <span
                  className="block h-full bg-signal rounded-full"
                  style={{ width: `${Math.round((d.sessions / maxDaily) * 100)}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right tabular-nums text-pine/70">
                {d.sessions} visits · {d.page_views} views
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-pine/10 rounded-2xl px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mb-3">
          Top pages (7 days)
        </p>
        {stats.top_pages_7d.length === 0 ? (
          <p className="text-sm text-pine/60">No page views recorded yet.</p>
        ) : (
          <div className="divide-y divide-pine/8">
            {stats.top_pages_7d.map((p) => (
              <div key={p.path} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 truncate text-pine/80">{p.path}</span>
                <span className="tabular-nums font-bold text-pine">{p.views.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModerationReport {
  id: string;
  reporter_name: string | null;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  target_author_name: string | null;
  reason: string;
  status: string;
  created_at: string;
  content_preview: string | null;
}

/** Moderation queue: user reports with one-tap actions. Every report
 *  should be actioned within 24 hours (App Store Guideline 1.2). */
function ReportsQueue({
  reports,
  acting,
  onAct,
}: {
  reports: ModerationReport[];
  acting: string | null;
  onAct: (report: ModerationReport, action: "remove_content" | "suspend_author" | "dismiss") => void;
}) {
  if (reports.length === 0)
    return (
      <p className="text-pine/60 text-sm bg-white border border-pine/10 rounded-2xl px-5 py-6">
        No open reports. 🎉
      </p>
    );
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="bg-white border border-pine/10 rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-signal-dark">
              🚩 {r.target_type}
            </span>
            <span className="text-sm font-bold text-pine">
              {r.target_author_name ?? "Unknown angler"}
            </span>
            <span className="text-xs text-pine/45">
              reported by {r.reporter_name ?? "an angler"} · {timeAgo(r.created_at)}
            </span>
          </div>
          {r.content_preview && (
            <p className="text-sm text-pine/75 bg-pine/5 rounded-xl px-3.5 py-2.5 mb-2 whitespace-pre-wrap">
              “{r.content_preview}”
            </p>
          )}
          {r.reason && <p className="text-xs text-pine/55 mb-2">Reason: {r.reason}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {r.target_type !== "user" && (
              <button
                type="button"
                disabled={acting === r.id}
                onClick={() => onAct(r, "remove_content")}
                className="text-xs font-bold uppercase tracking-wider bg-red-600 text-white rounded-full px-4 py-2 disabled:opacity-50"
              >
                Remove content
              </button>
            )}
            <button
              type="button"
              disabled={acting === r.id || !r.target_user_id}
              onClick={() => onAct(r, "suspend_author")}
              className="text-xs font-bold uppercase tracking-wider bg-pine text-white rounded-full px-4 py-2 disabled:opacity-50"
            >
              Suspend author
            </button>
            <button
              type="button"
              disabled={acting === r.id}
              onClick={() => onAct(r, "dismiss")}
              className="text-xs font-bold uppercase tracking-wider bg-white border border-pine/20 text-pine/60 rounded-full px-4 py-2 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface GrowthData {
  days: GrowthDay[];
  totals: { users: number; posts: number; catches: number; tournaments: number };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function AnglerStatsTable({
  rows,
  search,
  onSearch,
}: {
  rows: AnglerStatsRow[];
  search: string;
  onSearch: (v: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q))
    : rows;
  return (
    <div>
      <div className="mb-4 max-w-sm">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search anglers…"
          className="w-full bg-white border border-pine/15 rounded-full px-5 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60">No anglers found.</p>
        </div>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-pine/45 border-b-2 border-pine/15">
                  <th className="py-3 px-4 font-bold">Angler</th>
                  <th className="py-3 px-3 font-bold text-center">Catches</th>
                  <th className="py-3 px-3 font-bold text-center">Species</th>
                  <th className="py-3 px-3 font-bold">Biggest fish</th>
                  <th className="py-3 px-3 font-bold text-center">Tournaments</th>
                  <th className="py-3 px-3 font-bold text-center">Wins</th>
                  <th className="py-3 px-4 font-bold text-center">Posts</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-b border-pine/8 align-middle">
                    <td className="py-3 px-4">
                      <Link
                        href={`/fishmb/anglers/${r.user_id}`}
                        className="flex items-center gap-3 hover:opacity-80"
                      >
                        {r.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatar_url}
                            alt={r.name}
                            className="w-9 h-9 rounded-full object-cover border border-gold"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine text-sm">
                            {r.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="font-bold text-pine truncate max-w-[160px]">{r.name}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-pine">{r.total_catches}</td>
                    <td className="py-3 px-3 text-center text-pine/75">{r.species_count}</td>
                    <td className="py-3 px-3 text-pine/75 text-xs">
                      {r.biggest.length > 0 ? (
                        <>
                          <span className="font-bold text-pine">{r.biggest[0].species}</span>{" "}
                          {Number(r.biggest[0].length_in).toFixed(1)}″
                        </>
                      ) : (
                        <span className="text-pine/40">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-pine/75">{r.tournaments_joined}</td>
                    <td className="py-3 px-3 text-center font-bold text-gold">{r.tournament_wins}</td>
                    <td className="py-3 px-4 text-center text-pine/75">{r.posts_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** User management table: search, view activity, suspend/unsuspend. */
function UsersTable({
  users,
  search,
  onSearch,
  onToggleSuspend,
  onToggleDemo,
  acting,
}: {
  users: ManagedUser[];
  search: string;
  onSearch: (v: string) => void;
  onToggleSuspend: (u: ManagedUser) => void;
  onToggleDemo: (u: ManagedUser) => void;
  acting: string | null;
}) {
  const q = search.trim().toLowerCase();
  const rows = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      )
    : users;
  const realRows = rows.filter((u) => !u.is_demo);
  const demoRows = rows.filter((u) => u.is_demo);

  const renderRow = (u: ManagedUser) => (
    <tr key={u.id} className={`border-b border-pine/5 last:border-0 ${u.suspended ? "bg-red-50/50" : ""}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {u.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-signal text-white flex items-center justify-center font-bold text-sm">
              {u.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold text-pine truncate">{u.name}</p>
            <p className="text-xs text-pine/50 truncate">{u.email ?? "no email"}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-center text-pine/60 text-xs">
        {new Date(u.created_at).toLocaleDateString()}
      </td>
      <td className="py-3 px-3 text-center font-bold text-pine">{u.post_count}</td>
      <td className="py-3 px-3 text-center text-pine/75">{u.catch_count}</td>
      <td className="py-3 px-3 text-center">
        <span className="inline-flex gap-1.5 justify-center flex-wrap">
          {u.suspended ? (
            <span className="inline-block bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1" title={u.suspended_reason}>
              Suspended
            </span>
          ) : (
            <span className="inline-block bg-green-100 text-green-800 text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1">
              Active
            </span>
          )}
          {u.is_demo && (
            <span className="inline-block bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1">
              Demo
            </span>
          )}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="inline-flex gap-2 justify-end">
          <button
            onClick={() => onToggleDemo(u)}
            disabled={acting === u.id}
            className="text-xs font-bold uppercase tracking-wider rounded-full px-4 py-2 bg-pine/5 hover:bg-pine/10 text-pine transition-colors disabled:opacity-40"
          >
            {u.is_demo ? "Unmark demo" : "Mark demo"}
          </button>
          <button
            onClick={() => onToggleSuspend(u)}
            disabled={acting === u.id}
            className={`text-xs font-bold uppercase tracking-wider rounded-full px-4 py-2 transition-colors disabled:opacity-40 ${
              u.suspended
                ? "bg-green-700 hover:bg-green-800 text-white"
                : "bg-red-50 hover:bg-red-100 text-red-800"
            }`}
          >
            {acting === u.id ? "…" : u.suspended ? "Reinstate" : "Suspend"}
          </button>
        </span>
      </td>
    </tr>
  );

  const renderTable = (list: ManagedUser[]) => (
    <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-pine/10 text-left">
              <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-pine/55">User</th>
              <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-pine/55 text-center">Joined</th>
              <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-pine/55 text-center">Posts</th>
              <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-pine/55 text-center">Catches</th>
              <th className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-pine/55 text-center">Status</th>
              <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-pine/55 text-right">Action</th>
            </tr>
          </thead>
          <tbody>{list.map(renderRow)}</tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-md bg-white border border-pine/15 rounded-full px-5 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-4"
      />
      {rows.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60">No users found.</p>
        </div>
      ) : (
        <>
          {renderTable(realRows)}
          {demoRows.length > 0 && (
            <div className="mt-8">
              <h3 className="font-display font-bold uppercase text-pine text-lg">
                Demo / test accounts ({demoRows.length})
              </h3>
              <p className="text-sm text-pine/55 mb-3">
                Kept separate — not counted in the angler totals.
              </p>
              {renderTable(demoRows)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 30-day growth chart: signups, posts, catches per day (CSS bars). */
function GrowthChart({ data }: { data: GrowthData | null }) {
  if (!data) {
    return <p className="text-pine/50 text-sm">Loading growth data…</p>;
  }
  const max = Math.max(1, ...data.days.map((d) => Math.max(d.signups, d.posts, d.catches)));
  const bar = (v: number, color: string) => (
    <div className="flex-1 flex flex-col justify-end h-24">
      <div className={`${color} rounded-t`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v}`} />
    </div>
  );
  const last7 = data.days.slice(-7);
  const signups7 = last7.reduce((s, d) => s + d.signups, 0);
  const posts7 = last7.reduce((s, d) => s + d.posts, 0);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
 [" Total users", data.totals.users],
 [" Total posts", data.totals.posts],
 [" Total catches", data.totals.catches],
 [" Tournaments", data.totals.tournaments],
        ].map(([label, v]) => (
          <div key={label as string} className="bg-white border border-pine/10 rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-pine text-3xl">{v as number}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-pine/55 mt-1">{label as string}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-pine/10 rounded-3xl p-6 mb-6">
        <h3 className="font-bold text-pine uppercase tracking-wider text-sm mb-1">Last 7 days</h3>
        <p className="text-pine/55 text-sm mb-4">
          {signups7} new users · {posts7} posts
        </p>
        <div className="flex items-end gap-1 mb-2">
          {data.days.slice(-14).map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-[2px] h-24">
                {bar(d.signups, "bg-signal flex-1")}
                {bar(d.posts, "bg-pine flex-1")}
                {bar(d.catches, "bg-gold flex-1")}
              </div>
              <span className="text-[10px] text-pine/40 rotate-0">
                {new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-xs text-pine/60">
          <span><span className="inline-block w-3 h-3 bg-signal rounded-sm mr-1" />Signups</span>
          <span><span className="inline-block w-3 h-3 bg-pine rounded-sm mr-1" />Posts</span>
          <span><span className="inline-block w-3 h-3 bg-gold rounded-sm mr-1" />Catches</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useFishAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [suggestions, setSuggestions] = useState<TraditionalSuggestion[]>([]);
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [anglerStats, setAnglerStats] = useState<AnglerStatsRow[]>([]);
  const [anglerSearch, setAnglerSearch] = useState("");
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [visitStats, setVisitStats] = useState<VisitStatsData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [userMap, setUserMap] = useState<UserMapData | null>(null);
  const [tab, setTab] = useState<"claims" | "ads" | "tournaments" | "messages" | "anglers" | "users" | "growth" | "map" | "reports" | "visits" | "recommendations">("claims");
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    fishFetch("/api/fishmb/admin/stats")
      .then((d) => setStats(d.stats))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/claims?status=pending")
      .then((d) => setClaims(d.claims ?? []))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/ads?status=pending")
      .then((d) => setAds(d.ads ?? []))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/traditional?status=pending")
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/contact-messages?status=new")
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/user-stats")
      .then((d) => setAnglerStats(d.users ?? []))
      .catch(() => setDenied(true));
    fishFetch("/api/fishmb/admin/users")
      .then((d) => setAllUsers(d.users ?? []))
      .catch(() => {});
    fishFetch("/api/fishmb/admin/growth")
      .then((d) => setGrowth(d as GrowthData))
      .catch(() => {});
    fishFetch("/api/fishmb/admin/user-map")
      .then((d) => setUserMap(d as UserMapData))
      .catch(() => {});
    fishFetch("/api/fishmb/admin/reports?status=open")
      .then((d) => setReports(d.reports ?? []))
      .catch(() => {});
    fishFetch("/api/fishmb/admin/visits")
      .then((d) => setVisitStats((d.stats ?? null) as VisitStatsData | null))
      .catch(() => {});
    fishFetch("/api/fishmb/admin/recommendations?status=all")
      .then((d) => setRecommendations(d.recommendations ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const act = async (kind: "claims" | "ads" | "traditional" | "contact-messages", id: string, status: string) => {
    setActing(id);
    setNote(null);
    try {
      await fishFetch(`/api/fishmb/admin/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
 setNote(kind === "ads" && status === "active" ? "Ad approved — running for 7 days. " : "Done.");
      load();
    } catch {
      setNote("Action failed.");
    } finally {
      setActing(null);
    }
  };

  const actOnRecommendation = async (id: string, status: string) => {
    try {
      await fishFetch("/api/fishmb/admin/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const actOnReport = async (
    report: ModerationReport,
    action: "remove_content" | "suspend_author" | "dismiss"
  ) => {
    setActing(report.id);
    setNote(null);
    try {
      await fishFetch("/api/fishmb/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: report.id, action }),
      });
      setNote(
        action === "remove_content"
          ? "Content removed."
          : action === "suspend_author"
            ? "Author suspended."
            : "Report dismissed."
      );
      load();
    } catch {
      setNote("Action failed.");
    } finally {
      setActing(null);
    }
  };

  const toggleDemo = async (u: ManagedUser) => {
    setActing(u.id);
    try {
      await fishFetch("/api/fishmb/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id, is_demo: !u.is_demo }),
      });
      setAllUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_demo: !u.is_demo } : x))
      );
      setNote(u.is_demo ? `${u.name} is a regular angler again.` : `${u.name} marked as a demo account.`);
    } catch {
      setNote("Action failed.");
    } finally {
      setActing(null);
    }
  };

  const toggleSuspend = async (u: ManagedUser) => {
    const action = u.suspended ? "reinstate" : "suspend";
    let reason = "";
    if (!u.suspended) {
      reason = window.prompt(`Suspend ${u.name}? Give a reason (shown to them):`) ?? "";
      if (reason === null) return;
    } else if (!window.confirm(`Reinstate ${u.name}?`)) {
      return;
    }
    setActing(u.id);
    try {
      await fishFetch("/api/fishmb/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id, suspended: !u.suspended, reason }),
      });
      setNote(`${u.name} ${action === "suspend" ? "suspended." : "reinstated."}`);
      const d = await fishFetch("/api/fishmb/admin/users");
      setAllUsers(d.users ?? []);
    } catch {
      setNote("Action failed.");
    } finally {
      setActing(null);
    }
  };

  if (!user) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-pine/60">Log in to continue.</div>;
  }
  if (denied) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-3xl mb-4">Not available</h1>
        <p className="text-pine/60">
          This area is for the site owner only. (Admin access is configured via the ADMIN_EMAILS setting.)
        </p>
      </div>
    );
  }

  const statCards: [string, number, string][] = [
 [" Anglers", stats?.users ?? 0, "/fishmb/feed"],
 [" Businesses", stats?.businesses ?? 0, "/fishmb/business"],
 [" Tournaments", stats?.tournaments ?? 0, "/fishmb/tournaments"],
 [" Classifieds", stats?.classifieds ?? 0, "/fishmb/lodges"],
 [" Claims waiting", stats?.pendingClaims ?? 0, ""],
 [" Ads waiting", stats?.pendingAds ?? 0, ""],
 [" Ads running", stats?.activeAds ?? 0, ""],
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-1">Site owner</p>
          <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide">
            FishMB dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-pine"
        >
          ← Back
        </button>
      </div>
      <p className="text-pine/60 text-sm mb-8">
        Review business claims and ad submissions. Approving an ad starts its 7-day run immediately.
      </p>

      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
        {statCards.map(([label, value, href]) => {
          const card = (
            <div className="bg-white border border-pine/10 rounded-2xl p-4 text-center hover:shadow-md transition-shadow h-full">
              <p className="font-display font-bold text-pine text-3xl">{value}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-pine/55 mt-1">{label}</p>
            </div>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* Review tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
 ["reports", `🚩 Reports (${reports.length})`],
 ["visits", `📈 Visits`],
 ["recommendations", `💡 Recommendations (${recommendations.filter((r) => r.status === "new").length})`],
 ["claims", ` Business claims (${claims.length})`],
 ["ads", ` Ad submissions (${ads.length})`],
 ["tournaments", ` Tournament suggestions (${suggestions.length})`],
 ["messages", ` Messages (${messages.length})`],
 ["anglers", ` Angler stats (${anglerStats.length})`],
 ["users", ` Users (${allUsers.filter((u) => !u.is_demo).length})`],
 ["growth", ` Growth`],
 ["map", ` Angler map`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === v ? "bg-pine text-white" : "bg-white border border-pine/15 text-pine/60 hover:border-pine/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "recommendations" ? (
        <RecommendationsPanel items={recommendations} onStatus={actOnRecommendation} />
      ) : tab === "visits" ? (
        <VisitsPanel stats={visitStats} />
      ) : tab === "reports" ? (
        <ReportsQueue reports={reports} acting={acting} onAct={actOnReport} />
      ) : tab === "claims" ? (
        claims.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
            <p className="text-pine/60">No pending claims. All caught up.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {claims.map((c) => (
              <div key={c.id} className="bg-white border border-pine/10 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-display font-bold text-pine text-xl uppercase tracking-wide">{c.business_name}</p>
                  <span className="text-xs text-pine/45 whitespace-nowrap">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-xs text-pine/55 mb-3">Claimed by {c.user_name} · {c.user_email}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.card_photo_url} alt="Business card proof" className="w-full max-h-64 object-contain bg-paper-deep rounded-2xl mb-3 border border-pine/10" />
                {c.message && (
                  <p className="text-sm text-pine/70 bg-paper-deep rounded-2xl px-4 py-3 mb-3">“{c.message}”</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => act("claims", c.id, "approved")}
                    disabled={acting === c.id}
                    className="bg-pine hover:bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
 Approve
                  </button>
                  <button
                    onClick={() => act("claims", c.id, "rejected")}
                    disabled={acting === c.id}
                    className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "tournaments" ? (
        suggestions.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
            <p className="text-pine/60">No pending tournament suggestions. All caught up.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {suggestions.map((s) => (
              <div key={s.id} className="bg-white border border-pine/10 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-display font-bold text-pine text-xl uppercase tracking-wide">{s.name}</p>
                  <span className="text-xs text-pine/45 whitespace-nowrap">{timeAgo(s.created_at)}</span>
                </div>
                <p className="text-xs text-pine/55 mb-3">Suggested by {s.user_name}</p>
                <div className="text-sm text-pine/70 space-y-1 mb-3">
                  {s.dates && <p><span className="font-bold text-pine/55">Dates:</span> {s.dates}</p>}
                  {s.location && <p><span className="font-bold text-pine/55">Location:</span> {s.location}</p>}
                  {s.entry && <p><span className="font-bold text-pine/55">Entry:</span> {s.entry}</p>}
                  {s.url && <p className="break-all"><span className="font-bold text-pine/55">URL:</span> <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-signal-dark underline">{s.url}</a></p>}
                  {s.description && <p className="bg-paper-deep rounded-2xl px-4 py-3">“{s.description}”</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act("traditional", s.id, "approved")}
                    disabled={acting === s.id}
                    className="bg-pine hover:bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
 Approve
                  </button>
                  <button
                    onClick={() => act("traditional", s.id, "rejected")}
                    disabled={acting === s.id}
                    className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "messages" ? (
        messages.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
            <p className="text-pine/60">No new messages. All caught up.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {messages.map((m) => (
              <div key={m.id} className="bg-white border border-pine/10 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="font-display font-bold text-pine text-xl uppercase tracking-wide">
                    {m.subject || "No subject"}
                  </p>
                  <span className="text-xs text-pine/45 whitespace-nowrap">{timeAgo(m.created_at)}</span>
                </div>
                <p className="text-xs text-pine/55 mb-3">
                  {m.name} · <a href={`mailto:${m.email}`} className="text-signal-dark underline">{m.email}</a>
                </p>
                <p className="text-sm text-pine/70 bg-paper-deep rounded-2xl px-4 py-3 mb-3 whitespace-pre-line">
                  {m.message}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => act("contact-messages", m.id, "read")}
                    disabled={acting === m.id}
                    className="bg-pine hover:bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
 Mark read
                  </button>
                  <button
                    onClick={() => act("contact-messages", m.id, "archived")}
                    disabled={acting === m.id}
                    className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "anglers" ? (
        <AnglerStatsTable rows={anglerStats} search={anglerSearch} onSearch={setAnglerSearch} />
      ) : tab === "users" ? (
        <UsersTable
          users={allUsers}
          search={userSearch}
          onSearch={setUserSearch}
          onToggleSuspend={toggleSuspend}
          onToggleDemo={toggleDemo}
          acting={acting}
        />
      ) : tab === "growth" ? (
        <GrowthChart data={growth} />
      ) : tab === "map" ? (
        <div>
          <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-4">
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
 Where your anglers fish
            </h3>
            <p className="text-sm text-pine/60 mb-1">
              Aggregated from saved spots and GPS-tagged catches. Areas only
              appear when at least 2 anglers are active there — individual
              private spots are never shown.
            </p>
            {userMap && (
              <p className="text-xs text-pine/50">
                {userMap.totalAnglers} anglers with location data · {userMap.totalPins} saved spots/catches
              </p>
            )}
          </div>
          {userMap ? (
            <>
              <UserActivityMap cells={userMap.cells} />
              {userMap.cells.length > 0 && (
                <div className="bg-white border border-pine/10 rounded-3xl p-5 mt-4">
                  <h4 className="font-bold text-pine text-sm uppercase tracking-wider mb-3">
 Top areas by angler activity
                  </h4>
                  <div className="divide-y divide-pine/10">
                    {userMap.cells.slice(0, 10).map((c, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-pine">
                            #{i + 1} · {c.lat.toFixed(2)}°, {c.lng.toFixed(2)}°
                          </p>
                          <p className="text-xs text-pine/55">
                            {c.pins} saved spot{c.pins === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider text-signal-dark bg-signal/10 rounded-full px-3 py-1.5 whitespace-nowrap">
                          {c.anglers} angler{c.anglers === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-pine/40 mt-3">
                    Tip: host tournaments near the top areas — that&apos;s where your anglers already fish.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="h-64 bg-pine/10 rounded-3xl animate-pulse" />
          )}
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60">No pending ads. All caught up.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ads.map((a) => (
            <div key={a.id} className="bg-white border-2 border-gold/40 rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
 {a.slot === "feed" ? " Feed ad" : " Homepage banner"} · ${(a.price_cents / 100).toFixed(0)}/week
                </p>
                <span className="text-xs text-pine/45 whitespace-nowrap">{timeAgo(a.created_at)}</span>
              </div>
              <p className="font-display font-bold text-pine text-xl uppercase tracking-wide mb-1">{a.title}</p>
              <p className="text-xs text-pine/55 mb-3">
                by {a.user_name} · {a.user_email}
 {a.business_name ? ` · ${a.business_name}` : ""}
              </p>
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={a.title} className="w-full max-h-64 object-cover rounded-2xl mb-3 border border-pine/10" />
              )}
              {a.video_url && <video src={a.video_url} controls className="w-full max-h-64 rounded-2xl mb-3" />}
              {a.body && <p className="text-sm text-pine/70 mb-3">{a.body}</p>}
              {a.link_url && <p className="text-xs text-signal-dark mb-4 break-all">{a.link_url}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => act("ads", a.id, "active")}
                  disabled={acting === a.id}
                  className="bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                >
 Approve — run 7 days
                </button>
                <button
                  onClick={() => act("ads", a.id, "rejected")}
                  disabled={acting === a.id}
                  className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
