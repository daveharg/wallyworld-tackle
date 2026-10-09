// FishMB classifieds — Kijiji-style buy & sell for the community.
// Anyone logged in can list whatever fishing-related gear or service they want.
// Deals happen off-site via FishMB messages; FishMB takes no cut.

import { query } from "./db";

export const CLASSIFIED_CATEGORIES = [
  { key: "tackle", emoji: "🪝", label: "Tackle" },
  { key: "rods-reels", emoji: "🎣", label: "Rods & Reels" },
  { key: "boats-motors", emoji: "🚤", label: "Boats & Motors" },
  { key: "ice-fishing", emoji: "🧊", label: "Ice Fishing" },
  { key: "electronics", emoji: "📡", label: "Electronics" },
  { key: "services", emoji: "🛠️", label: "Services" },
  { key: "other", emoji: "📦", label: "Other" },
] as const;

export type ClassifiedCategoryKey = (typeof CLASSIFIED_CATEGORIES)[number]["key"];

export function classifiedCategoryMeta(key: string) {
  return (
    CLASSIFIED_CATEGORIES.find((c) => c.key === key) ??
    CLASSIFIED_CATEGORIES[CLASSIFIED_CATEGORIES.length - 1]
  );
}

export function isClassifiedCategoryKey(key: string): key is ClassifiedCategoryKey {
  return CLASSIFIED_CATEGORIES.some((c) => c.key === key);
}

export interface Classified {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  category: string;
  title: string;
  description: string;
  /** Price in cents; null = "Contact" (no fixed price). */
  price_cents: number | null;
  photos: string[];
  location: string | null;
  status: "active" | "sold";
  created_at: string;
}

let ensured = false;

export async function ensureClassifieds(): Promise<void> {
  if (ensured) return;
  // One-time move: the old guide/shack classifieds owned this table name.
  // Move it aside first so CREATE TABLE below builds the new schema.
  const cols = await query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'fm_classifieds'`
  ).catch(() => [] as { c: string }[]);
  if (cols.some((r) => r.c === "contact")) {
    await query(`ALTER TABLE fm_classifieds RENAME TO fm_guide_classifieds`);
  }
  await query(`CREATE TABLE IF NOT EXISTS fm_classifieds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    category text NOT NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    price_cents int,
    photos jsonb NOT NULL DEFAULT '[]'::jsonb,
    location text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_classifieds_cat_status_idx ON fm_classifieds(category, status, created_at DESC)`
  );
  ensured = true;
}

function rowToClassified(row: Record<string, unknown>): Classified {
  const photos = Array.isArray(row.photos)
    ? (row.photos as unknown[]).filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    user_name: (row.user_name as string) ?? "Angler",
    avatar_url: (row.avatar_url as string | null) ?? null,
    category: row.category as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    price_cents: row.price_cents as number | null,
    photos,
    location: (row.location as string | null) ?? null,
    status: (row.status as "active" | "sold") ?? "active",
    created_at: row.created_at as string,
  };
}

const SELECT_COLS = `c.id, c.user_id, u.name AS user_name, u.avatar_url, c.category,
  c.title, c.description, c.price_cents, c.photos, c.location, c.status, c.created_at`;

export async function listClassifieds(opts: {
  category?: string;
  q?: string;
  userId?: string;
  includeSold?: boolean;
  limit?: number;
} = {}): Promise<Classified[]> {
  await ensureClassifieds();
  const conds: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeSold) conds.push(`c.status = 'active'`);
  if (opts.category && isClassifiedCategoryKey(opts.category)) {
    params.push(opts.category);
    conds.push(`c.category = $${params.length}`);
  }
  if (opts.userId) {
    params.push(opts.userId);
    conds.push(`c.user_id = $${params.length}::uuid`);
  }
  if (opts.q && opts.q.trim().length >= 2) {
    params.push(`%${opts.q.trim()}%`);
    conds.push(`(c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
  }
  const limit = Math.min(Math.max(opts.limit ?? 48, 1), 100);
  const rows = await query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS}
       FROM fm_classifieds c
       JOIN fm_users u ON u.id = c.user_id
      ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
      ORDER BY c.created_at DESC
      LIMIT ${limit}`,
    params
  );
  return rows.map(rowToClassified);
}

export async function getClassified(id: string): Promise<Classified | null> {
  await ensureClassifieds();
  const rows = await query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS}
       FROM fm_classifieds c
       JOIN fm_users u ON u.id = c.user_id
      WHERE c.id = $1::uuid`,
    [id]
  );
  return rows[0] ? rowToClassified(rows[0]) : null;
}

export async function createClassified(
  userId: string,
  input: {
    category: string;
    title: string;
    description: string;
    price_cents: number | null;
    photos: string[];
    location: string | null;
  }
): Promise<Classified> {
  await ensureClassifieds();
  const category = isClassifiedCategoryKey(input.category) ? input.category : "other";
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO fm_classifieds (user_id, category, title, description, price_cents, photos, location)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, user_id,
       (SELECT name FROM fm_users WHERE id = $1::uuid) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1::uuid) AS avatar_url,
       category, title, description, price_cents, photos, location, status, created_at`,
    [
      userId,
      category,
      input.title,
      input.description,
      input.price_cents,
      JSON.stringify(input.photos.slice(0, 4)),
      input.location,
    ]
  );
  return rowToClassified(rows[0]);
}

export async function markSold(id: string, userId: string): Promise<boolean> {
  await ensureClassifieds();
  const rows = await query(
    `UPDATE fm_classifieds SET status = 'sold'
      WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'active'
      RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}

export async function deleteClassified(id: string, userId: string): Promise<boolean> {
  await ensureClassifieds();
  const rows = await query(
    `DELETE FROM fm_classifieds WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}

/** Format cents for display: $1,250 or "Contact" when null. */
export function formatPrice(price_cents: number | null): string {
  if (price_cents === null || price_cents === undefined) return "Contact";
  const dollars = price_cents / 100;
  return "$" + dollars.toLocaleString("en-CA", { maximumFractionDigits: dollars % 1 === 0 ? 0 : 2 });
}
