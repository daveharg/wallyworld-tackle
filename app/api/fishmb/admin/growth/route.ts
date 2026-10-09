// GET /api/fishmb/admin/growth — signups, posts, and catches per day for the
// last 30 days, plus totals. Admin only.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  ensureProfileColumns,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  await ensureProfileColumns();

  const days = await query<{ day: string; signups: string; posts: string; catches: string }>(
    `WITH days AS (
       SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day')::date AS day
     )
     SELECT d.day::text AS day,
            (SELECT COUNT(*) FROM fm_users u WHERE u.created_at::date = d.day)::text AS signups,
            (SELECT COUNT(*) FROM fm_discussions p WHERE p.created_at::date = d.day)::text AS posts,
            (SELECT COUNT(*) FROM fm_catches c WHERE c.created_at::date = d.day)::text AS catches
       FROM days d
      ORDER BY d.day ASC`
  );

  const totals = await query<{ users: string; posts: string; catches: string; tournaments: string }>(
    `SELECT (SELECT COUNT(*) FROM fm_users)::text AS users,
            (SELECT COUNT(*) FROM fm_discussions)::text AS posts,
            (SELECT COUNT(*) FROM fm_catches)::text AS catches,
            (SELECT COUNT(*) FROM fm_tournaments)::text AS tournaments`
  );

  return NextResponse.json({
    days: days.map((r) => ({
      day: r.day,
      signups: Number(r.signups),
      posts: Number(r.posts),
      catches: Number(r.catches),
    })),
    totals: {
      users: Number(totals[0]?.users ?? 0),
      posts: Number(totals[0]?.posts ?? 0),
      catches: Number(totals[0]?.catches ?? 0),
      tournaments: Number(totals[0]?.tournaments ?? 0),
    },
  });
}
