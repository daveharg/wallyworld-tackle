// /api/fishmb/rentals/[id]/bookings — POST a booking request (auth; renter ≠ owner).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
} from "@/lib/fish/auth";
import {
  ensureRentalsTables,
  getRental,
  createBooking,
  datesInRange,
} from "@/lib/fish/rentals";
import { validDate } from "../slots/route";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  if (rental.owner_user_id === me.id) {
    return forbidden("You can't book your own rental.");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const start = body.start_date;
  const end = body.end_date;
  if (!validDate(start) || !validDate(end)) {
    return badRequest("start_date and end_date must be YYYY-MM-DD dates.");
  }
  if (end < start) return badRequest("end_date must be on or after start_date.");
  if (datesInRange(start, end).length > 30) {
    return badRequest("Bookings are limited to 30 days at a time.");
  }
  if (start < new Date().toISOString().slice(0, 10)) {
    return badRequest("Bookings start today at the earliest.");
  }
  const contact =
    typeof body.renter_contact === "string" ? body.renter_contact.trim().slice(0, 200) : "";
  if (!contact) return badRequest("Add a phone number or email so the owner can call you.");
  try {
    const booking = await createBooking(id, me.id, start, end, contact);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    // Friendly validation errors (thrown by createBooking) are safe to show.
    // Raw database errors must never reach the screen.
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : "";
    if (!code && !/syntax error|at or near|violates |duplicate key|relation .* does not exist/i.test(msg)) {
      return badRequest(msg || "Could not create the booking.");
    }
    console.error("createBooking failed:", e);
    return NextResponse.json(
      { error: "Something went wrong saving your booking. Please try again." },
      { status: 500 }
    );
  }
}
