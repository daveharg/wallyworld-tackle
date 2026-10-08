// Community classifieds: guide services + ice shack rentals.
// Anyone logged in can post; contact info is shown so deals happen off-site.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

type Category = "guide" | "shack";

interface Listing {
  id: string;
  title: string;
  body: string;
  price_text: string | null;
  contact: string;
  location: string | null;
  offers: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  created_at: string;
}

const COPY: Record<Category, { title: string; blurb: string; cta: string; titlePh: string; bodyPh: string }> = {
  guide: {
    title: "🎣 Guide classifieds",
    blurb:
      "Hire a local angler — from weekend warriors who'll hop on your boat to full-time guides with their own rig. Rates are set by the poster; FishMB just makes the intro.",
    cta: "+ Post your guiding service",
    titlePh: "e.g. Walleye trips on Lake Winnipeg — $250/day",
    bodyPh:
      "What you offer, your experience, what waters you fish, what's included (boat, gear, bait?)…",
  },
  shack: {
    title: "🛖 Ice shack rentals",
    blurb:
      "Rent out your ice fishing shack — or find one for the weekend. Post where it is, what it sleeps, and your price.",
    cta: "+ List your shack",
    titlePh: "e.g. Heated 8x12 shack on Balsam Bay — $100/night",
    bodyPh: "Size, heating, bunks, hole count, access details, what's nearby…",
  },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Classifieds({ category }: { category: Category }) {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [offers, setOffers] = useState("fishing");
  const [offersTab, setOffersTab] = useState<"fishing" | "hunting">("fishing");
  const copy = COPY[category];

  const shown =
    category === "guide"
      ? items.filter((l) => l.offers === offersTab || l.offers === "both")
      : items;

  const load = () =>
    fishFetch(`/api/fishmb/classifieds?category=${category}`)
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const submit = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!title.trim() || !body.trim() || !contact.trim() || posting) return;
    setPosting(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/classifieds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          body: body.trim(),
          price_text: price.trim() || null,
          contact: contact.trim(),
          location: location.trim() || null,
          offers: category === "guide" ? offers : undefined,
        }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      setItems([(d as { item: Listing }).item, ...items]);
      setTitle("");
      setBody("");
      setPrice("");
      setContact("");
      setLocation("");
      setOffers("fishing");
      setOpen(false);
      setNote("Your listing is live! 🎣");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not post your listing.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this listing?")) return;
    try {
      await fishFetch(`/api/fishmb/classifieds/${id}`, { method: "DELETE" });
      setItems(items.filter((i) => i.id !== id));
    } catch {
      /* non-fatal */
    }
  };

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide">
          {copy.title}
        </h2>
        <button
          onClick={() => (user ? setOpen((o) => !o) : openLogin())}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          {open ? "Close" : copy.cta}
        </button>
      </div>
      <p className="text-pine/60 text-sm max-w-2xl mb-5">{copy.blurb}</p>

      {category === "guide" && (
        <div className="flex gap-2 mb-5">
          {(
            [
              ["fishing", "🎣 Fishing guides"],
              ["hunting", "🦌 Hunting guides"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setOffersTab(v)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                offersTab === v ? "bg-pine text-white" : "bg-white border border-pine/15 text-pine/60 hover:border-pine/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-5">{note}</p>
      )}

      {open && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5 md:p-6 mb-6 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder={copy.titlePh}
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={copy.bodyPh}
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              maxLength={100}
              placeholder="Price (e.g. $200/day)"
              className="bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
              placeholder="Location (e.g. Lake Winnipeg)"
              className="bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder="Contact — phone or email *"
              className="bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
          </div>
          {category === "guide" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
                What do you guide?
              </p>
              <div className="flex gap-2">
                {(
                  [
                    ["fishing", "🎣 Fishing"],
                    ["hunting", "🦌 Hunting"],
                    ["both", "🎣🦌 Both"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOffers(v)}
                    className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                      offers === v ? "bg-pine text-white" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={posting || !title.trim() || !body.trim() || !contact.trim()}
              className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
            >
              {posting ? "Posting…" : "Post listing"}
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-pine/55 text-sm bg-white border border-pine/10 rounded-2xl p-6">
          Nothing listed yet — be the first.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {shown.map((l) => (
            <article key={l.id} className="bg-white border border-pine/10 rounded-3xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-bold text-pine leading-snug">{l.title}</h3>
                {l.price_text && (
                  <span className="shrink-0 bg-gold/20 text-pine font-bold text-sm rounded-full px-3 py-1">
                    {l.price_text}
                  </span>
                )}
              </div>
              <p className="text-pine/75 text-sm whitespace-pre-line flex-1">{l.body}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-pine/55">
                {l.location && <span>📍 {l.location}</span>}
                <span>📞 {l.contact}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-pine/10">
                <Link
                  href={`/fishmb/anglers/${l.user_id}`}
                  className="text-xs font-bold text-pine/60 hover:text-signal-dark"
                >
                  {l.user_name} · {timeAgo(l.created_at)}
                </Link>
                {user?.id === l.user_id && (
                  <button
                    onClick={() => remove(l.id)}
                    className="text-xs font-bold uppercase tracking-wider text-red-700/70 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
