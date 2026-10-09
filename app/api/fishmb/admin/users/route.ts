// GET /api/fishmb/admin/users — list all users with activity stats. Admin only.
// PATCH /api/fishmb/admin/users — { user_id, suspended, reason } suspend/unsuspend. Admin only.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  badRequest,
  ensureProfileColumns,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";

async function requireAdmin(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return { error: unauthorized() };
  if (!isAdminEmail(me.email)) return { error: forbidden("Admin only.") };
  await ensureProfileColumns();
  return { me };
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;

  const users = await query<{
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
    suspended: boolean;
    suspended_reason: string;
    post_count: string;
    catch_count: string;
  }>(
    `SELECT u.id, u.name, u.email, u.avatar_url, u.created_at,
            COALESCE(u.suspended, false) AS suspended,
            COALESCE(u.suspended_reason, '') AS suspended_reason,
            (SELECT COUNT(*) FROM fm_discussions d WHERE d.user_id = u.id)::text AS post_count,
            (SELECT COUNT(*) FROM fm_catches c WHERE c.user_id = u.id)::text AS catch_count
       FROM fm_users u
      ORDER BY u.created_at DESC
      LIMIT 500`
  );
  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON.");
  }
  const userId = String(body.user_id ?? "");
  if (!userId) return badRequest("user_id required.");
  if (typeof body.suspended !== "boolean") return badRequest("suspended must be boolean.");

  // Never suspend yourself.
  if (userId === check.me!.id) return badRequest("You can't suspend your own account.");

  const reason = String(body.reason ?? "").slice(0, 300);
  await query(
    `UPDATE fm_users
        SET suspended = $2,
            suspended_at = CASE WHEN $2 THEN now() ELSE NULL END,
            suspended_reason = CASE WHEN $2 THEN $3 ELSE '' END
      WHERE id = $1`,
    [userId, body.suspended, reason]
  );
  return NextResponse.json({ ok: true });
}
