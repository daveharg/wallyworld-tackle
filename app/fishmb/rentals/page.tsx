// FishMB Rentals — community marketplace for renting ice shacks, tents,
// equipment, and personal guide services. Deals happen off-site: bookings
// are requests, and the owner calls the renter to confirm.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { compressImage } from "../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import { RENTAL_CATS, type RentalCatKey } from "./_meta";

interface RentalItem {
  id: string;
  title: string;
  description: string;
  category: RentalCatKey;
  price_text: string | null;
  location: string | null;
  photos: string[];
  owner_name: string;
  owner_avatar_url: string | null;
  created_at: string;
}

export default function RentalsPage() {
  const { user, openLogin } = useFishAuth();
  const [cat, setCat] = useState<RentalCatKey>("shack");
  const [items, setItems] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async (c: RentalCatKey) => {
    setLoading(true);
    try {
      const d = await fishFetch(`/api/fishmb/rentals?category=${c}`);
      setItems(d.items as RentalItem[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(cat);
  }, [cat]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide">
            Rentals
          </h1>
          <p className="text-pine/60 text-sm mt-1 max-w-xl">
            Rent an ice shack, a tent, gear, or a personal guide — straight from
            the people who own them. Booking requests are free; the owner calls
            you to make the deal.
          </p>
        </div>
        <div className="flex gap-2">
          {user && (
            <Link
              href="/fishmb/rentals/bookings"
              className="inline-flex items-center bg-paper-deep border border-pine/15 hover:border-signal text-pine text-sm font-bold uppercase tracking-wider px-5 py-3 rounded-full transition-colors"
            >
              📅 My bookings
            </Link>
          )}
          <button
            onClick={() => (user ? setShowForm(true) : openLogin())}
            className="inline-flex items-center bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-5 py-3 rounded-full transition-colors"
          >
            + List your rental
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto py-4 -mx-4 px-4">
        {RENTAL_CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
              cat === c.key
                ? "bg-pine text-white"
                : "bg-paper-deep border border-pine/15 text-pine/70 hover:border-signal"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-pine/10 rounded-3xl h-64 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-4xl mb-3">{RENTAL_CATS.find((c) => c.key === cat)?.emoji}</p>
          <p className="text-pine/70 font-bold">
            No {RENTAL_CATS.find((c) => c.key === cat)?.label.toLowerCase()} listed yet.
          </p>
          <p className="text-pine/50 text-sm mt-1">Be the first — list yours for free.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((r) => (
            <Link
              key={r.id}
              href={`/fishmb/rentals/${r.id}`}
              className="bg-white border border-pine/10 rounded-3xl overflow-hidden hover:border-signal/50 transition-colors"
            >
              <div className="aspect-video bg-paper-deep relative">
                {r.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    {RENTAL_CATS.find((c) => c.key === r.category)?.emoji}
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="font-bold text-pine text-lg leading-snug line-clamp-1">{r.title}</p>
                {r.price_text && (
                  <p className="text-signal font-bold text-sm mt-1">{r.price_text}</p>
                )}
                <div className="flex items-center justify-between mt-3 text-xs text-pine/50">
                  <span className="truncate">{r.location ?? "Manitoba"}</span>
                  <span className="shrink-0 ml-2">by {r.owner_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <NewRentalForm
          onClose={() => setShowForm(false)}
          onCreated={(c) => {
            setShowForm(false);
            if (c === cat) load(cat);
            else setCat(c);
          }}
        />
      )}
    </div>
  );
}

function NewRentalForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (cat: RentalCatKey) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RentalCatKey>("shack");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const uploadAll = async (): Promise<string[]> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const urls: string[] = [];
    for (const f of files.slice(0, 8)) {
      const form = new FormData();
      form.append("file", await compressImage(f));
      const res = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed.");
      urls.push(d.url as string);
    }
    return urls;
  };

  const submit = async () => {
    if (!title.trim() || !contact.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const photos = await uploadAll();
      const d = await fishFetch("/api/fishmb/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          price_text: price.trim() || null,
          contact: contact.trim(),
          location: location.trim() || null,
          photos,
        }),
      });
      onCreated((d as { rental: { category: RentalCatKey } }).rental.category);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create your listing.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-pine-deep/60 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="List your rental"
    >
      <div
        className="bg-paper rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-1">
          List your rental
        </h2>
        <p className="text-pine/60 text-sm mb-6">
          Free to list. Renters book days from your calendar — you get the
          request and call them to make the deal.
        </p>
        {note && (
          <p className="text-sm text-signal-dark bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            {note}
          </p>
        )}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {RENTAL_CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  category === c.key
                    ? "bg-pine text-white"
                    : "bg-paper-deep border border-pine/15 text-pine/70"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Title — e.g. 8x12 heated ice shack on Lake Winnipeg *"
            className={inputCls}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Details: sleeps, heat, holes, what's included…"
            className={`${inputCls} text-sm resize-none`}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              maxLength={100}
              placeholder="Price — e.g. $150/day"
              className={inputCls}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="Location (e.g. Chalet Beach, MB)"
              className={inputCls}
            />
          </div>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            placeholder="Contact — phone or email *"
            className={inputCls}
          />
          <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
            {files.length > 0
              ? `📷 ${files.length} photo(s) selected`
              : "📷 Add photos (up to 8)"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="text-pine/60 text-sm font-bold uppercase tracking-wider px-5 py-3"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !title.trim() || !contact.trim()}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full disabled:opacity-40 transition-colors"
            >
              {busy ? "Listing…" : "Create listing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
