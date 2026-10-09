// "My listings" section for the OWNER's own profile: their classifieds with
// sold badges and quick sold/delete actions, plus a list-something CTA.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import { classifiedCategoryMeta, formatPrice } from "@/lib/fish/classifieds";

interface MyListing {
  id: string;
  title: string;
  category: string;
  price_cents: number | null;
  photos: string[];
  status: "active" | "sold";
}

export default function MyListings() {
  const [listings, setListings] = useState<MyListing[] | null>(null);

  const load = async () => {
    try {
      const d = await fishFetch("/api/fishmb/classifieds?mine=1");
      setListings((d.items as MyListing[]) ?? []);
    } catch {
      setListings([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markSold = async (id: string) => {
    if (!confirm("Mark this listing as sold?")) return;
    try {
      await fishFetch(`/api/fishmb/classifieds/${id}/sold`, { method: "POST" });
      setListings((prev) => prev?.map((l) => (l.id === id ? { ...l, status: "sold" } : l)) ?? null);
    } catch {
      /* non-fatal */
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this listing permanently?")) return;
    try {
      await fishFetch(`/api/fishmb/classifieds/${id}/delete`, { method: "POST" });
      setListings((prev) => prev?.filter((l) => l.id !== id) ?? null);
    } catch {
      /* non-fatal */
    }
  };

  if (listings === null) {
    return (
      <section className="mt-8 mb-8 bg-white border border-pine/10 rounded-3xl p-4 sm:p-5">
        <div className="h-6 bg-pine/10 rounded-full w-40 animate-pulse mb-4" />
        <div className="h-16 bg-pine/10 rounded-2xl animate-pulse" />
      </section>
    );
  }

  return (
    <section className="mt-8 mb-8 bg-white border border-pine/10 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4 px-1">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
          🏷️ My listings
        </h2>
        <Link
          href="/fishmb/classifieds/new"
          className="text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline"
        >
          + List something
        </Link>
      </div>
      {listings.length === 0 ? (
        <Link
          href="/fishmb/classifieds/new"
          className="block text-center bg-paper-deep border border-dashed border-pine/20 rounded-2xl px-4 py-6 text-pine/60 hover:text-signal-dark hover:border-signal/40 transition-colors"
        >
          <p className="text-2xl mb-1">🏷️</p>
          <p className="font-bold text-sm">Got gear, a boat, or a service to sell?</p>
          <p className="text-signal-dark font-bold text-sm mt-1">List it on classifieds →</p>
        </Link>
      ) : (
        <ul className="space-y-1">
          {listings.map((l) => {
            const meta = classifiedCategoryMeta(l.category);
            return (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-paper-deep transition-colors"
              >
                <Link href={`/fishmb/classifieds/${l.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  {l.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.photos[0]}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-paper-deep"
                    />
                  ) : (
                    <span className="w-14 h-14 rounded-xl bg-paper-deep flex items-center justify-center text-2xl shrink-0">
                      {meta.emoji}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 block">
                    <span className="block font-bold text-pine truncate">{l.title}</span>
                    <span className="block text-xs text-pine/55 uppercase tracking-wider mt-0.5">
                      {formatPrice(l.price_cents)}
                      {l.status === "sold" && (
                        <span className="ml-2 bg-pine/10 text-pine px-2 py-0.5 rounded-full">Sold</span>
                      )}
                    </span>
                  </span>
                </Link>
                <span className="flex gap-1.5 shrink-0">
                  {l.status === "active" && (
                    <button
                      onClick={() => markSold(l.id)}
                      className="text-xs font-bold text-pine border border-pine/20 hover:bg-pine/5 px-3 py-1.5 rounded-full"
                    >
                      ✓ Sold
                    </button>
                  )}
                  <button
                    onClick={() => remove(l.id)}
                    className="text-xs font-bold text-signal-dark border border-signal/30 hover:bg-signal/10 px-3 py-1.5 rounded-full"
                    aria-label={`Delete ${l.title}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
