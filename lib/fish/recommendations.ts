// FishMB recommendations — the "give a recommendation" boxes around the
// app land here: a lake to add, a lodge to list, a feature idea, a
// correction. Read and worked from the admin dashboard's
// Recommendations tab.

import { query } from "./db";

let ensured = false;
export async function ensureRecommendationsTable(): Promise<void> {
  if (ensured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS fm_recommendations (
       id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id    uuid REFERENCES fm_users(id) ON DELETE SET NULL,
       name       text NOT NULL DEFAULT '',
       email      text,
       kind       text NOT NULL DEFAULT 'general',
       subject    text NOT NULL DEFAULT '',
       message    text NOT NULL,
       page       text,
       status     text NOT NULL DEFAULT 'new',
       created_at timestamptz NOT NULL DEFAULT now()
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_recommendations_created_idx ON fm_recommendations (created_at DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_recommendations_status_idx ON fm_recommendations (status, created_at DESC)`
  );
  ensured = true;
}

export const RECOMMENDATION_KINDS = ["general", "lake", "lodge", "guide", "feature", "correction"] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export interface Recommendation {
  id: string;
  user_id: string | null;
  user_name: string | null;
  name: string;
  email: string | null;
  kind: string;
  subject: string;
  message: string;
  page: string | null;
  status: string;
  created_at: string;
}

export async function createRecommendation(input: {
  userId: string | null;
  name: string;
  email: string | null;
  kind: string;
  subject: string;
  message: string;
  page: string | null;
}): Promise<void> {
  await ensureRecommendationsTable();
  await query(
    `INSERT INTO fm_recommendations (user_id, name, email, kind, subject, message, page)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.userId, input.name, input.email, input.kind, input.subject, input.message, input.page]
  );
}

export async function listRecommendations(status: string | null): Promise<Recommendation[]> {
  await ensureRecommendationsTable();
  return query<Recommendation>(
    `SELECT r.id, r.user_id, u.name AS user_name, r.name, r.email,
            r.kind, r.subject, r.message, r.page, r.status, r.created_at
       FROM fm_recommendations r
       LEFT JOIN fm_users u ON u.id = r.user_id
      WHERE ($1::text IS NULL OR r.status = $1)
      ORDER BY r.created_at DESC
      LIMIT 200`,
    [status]
  );
}

export async function setRecommendationStatus(id: string, status: string): Promise<boolean> {
  await ensureRecommendationsTable();
  const rows = await query<{ id: string }>(
    `UPDATE fm_recommendations SET status = $2 WHERE id = $1 RETURNING id`,
    [id, status]
  );
  return rows.length > 0;
}
