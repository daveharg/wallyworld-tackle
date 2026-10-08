// /api/fishmb/classifieds — guide + ice-shack classifieds.
// GET ?category=guide|shack — public listing. POST — new listing (auth).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { listClassifieds, createClassified } from "@/lib/fish/classifieds";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  if (category !== "guide" && category !== "shack") {
    return badRequest("category must be 'guide' or 'shack'.");
  }
  const items = await listClassifieds(category);
  return NextResponse.json({ items });
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
  const category = body.category;
  if (category !== "guide" && category !== "shack") {
    return badRequest("category must be 'guide' or 'shack'.");
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  if (!title) return badRequest("Give your listing a title.");
  if (!text) return badRequest("Describe your service.");
  if (!contact) return badRequest("Add a way for people to reach you (phone or email).");
  const price =
    typeof body.price_text === "string" && body.price_text.trim()
      ? body.price_text.trim().slice(0, 100)
      : null;
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 100)
      : null;
  const item = await createClassified(me.id, {
    category,
    title,
    body: text,
    price_text: price,
    contact,
    location,
    offers: typeof body.offers === "string" ? body.offers : undefined,
  });
  return NextResponse.json({ item }, { status: 201 });
}
