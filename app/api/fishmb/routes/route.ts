// /api/fishmb/routes — saved GPS route recordings.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

async function ensureRoutesTable() {
  await query(`CREATE TABLE IF NOT EXISTS fm_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    name text NOT NULL,
    points jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureRoutesTable();
  const routes = await query(
    `SELECT id, name, points, created_at FROM fm_routes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [me.id]
  );
  return NextResponse.json({ routes });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const points = Array.isArray(body.points) ? body.points : [];
  if (!name) return badRequest("Route name is required.");
  if (points.length < 2) return badRequest("Route needs at least 2 points.");
  await ensureRoutesTable();
  const created = await query(
    `INSERT INTO fm_routes (user_id, name, points) VALUES ($1, $2, $3) RETURNING id, name, created_at`,
    [me.id, name, JSON.stringify(points.slice(0, 5000))]
  );
  return NextResponse.json({ route: created[0] }, { status: 201 });
}
