// FishMB Classifieds — Kijiji-style buy & sell for the community.
// Signed-out visitors can browse; listing and messaging need a login.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import BackArrow from "../_components/BackArrow";
import {
  CLASSIFIED_CATEGORIES,
  classifiedCategoryMeta,
  formatPrice,
} from "@/lib/fish/classifieds-meta";

interface Listing {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  category: string;
  title: string;
  description: string;
  price_cents: number | null;
  photos: string[];
  location: string | null;
  status: "active" | "sold";
  created_at: string;
}

function ListingCard({ item }: { item: Listing }) {
  const meta = classifiedCategoryMeta(item.category);
  return (
    <Link
      href={`/fishmb/classifieds/${item.id}`}
      className="block bg-white border border-pine/10 rounded-3xl overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-paper-deep relative">
        {item.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-pine/5">
            {meta.emoji}
          </div>
        )}
        {item.status === "sold" && (
          <span className="absolute top-2 left-2 bg-pine-deep/85 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            Sold
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-black text-pine text-lg leading-tight">
          {formatPrice(item.price_cents)}
        </p>
        <p className="text-sm text-pine/75 font-medium leading-snug mt-0.5 line-clamp-2">
          {item.title}
        </p>
        {item.location && (
          <p className="text-xs text-pine/50 mt-1 truncate">{item.location}</p>
        )}
      </div>
    </Link>
  );
}

export default function ClassifiedsPage() {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = async (category: string, query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (query.trim()) params.set("q", query.trim());
      const d = await fishFetch(`/api/fishmb/classifieds?${params.toString()}`);
      setItems((d.items as Listing[]) ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(cat, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput);
  };

  const listSomething = () => {
    if (!user) {
      openLogin();
      return;
    }
    router.push("/fishmb/classifieds/new");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <BackArrow />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black text-pine tracking-tight">Classifieds</h1>
        <button
          onClick={listSomething}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          + List something
        </button>
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="mb-4">
        <div className="flex items-center bg-white border border-pine/15 rounded-full px-5 py-3.5 shadow-sm focus-within:border-signal/60">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search classifieds"
            className="flex-1 bg-transparent text-pine placeholder:text-pine/40 text-[15px] focus:outline-none"
            aria-label="Search classifieds"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQ("");
              }}
              className="text-pine/40 hover:text-pine font-bold px-2"
              aria-label="Clear search"
            >
 
            </button>
          )}
        </div>
      </form>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4">
 {[{ key: "all", emoji: "", label: "All" }, ...CLASSIFIED_CATEGORIES].map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full border text-sm font-bold whitespace-nowrap transition-colors ${
              cat === c.key
                ? "bg-pine text-white border-pine"
                : "bg-white text-pine/70 border-pine/15 hover:border-pine/40"
            }`}
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {/* Popular categories */}
      <h2 className="text-lg font-black text-pine tracking-tight mb-3">Popular categories</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
        {CLASSIFIED_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className="shrink-0 flex flex-col items-center gap-2 w-20"
          >
            <span
              className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-colors ${
                cat === c.key ? "bg-pine text-white" : "bg-pine/10 hover:bg-pine/20"
              }`}
            >
              {c.emoji}
            </span>
            <span className="text-xs font-bold text-pine/70 text-center leading-tight">
              {c.label}
            </span>
          </button>
        ))}
      </div>

      {/* Listings grid */}
      <h2 className="text-lg font-black text-pine tracking-tight mb-3">
        {q ? `Results for “${q}”` : cat === "all" ? "Fresh listings" : classifiedCategoryMeta(cat).label}
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
              <div className="aspect-square bg-pine/5 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-5 bg-pine/10 rounded-full w-20 animate-pulse" />
                <div className="h-4 bg-pine/10 rounded-full w-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white border border-pine/10 rounded-3xl">
          <p className="font-bold text-pine mb-1">Nothing here yet</p>
          <p className="text-sm text-pine/55 mb-5 px-6">
            {q || cat !== "all"
              ? "Try a different search or category."
              : "Be the first to list your gear, boat, or service."}
          </p>
          <button
            onClick={listSomething}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full transition-colors"
          >
            + List something
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!user && (
        <p className="text-center text-xs text-pine/45 mt-8">
          Browsing is free —{" "}
          <button onClick={openLogin} className="font-bold text-signal-dark hover:underline">
            log in
          </button>{" "}
          to list your gear or message a seller.
        </p>
      )}
    </div>
  );
}
