// Site-owner dashboard: stats, business claims, ad submissions.
// Access gated by ADMIN_EMAILS env (see lib/fish/business.ts isAdminEmail).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";

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

export default function AdminPage() {
  const { user } = useFishAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [suggestions, setSuggestions] = useState<TraditionalSuggestion[]>([]);
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [anglerStats, setAnglerStats] = useState<AnglerStatsRow[]>([]);
  const [anglerSearch, setAnglerSearch] = useState("");
  const [tab, setTab] = useState<"claims" | "ads" | "tournaments" | "messages" | "anglers">("claims");
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
      setNote(kind === "ads" && status === "active" ? "Ad approved — running for 7 days. 🎣" : "Done.");
      load();
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
    ["👥 Anglers", stats?.users ?? 0, "/fishmb/feed"],
    ["🏢 Businesses", stats?.businesses ?? 0, "/fishmb/business"],
    ["🏆 Tournaments", stats?.tournaments ?? 0, "/fishmb/tournaments"],
    ["📋 Classifieds", stats?.classifieds ?? 0, "/fishmb/lodges"],
    ["📨 Claims waiting", stats?.pendingClaims ?? 0, ""],
    ["📢 Ads waiting", stats?.pendingAds ?? 0, ""],
    ["✅ Ads running", stats?.activeAds ?? 0, ""],
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
        <Link
          href="/fishmb"
          className="text-xs font-bold uppercase tracking-wider text-pine/60 hover:text-pine"
        >
          ← Back to site
        </Link>
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
      <div className="flex gap-2 mb-6">
        {(
          [
            ["claims", `📨 Business claims (${claims.length})`],
            ["ads", `📢 Ad submissions (${ads.length})`],
            ["tournaments", `🏆 Tournament suggestions (${suggestions.length})`],
            ["messages", `✉️ Messages (${messages.length})`],
            ["anglers", `📊 Angler stats (${anglerStats.length})`],
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

      {tab === "claims" ? (
        claims.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
            <p className="text-4xl mb-3">🎉</p>
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
                    ✓ Approve
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
            <p className="text-4xl mb-3">🎉</p>
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
                    ✓ Approve
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
            <p className="text-4xl mb-3">🎉</p>
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
                    ✓ Mark read
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
      ) : ads.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-pine/60">No pending ads. All caught up.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ads.map((a) => (
            <div key={a.id} className="bg-white border-2 border-gold/40 rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
                  {a.slot === "feed" ? "📄 Feed ad" : "🖼️ Homepage banner"} · ${(a.price_cents / 100).toFixed(0)}/week
                </p>
                <span className="text-xs text-pine/45 whitespace-nowrap">{timeAgo(a.created_at)}</span>
              </div>
              <p className="font-display font-bold text-pine text-xl uppercase tracking-wide mb-1">{a.title}</p>
              <p className="text-xs text-pine/55 mb-3">
                by {a.user_name} · {a.user_email}
                {a.business_name ? ` · 🏢 ${a.business_name}` : ""}
              </p>
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={a.title} className="w-full max-h-64 object-cover rounded-2xl mb-3 border border-pine/10" />
              )}
              {a.video_url && <video src={a.video_url} controls className="w-full max-h-64 rounded-2xl mb-3" />}
              {a.body && <p className="text-sm text-pine/70 mb-3">{a.body}</p>}
              {a.link_url && <p className="text-xs text-signal-dark mb-4 break-all">🔗 {a.link_url}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => act("ads", a.id, "active")}
                  disabled={acting === a.id}
                  className="bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                >
                  ✓ Approve — run 7 days
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
