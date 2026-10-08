// Site-owner review queue: business claims + ad submissions.
// Access gated by ADMIN_EMAILS env (see lib/fish/business.ts isAdminEmail).

"use client";

import { useEffect, useState } from "react";
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

export default function AdminPage() {
  const { user } = useFishAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = () => {
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
    try {
      await fishFetch(`/api/fishmb/admin/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setNote("Done.");
      load();
    } catch {
      setNote("Action failed.");
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-2">Review queue</h1>
      <p className="text-pine/60 text-sm mb-8">Business claims and ad submissions waiting for approval.</p>
      {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>}

      <h2 className="font-bold text-pine uppercase tracking-wide text-xl mb-4">
        Business claims ({claims.length})
      </h2>
      {claims.length === 0 ? (
        <p className="text-pine/50 text-sm mb-10">No pending claims.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {claims.map((c) => (
            <div key={c.id} className="bg-white border border-pine/10 rounded-3xl p-5">
              <p className="font-bold text-pine">{c.business_name}</p>
              <p className="text-xs text-pine/55 mb-3">by {c.user_name} ({c.user_email})</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.card_photo_url} alt="Business card proof" className="w-full max-h-56 object-contain bg-paper-deep rounded-2xl mb-3" />
              {c.message && <p className="text-sm text-pine/70 mb-3">{c.message}</p>}
              <div className="flex gap-2">
                <button onClick={() => act("claims", c.id, "approved")} className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Approve</button>
                <button onClick={() => act("claims", c.id, "rejected")} className="bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-bold text-pine uppercase tracking-wide text-xl mb-4">
        Ad submissions ({ads.length})
      </h2>
      {ads.length === 0 ? (
        <p className="text-pine/50 text-sm">No pending ads.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ads.map((a) => (
            <div key={a.id} className="bg-white border border-pine/10 rounded-3xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold mb-1">
                {a.slot === "feed" ? "Feed ad" : "Homepage banner"} · ${(a.price_cents / 100).toFixed(0)}/week
              </p>
              <p className="font-bold text-pine">{a.title}</p>
              <p className="text-xs text-pine/55 mb-3">by {a.user_name} ({a.user_email}){a.business_name ? ` · ${a.business_name}` : ""}</p>
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={a.title} className="w-full max-h-56 object-cover rounded-2xl mb-3" />
              )}
              {a.video_url && (
                <video src={a.video_url} controls className="w-full max-h-56 rounded-2xl mb-3" />
              )}
              {a.body && <p className="text-sm text-pine/70 mb-3">{a.body}</p>}
              {a.link_url && <p className="text-xs text-signal-dark mb-3 break-all">{a.link_url}</p>}
              <div className="flex gap-2">
                <button onClick={() => act("ads", a.id, "active")} className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Approve & run 7 days</button>
                <button onClick={() => act("ads", a.id, "rejected")} className="bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
