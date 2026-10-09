// FishMB guide classifieds: guide services + ice shack rentals posted by the community.
// (Moved aside from lib/fish/classifieds.ts when the Kijiji-style classifieds
//  section took over that name. Table: fm_guide_classifieds.)
// Anyone logged in can list; listings show contact info so deals happen off-site.

import { query, queryOne } from "./db";

export type GuideClassifiedCategory = "guide" | "shack";

export interface GuideClassified {
  id: string;
  category: GuideClassifiedCategory;
  title: string;
  body: string;
  price_text: string | null;
  contact: string;
  location: string | null;
  offers: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  created_at: string;
}

let ensured = false;

export async function ensureGuideClassifiedsTable(): Promise<void> {
  if (ensured) return;
  // One-time move: the Kijiji-style classifieds section now owns fm_classifieds.
  const oldCols = await query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'fm_classifieds'`
  ).catch(() => [] as { c: string }[]);
  if (oldCols.some((r) => r.c === "contact")) {
    await query(`ALTER TABLE fm_classifieds RENAME TO fm_guide_classifieds`);
  }
  await query(`CREATE TABLE IF NOT EXISTS fm_guide_classifieds (
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
  await query(`ALTER TABLE fm_guide_classifieds ADD COLUMN IF NOT EXISTS offers text NOT NULL DEFAULT 'fishing'`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_guide_classifieds_category_idx ON fm_guide_classifieds(category, created_at DESC)`
  );
  ensured = true;
}

export async function listGuideClassifieds(
  category: GuideClassifiedCategory,
  limit = 50
): Promise<GuideClassified[]> {
  await ensureGuideClassifiedsTable();
  return query<GuideClassified>(
    `SELECT c.id, c.category, c.title, c.body, c.price_text, c.contact, c.location, c.offers,
            c.user_id, u.name AS user_name, u.avatar_url, c.created_at
       FROM fm_guide_classifieds c
       JOIN fm_users u ON u.id = c.user_id
      WHERE c.category = $1
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [category, limit]
  );
}

export async function createGuideClassified(
  userId: string,
  input: {
    category: GuideClassifiedCategory;
    title: string;
    body: string;
    price_text: string | null;
    contact: string;
    location: string | null;
    offers?: string;
  }
): Promise<GuideClassified> {
  await ensureGuideClassifiedsTable();
  const offers =
    input.category === "guide" && ["fishing", "hunting", "both"].includes(input.offers ?? "")
      ? input.offers!
      : "fishing";
  const rows = await query<GuideClassified>(
    `INSERT INTO fm_guide_classifieds (user_id, category, title, body, price_text, contact, location, offers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, category, title, body, price_text, contact, location, offers, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       created_at`,
    [userId, input.category, input.title, input.body, input.price_text, input.contact, input.location, offers]
  );
  return rows[0];
}

export async function deleteGuideClassified(id: string, userId: string): Promise<boolean> {
  await ensureGuideClassifiedsTable();
  const rows = await query(
    `DELETE FROM fm_guide_classifieds WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}
