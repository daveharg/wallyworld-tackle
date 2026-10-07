// GET /api/fish/users/me/stats — your own lifetime stats (auth required).
// Includes ALL your catches regardless of visibility.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { buildStats } from "@/lib/fish/stats";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const stats = await buildStats(me.id);
  return NextResponse.json({ user_id: me.id, ...stats });
}
