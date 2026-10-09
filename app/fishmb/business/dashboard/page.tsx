// Business dashboard — listings, business page, tournaments, bookings, ads.
// Business accounts only; personal accounts are redirected to their profile.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import MyListings from "../../profile/_components/MyListings";

type Tab = "listings" | "business" | "tournaments" | "bookings" | "advertise";

interface DashboardData {
  business: {
    id: string;
    name: string;
    description: string;
    contact: string;
    website: string | null;
    location: string | null;
    photos: string[];
  } | null;
  rentals: { id: string; title: string; category: string; photos: string[] }[];
  rentalsWithPending: Record<string, number>;
  tournaments: {
    active: TournamentRow[];
    past: TournamentRow[];
  };
  bookingStats: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    perRental: { rental_id: string; title: string; pending: number; confirmed: number; cancelled: number }[];
  };
  bookings: BookingRow[];
  ads: AdRow[];
}

interface TournamentRow {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  participant_count: number;
}

interface BookingRow {
  id: string;
  rental_id: string;
  rental_title: string;
  renter_name: string;
  renter_avatar_url: string | null;
  renter_contact: string;
  start_date: string;
  end_date: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
}

interface AdRow {
  id: string;
  slot: string;
  title: string;
  status: string;
  price_cents: number;
  created_at: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "listings", label: "🏷️ Listings" },
  { id: "business", label: "🏢 Business page" },
  { id: "tournaments", label: "🏆 Tournaments" },
  { id: "bookings", label: "📊 Bookings" },
  { id: "advertise", label: "📣 Advertise" },
];

const AD_SLOTS = [
  { id: "feed", name: "Feed ad", price: "$25" },
  { id: "homepage_banner", name: "Homepage banner", price: "$75" },
];

function statusBadge(s: string) {
  const cls =
    s === "pending"
      ? "bg-gold/25 text-gold border-gold/50"
      : s === "confirmed" || s === "active"
        ? "bg-pine/10 text-pine border-pine/20"
        : "bg-pine/5 text-pine/50 border-pine/10";
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${cls}`}>
      {s}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function BusinessDashboardPage() {
  const { user, loading, openLogin } = useFishAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("listings");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isBusiness = (user as { account_type?: string } | null)?.account_type === "business";

  useEffect(() => {
    if (!loading && user && !isBusiness) {
      router.replace("/fishmb/profile");
    }
  }, [loading, user, isBusiness, router]);

  useEffect(() => {
    if (!isBusiness) return;
    let live = true;
    fishFetch("/api/fishmb/business/dashboard")
      .then((d) => {
        if (live) setData(d as DashboardData);
      })
      .catch((e) => {
        if (live) setLoadError(e instanceof Error ? e.message : "Could not load the dashboard.");
      });
    return () => {
      live = false;
    };
  }, [isBusiness]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-pine/50">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Business dashboard
        </h1>
        <p className="text-pine/60 mb-6">Log in with your business account to manage listings, bookings, tournaments and ads.</p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Log in
        </button>
      </div>
    );
  }

  if (!isBusiness) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-pine/70 mb-4">
          💼 The business dashboard is for business accounts — taking you back to your profile…
        </p>
        <Link
          href="/fishmb/profile"
          className="inline-block bg-pine text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Go to my profile
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-2">💼 Business</p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-8">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 sm:flex gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 rounded-2xl sm:rounded-full text-sm font-bold uppercase tracking-wider transition-colors text-center ${
              tab === t.id
                ? "bg-pine text-white"
                : "bg-paper-deep border border-pine/15 text-pine/70 hover:border-signal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data && !loadError && (
        <div className="space-y-3">
          <div className="h-8 bg-pine/10 rounded-full w-48 animate-pulse" />
          <div className="h-32 bg-pine/10 rounded-2xl animate-pulse" />
        </div>
      )}
      {loadError && (
        <p className="text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 text-sm">
          {loadError}
        </p>
      )}

      {data && tab === "listings" && (
        <section>
          <MyListings />
          <Link
            href="/fishmb/classifieds/new"
            className="mt-4 inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
          >
            + List something
          </Link>
        </section>
      )}

      {data && tab === "business" && (
        <section>
          {data.business ? (
            <div className="bg-white border border-pine/10 rounded-3xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide">
                    {data.business.name}
                  </h2>
                  {data.business.location && (
                    <p className="text-sm text-pine/55 mt-1">📍 {data.business.location}</p>
                  )}
                </div>
                <Link
                  href={`/fishmb/business/${data.business.id}`}
                  className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
                >
                  View / edit page →
                </Link>
              </div>
              {data.business.description && (
                <p className="text-pine/70 text-sm mt-4 leading-relaxed">{data.business.description}</p>
              )}
              {data.business.contact && (
                <p className="text-sm text-pine/60 mt-3">📞 {data.business.contact}</p>
              )}
              {data.business.website && (
                <a
                  href={data.business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal-dark font-bold text-sm mt-2 inline-block"
                >
                  {data.business.website} ↗
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white border border-pine/10 rounded-3xl p-6 text-center">
              <p className="text-3xl mb-3">🏢</p>
              <h2 className="font-bold text-pine text-lg mb-2">No business page yet</h2>
              <p className="text-sm text-pine/60 mb-6">
                Create a page for your lodge, guide service, or shop — or claim it if it&apos;s already listed.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/fishmb/business/new"
                  className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
                >
                  Create business page
                </Link>
                <Link
                  href="/fishmb/business"
                  className="bg-paper-deep border border-pine/15 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full"
                >
                  Claim a listing
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {data && tab === "tournaments" && (
        <section className="space-y-8">
          <TournamentGroup
            title="▶ Active tournaments"
            rows={data.tournaments.active}
            empty="No active tournaments. Create one from the tournaments page."
          />
          <TournamentGroup
            title="🏁 Past tournaments"
            rows={data.tournaments.past}
            empty="No past tournaments yet."
          />
          <Link
            href="/fishmb/tournaments"
            className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
          >
            + New tournament
          </Link>
        </section>
      )}

      {data && tab === "bookings" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Total requests", data.bookingStats.total],
              ["⏳ Pending", data.bookingStats.pending],
              ["✅ Confirmed", data.bookingStats.confirmed],
              ["❌ Cancelled", data.bookingStats.cancelled],
            ].map(([label, n]) => (
              <div key={label as string} className="bg-white border border-pine/10 rounded-2xl p-4 text-center">
                <p className="font-display font-bold text-pine text-3xl">{n}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/55 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
              Per rental
            </h2>
            {data.bookingStats.perRental.length === 0 ? (
              <p className="text-pine/55 text-sm">No rentals listed yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.bookingStats.perRental.map((r) => {
                  return (
                    <Link
                      key={r.rental_id}
                      href={`/fishmb/classifieds/${r.rental_id}`}
                      className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-4 hover:border-gold/40 transition-colors"
                    >
                      <span className="text-2xl">🛖</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-pine truncate">{r.title}</p>
                        <p className="text-xs text-pine/55 mt-0.5">
                          {r.pending} pending · {r.confirmed} confirmed · {r.cancelled} cancelled
                        </p>
                      </div>
                      {r.pending > 0 && (
                        <span className="bg-signal text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0">
                          {r.pending} new
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
              Latest requests
            </h2>
            {data.bookings.length === 0 ? (
              <p className="text-pine/55 text-sm">No booking requests yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.bookings.slice(0, 10).map((b) => (
                  <Link
                    key={b.id}
                    href={`/fishmb/classifieds/${b.rental_id}`}
                    className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-4 hover:border-gold/40 transition-colors"
                  >
                    {b.renter_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.renter_avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine shrink-0">
                        {b.renter_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-pine truncate">
                        {b.renter_name} <span className="font-normal text-pine/55">· {b.rental_title}</span>
                      </p>
                      <p className="text-xs text-pine/55 mt-0.5">
                        {fmtDate(b.start_date)} → {fmtDate(b.end_date)} · 📞 {b.renter_contact}
                      </p>
                    </div>
                    {statusBadge(b.status)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {data && tab === "advertise" && (
        <AdSection ads={data.ads} onSubmitted={(ad) => setData({ ...data, ads: [ad, ...data.ads] })} />
      )}
    </div>
  );
}

function TournamentGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: TournamentRow[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-pine/55 text-sm">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-pine truncate">{t.name}</p>
                <p className="text-xs text-pine/55 mt-0.5">
                  👥 {t.participant_count} angler{t.participant_count === 1 ? "" : "s"} ·{" "}
                  {fmtDate(t.starts_at)} → {fmtDate(t.ends_at)}
                </p>
              </div>
              {statusBadge(t.status)}
              <Link
                href={`/fishmb/tournaments/${t.id}/manage`}
                className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full transition-colors shrink-0"
              >
                Manage
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdSection({ ads, onSubmitted }: { ads: AdRow[]; onSubmitted: (ad: AdRow) => void }) {
  const [slot, setSlot] = useState("feed");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      if (file) {
        const token = localStorage.getItem(FISHMB_TOKEN_KEY);
        const fd = new FormData();
        fd.append("file", await compressImage(file));
        const upRes = await fetch("/api/fish/photos/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up.error || "Upload failed.");
        if (file.type.startsWith("video/")) videoUrl = up.url as string;
        else imageUrl = up.url as string;
      }
      const d = await fishFetch("/api/fishmb/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl,
          video_url: videoUrl,
          link_url: link.trim() || null,
        }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      const ad = (d as { ad: AdRow }).ad;
      onSubmitted(ad);
      setNote("Ad submitted! It goes live once approved — we'll be in touch about payment. 🎣");
      setTitle("");
      setBody("");
      setLink("");
      setFile(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not submit your ad.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <section className="space-y-6">
      <div className="bg-white border border-pine/10 rounded-3xl p-6 space-y-4">
        <h2 className="font-bold text-pine uppercase tracking-wide">Request an ad</h2>
        <p className="text-sm text-pine/60">
          Ads run 7 days and go live after a quick review — we&apos;ll be in touch about payment.
        </p>
        <p className="text-sm text-pine/75 bg-gold/15 border border-gold/40 rounded-2xl px-4 py-3">
          🎨 No design? No problem — <strong>we can create your ad banner or feed ad for you.</strong>{" "}
          Just fill in the details below and we&apos;ll handle the creative.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {AD_SLOTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSlot(s.id)}
              className={`text-left border-2 rounded-2xl p-4 transition-colors ${
                slot === s.id ? "border-signal" : "border-pine/10 hover:border-pine/30"
              }`}
            >
              <p className="font-bold text-pine uppercase text-sm">{s.name}</p>
              <p className="font-bold text-signal-dark text-sm mt-0.5">{s.price} / week</p>
            </button>
          ))}
        </div>
        {note && (
          <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3">{note}</p>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Headline *"
          className={inputCls}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Short description (optional)"
          className={`${inputCls} text-sm resize-none`}
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={500}
          placeholder="Link (https://…)"
          className={inputCls}
        />
        <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
          {file ? `📎 ${file.name.slice(0, 30)}` : "📎 Ad image or video (optional — we can make one for you)"}
          <input
            type="file"
            accept="image/*,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full disabled:opacity-40 transition-colors"
        >
          {busy ? "Submitting…" : "Submit ad request"}
        </button>
      </div>

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
          My ad requests
        </h2>
        {ads.length === 0 ? (
          <p className="text-pine/55 text-sm">No ad requests yet.</p>
        ) : (
          <div className="space-y-2.5">
            {ads.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-pine truncate">{a.title}</p>
                  <p className="text-xs text-pine/55 mt-0.5">
                    {a.slot === "feed" ? "Feed ad" : "Homepage banner"} · ${(a.price_cents / 100).toFixed(0)}/week
                  </p>
                </div>
                {statusBadge(a.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
