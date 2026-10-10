// /api/fish/catches/[id] — update or delete your own catch.
// PATCH → update visibility / personal_record (owner only).
// DELETE → delete your own catch (owner only).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

const VISIBILITIES = ["public", "friends", "private"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (body.visibility !== undefined) {
    const v = body.visibility as string;
    if (!VISIBILITIES.includes(v as (typeof VISIBILITIES)[number])) {
      return badRequest("visibility must be public, friends or private.");
    }
    sets.push(`visibility = $${i++}`);
    vals.push(v);
  }
  if (body.personal_record !== undefined) {
    sets.push(`personal_record = $${i++}`);
    vals.push(body.personal_record === true);
  }
  if (sets.length === 0) {
    return badRequest("Nothing to update.");
  }

  vals.push(id, me.id);
  const rows = await query(
    `UPDATE fm_catches SET ${sets.join(", ")}
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING id`,
    vals
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Catch not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;

  const rows = await query(
    `DELETE FROM fm_catches WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, me.id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Catch not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
