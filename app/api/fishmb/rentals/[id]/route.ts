// /api/fishmb/rentals/[id] — public detail (GET), owner edit (PATCH), owner delete (DELETE).

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
  updateRental,
  deleteRental,
} from "@/lib/fish/rentals";

const URL_RE = /^https:\/\//i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  return NextResponse.json({ rental });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  if (rental.owner_user_id !== me.id) return forbidden("Only the owner can edit this rental.");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const input: {
    title?: string;
    description?: string;
    price_text?: string | null;
    contact?: string;
    location?: string | null;
    photos?: string[];
  } = {};
  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
    if (!t) return badRequest("Title can't be empty.");
    input.title = t;
  }
  if (body.description !== undefined) {
    input.description =
      typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  }
  if (body.price_text !== undefined) {
    input.price_text =
      typeof body.price_text === "string" && body.price_text.trim()
        ? body.price_text.trim().slice(0, 100)
        : null;
  }
  if (body.contact !== undefined) {
    const c = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
    if (!c) return badRequest("Contact can't be empty.");
    input.contact = c;
  }
  if (body.location !== undefined) {
    input.location =
      typeof body.location === "string" && body.location.trim()
        ? body.location.trim().slice(0, 120)
        : null;
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) return badRequest("photos must be an array of URLs.");
    input.photos = (body.photos as unknown[])
      .filter((p): p is string => typeof p === "string" && URL_RE.test(p.trim()))
      .slice(0, 8)
      .map((p) => p.trim());
  }
  const updated = await updateRental(id, me.id, input);
  if (!updated) return notFound("Rental not found.");
  return NextResponse.json({ rental: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  if (rental.owner_user_id !== me.id) return forbidden("Only the owner can delete this rental.");
  await deleteRental(id, me.id);
  return NextResponse.json({ ok: true });
}
