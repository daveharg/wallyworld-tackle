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

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminPage() {
  const { user } = useFishAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [tab, setTab] = useState<"claims" | "ads">("claims");
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
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const act = async (kind: "claims" | "ads", id: string, status: string) => {
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
