// FishMB admin alerts — tell the site owner the moment a moderation
// report or a recommendation lands, from INSIDE the app.
//
// Why this exists: the old monitor read the admin dashboard through a
// browser signed in as Dave, so it died whenever that session expired —
// and before that it needed the database credential pulled out of the
// Vercel dashboard. None of that machinery is needed: the data lives in
// this app's own database, so the app alerts on its own.
//
// Two layers:
//  1. Instant: createReport / createRecommendation call
//     alertAdminsNewItem() right after the insert. Fire-and-forget web
//     push to every admin account (ADMIN_EMAILS), throttled to one push
//     per kind per 15 minutes so a flood can't buzz Dave's phone off
//     the table — throttled items are recorded as unpushed, not lost.
//  2. Sweep: the Vercel Cron job=monitor run (twice daily) finds open
//     reports / new recommendations older than 20 minutes that never
//     got a pushed alert (throttled above, push failed, or created
//     before this module existed) and sends ONE summary push per kind.
//     That keeps the 24-hour report-review promise covered even if an
//     instant push is missed.

import { query, queryOne } from "./db";
import { sendPushToUser } from "./push";
import { ensureModerationTables } from "./moderation";
import { ensureRecommendationsTable } from "./recommendations";

export type AdminAlertKind = "report" | "recommendation";

let ensured = false;
export async function ensureAdminAlertsTable(): Promise<void> {
  if (ensured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS fm_admin_alerts (
       id         serial PRIMARY KEY,
       kind       text NOT NULL CHECK (kind IN ('report','recommendation')),
       item_id    text NOT NULL,
       pushed     boolean NOT NULL DEFAULT false,
       created_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (kind, item_id)
     )`
  );
  ensured = true;
}

/** User ids for every account on the ADMIN_EMAILS allowlist. */
async function adminUserIds(): Promise<string[]> {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return [];
  const rows = await query<{ id: string }>(
    `SELECT id FROM fm_users WHERE lower(email) = ANY($1::text[])`,
    [list]
  );
  return rows.map((r) => r.id);
}

async function pushToAdmins(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  const ids = await adminUserIds();
  if (ids.length === 0) return;
  await Promise.allSettled(ids.map((id) => sendPushToUser(id, payload)));
}

const ADMIN_URL = "/fishmb/admin";

/**
 * Instant alert for one new report/recommendation. Fire-and-forget —
 * never awaited by the caller, never throws, never blocks the insert
 * that triggered it (same pattern as notifyFriends in push.ts).
 */
export function alertAdminsNewItem(
  kind: AdminAlertKind,
  itemId: string,
  payload: { title: string; body: string; tag?: string }
): void {
  (async () => {
    try {
      await ensureAdminAlertsTable();
      // One record per item, ever — a duplicate call is a no-op.
      const inserted = await query<{ id: number }>(
        `INSERT INTO fm_admin_alerts (kind, item_id, pushed)
         VALUES ($1, $2, false)
         ON CONFLICT (kind, item_id) DO NOTHING
         RETURNING id`,
        [kind, itemId]
      );
      if (inserted.length === 0) return;

      // Throttle: if a push for this kind went out in the last 15
      // minutes, stay quiet — the sweep summarises this item later.
      const recent = await queryOne<{ id: number }>(
        `SELECT id FROM fm_admin_alerts
          WHERE kind = $1 AND pushed = true
            AND created_at > now() - interval '15 minutes'
          ORDER BY created_at DESC LIMIT 1`,
        [kind]
      );
      if (recent) return;

      await pushToAdmins({ ...payload, url: ADMIN_URL });
      await query(
        `UPDATE fm_admin_alerts SET pushed = true WHERE kind = $1 AND item_id = $2`,
        [kind, itemId]
      );
    } catch {
      // Best-effort — an alert must never break posting a report.
    }
  })();
}

export interface AdminAlertSweepResult {
  reports_waiting: number;
  recommendations_waiting: number;
  pushed: boolean;
}

/**
 * Backstop sweep, run by Vercel Cron (job=monitor). Finds items that
 * never produced a pushed alert and are at least 20 minutes old, sends
 * one summary push per kind, and marks those items as pushed.
 */
export async function sweepAdminAlerts(): Promise<AdminAlertSweepResult> {
  await ensureAdminAlertsTable();
  await ensureModerationTables();
  await ensureRecommendationsTable();

  const stale = `interval '20 minutes'`;
  const reports = await query<{ id: string }>(
    `SELECT r.id FROM fm_reports r
      WHERE r.status = 'open'
        AND r.created_at < now() - ${stale}
        AND NOT EXISTS (
          SELECT 1 FROM fm_admin_alerts a
           WHERE a.kind = 'report' AND a.item_id = r.id::text AND a.pushed = true
        )
      ORDER BY r.created_at ASC LIMIT 200`
  );
  const recs = await query<{ id: string }>(
    `SELECT r.id FROM fm_recommendations r
      WHERE r.status = 'new'
        AND r.created_at < now() - ${stale}
        AND NOT EXISTS (
          SELECT 1 FROM fm_admin_alerts a
           WHERE a.kind = 'recommendation' AND a.item_id = r.id::text AND a.pushed = true
        )
      ORDER BY r.created_at ASC LIMIT 200`
  );

  let pushed = false;
  if (reports.length > 0) {
    await pushToAdmins({
      title: "🚩 FishMB reports waiting",
      body:
        reports.length === 1
          ? "1 report is waiting for review in Admin → Reports."
          : `${reports.length} reports are waiting for review in Admin → Reports.`,
      url: ADMIN_URL,
      tag: "fm-admin-report-sweep",
    });
    pushed = true;
  }
  if (recs.length > 0) {
    await pushToAdmins({
      title: "💡 FishMB recommendations waiting",
      body:
        recs.length === 1
          ? "1 recommendation is waiting in Admin → Recommendations."
          : `${recs.length} recommendations are waiting in Admin → Recommendations.`,
      url: ADMIN_URL,
      tag: "fm-admin-rec-sweep",
    });
    pushed = true;
  }

  for (const r of reports) {
    await query(
      `INSERT INTO fm_admin_alerts (kind, item_id, pushed) VALUES ('report', $1, true)
       ON CONFLICT (kind, item_id) DO UPDATE SET pushed = true`,
      [r.id]
    );
  }
  for (const r of recs) {
    await query(
      `INSERT INTO fm_admin_alerts (kind, item_id, pushed) VALUES ('recommendation', $1, true)
       ON CONFLICT (kind, item_id) DO UPDATE SET pushed = true`,
      [r.id]
    );
  }

  return {
    reports_waiting: reports.length,
    recommendations_waiting: recs.length,
    pushed,
  };
}
