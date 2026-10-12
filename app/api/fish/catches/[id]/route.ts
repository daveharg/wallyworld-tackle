// /api/fish/catches/[id] — update or delete your own catch.
// PATCH → update visibility / personal_record (owner only).
// DELETE → delete your own catch (owner only).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

const VISIBILITIES = ["public", "friends", "private"] as const;

// GET /api/fish/catches/[id] — full catch details (owner, or anyone who can
// see it by visibility/friendship; tournament entries visible to participants).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  const { id } = await params;
  const rows = await query(
    `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar
     FROM fm_catches c JOIN fm_users u ON u.id = c.user_id
     WHERE c.id = $1`,
    [id]
  );
  const c = rows[0] as Record<string, unknown> | undefined;
  if (!c) return NextResponse.json({ error: "Catch not found." }, { status: 404 });

  const ownerId = c.user_id as string;
  const isOwner = !!me && me.id === ownerId;
  const vis = c.visibility as string;
  // Tournament entries: visible to tournament participants + organizer.
  let canSee = isOwner || vis === "public";
  if (!canSee && me) {
    if (vis === "friends") {
      const fr = await query(
        `SELECT 1 FROM fm_friends WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted' LIMIT 1`,
        [me.id, ownerId]
      );
      canSee = fr.length > 0;
    }
    if (!canSee && c.tournament_id) {
      const tp = await query(
        `SELECT 1 FROM fm_tournament_participants WHERE tournament_id = $1 AND user_id = $2 LIMIT 1`,
        [c.tournament_id, me.id]
      );
      canSee = tp.length > 0;
    }
  }
  if (!canSee) return NextResponse.json({ error: "Catch not found." }, { status: 404 });
  return NextResponse.json({ catch: c });
}

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

  try {
    await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS depth_ft numeric(6,1)`);
  } catch {}
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
  if (body.depth_ft !== undefined) {
    if (body.depth_ft !== null) {
      const d = Number(body.depth_ft);
      if (!Number.isFinite(d) || d <= 0 || d > 1000) {
        return badRequest("depth_ft must be a positive number of feet, or null.");
      }
      sets.push(`depth_ft = $${i++}`);
      vals.push(Math.round(d * 10) / 10);
    } else {
      sets.push(`depth_ft = $${i++}`);
      vals.push(null);
    }
  }
  if (body.note !== undefined) {
    if (typeof body.note !== "string" && body.note !== null) {
      return badRequest("note must be a string or null.");
    }
    sets.push(`note = $${i++}`);
    vals.push(body.note === null ? null : body.note.trim().slice(0, 500) || null);
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) {
      return badRequest("photos must be an array of URLs.");
    }
    const photos = body.photos
      .filter(
        (u): u is string =>
          typeof u === "string" && /^https?:\/\//.test(u) && u.length <= 2048
      )
      .slice(0, 4);
    sets.push(`photos = $${i++}::jsonb`);
    vals.push(JSON.stringify(photos));
    // The legacy single-photo columns mirror the first photo — they carry
    // the verified signal, so an emptied photo set un-verifies the catch.
    sets.push(`photo_hold_url = $${i++}`);
    vals.push(photos[0] ?? null);
    sets.push(`photo_measure_url = $${i++}`);
    vals.push(photos[0] ?? null);
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
