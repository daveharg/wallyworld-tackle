// /api/fishmb/admin/claims — review business-card claims (site owner only).

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
    `SELECT c.*, u.name AS user_name, u.email AS user_email
     FROM fm_business_claims c JOIN fm_users u ON u.id = c.user_id
     WHERE c.status = $1 ORDER BY c.created_at DESC LIMIT 100`,
    [status]
  );
  return NextResponse.json({ claims: rows });
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
  const status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : null;
  if (!id || !status) return badRequest("id and status (approved|rejected) required.");
  await query(`UPDATE fm_business_claims SET status = $1 WHERE id = $2`, [status, id]);
  return NextResponse.json({ ok: true });
}
