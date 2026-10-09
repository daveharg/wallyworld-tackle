// List something on FishMB Classifieds.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import { CLASSIFIED_CATEGORIES } from "@/lib/fish/classifieds";

export default function NewClassifiedPage() {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("tackle");
  const [price, setPrice] = useState("");
  const [noPrice, setNoPrice] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = async (file: File): Promise<string> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const form = new FormData();
    form.append("file", await compressImage(file));
    const upRes = await fetch("/api/fish/photos/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const up = await upRes.json();
    if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
    return up.url as string;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openLogin();
      return;
    }
    if (!title.trim() || !description.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of photos.slice(0, 4)) {
        urls.push(await uploadPhoto(f));
      }
      const d = await fishFetch("/api/fishmb/classifieds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          price: noPrice ? null : price.trim() || null,
          description: description.trim(),
          location: location.trim() || null,
          photos: urls,
        }),
      });
      router.push(`/fishmb/classifieds/${d.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create listing.");
      setPosting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-32 text-center">
        <p className="text-4xl mb-3">🏷️</p>
        <h1 className="text-xl font-black text-pine mb-2">List it on FishMB</h1>
        <p className="text-sm text-pine/60 mb-6">
          Log in to list your gear, boat, or service — it's free.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
        >
          Log in to continue
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-[15px] placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <Link
        href="/fishmb/classifieds"
        className="inline-block text-sm font-bold text-pine/55 hover:text-pine mb-4"
      >
        ← Classifieds
      </Link>
      <h1 className="text-xl font-black text-pine tracking-tight mb-5">🏷️ List something</h1>

      <form onSubmit={submit} className="bg-white border border-pine/10 rounded-3xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lowrance Hook2 7 fish finder"
            maxLength={100}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
          >
            {CLASSIFIED_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Price
          </label>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pine/50 font-bold">
                $
              </span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                disabled={noPrice}
                className={inputCls + " pl-8 disabled:opacity-40"}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-pine/70 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={noPrice}
                onChange={(e) => setNoPrice(e.target.checked)}
                className="w-4 h-4 accent-[#2f6b3a]"
              />
              No fixed price
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition, age, what's included, why you're selling…"
            rows={4}
            maxLength={2000}
            className={inputCls + " resize-none"}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Location
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Winnipeg, Brandon"
            maxLength={100}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-pine/60 mb-1.5">
            Photos (up to 4)
          </label>
          {photos.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {photos.map((f, i) => (
                <span
                  key={i}
                  className="relative text-xs font-bold text-pine/70 bg-pine/5 rounded-full pl-3 pr-2 py-1.5"
                >
                  📷 {f.name.slice(0, 18)}
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="ml-1.5 text-pine/50 hover:text-signal-dark font-bold"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className="inline-block text-sm font-bold text-signal-dark cursor-pointer">
            📷 {photos.length > 0 ? `Add more (${photos.length}/4)` : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
                if (picked.length) setPhotos([...photos, ...picked].slice(0, 4));
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={posting || !title.trim() || !description.trim()}
          className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-4 rounded-full transition-colors disabled:opacity-40"
        >
          {posting ? "Posting…" : "Post listing"}
        </button>
        <p className="text-xs text-pine/45 text-center">
          Buyers message you through FishMB chat. FishMB takes no cut — deals are between you and the buyer.
        </p>
      </form>
    </div>
  );
}
