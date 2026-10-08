// /api/fishmb/bookings — auth; the signed-in user's bookings
// as owner ("as_owner") and as renter ("as_renter").

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import {
  ensureRentalsTables,
  getBookingsForOwner,
  getBookingsForRenter,
} from "@/lib/fish/rentals";

export async function GET(req: NextRequest) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const [as_owner, as_renter] = await Promise.all([
    getBookingsForOwner(me.id),
    getBookingsForRenter(me.id),
  ]);
  return NextResponse.json({ as_owner, as_renter });
}
