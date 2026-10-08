// FishMB personal lake notes — the angler's own notes per lake
// (patterns, depths, what worked). Strictly per-user.

import { query, queryOne } from "./db";

export interface LakeNote {
  user_id: string;
  lake_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

let ensured = false;

export async function ensureLakeNotesTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_lake_notes (
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    lake_id text NOT NULL,
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lake_id)
  )`);
  ensured = true;
}

export async function listLakeNotes(userId: string): Promise<LakeNote[]> {
  await ensureLakeNotesTable();
  return query<LakeNote>(
    `SELECT * FROM fm_lake_notes WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
}

export async function saveLakeNote(
  userId: string,
  lakeId: string,
  notes: string
): Promise<LakeNote> {
  await ensureLakeNotesTable();
  const row = await queryOne<LakeNote>(
    `INSERT INTO fm_lake_notes (user_id, lake_id, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, lake_id) DO UPDATE SET
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING *`,
    [userId, lakeId, notes]
  );
  if (!row) throw new Error("Could not save note.");
  return row;
}

export async function deleteLakeNote(userId: string, lakeId: string): Promise<void> {
  await ensureLakeNotesTable();
  await query(`DELETE FROM fm_lake_notes WHERE user_id = $1 AND lake_id = $2`, [
    userId,
    lakeId,
  ]);
}
