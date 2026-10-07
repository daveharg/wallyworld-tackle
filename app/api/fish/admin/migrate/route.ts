// TEMPORARY one-time migration endpoint. Runs 003.sql (feed: kind/photo/comments).
// Removed after first successful run. Requires the one-time token.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";

const ONE_TIME_TOKEN = "281a73bce2b16fdc3f021f5191f2f4e0c464fcc483bc90d716248dd93e3baad0";

const STATEMENTS = [
  "ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'post'",
  "ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS photo_url text",
  `CREATE TABLE IF NOT EXISTS fm_comments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     uuid        NOT NULL REFERENCES fm_discussions(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    body        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS fm_comments_post_idx ON fm_comments(post_id, created_at)",
  "CREATE INDEX IF NOT EXISTS fm_comments_user_idx ON fm_comments(user_id)",
];

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  for (const s of STATEMENTS) await query(s);
  return NextResponse.json({ ok: true, migrated: "003 feed kind/photo/comments" });
}
