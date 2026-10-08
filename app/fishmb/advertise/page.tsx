// Advertise on FishMB — business accounts submit feed / homepage-banner ads.
// Ads go live after approval. Pricing below is proposed — Dave confirms final numbers.

"use client";

import { useState } from "react";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { compressImage } from "../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

const SLOTS = [
  {
    id: "feed",
    name: "Feed ad",
    price: "$25",
    blurb: "Your ad appears right inside the community feed every few posts, marked Sponsored. Image or video + link.",
  },
  {
    id: "homepage_banner",
    name: "Homepage banner",
    price: "$75",
    blurb: "A big banner on the FishMB homepage — image or video, seen by every visitor. Premium placement.",
  },
];

export default function AdvertisePage() {
  const { user, openLogin } = useFishAuth();
  const [slot, setSlot] = useState("feed");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const isBusiness = (user as { account_type?: string } | null)?.account_type === "business";

  const submit = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!title.trim() || !file || busy) return;
    setBusy(true);
    setNote(null);
    try {
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
      const isVideo = file.type.startsWith("video/");
      const d = await fishFetch("/api/fishmb/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          title: title.trim(),
          body: body.trim(),
          image_url: isVideo ? null : (up.url as string),
          video_url: isVideo ? (up.url as string) : null,
          link_url: link.trim() || null,
        }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      setNote(
        "Ad submitted! It goes live once approved — we'll be in touch about payment. 🎣"
      );
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
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">For businesses</p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3">
        Advertise on FishMB
      </h1>
      <p className="text-pine/65 mb-8 max-w-2xl">
        Put your lodge, guide service, or tackle shop in front of Manitoba anglers.
        Every ad runs 7 days and goes live after a quick review.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {SLOTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSlot(s.id)}
            className={`text-left bg-white border-2 rounded-3xl p-6 transition-colors ${
              slot === s.id ? "border-signal" : "border-pine/10 hover:border-pine/30"
            }`}
          >
            <p className="font-display font-bold text-pine text-xl uppercase">{s.name}</p>
            <p className="font-bold text-signal-dark text-lg mt-1">{s.price} / week</p>
            <p className="text-sm text-pine/60 mt-2">{s.blurb}</p>
          </button>
        ))}
      </div>

      {!user ? (
        <div className="text-center py-6">
          <p className="text-pine/60 mb-4">Log in with a business account to submit an ad.</p>
          <button onClick={openLogin} className="bg-signal text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full">
            Log in
          </button>
        </div>
      ) : !isBusiness ? (
        <p className="text-pine/60 bg-white border border-pine/10 rounded-2xl p-6 text-center">
          Advertising is for business accounts — set your account type to Business in your profile.
        </p>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl p-6 space-y-4">
          <h2 className="font-bold text-pine uppercase tracking-wide">Your ad</h2>
          {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3">{note}</p>}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Headline * (e.g. Spring walleye trips — 20% off)" className={inputCls} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={300} placeholder="Short description (optional)" className={`${inputCls} text-sm resize-none`} />
          <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="Link (https://…)" className={inputCls} />
          <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
            {file ? `📎 ${file.name.slice(0, 30)}` : "📎 Ad image or video *"}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-pine/60">
              {SLOTS.find((s) => s.id === slot)?.price} for 7 days — pay after approval.
            </p>
            <button
              onClick={submit}
              disabled={busy || !title.trim() || !file}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full disabled:opacity-40 transition-colors"
            >
              {busy ? "Submitting…" : "Submit ad"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
