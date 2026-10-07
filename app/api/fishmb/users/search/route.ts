// GET /api/fishmb/users/search?q= — find anglers to friend (auth required).
// Returns id, name, avatar_url. Never exposes emails.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });
  const users = await query<{ id: string; name: string; avatar_url: string | null }>(
    `SELECT id, name, avatar_url FROM fm_users
      WHERE id <> $1 AND name ILIKE '%' || $2 || '%'
      ORDER BY name ASC LIMIT 10`,
    [me.id, q]
  );
  return NextResponse.json({ users });
}
