// /api/fishmb/business — business pages.
// GET: list all (public). POST: create your business page (business accounts only).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import {
  ensureBusinessTables,
  listBusinesses,
  getMyBusiness,
} from "@/lib/fish/business";
import { query } from "@/lib/fish/db";

export async function GET() {
  const items = await listBusinesses();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureBusinessTables();
  const accountType = (me as { account_type?: string }).account_type ?? "personal";
  if (accountType !== "business") {
    return forbidden("Only business accounts can create a business page.");
  }
  const existing = await getMyBusiness(me.id);
  if (existing) return badRequest("You already have a business page.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return badRequest("Business name is required.");
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const contact =
    typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  if (!contact) return badRequest("Add a way for customers to reach you.");
  const website =
    typeof body.website === "string" && body.website.trim()
      ? body.website.trim().slice(0, 300)
      : null;
  if (website && !/^https?:\/\//i.test(website)) return badRequest("Website must be a URL.");
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim().slice(0, 120)
      : null;
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((p): p is string => typeof p === "string" && /^https?:\/\//.test(p)).slice(0, 8)
    : [];

  const rows = await query(
    `INSERT INTO fm_businesses (owner_user_id, name, description, photos, contact, website, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [me.id, name, description, JSON.stringify(photos), contact, website, location]
  );
  return NextResponse.json({ business: rows[0] }, { status: 201 });
}
