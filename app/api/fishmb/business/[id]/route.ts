// /api/fishmb/business/[id] — one business page.
// GET: public. PATCH/DELETE: owner only.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden, notFound } from "@/lib/fish/auth";
import { ensureBusinessTables, getBusiness } from "@/lib/fish/business";
import { query } from "@/lib/fish/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const b = await getBusiness(params.id);
  if (!b) return notFound("Business not found.");
  return NextResponse.json({ business: b });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureBusinessTables();
  const b = await getBusiness(params.id);
  if (!b) return notFound("Business not found.");
  if (b.owner_user_id !== me.id) return forbidden("Only the owner can edit this page.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const updates: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    vals.push(v);
    updates.push(`${col} = $${vals.length}`);
  };
  if (typeof body.name === "string" && body.name.trim()) set("name", body.name.trim().slice(0, 100));
  if (typeof body.description === "string") set("description", body.description.trim().slice(0, 2000));
  if (typeof body.contact === "string" && body.contact.trim()) set("contact", body.contact.trim().slice(0, 200));
  if (typeof body.website === "string") {
    const w = body.website.trim();
    if (w && !/^https?:\/\//i.test(w)) return badRequest("Website must be a URL.");
    set("website", w ? w.slice(0, 300) : null);
  }
  if (typeof body.location === "string") {
    const l = body.location.trim();
    set("location", l ? l.slice(0, 120) : null);
  }
  if (Array.isArray(body.photos)) {
    const photos = body.photos
      .filter((p): p is string => typeof p === "string" && /^https?:\/\//.test(p))
      .slice(0, 8);
    set("photos", JSON.stringify(photos));
  }
  if (updates.length === 0) return badRequest("Nothing to update.");
  vals.push(params.id);
  const rows = await query(
    `UPDATE fm_businesses SET ${updates.join(", ")} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return NextResponse.json({ business: rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureBusinessTables();
  const b = await getBusiness(params.id);
  if (!b) return notFound("Business not found.");
  if (b.owner_user_id !== me.id) return forbidden("Only the owner can delete this page.");
  await query(`DELETE FROM fm_businesses WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
