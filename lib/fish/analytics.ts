// FishMB first-party visit analytics — page views + visit duration,
// counted by our own beacon (no third-party trackers). Powers the
// admin dashboard's Visits tab: how many visits, how long they stay,
// and which pages get the traffic.

import { query, queryOne } from "./db";

let ensured = false;
export async function ensureAnalyticsTables(): Promise<void> {
  if (ensured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS fm_visit_sessions (
       session_id  text PRIMARY KEY,
       user_id     uuid REFERENCES fm_users(id) ON DELETE SET NULL,
       started_at  timestamptz NOT NULL DEFAULT now(),
       last_seen_at timestamptz NOT NULL DEFAULT now(),
       page_views  integer NOT NULL DEFAULT 1,
       landing_path text NOT NULL DEFAULT ''
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_visit_sessions_started_idx ON fm_visit_sessions (started_at DESC)`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS fm_page_views (
       id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       session_id text NOT NULL,
       path       text NOT NULL,
       viewed_at  timestamptz NOT NULL DEFAULT now()
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_page_views_viewed_idx ON fm_page_views (viewed_at DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_page_views_path_idx ON fm_page_views (path, viewed_at DESC)`
  );
  ensured = true;
}

export type VisitEvent = "start" | "ping" | "end";

/** Record one beacon hit. Heartbeats only move last_seen_at; a "start"
 *  or a ping flagged new_view also counts a page view. */
export async function recordVisit(
  sessionId: string,
  userId: string | null,
  event: VisitEvent,
  path: string,
  newView: boolean
): Promise<void> {
  await ensureAnalyticsTables();
  if (event === "start") {
    await query(
      `INSERT INTO fm_visit_sessions (session_id, user_id, landing_path)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE
         SET last_seen_at = now(),
             user_id = COALESCE(EXCLUDED.user_id, fm_visit_sessions.user_id)`,
      [sessionId, userId, path]
    );
    await query(`INSERT INTO fm_page_views (session_id, path) VALUES ($1, $2)`, [
      sessionId,
      path,
    ]);
    return;
  }
  const bump = event === "ping" && newView;
  await query(
    `UPDATE fm_visit_sessions
        SET last_seen_at = now(),
            page_views = page_views + ${bump ? 1 : 0}
      WHERE session_id = $1`,
    [sessionId]
  );
  if (bump) {
    await query(
      `INSERT INTO fm_page_views (session_id, path)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM fm_visit_sessions WHERE session_id = $1)`,
      [sessionId, path]
    );
  }
}

export interface VisitWindow {
  sessions: number;
  page_views: number;
  signed_in_visitors: number;
  avg_duration_s: number;
  median_duration_s: number;
}

export interface VisitStats {
  last_24h: VisitWindow;
  last_7d: VisitWindow;
  last_30d: VisitWindow;
  daily: { day: string; sessions: number; page_views: number }[];
  top_pages_7d: { path: string; views: number }[];
}

async function windowStats(intervalSql: string): Promise<VisitWindow> {
  const row = await queryOne<{
    sessions: string;
    page_views: string;
    signed_in_visitors: string;
    avg_duration_s: string | null;
    median_duration_s: string | null;
  }>(
    `SELECT COUNT(*)::text AS sessions,
            COALESCE(SUM(page_views), 0)::text AS page_views,
            COUNT(DISTINCT user_id)::text AS signed_in_visitors,
            AVG(EXTRACT(EPOCH FROM (last_seen_at - started_at))) FILTER (WHERE last_seen_at - started_at >= INTERVAL '5 seconds')::text AS avg_duration_s,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (last_seen_at - started_at))) FILTER (WHERE last_seen_at - started_at >= INTERVAL '5 seconds')::text AS median_duration_s
       FROM fm_visit_sessions
      WHERE started_at > now() - ${intervalSql}`
  );
  return {
    sessions: Number(row?.sessions ?? 0),
    page_views: Number(row?.page_views ?? 0),
    signed_in_visitors: Number(row?.signed_in_visitors ?? 0),
    avg_duration_s: Math.round(Number(row?.avg_duration_s ?? 0)),
    median_duration_s: Math.round(Number(row?.median_duration_s ?? 0)),
  };
}

export async function getVisitStats(): Promise<VisitStats> {
  await ensureAnalyticsTables();
  const [last_24h, last_7d, last_30d, daily, top] = await Promise.all([
    windowStats(`INTERVAL '24 hours'`),
    windowStats(`INTERVAL '7 days'`),
    windowStats(`INTERVAL '30 days'`),
    query<{ day: string; sessions: string; page_views: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COUNT(s.session_id)::text AS sessions,
              COALESCE(SUM(s.page_views), 0)::text AS page_views
         FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(day)
         LEFT JOIN fm_visit_sessions s ON s.started_at::date = d.day::date
        GROUP BY d.day
        ORDER BY d.day`
    ),
    query<{ path: string; views: string }>(
      `SELECT path, COUNT(*)::text AS views
         FROM fm_page_views
        WHERE viewed_at > now() - INTERVAL '7 days'
        GROUP BY path
        ORDER BY COUNT(*) DESC
        LIMIT 12`
    ),
  ]);
  return {
    last_24h,
    last_7d,
    last_30d,
    daily: daily.map((d) => ({
      day: d.day,
      sessions: Number(d.sessions),
      page_views: Number(d.page_views),
    })),
    top_pages_7d: top.map((t) => ({ path: t.path, views: Number(t.views) })),
  };
}
