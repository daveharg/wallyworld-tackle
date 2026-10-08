// /api/fishmb/rentals — public listing (GET ?category=), new listing (POST, auth).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import {
  ensureRentalsTables,
  listRentals,
  getMyRentals,
  createRental,
  RENTAL_CATEGORIES,
  type RentalCategory,
} from "@/lib/fish/rentals";

const URL_RE = /^https:\/\//i;

export async function GET(req: NextRequest) {
  await ensureRentalsTables();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  if (category !== null && !RENTAL_CATEGORIES.includes(category as RentalCategory)) {
    return badRequest("category must be shack, tent, equipment, or guide.");
  }
  if (searchParams.get("mine") === "1") {
    const me = await fishUserFromRequest(req);
    if (!me) return unauthorized();
    const items = await getMyRentals(me.id);
    return NextResponse.json({ items });
  }
  const items = await listRentals((category as RentalCategory) || undefined);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const category = body.category;
  if (!RENTAL_CATEGORIES.includes(category as RentalCategory)) {
    return badRequest("Pick a category: shack, tent, equipment, or guide.");
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  if (!title) return badRequest("Give your rental a title.");
  if (!contact) return badRequest("Add a way for people to reach you (phone or email).");
  const price =
    typeof body.price_text === "string" && body.price_text.trim()
      ? body.price_text.trim().slice(0, 100)
      : null;
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 120)
      : null;
  const photos = Array.isArray(body.photos)
    ? (body.photos as unknown[])
        .filter((p): p is string => typeof p === "string" && URL_RE.test(p.trim()))
        .slice(0, 8)
        .map((p) => p.trim())
    : [];
  const rental = await createRental(me.id, {
    title,
    description,
    category: category as RentalCategory,
    price_text: price,
    contact,
    location,
    photos,
  });
  return NextResponse.json({ rental }, { status: 201 });
}
