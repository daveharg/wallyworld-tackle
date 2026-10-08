// FishMB classifieds: guide services + ice shack rentals posted by the community.
// Anyone logged in can list; listings show contact info so deals happen off-site.

import { query, queryOne } from "./db";

export type ClassifiedCategory = "guide" | "shack";

export interface Classified {
  id: string;
  category: ClassifiedCategory;
  title: string;
  body: string;
  price_text: string | null;
  contact: string;
  location: string | null;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  created_at: string;
}

let ensured = false;

export async function ensureClassifiedsTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_classifieds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('guide', 'shack')),
    title text NOT NULL,
    body text NOT NULL,
    price_text text,
    contact text NOT NULL,
    location text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_classifieds_category_idx ON fm_classifieds(category, created_at DESC)`
  );
  ensured = true;
}

export async function listClassifieds(
  category: ClassifiedCategory,
  limit = 50
): Promise<Classified[]> {
  await ensureClassifiedsTable();
  return query<Classified>(
    `SELECT c.id, c.category, c.title, c.body, c.price_text, c.contact, c.location,
            c.user_id, u.name AS user_name, u.avatar_url, c.created_at
       FROM fm_classifieds c
       JOIN fm_users u ON u.id = c.user_id
      WHERE c.category = $1
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [category, limit]
  );
}

export async function createClassified(
  userId: string,
  input: {
    category: ClassifiedCategory;
    title: string;
    body: string;
    price_text: string | null;
    contact: string;
    location: string | null;
  }
): Promise<Classified> {
  await ensureClassifiedsTable();
  const rows = await query<Classified>(
    `INSERT INTO fm_classifieds (user_id, category, title, body, price_text, contact, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, category, title, body, price_text, contact, location, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       created_at`,
    [userId, input.category, input.title, input.body, input.price_text, input.contact, input.location]
  );
  return rows[0];
}

export async function deleteClassified(id: string, userId: string): Promise<boolean> {
  await ensureClassifiedsTable();
  const rows = await query(
    `DELETE FROM fm_classifieds WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}
