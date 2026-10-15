// GET /api/fishmb/monitor — read-only digest of the two admin inboxes
// (open moderation reports + new recommendations) for Toby's monitor.
//
// Auth: a dedicated machine token, `Authorization: Bearer ${MONITOR_TOKEN}`
// (env var, set in Vercel only). This replaces the old browser-session
// monitor, whose Google sign-in kept breaking (expired sessions, tangled
// saved passwords). The data stays fully gated: no token, no data — the
// endpoint returns nothing without it, and the token is read-only and
// scoped to exactly these two lists. Revoke by deleting the env var.
//
// Deliberately NOT accepted here: FishMB user sessions (admin or not) and
// CRON_SECRET. One door, one key.

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureModerationTables } from "@/lib/fish/moderation";
import {
  ensureRecommendationsTable,
  listRecommendations,
} from "@/lib/fish/recommendations";

export const dynamic = "force-dynamic";

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Hash both sides so timingSafeEqual always compares equal-length
  // buffers (no length leak, no exception on mismatched lengths).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

interface MonitorReportRow {
  id: string;
  reporter_name: string | null;
  target_type: string;
  target_id: string;
  target_author_name: string | null;
  reason: string;
  status: string;
  created_at: string;
  content_preview: string | null;
}

export async function GET(req: NextRequest) {
  const token = process.env.MONITOR_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Monitor token not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const auth = req.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!tokenMatches(provided, token)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  await ensureModerationTables();
  await ensureRecommendationsTable();

  // Same shaping as GET /api/fishmb/admin/reports?status=open.
  const reports = await query<MonitorReportRow>(
    `SELECT r.id,
            (SELECT name FROM fm_users WHERE id = r.reporter_id) AS reporter_name,
            r.target_type, r.target_id,
            (SELECT name FROM fm_users WHERE id = r.target_user_id) AS target_author_name,
            r.reason, r.status, r.created_at,
            CASE r.target_type
              WHEN 'post' THEN (SELECT LEFT(body, 200) FROM fm_discussions WHERE id::text = r.target_id)
              WHEN 'comment' THEN (SELECT LEFT(body, 200) FROM fm_comments WHERE id::text = r.target_id)
              WHEN 'catch' THEN (SELECT LEFT(COALESCE(feed_caption, species), 200) FROM fm_catches WHERE id::text = r.target_id)
              ELSE NULL
            END AS content_preview
       FROM fm_reports r
      WHERE r.status = 'open'
      ORDER BY r.created_at ASC
      LIMIT 200`
  );

  const recommendations = await listRecommendations("new");

  return NextResponse.json(
    { ok: true, generated_at: new Date().toISOString(), reports, recommendations },
    { headers: { "Cache-Control": "no-store" } }
  );
}
