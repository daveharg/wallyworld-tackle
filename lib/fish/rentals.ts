// FishMB rentals: ice shack / tent / equipment / guide-service listings with an
// availability calendar and day-level booking requests.
// Bookings are REQUESTS — the owner calls the renter to confirm the deal.

import { query, queryOne, withTransaction, txQuery, txQueryOne } from "./db";
import type { PoolClient } from "pg";

export type RentalCategory = "shack" | "tent" | "equipment" | "guide";

export const RENTAL_CATEGORIES: RentalCategory[] = ["shack", "tent", "equipment", "guide"];

export interface Rental {
  id: string;
  owner_user_id: string;
  owner_name: string;
  owner_avatar_url: string | null;
  title: string;
  description: string;
  category: RentalCategory;
  price_text: string | null;
  contact: string;
  location: string | null;
  photos: string[];
  created_at: string;
}

export interface RentalSlot {
  id: string;
  rental_id: string;
  slot_date: string; // YYYY-MM-DD
  status: "open" | "booked";
}

export interface RentalBooking {
  id: string;
  rental_id: string;
  rental_title: string;
  rental_category: RentalCategory;
  owner_user_id: string;
  owner_name: string;
  renter_user_id: string;
  renter_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  renter_name_note: string | null;
  renter_contact: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
}

let ensured = false;

export async function ensureRentalsTables(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_rentals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    category text NOT NULL CHECK (category IN ('shack','tent','equipment','guide')),
    price_text text,
    contact text NOT NULL,
    location text,
    photos jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS fm_rental_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES fm_rentals(id) ON DELETE CASCADE,
    slot_date date NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','booked')),
    UNIQUE (rental_id, slot_date)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS fm_rental_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id uuid NOT NULL REFERENCES fm_rentals(id) ON DELETE CASCADE,
    renter_user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    renter_name text,
    renter_contact text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_rentals_category_idx ON fm_rentals(category, created_at DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_rental_slots_rental_idx ON fm_rental_slots(rental_id, slot_date)`
  );
  ensured = true;
}

const RENTAL_SELECT = `
  SELECT r.id, r.owner_user_id, u.name AS owner_name, u.avatar_url AS owner_avatar_url,
         r.title, r.description, r.category, r.price_text, r.contact, r.location,
         r.photos, r.created_at
    FROM fm_rentals r
    JOIN fm_users u ON u.id = r.owner_user_id`;

export async function listRentals(category?: RentalCategory, limit = 60): Promise<Rental[]> {
  await ensureRentalsTables();
  if (category) {
    return query<Rental>(`${RENTAL_SELECT} WHERE r.category = $1 ORDER BY r.created_at DESC LIMIT $2`, [category, limit]);
  }
  return query<Rental>(`${RENTAL_SELECT} ORDER BY r.created_at DESC LIMIT $1`, [limit]);
}

export async function getRental(id: string): Promise<Rental | null> {
  await ensureRentalsTables();
  return queryOne<Rental>(`${RENTAL_SELECT} WHERE r.id = $1`, [id]);
}

export async function getMyRentals(userId: string): Promise<Rental[]> {
  await ensureRentalsTables();
  return query<Rental>(`${RENTAL_SELECT} WHERE r.owner_user_id = $1 ORDER BY r.created_at DESC`, [userId]);
}

export async function createRental(
  ownerId: string,
  input: {
    title: string;
    description: string;
    category: RentalCategory;
    price_text: string | null;
    contact: string;
    location: string | null;
    photos: string[];
  }
): Promise<Rental> {
  await ensureRentalsTables();
  const rows = await query<Rental>(
    `INSERT INTO fm_rentals (owner_user_id, title, description, category, price_text, contact, location, photos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, owner_user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS owner_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS owner_avatar_url,
       title, description, category, price_text, contact, location, photos, created_at`,
    [ownerId, input.title, input.description, input.category, input.price_text, input.contact, input.location, JSON.stringify(input.photos)]
  );
  return rows[0];
}

export async function updateRental(
  id: string,
  ownerId: string,
  input: {
    title?: string;
    description?: string;
    price_text?: string | null;
    contact?: string;
    location?: string | null;
    photos?: string[];
  }
): Promise<Rental | null> {
  await ensureRentalsTables();
  const sets: string[] = [];
  const params: unknown[] = [id, ownerId];
  const push = (col: string, val: unknown, json = false) => {
    sets.push(`${col} = $${params.length + 1}${json ? "::jsonb" : ""}`);
    params.push(val);
  };
  if (input.title !== undefined) push("title", input.title);
  if (input.description !== undefined) push("description", input.description);
  if (input.price_text !== undefined) push("price_text", input.price_text);
  if (input.contact !== undefined) push("contact", input.contact);
  if (input.location !== undefined) push("location", input.location);
  if (input.photos !== undefined) push("photos", JSON.stringify(input.photos), true);
  if (sets.length === 0) return getRental(id);
  const row = await queryOne<Rental>(
    `UPDATE fm_rentals SET ${sets.join(", ")} WHERE id = $1 AND owner_user_id = $2
     RETURNING id, owner_user_id,
       (SELECT name FROM fm_users WHERE id = owner_user_id) AS owner_name,
       (SELECT avatar_url FROM fm_users WHERE id = owner_user_id) AS owner_avatar_url,
       title, description, category, price_text, contact, location, photos, created_at`,
    params
  );
  return row;
}

export async function deleteRental(id: string, ownerId: string): Promise<boolean> {
  await ensureRentalsTables();
  const rows = await query(`DELETE FROM fm_rentals WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [id, ownerId]);
  return rows.length > 0;
}

// --- Slots -----------------------------------------------------------------

export interface SlotDay {
  date: string; // YYYY-MM-DD
  status: "open" | "booked";
}

export async function getSlots(rentalId: string, from: string, to: string): Promise<SlotDay[]> {
  await ensureRentalsTables();
  const rows = await query<{ slot_date: string; status: string }>(
    `SELECT to_char(slot_date, 'YYYY-MM-DD') AS slot_date, status
       FROM fm_rental_slots
      WHERE rental_id = $1 AND slot_date >= $2::date AND slot_date <= $3::date
      ORDER BY slot_date`,
    [rentalId, from, to]
  );
  return rows.map((r) => ({ date: r.slot_date, status: r.status as "open" | "booked" }));
}

/** Owner upserts: open=true marks days available (never unbooks a booked day);
 *  open=false removes the day only if it is currently open (never deletes booked days). */
export async function setSlots(
  rentalId: string,
  ownerId: string,
  dates: string[],
  open: boolean
): Promise<SlotDay[]> {
  await ensureRentalsTables();
  const rental = await getRental(rentalId);
  if (!rental || rental.owner_user_id !== ownerId) return [];
  for (const d of dates) {
    if (open) {
      await query(
        `INSERT INTO fm_rental_slots (rental_id, slot_date, status)
         VALUES ($1, $2::date, 'open')
         ON CONFLICT (rental_id, slot_date) DO UPDATE SET status = 'open'
         WHERE fm_rental_slots.status = 'open'`,
        [rentalId, d]
      );
    } else {
      await query(
        `DELETE FROM fm_rental_slots
          WHERE rental_id = $1 AND slot_date = $2::date AND status = 'open'`,
        [rentalId, d]
      );
    }
  }
  return getSlots(rentalId, dates[0] ?? todayPlus(0), dates[dates.length - 1] ?? todayPlus(90));
}

/** YYYY-MM-DD of today (UTC) + offset days. */
export function todayPlus(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// --- Bookings ---------------------------------------------------------------

const BOOKING_SELECT = `
  SELECT b.id, b.rental_id, r.title AS rental_title, r.category AS rental_category,
         r.owner_user_id, ou.name AS owner_name,
         b.renter_user_id, u.name AS renter_name,
         to_char(b.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(b.end_date, 'YYYY-MM-DD') AS end_date,
         b.renter_name AS renter_name_note, b.renter_contact, b.status, b.created_at
    FROM fm_rental_bookings b
    JOIN fm_rentals r ON r.id = b.rental_id
    JOIN fm_users u ON u.id = b.renter_user_id
    JOIN fm_users ou ON ou.id = r.owner_user_id`;

export async function getBookingsForOwner(ownerId: string): Promise<RentalBooking[]> {
  await ensureRentalsTables();
  return query<RentalBooking>(
    `${BOOKING_SELECT} WHERE r.owner_user_id = $1 ORDER BY b.created_at DESC`,
    [ownerId]
  );
}

export async function getBookingsForRenter(userId: string): Promise<RentalBooking[]> {
  await ensureRentalsTables();
  return query<RentalBooking>(
    `${BOOKING_SELECT} WHERE b.renter_user_id = $1 ORDER BY b.created_at DESC`,
    [userId]
  );
}

export async function getBookingsForRental(rentalId: string): Promise<RentalBooking[]> {
  await ensureRentalsTables();
  return query<RentalBooking>(
    `${BOOKING_SELECT} WHERE b.rental_id = $1 ORDER BY b.start_date ASC`,
    [rentalId]
  );
}

/** List YYYY-MM-DD dates between start and end inclusive. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Book open days in a transaction: every date in range must be an 'open' slot.
 *  Throws with a friendly message when any day is unavailable. */
export async function createBooking(
  rentalId: string,
  renterId: string,
  startDate: string,
  endDate: string,
  renterContact: string
): Promise<RentalBooking> {
  await ensureRentalsTables();
  const dates = datesInRange(startDate, endDate);
  const booking = await withTransaction(async (client: PoolClient) => {
    const openRows = await txQuery<{ d: string }>(
      client,
      `SELECT to_char(slot_date, 'YYYY-MM-DD') AS d FROM fm_rental_slots
        WHERE rental_id = $1 AND slot_date >= $2::date AND slot_date <= $3::date AND status = 'open'`,
      [rentalId, startDate, endDate]
    );
    const open = new Set(openRows.map((r) => r.d));
    const missing = dates.filter((d) => !open.has(d));
    if (missing.length > 0) {
      throw new Error("Those days aren't available — pick only the green (available) days.");
    }
    const row = await txQueryOne<RentalBooking>(
      client,
      `WITH new_booking AS (
         INSERT INTO fm_rental_bookings (rental_id, renter_user_id, start_date, end_date, renter_contact)
         VALUES ($1, $2, $3::date, $4::date, $5)
         RETURNING id
       )
       ${BOOKING_SELECT} WHERE b.id = (SELECT id FROM new_booking)`,
      [rentalId, renterId, startDate, endDate, renterContact]
    );
    await txQuery(
      client,
      `UPDATE fm_rental_slots SET status = 'booked'
        WHERE rental_id = $1 AND slot_date >= $2::date AND slot_date <= $3::date`,
      [rentalId, startDate, endDate]
    );
    return row!;
  });
  return booking;
}

/** Transition a booking. Owner: confirm or cancel (cancel reopens the days).
 *  Renter: cancel only (also reopens the days). Throws on invalid transition. */
export async function transitionBooking(
  bookingId: string,
  actorId: string,
  toStatus: "confirmed" | "cancelled"
): Promise<RentalBooking> {
  await ensureRentalsTables();
  return withTransaction(async (client: PoolClient) => {
    const b = await txQueryOne<{ id: string; rental_id: string; renter_user_id: string; owner_user_id: string; status: string; start_date: string; end_date: string }>(
      client,
      `SELECT b.id, b.rental_id, b.renter_user_id, b.status,
              r.owner_user_id,
              to_char(b.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(b.end_date, 'YYYY-MM-DD') AS end_date
         FROM fm_rental_bookings b
         JOIN fm_rentals r ON r.id = b.rental_id
        WHERE b.id = $1
        FOR UPDATE`,
      [bookingId]
    );
    if (!b) throw new Error("Booking not found.");
    const isOwner = b.owner_user_id === actorId;
    const isRenter = b.renter_user_id === actorId;
    if (!isOwner && !isRenter) throw new Error("Not allowed.");
    if (b.status === "cancelled") throw new Error("This booking was already cancelled.");
    if (toStatus === "confirmed") {
      if (!isOwner) throw new Error("Only the owner can confirm a booking.");
      if (b.status !== "pending") throw new Error("Only pending bookings can be confirmed.");
    } else {
      // cancelled
      if (!isOwner && !(isRenter && b.status === "pending")) {
        throw new Error("You can't cancel this booking.");
      }
    }
    if (toStatus === "cancelled") {
      await txQuery(
        client,
        `UPDATE fm_rental_slots SET status = 'open'
          WHERE rental_id = $1 AND slot_date >= $2::date AND slot_date <= $3::date AND status = 'booked'`,
        [b.rental_id, b.start_date, b.end_date]
      );
    }
    const out = await txQueryOne<RentalBooking>(
      client,
      `UPDATE fm_rental_bookings SET status = $2 WHERE id = $1 RETURNING *`,
      [bookingId, toStatus]
    );
    void out;
    const full = await txQueryOne<RentalBooking>(
      client,
      `${BOOKING_SELECT} WHERE b.id = $1`,
      [bookingId]
    );
    return full!;
  });
}
