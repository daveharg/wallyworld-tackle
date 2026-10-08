// /api/fishmb/business/dashboard — the business dashboard payload.
// Auth + business accounts only.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import {
  ensureBusinessTables,
  getMyBusiness,
  getMyAds,
} from "@/lib/fish/business";
import {
  ensureRentalsTables,
  getMyRentals,
  getBookingsForOwner,
} from "@/lib/fish/rentals";
import { getMyTournaments } from "@/lib/fish/tournaments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const accountType = (me as { account_type?: string }).account_type ?? "personal";
  if (accountType !== "business") {
    return forbidden("The business dashboard is for business accounts.");
  }

  await ensureBusinessTables();
  await ensureRentalsTables();

  const [business, rentals, bookings, tournaments, ads] = await Promise.all([
    getMyBusiness(me.id),
    getMyRentals(me.id),
    getBookingsForOwner(me.id),
    getMyTournaments(me.id),
    getMyAds(me.id),
  ]);

  const pendingByRental: Record<string, number> = {};
  for (const b of bookings) {
    if (b.status === "pending") {
      pendingByRental[b.rental_id] = (pendingByRental[b.rental_id] ?? 0) + 1;
    }
  }

  const active = tournaments.filter((t) => t.status !== "ended");
  const past = tournaments.filter((t) => t.status === "ended");

  const bookingStats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    perRental: rentals.map((r) => ({
      rental_id: r.id,
      title: r.title,
      pending: bookings.filter((b) => b.rental_id === r.id && b.status === "pending").length,
      confirmed: bookings.filter((b) => b.rental_id === r.id && b.status === "confirmed").length,
      cancelled: bookings.filter((b) => b.rental_id === r.id && b.status === "cancelled").length,
    })),
  };

  return NextResponse.json({
    business,
    rentals,
    pendingByRental,
    tournaments: { active, past },
    bookingStats,
    bookings,
    ads,
  });
}
