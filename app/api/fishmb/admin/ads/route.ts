// /api/fishmb/admin/ads — review ad submissions (site owner only).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import { ensureBusinessTables, isAdminEmail } from "@/lib/fish/business";
import { query } from "@/lib/fish/db";

function admin(me: { email: string | null }) {
  if (!isAdminEmail(me.email)) throw new Error("forbidden");
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    admin(me);
  } catch {
    return forbidden("Admin only.");
  }
  await ensureBusinessTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const rows = await query(
    `SELECT a.*, u.name AS user_name, u.email AS user_email, b.name AS business_name
     FROM fm_ads a JOIN fm_users u ON u.id = a.user_id
     LEFT JOIN fm_businesses b ON b.id = a.business_id
     WHERE a.status = $1 ORDER BY a.created_at DESC LIMIT 100`,
    [status]
  );
  return NextResponse.json({ ads: rows });
}

export async function PATCH(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    admin(me);
  } catch {
    return forbidden("Admin only.");
  }
  await ensureBusinessTables();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  const status =
    body.status === "active" ? "active" : body.status === "rejected" ? "rejected" : null;
  if (!id || !status) return badRequest("id and status (active|rejected) required.");
  // Approving starts a 7-day run immediately.
  if (status === "active") {
    await query(
      `UPDATE fm_ads SET status = 'active', starts_at = now(), ends_at = now() + INTERVAL '7 days' WHERE id = $1`,
      [id]
    );
  } else {
    await query(`UPDATE fm_ads SET status = 'rejected' WHERE id = $1`, [id]);
  }
  return NextResponse.json({ ok: true });
}
