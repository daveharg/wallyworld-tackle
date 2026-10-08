// "My bookings" — two sections: the user's own trips (as renter) and
// booking requests on their rentals (as owner). Bookings are REQUESTS —
// the owner calls the renter to confirm the deal.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { catMeta } from "../_meta";

interface Booking {
  id: string;
  rental_id: string;
  rental_title: string;
  rental_category: string;
  owner_name: string;
  renter_name: string;
  start_date: string;
  end_date: string;
  renter_contact: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
}

export default function MyBookingsPage() {
  const { user, loading: authLoading, openLogin } = useFishAuth();
  const [asOwner, setAsOwner] = useState<Booking[]>([]);
  const [asRenter, setAsRenter] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const d = await fishFetch("/api/fishmb/bookings");
        setAsOwner(d.as_owner as Booking[]);
        setAsRenter(d.as_renter as Booking[]);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading]);

  const transition = async (bid: string, status: "confirmed" | "cancelled") => {
    setBusy(bid);
    setNote(null);
    try {
      const d = await fishFetch(`/api/fishmb/bookings/${bid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const updated = d.booking as Booking;
      setAsOwner((prev) => prev.map((b) => (b.id === bid ? updated : b)));
      setAsRenter((prev) => prev.map((b) => (b.id === bid ? updated : b)));
      if (status === "cancelled") setNote("Booking cancelled — those days are available again.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not update the booking.");
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-10 bg-pine/10 rounded-full w-1/2 animate-pulse mb-6" />
        <div className="h-24 bg-pine/10 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-3xl tracking-wide mb-4">
          My bookings
        </h1>
        <p className="text-pine/60 mb-6">Log in to see your booking requests.</p>
        <button
          onClick={openLogin}
          className="bg-signal text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-1">
        My bookings
      </h1>
      <p className="text-pine/60 text-sm mb-8">
        Booking requests are free — the owner calls you to confirm the deal.
      </p>

      {note && (
        <p className="text-sm text-pine bg-gold/15 border border-gold/30 rounded-2xl px-4 py-3 mb-6">
          {note}
        </p>
      )}

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-4">
        🎣 My trips
      </h2>
      {asRenter.length === 0 ? (
        <p className="text-pine/50 text-sm mb-10">
          No trips booked yet.{" "}
          <Link href="/fishmb/rentals" className="text-signal font-bold">
            Find a rental →
          </Link>
        </p>
      ) : (
        <div className="space-y-3 mb-10">
          {asRenter.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              mine="renter"
              busy={busy === b.id}
              onAction={(s) => transition(b.id, s)}
            />
          ))}
        </div>
      )}

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-4">
        📋 Bookings on my rentals
      </h2>
      {asOwner.length === 0 ? (
        <p className="text-pine/50 text-sm">
          Nobody has requested your rentals yet.{" "}
          <Link href="/fishmb/rentals" className="text-signal font-bold">
            List one →
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          {asOwner.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              mine="owner"
              busy={busy === b.id}
              onAction={(s) => transition(b.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  b,
  mine,
  busy,
  onAction,
}: {
  b: Booking;
  mine: "owner" | "renter";
  busy: boolean;
  onAction: (s: "confirmed" | "cancelled") => void;
}) {
  const meta = catMeta(b.rental_category);
  return (
    <div className="bg-white border border-pine/10 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-pine/50">
            {meta.emoji} {b.rental_title}
          </p>
          <p className="font-bold text-pine text-lg mt-1">
            {b.start_date} → {b.end_date}
          </p>
          <p className="text-sm text-pine/60 mt-1">
            {mine === "owner" ? (
              <>
                {b.renter_name} · {b.renter_contact}
              </>
            ) : (
              <>Owner: {b.owner_name}</>
            )}{" "}
            ·{" "}
            <span
              className={
                b.status === "confirmed"
                  ? "text-pine font-bold"
                  : b.status === "cancelled"
                  ? "text-pine/40 line-through"
                  : "text-gold font-bold"
              }
            >
              {b.status}
            </span>
          </p>
          {mine === "owner" && b.status === "pending" && (
            <p className="text-xs text-pine/50 mt-1">Call {b.renter_name} at {b.renter_contact} to confirm the deal.</p>
          )}
        </div>
        <Link
          href={`/fishmb/rentals/${b.rental_id}`}
          className="text-xs font-bold uppercase tracking-wider text-signal hover:text-signal-dark shrink-0"
        >
          View listing →
        </Link>
      </div>
      <div className="flex gap-2 mt-4">
        {mine === "owner" && b.status === "pending" && (
          <>
            <button
              onClick={() => onAction("confirmed")}
              disabled={busy}
              className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40"
            >
              {busy ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => onAction("cancelled")}
              disabled={busy}
              className="bg-paper-deep border border-pine/15 text-pine/70 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        )}
        {mine === "owner" && b.status === "confirmed" && (
          <button
            onClick={() => onAction("cancelled")}
            disabled={busy}
            className="bg-paper-deep border border-pine/15 text-pine/70 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40"
          >
            Cancel booking
          </button>
        )}
        {mine === "renter" && b.status === "pending" && (
          <button
            onClick={() => onAction("cancelled")}
            disabled={busy}
            className="bg-paper-deep border border-pine/15 text-pine/70 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-40"
          >
            Cancel request
          </button>
        )}
      </div>
    </div>
  );
}
