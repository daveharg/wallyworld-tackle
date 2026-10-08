// FishMB businesses: business accounts, business pages, claim verification,
// and paid advertisements (feed + homepage banner slots).

import { query, queryOne } from "./db";

export type AccountType = "personal" | "business";

let ensured = false;

export async function ensureBusinessTables(): Promise<void> {
  if (ensured) return;
  await query(
    `ALTER TABLE fm_users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal'`
  );
  await query(`CREATE TABLE IF NOT EXISTS fm_businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL UNIQUE REFERENCES fm_users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    photos jsonb NOT NULL DEFAULT '[]',
    contact text NOT NULL DEFAULT '',
    website text,
    location text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Business-card proof claims: "this listing is mine".
  await query(`CREATE TABLE IF NOT EXISTS fm_business_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    business_name text NOT NULL,
    card_photo_url text NOT NULL,
    message text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Paid advertisements.
  await query(`CREATE TABLE IF NOT EXISTS fm_ads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    business_id uuid REFERENCES fm_businesses(id) ON DELETE SET NULL,
    slot text NOT NULL CHECK (slot IN ('feed', 'homepage_banner')),
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    image_url text,
    video_url text,
    link_url text,
    price_cents int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_ads_slot_status_idx ON fm_ads(slot, status)`
  );
  ensured = true;
}

/** Admin = site owner. Gated by ADMIN_EMAILS env (comma-separated). */
export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export interface Business {
  id: string;
  owner_user_id: string;
  name: string;
  description: string;
  photos: string[];
  contact: string;
  website: string | null;
  location: string | null;
  created_at: string;
  owner_name?: string;
}

export async function getBusiness(id: string): Promise<Business | null> {
  await ensureBusinessTables();
  return queryOne<Business>(
    `SELECT b.*, u.name AS owner_name FROM fm_businesses b
     JOIN fm_users u ON u.id = b.owner_user_id WHERE b.id = $1`,
    [id]
  );
}

export async function listBusinesses(limit = 50): Promise<Business[]> {
  await ensureBusinessTables();
  return query<Business>(
    `SELECT b.*, u.name AS owner_name FROM fm_businesses b
     JOIN fm_users u ON u.id = b.owner_user_id
     ORDER BY b.created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getMyBusiness(userId: string): Promise<Business | null> {
  await ensureBusinessTables();
  return queryOne<Business>(`SELECT * FROM fm_businesses WHERE owner_user_id = $1`, [userId]);
}

export interface Ad {
  id: string;
  user_id: string;
  business_id: string | null;
  business_name: string | null;
  slot: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  price_cents: number;
  status: string;
  created_at: string;
}

/** Proposed ad pricing (Dave to confirm): 7-day runs. */
export const AD_PRICES: Record<string, { label: string; price_cents: number }> = {
  feed: { label: "Feed ad — 7 days", price_cents: 2500 },
  homepage_banner: { label: "Homepage banner — 7 days", price_cents: 7500 },
};

export async function getActiveAds(slot: "feed" | "homepage_banner", limit = 10): Promise<Ad[]> {
  await ensureBusinessTables();
  return query<Ad>(
    `SELECT a.*, b.name AS business_name FROM fm_ads a
     LEFT JOIN fm_businesses b ON b.id = a.business_id
     WHERE a.slot = $1 AND a.status = 'active'
       AND (a.starts_at IS NULL OR a.starts_at <= now())
       AND (a.ends_at IS NULL OR a.ends_at > now())
     ORDER BY a.created_at DESC LIMIT $2`,
    [slot, limit]
  );
}
