// /api/fishmb/admin/traditional — site-owner review of traditional
// tournament suggestions. Gated by ADMIN_EMAILS env.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
} from "@/lib/fish/auth";
import {
  ensureTraditionalTables,
  listSuggestions,
} from "@/lib/fish/traditional";
import { isAdminEmail } from "@/lib/fish/business";
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
  await ensureTraditionalTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  return NextResponse.json({ suggestions: await listSuggestions(status) });
}

export async function PATCH(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    admin(me);
  } catch {
    return forbidden("Admin only.");
  }
  await ensureTraditionalTables();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  const status =
    body.status === "approved" || body.status === "rejected" ? body.status : null;
  if (!id || !status) return badRequest("id and status (approved|rejected) required.");
  await query(`UPDATE fm_traditional_suggestions SET status = $1 WHERE id = $2`, [
    status,
    id,
  ]);
  return NextResponse.json({ ok: true });
}
