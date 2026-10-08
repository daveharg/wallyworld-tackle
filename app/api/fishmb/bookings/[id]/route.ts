// /api/fishmb/bookings/[id] — PATCH status transitions.
// Owner: confirm or cancel (cancel reopens the days). Renter: cancel only.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { ensureRentalsTables, transitionBooking } from "@/lib/fish/rentals";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  if (body.status !== "confirmed" && body.status !== "cancelled") {
    return badRequest("status must be 'confirmed' or 'cancelled'.");
  }
  try {
    const booking = await transitionBooking(id, me.id, body.status);
    return NextResponse.json({ booking });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Could not update the booking.");
  }
}
