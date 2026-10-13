// GET   /api/fishmb/admin/reports — the moderation queue (open first).
// PATCH /api/fishmb/admin/reports — { report_id, action } where action is
//   "remove_content" (delete the reported post/comment/story/catch),
//   "suspend_author" (suspend the reported author), or "dismiss".
// Admin only. Aim: every report actioned within 24 hours (App Store 1.2).

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  badRequest,
  ensureProfileColumns,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import { ensureModerationTables } from "@/lib/fish/moderation";

async function requireAdmin(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return { error: unauthorized() };
  if (!isAdminEmail(me.email)) return { error: forbidden("Admin only.") };
  await ensureProfileColumns();
  return { me };
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  target_author_name: string | null;
  reason: string;
  status: string;
  created_at: string;
  content_preview: string | null;
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  await ensureModerationTables();
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const reports = await query<ReportRow>(
    `SELECT r.id, r.reporter_id,
            (SELECT name FROM fm_users WHERE id = r.reporter_id) AS reporter_name,
            r.target_type, r.target_id, r.target_user_id,
            (SELECT name FROM fm_users WHERE id = r.target_user_id) AS target_author_name,
            r.reason, r.status, r.created_at,
            CASE r.target_type
              WHEN 'post' THEN (SELECT LEFT(body, 200) FROM fm_discussions WHERE id::text = r.target_id)
              WHEN 'comment' THEN (SELECT LEFT(body, 200) FROM fm_comments WHERE id::text = r.target_id)
              WHEN 'catch' THEN (SELECT LEFT(COALESCE(feed_caption, species), 200) FROM fm_catches WHERE id::text = r.target_id)
              ELSE NULL
            END AS content_preview
       FROM fm_reports r
      WHERE r.status = $1
      ORDER BY r.created_at ASC
      LIMIT 200`,
    [status]
  );
  return NextResponse.json({ reports });
}

export async function PATCH(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  await ensureModerationTables();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const reportId = String(body.report_id ?? "");
  const action = String(body.action ?? "");
  if (!reportId) return badRequest("report_id required.");
  if (!["remove_content", "suspend_author", "dismiss"].includes(action))
    return badRequest("action is invalid.");

  const report = await queryOne<{
    id: string;
    target_type: string;
    target_id: string;
    target_user_id: string | null;
    status: string;
  }>(`SELECT * FROM fm_reports WHERE id = $1`, [reportId]);
  if (!report) return badRequest("Report not found.");
  if (report.status !== "open") return badRequest("Report already handled.");

  if (action === "remove_content") {
    const table =
      report.target_type === "post"
        ? "fm_discussions"
        : report.target_type === "comment"
          ? "fm_comments"
          : report.target_type === "story"
            ? "fm_stories"
            : report.target_type === "catch"
              ? "fm_catches"
              : null;
    if (!table)
      return badRequest("A reported angler can't be 'removed' — suspend or dismiss instead.");
    await query(`DELETE FROM ${table} WHERE id::text = $1`, [report.target_id]);
  }
  if (action === "suspend_author") {
    if (!report.target_user_id) return badRequest("Report has no author to suspend.");
    if (report.target_user_id === check.me!.id)
      return badRequest("You can't suspend yourself.");
    await query(
      `UPDATE fm_users
          SET suspended = true, suspended_at = now(),
              suspended_reason = 'Suspended after a community report.'
        WHERE id = $1`,
      [report.target_user_id]
    );
  }
  await query(
    `UPDATE fm_reports SET status = $2, acted_at = now(), acted_by = $3 WHERE id = $1`,
    [reportId, action === "dismiss" ? "dismissed" : "actioned", check.me!.id]
  );
  return NextResponse.json({ ok: true });
}
