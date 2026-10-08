// "My rentals" section for the OWNER's own profile: their listings with
// pending booking-request badges, plus a list-your-rental CTA when empty.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import { catMeta } from "../../rentals/_meta";

interface MyRental {
  id: string;
  title: string;
  category: string;
  photos: string[];
}

interface OwnerBooking {
  id: string;
  rental_id: string;
  status: "pending" | "confirmed" | "cancelled";
}

export default function MyRentals() {
  const [rentals, setRentals] = useState<MyRental[] | null>(null);
  const [pendingByRental, setPendingByRental] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [r, b] = await Promise.all([
          fishFetch("/api/fishmb/rentals?mine=1"),
          fishFetch("/api/fishmb/bookings"),
        ]);
        if (!live) return;
        setRentals((r.items as MyRental[]) ?? []);
        const counts: Record<string, number> = {};
        for (const bk of (b.as_owner as OwnerBooking[]) ?? []) {
          if (bk.status === "pending") {
            counts[bk.rental_id] = (counts[bk.rental_id] ?? 0) + 1;
          }
        }
        setPendingByRental(counts);
      } catch {
        if (live) setRentals([]);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (rentals === null) {
    return (
      <div className="mt-8">
        <div className="h-6 bg-pine/10 rounded-full w-40 animate-pulse mb-3" />
        <div className="h-20 bg-pine/10 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const totalPending = Object.values(pendingByRental).reduce((a, n) => a + n, 0);

  return (
    <div className="mt-8">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3 flex items-center gap-2 flex-wrap">
        🏠 My rentals
        {totalPending > 0 && (
          <span className="bg-signal text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            {totalPending} new request{totalPending > 1 ? "s" : ""}
          </span>
        )}
      </h2>
      {rentals.length === 0 ? (
        <Link
          href="/fishmb/rentals"
          className="block text-center bg-paper-deep border border-dashed border-pine/20 rounded-2xl px-4 py-6 text-pine/60 hover:text-signal-dark hover:border-signal/40 transition-colors"
        >
          <p className="text-2xl mb-1">🛖</p>
          <p className="font-bold text-sm">Got an ice shack, tent, gear, or guiding to offer?</p>
          <p className="text-signal-dark font-bold text-sm mt-1">List your first rental →</p>
        </Link>
      ) : (
        <div className="space-y-2.5">
          {rentals.map((r) => {
            const meta = catMeta(r.category);
            const pending = pendingByRental[r.id] ?? 0;
            return (
              <Link
                key={r.id}
                href={`/fishmb/rentals/${r.id}`}
                className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3 hover:shadow-md hover:border-gold/40 transition-all"
              >
                {r.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photos[0]}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0 bg-paper-deep"
                  />
                ) : (
                  <span className="w-14 h-14 rounded-xl bg-paper-deep flex items-center justify-center text-2xl shrink-0">
                    {meta.emoji}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-pine truncate">{r.title}</p>
                  <p className="text-xs text-pine/55 uppercase tracking-wider">
                    {meta.emoji} {meta.singular}
                  </p>
                </div>
                {pending > 0 ? (
                  <span className="bg-signal text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0">
                    {pending} new
                  </span>
                ) : (
                  <span className="text-pine/30 text-sm font-bold shrink-0">→</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
