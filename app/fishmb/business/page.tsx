// Business directory + "list your business" + claim flow.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface Biz {
  id: string;
  name: string;
  description: string;
  photos: string[];
  contact: string;
  website: string | null;
  location: string | null;
  owner_name?: string;
}

export default function BusinessDirectoryPage() {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<Biz[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimName, setClaimName] = useState("");
  const [claimCard, setClaimCard] = useState<File | null>(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [claimNote, setClaimNote] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const isBusiness = (user as { account_type?: string } | null)?.account_type === "business";

  useEffect(() => {
    fishFetch("/api/fishmb/business")
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  const uploadCard = async (file: File): Promise<string> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/fish/photos/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Upload failed.");
    return d.url as string;
  };

  const submitClaim = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!isBusiness) {
      setClaimNote("Only business accounts can claim a listing — switch your account type in your profile.");
      return;
    }
    if (!claimName.trim() || !claimCard || claimBusy) return;
    setClaimBusy(true);
    setClaimNote(null);
    try {
      const cardUrl = await uploadCard(claimCard);
      const d = await fishFetch("/api/fishmb/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: claimName.trim(),
          card_photo_url: cardUrl,
          message: claimMsg.trim(),
        }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      setClaimNote("Claim sent! We'll review your business card and hand over the listing. 🎣");
      setClaimName("");
      setClaimCard(null);
      setClaimMsg("");
      setClaimOpen(false);
    } catch (e) {
      setClaimNote(e instanceof Error ? e.message : "Could not send your claim.");
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">Local businesses</p>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
          Manitoba fishing businesses
        </h1>
        {isBusiness ? (
          <Link
            href="/fishmb/business/new"
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
          >
            + List your business
          </Link>
        ) : (
          <button
            onClick={() => (user ? undefined : openLogin())}
            title={user ? "Switch to a business account in your profile to list a business" : undefined}
            className="bg-pine/10 text-pine/60 font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full cursor-not-allowed"
          >
            + List your business
          </button>
        )}
      </div>
      <p className="text-pine/65 max-w-2xl mb-4">
        Lodges, guides, tackle shops and services run by FishMB business accounts.
        {user && !isBusiness && " (Business accounts can list here — set your account type in your profile.)"}
      </p>
      <button
        onClick={() => (user ? setClaimOpen((o) => !o) : openLogin())}
        className="text-sm font-bold text-signal-dark mb-8"
      >
        {claimOpen ? "Close" : "Already listed? Claim your business →"}
      </button>

      {claimOpen && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5 md:p-6 mb-8 max-w-2xl space-y-4">
          <p className="text-sm text-pine/70">
            If your business is already on FishMB, send us a photo of your business
            card as proof and we&apos;ll hand the listing over to you.
          </p>
          <input
            value={claimName}
            onChange={(e) => setClaimName(e.target.value)}
            maxLength={120}
            placeholder="Business name as listed"
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
          />
          <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
            {claimCard ? `📷 ${claimCard.name.slice(0, 30)}` : "📷 Photo of your business card *"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setClaimCard(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            value={claimMsg}
            onChange={(e) => setClaimMsg(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Anything we should know? (optional)"
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
          />
          <button
            onClick={submitClaim}
            disabled={claimBusy || !claimName.trim() || !claimCard}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
          >
            {claimBusy ? "Sending…" : "Send claim"}
          </button>
        </div>
      )}
      {claimNote && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-8 max-w-2xl">{claimNote}</p>
      )}

      {items.length === 0 ? (
        <p className="text-pine/55 bg-white border border-pine/10 rounded-2xl p-8 text-center">
          No businesses listed yet — be the first.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((b) => (
            <Link
              key={b.id}
              href={`/fishmb/business/${b.id}`}
              className="bg-white border border-pine/10 rounded-3xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              {b.photos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.photos[0]} alt={b.name} className="w-full h-40 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-40 bg-pine/10 flex items-center justify-center text-4xl">🏢</div>
              )}
              <div className="p-5">
                <h3 className="font-display font-bold text-pine text-xl uppercase tracking-wide">{b.name}</h3>
                {b.location && <p className="text-sm text-pine/55 mt-1">📍 {b.location}</p>}
                {b.description && <p className="text-sm text-pine/70 mt-2 line-clamp-2">{b.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
