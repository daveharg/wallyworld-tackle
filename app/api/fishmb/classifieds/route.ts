// /api/fishmb/classifieds — Kijiji-style community classifieds.
// GET: public listing (?category=, ?q=, ?mine=1 with auth). POST: new listing (auth).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import {
  listClassifieds,
  createClassified,
  isClassifiedCategoryKey,
} from "@/lib/fish/classifieds";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  if (category && !isClassifiedCategoryKey(category)) {
    return badRequest("Unknown category.");
  }
  const q = (searchParams.get("q") || "").trim().slice(0, 80) || undefined;
  let userId: string | undefined;
  if (searchParams.get("mine") === "1") {
    const me = await fishUserFromRequest(req).catch(() => null);
    if (!me) return unauthorized();
    userId = me.id;
  }
  const items = await listClassifieds({ category, q, userId });
  return NextResponse.json({ items });
}

function cleanUrl(v: unknown): string | null {
  return typeof v === "string" && /^https?:\/\//.test(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const category = typeof body.category === "string" ? body.category : "";
  if (!isClassifiedCategoryKey(category)) return badRequest("Pick a category.");
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  if (!title) return badRequest("Give your listing a title.");
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  if (!description) return badRequest("Describe what you're listing.");
  // Price: dollars as a number/string, or omitted/"contact" for no fixed price.
  let price_cents: number | null = null;
  const rawPrice = body.price_cents ?? body.price;
  if (typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice >= 0) {
    price_cents = Math.round(rawPrice * 100);
  } else if (typeof rawPrice === "string" && rawPrice.trim() !== "") {
    const n = Number(rawPrice.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) return badRequest("That price doesn't look right.");
    price_cents = Math.round(n * 100);
  }
  if (price_cents !== null && price_cents > 100_000_000) {
    return badRequest("That price looks too high.");
  }
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map(cleanUrl)
    .filter((u): u is string => u !== null)
    .slice(0, 4);
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 100)
      : null;
  const item = await createClassified(me.id, {
    category,
    title,
    description,
    price_cents,
    photos,
    location,
  });
  return NextResponse.json({ item }, { status: 201 });
}
