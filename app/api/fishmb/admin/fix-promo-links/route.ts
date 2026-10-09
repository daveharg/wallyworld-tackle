// POST /api/fishmb/admin/fix-promo-links — one-time: rewrite
// wallyworldtackle.ca/fishmb/* links to fishmb.ca/fishmb/* in all feed posts.
// Admin only.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const email = (me.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return forbidden("Admin only.");

  const rows = await query<{ id: string }>(
    `UPDATE fm_discussions
        SET body = REPLACE(body, 'https://www.wallyworldtackle.ca/fishmb/', 'https://www.fishmb.ca/fishmb/')
      WHERE body LIKE '%wallyworldtackle.ca/fishmb/%'
      RETURNING id`
  );
  return NextResponse.json({ updated: rows.length, ids: rows.map((r) => r.id) });
}
