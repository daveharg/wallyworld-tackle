// /api/fish/auth/me — current Fish user profile.
// GET  → profile (auth required)
// PATCH → update name, avatar_url, stats_public (auth required)

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  toApiUser,
  ensureProfileColumns,
  type FishUser,
} from "@/lib/fish/auth";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  return NextResponse.json({ user: toApiUser(me) });
}

export async function PATCH(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureProfileColumns();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (name.length === 0) return badRequest("name cannot be empty.");
    params.push(name);
    updates.push(`name = $${params.length}`);
  }
  if (body.avatar_url === null || typeof body.avatar_url === "string") {
    const v = typeof body.avatar_url === "string" ? body.avatar_url.slice(0, 2048) : null;
    if (v !== null && !/^https?:\/\//.test(v)) return badRequest("avatar_url must be an http(s) URL.");
    params.push(v);
    updates.push(`avatar_url = $${params.length}`);
  }
  if (typeof body.stats_public === "boolean") {
    params.push(body.stats_public);
    updates.push(`stats_public = $${params.length}`);
  }
  if (typeof body.bio === "string") {
    params.push(body.bio.trim().slice(0, 500));
    updates.push(`bio = $${params.length}`);
  }
  if (body.account_type === "personal" || body.account_type === "business") {
    params.push(body.account_type);
    updates.push(`account_type = $${params.length}`);
  }
  if (updates.length === 0) return badRequest("Nothing to update.");

  params.push(me.id);
  const rows = await query<FishUser>(
    `UPDATE fm_users SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return NextResponse.json({ user: toApiUser(rows[0]) });
}
