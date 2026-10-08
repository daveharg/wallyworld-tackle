// FishMB traditional (non-digital) tournament suggestions.
// User-submitted derby suggestions queue for admin approval; approved rows are
// merged into public/fishmb/tournaments.json by the weekly research cron.

import { query } from "@/lib/fish/db";

export interface TraditionalSuggestion {
  id: string;
  user_id: string;
  name: string;
  dates: string;
  location: string;
  entry: string;
  description: string;
  url: string;
  status: "pending" | "approved" | "rejected" | "merged";
  created_at: string;
  user_name?: string;
}

export async function ensureTraditionalTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS fm_traditional_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      dates TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      entry TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_trad_suggestions_status ON fm_traditional_suggestions(status)`
  );
}

export async function listSuggestions(
  status: string | null
): Promise<TraditionalSuggestion[]> {
  if (status) {
    return query<TraditionalSuggestion>(
      `SELECT s.*, u.name AS user_name
         FROM fm_traditional_suggestions s
         JOIN fm_users u ON u.id = s.user_id
        WHERE s.status = $1
        ORDER BY s.created_at DESC LIMIT 100`,
      [status]
    );
  }
  return query<TraditionalSuggestion>(
    `SELECT s.*, u.name AS user_name
       FROM fm_traditional_suggestions s
       JOIN fm_users u ON u.id = s.user_id
      ORDER BY s.created_at DESC LIMIT 100`
  );
}
