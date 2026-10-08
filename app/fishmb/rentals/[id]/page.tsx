// Rental detail page: photos, info, availability calendar, renter booking
// flow, and (for the owner) the availability editor + booking requests.
// Bookings are REQUESTS — the owner calls the renter to confirm the deal.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { catMeta, type RentalCatKey } from "../_meta";

interface Rental {
  id: string;
  owner_user_id: string;
  owner_name: string;
  owner_avatar_url: string | null;
  title: string;
  description: string;
  category: RentalCatKey;
  price_text: string | null;
  contact: string;
  location: string | null;
  photos: string[];
  created_at: string;
}

interface Booking {
  id: string;
  rental_id: string;
  rental_title: string;
  renter_user_id: string;
  renter_name: string;
  renter_avatar_url: string | null;
  start_date: string;
  end_date: string;
  renter_contact: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type DayStatus = "open" | "booked" | "none";

const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayYMD(): string {
  const d = new Date();
  return fmtYMD(d);
}
function addDaysStr(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return fmtYMD(dt);
}
function datesBetween(a: string, b: string): string[] {
  const out: string[] = [];
  let cur = a;
  while (cur <= b) {
    out.push(cur);
    cur = addDaysStr(cur, 1);
  }
  return out;
}

export default function RentalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, openLogin } = useFishAuth();

  const [rental, setRental] = useState<Rental | null>(null);
  const [slots, setSlots] = useState<Record<string, "open" | "booked">>({});
  const [photoIdx, setPhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Renter flow
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  // Owner flow
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [savingSlots, setSavingSlots] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsBusy, setBookingsBusy] = useState<string | null>(null);

  const isOwner = !!user && !!rental && user.id === rental.owner_user_id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fishFetch(`/api/fishmb/rentals/${id}`);
      const r = d.rental as Rental;
      setRental(r);
      const to = addDaysStr(todayYMD(), 92);
      const s = await fishFetch(`/api/fishmb/rentals/${id}/slots?from=${todayYMD()}&to=${to}`);
      const map: Record<string, "open" | "booked"> = {};
      for (const sl of s.slots as { date: string; status: "open" | "booked" }[]) {
        map[sl.date] = sl.status;
      }
      setSlots(map);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOwnerBookings = useCallback(async () => {
    if (!isOwner) return;
    try {
      const d = await fishFetch(`/api/fishmb/rentals/${id}/bookings`);
      setBookings((d.bookings as Booking[]) ?? []);
    } catch {
      /* ignore */
    }
  }, [id, isOwner]);

  useEffect(() => {
    loadOwnerBookings();
  }, [loadOwnerBookings]);

  const statusOf = (date: string): DayStatus => {
    if (date in changes) return changes[date] ? "open" : "none";
    return slots[date] ?? "none";
  };

  const today = todayYMD();
  const monthStarts = useMemo(() => {
    const now = new Date();
    const out: { y: number; m: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    return out;
  }, []);

  const clickDay = (date: string) => {
    if (date < today) return;
    if (isOwner) {
      const st = slots[date];
      if (st === "booked") return; // never toggle booked days
      setChanges((prev) => {
        const next = { ...prev };
        const current = date in prev ? (prev[date] ? "open" : "none") : st ?? "none";
        if (current === "open") {
          // want it closed
          if ((st ?? "none") === "open") next[date] = false;
          else delete next[date];
        } else {
          // want it open
          if ((st ?? "none") === "open") delete next[date];
          else next[date] = true;
        }
        return next;
      });
    } else {
      if (slots[date] !== "open") return;
      setBookingDone(false);
      if (!selStart || (selStart && selEnd)) {
        setSelStart(date);
        setSelEnd(null);
      } else if (date >= selStart) {
        setSelEnd(date);
      } else {
        setSelStart(date);
      }
    }
  };

  const pendingChangeCount = Object.keys(changes).length;

  const saveAvailability = async () => {
    if (pendingChangeCount === 0 || savingSlots) return;
    setSavingSlots(true);
    setNote(null);
    try {
      const openDates = Object.entries(changes)
        .filter(([, v]) => v)
        .map(([d]) => d)
        .sort();
      const closedDates = Object.entries(changes)
        .filter(([, v]) => !v)
        .map(([d]) => d)
        .sort();
      if (openDates.length > 0) {
        await fishFetch(`/api/fishmb/rentals/${id}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: openDates, open: true }),
        });
      }
      if (closedDates.length > 0) {
        await fishFetch(`/api/fishmb/rentals/${id}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: closedDates, open: false }),
        });
      }
      setChanges({});
      await load();
      setNote("Availability saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save availability.");
    } finally {
      setSavingSlots(false);
    }
  };

  const rangeDates = selStart && selEnd ? datesBetween(selStart, selEnd) : selStart ? [selStart] : [];
  const rangeAllOpen = rangeDates.every((d) => slots[d] === "open");

  const requestBooking = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!selStart || !contact.trim() || bookingBusy) return;
    const end = selEnd ?? selStart;
    if (rangeDates.length > 30) {
      setNote("Bookings are limited to 30 days at a time.");
      return;
    }
    setBookingBusy(true);
    setNote(null);
    try {
      await fishFetch(`/api/fishmb/rentals/${id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: selStart,
          end_date: end,
          renter_contact: contact.trim(),
        }),
      });
      setBookingDone(true);
      setSelStart(null);
      setSelEnd(null);
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send the booking request.");
    } finally {
      setBookingBusy(false);
    }
  };

  const transition = async (bid: string, status: "confirmed" | "cancelled") => {
    setBookingsBusy(bid);
    setNote(null);
    try {
      await fishFetch(`/api/fishmb/bookings/${bid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadOwnerBookings();
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not update the booking.");
    } finally {
      setBookingsBusy(null);
    }
  };

  const deleteListing = async () => {
    if (!window.confirm("Delete this rental listing? This can't be undone.")) return;
    try {
      await fishFetch(`/api/fishmb/rentals/${id}`, { method: "DELETE" });
      router.push("/fishmb/rentals");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete the listing.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-10 bg-pine/10 rounded-full w-2/3 animate-pulse mb-4" />
        <div className="h-64 bg-pine/10 rounded-3xl animate-pulse" />
      </div>
    );
  }
  if (notFound || !rental) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-pine/60 mb-6">This rental listing wasn't found.</p>
        <Link
          href="/fishmb/rentals"
          className="bg-signal text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Back to Rentals
        </Link>
      </div>
    );
  }

  const meta = catMeta(rental.category);
  const photos = rental.photos.length > 0 ? rental.photos : [];
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <Link
        href="/fishmb/rentals"
        className="text-sm font-bold uppercase tracking-wider text-pine/50 hover:text-signal"
      >
        ← Rentals
      </Link>

      <div className="mt-4">
        <span className="inline-block bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
          {meta.emoji} {meta.label}
        </span>
        <h1 className="font-display font-bold uppercase text-pine text-3xl md:text-4xl tracking-wide mt-3">
          {rental.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-pine/60">
          {rental.price_text && <span className="text-signal font-bold text-lg">{rental.price_text}</span>}
          {rental.location && <span>📍 {rental.location}</span>}
          <span>by {rental.owner_name}</span>
        </div>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/fishmb/rentals/${id}`;
            if (navigator.share) {
              try {
                await navigator.share({
                  title: rental.title,
                  text: `${rental.title}${rental.price_text ? ` — ${rental.price_text}` : ""}${rental.location ? ` (${rental.location})` : ""}`,
                  url,
                });
              } catch {
                /* user dismissed the share sheet */
              }
            } else {
              await navigator.clipboard.writeText(url);
              setNote("Listing link copied — share it anywhere.");
            }
          }}
          className="mt-3 inline-flex items-center gap-2 bg-pine text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-pine-deep transition-colors"
        >
          📤 Share this listing
        </button>
      </div>

      {/* Owner: booking requests — front and center, above the public details */}
      {isOwner && (
        <div className="mt-6 bg-gold/10 border-2 border-gold/40 rounded-3xl p-6">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1 flex items-center gap-2 flex-wrap">
            📥 Booking requests
            {pendingCount > 0 && (
              <span className="bg-signal text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {pendingCount} new
              </span>
            )}
          </h2>
          <p className="text-pine/60 text-sm mb-4">
            Call the renter to close the deal — confirming holds the days, declining reopens them.
          </p>
          {bookings.length === 0 ? (
            <p className="text-pine/50 text-sm">No booking requests yet. Share your listing to get the word out.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-pine/10 rounded-2xl p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {b.renter_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.renter_avatar_url}
                        alt={b.renter_name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-gold shrink-0"
                      />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine text-lg shrink-0">
                        {b.renter_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-pine truncate">{b.renter_name}</p>
                      <a
                        href={`tel:${b.renter_contact}`}
                        className="text-signal-dark font-bold text-sm"
                      >
                        📞 {b.renter_contact}
                      </a>
                      <p className="text-sm text-pine/60 mt-0.5">
                        {b.start_date} → {b.end_date} · requested {fmtDate(b.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                        b.status === "confirmed"
                          ? "bg-pine text-white"
                          : b.status === "cancelled"
                          ? "bg-pine/10 text-pine/40"
                          : "bg-gold/25 text-signal-dark"
                      }`}
                    >
                      {b.status}
                    </span>
                    {b.status === "pending" && (
                      <>
                        <button
                          onClick={() => transition(b.id, "confirmed")}
                          disabled={bookingsBusy === b.id}
                          className="bg-pine hover:bg-pine-deep text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                        >
                          {bookingsBusy === b.id ? "…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => transition(b.id, "cancelled")}
                          disabled={bookingsBusy === b.id}
                          className="bg-white border border-pine/15 text-pine/70 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full disabled:opacity-40"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {b.status === "confirmed" && (
                      <button
                        onClick={() => transition(b.id, "cancelled")}
                        disabled={bookingsBusy === b.id}
                        className="bg-white border border-pine/15 text-pine/70 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full disabled:opacity-40"
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={deleteListing}
            className="mt-6 text-xs font-bold uppercase tracking-wider text-signal-dark/70 hover:text-signal-dark"
          >
            Delete this listing
          </button>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-6">
          <div className="rounded-3xl overflow-hidden bg-paper-deep aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIdx]}
              alt={rental.title}
              className="w-full h-full object-cover"
            />
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {photos.map((p, i) => (
                <button
                  key={p + i}
                  onClick={() => setPhotoIdx(i)}
                  className={`w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 ${
                    i === photoIdx ? "border-signal" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {rental.description && (
        <p className="mt-6 text-pine/80 whitespace-pre-line">{rental.description}</p>
      )}

      {note && (
        <p className="mt-6 text-sm text-pine bg-gold/15 border border-gold/30 rounded-2xl px-4 py-3">
          {note}
        </p>
      )}

      {/* Availability calendar */}
      <div className="mt-8 bg-white border border-pine/10 rounded-3xl p-6">
        <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-1">
          {isOwner ? "Availability" : "Available days"}
        </h2>
        <p className="text-pine/60 text-sm mb-5">
          {isOwner
            ? "Tap days to mark them available or closed, then save. Booked days can't be changed until the booking is cancelled."
            : "Green days are available — tap one to start, tap another to set the range. Only days the owner marked available can be booked."}
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {monthStarts.map(({ y, m }) => (
            <MonthGrid
              key={`${y}-${m}`}
              year={y}
              month={m}
              today={today}
              statusOf={statusOf}
              isChanged={(date) => date in changes}
              onDay={clickDay}
              selStart={selStart}
              selEnd={selEnd}
              isOwner={isOwner}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-pine/60">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-pine inline-block" /> Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-pine/15 inline-block" /> Booked
          </span>
          {!isOwner && selStart && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-signal inline-block" /> Your selection
            </span>
          )}
          {isOwner && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded border-2 border-dashed border-signal inline-block" /> Unsaved change
            </span>
          )}
        </div>

        {isOwner ? (
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveAvailability}
              disabled={savingSlots || pendingChangeCount === 0}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full disabled:opacity-40 transition-colors"
            >
              {savingSlots ? "Saving…" : `Save availability (${pendingChangeCount})`}
            </button>
          </div>
        ) : (
          <div className="mt-6 bg-paper-deep border border-pine/10 rounded-2xl p-5">
            {bookingDone ? (
              <div className="text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-bold text-pine text-lg">Booking request sent!</p>
                <p className="text-pine/60 text-sm mt-1">
                  The owner will call you to confirm the deal.
                </p>
              </div>
            ) : selStart ? (
              <div className="space-y-3">
                <p className="font-bold text-pine">
                  {selStart === (selEnd ?? selStart)
                    ? `One day: ${selStart}`
                    : `${selStart} → ${selEnd}`}
                  <span className="font-normal text-pine/60"> ({rangeDates.length} day{rangeDates.length > 1 ? "s" : ""})</span>
                </p>
                {!rangeAllOpen && (
                  <p className="text-sm text-signal-dark">
                    Some days in that range aren't available — pick only green days.
                  </p>
                )}
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={200}
                  placeholder="Your phone or email — the owner will call you *"
                  className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
                />
                <p className="text-xs text-pine/50">
                  Booking requests are free. The owner calls you to confirm the deal — nothing is charged here.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelStart(null);
                      setSelEnd(null);
                    }}
                    className="text-pine/60 text-sm font-bold uppercase tracking-wider px-4 py-3"
                  >
                    Clear
                  </button>
                  <button
                    onClick={requestBooking}
                    disabled={bookingBusy || !contact.trim() || !rangeAllOpen}
                    className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full disabled:opacity-40 transition-colors"
                  >
                    {bookingBusy ? "Sending…" : "Request booking"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-pine/60 text-sm text-center">
                {user
                  ? "Tap an available (green) day above to start a booking request."
                  : "Log in and tap an available (green) day above to request a booking."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="mt-6 bg-white border border-pine/10 rounded-3xl p-6">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-2">
          Contact the owner
        </h2>
        <p className="text-pine/80 font-bold">{rental.contact}</p>
        <p className="text-pine/50 text-xs mt-1">
          Prefer to talk first? Reach out directly — deals are made with the owner, not through this site.
        </p>
      </div>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  today,
  statusOf,
  isChanged,
  onDay,
  selStart,
  selEnd,
  isOwner,
}: {
  year: number;
  month: number;
  today: string;
  statusOf: (date: string) => DayStatus;
  isChanged: (date: string) => boolean;
  onDay: (date: string) => void;
  selStart: string | null;
  selEnd: string | null;
  isOwner: boolean;
}) {
  const name = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(fmtYMD(new Date(year, month, d)));

  const inSelection = (date: string) =>
    !isOwner && selStart !== null && date >= selStart && date <= (selEnd ?? selStart);

  return (
    <div>
      <p className="font-bold text-pine text-sm mb-2 text-center">{name}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-pine/40 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) =>
          date === null ? (
            <span key={`x${i}`} />
          ) : (
            <DayCell
              key={date}
              date={date}
              status={statusOf(date)}
              changed={isChanged(date)}
              past={date < today}
              selected={inSelection(date)}
              onClick={() => onDay(date)}
              isOwner={isOwner}
            />
          )
        )}
      </div>
    </div>
  );
}

function DayCell({
  date,
  status,
  changed,
  past,
  selected,
  onClick,
  isOwner,
}: {
  date: string;
  status: DayStatus;
  changed: boolean;
  past: boolean;
  selected: boolean;
  onClick: () => void;
  isOwner: boolean;
}) {
  const day = Number(date.slice(8, 10));
  const clickable = !past && (status === "open" || (isOwner && status === "none"));
  let cls =
    "aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-colors ";
  if (past) {
    cls += "text-pine/20";
  } else if (selected) {
    cls += "bg-signal text-white";
  } else if (status === "open") {
    cls += "bg-pine text-white hover:bg-pine-deep cursor-pointer";
  } else if (status === "booked") {
    cls += "bg-pine/15 text-pine/40";
  } else if (isOwner) {
    cls += "text-pine/40 hover:bg-gold/20 cursor-pointer";
  } else {
    cls += "text-pine/25";
  }
  if (changed) cls += " border-2 border-dashed border-signal";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cls}
      aria-label={date}
    >
      {day}
    </button>
  );
}
