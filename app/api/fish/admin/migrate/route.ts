// TEMPORARY one-time migration endpoint. Runs 002.sql (fm_discussions).
// Removed after first successful run. Requires the one-time token.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";

const ONE_TIME_TOKEN = "151d5b340e75ffad23ec317e7f7cc67017dbeeb42ba87cf0cd2cce0058156f09";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS fm_discussions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    body        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS fm_discussions_user_idx ON fm_discussions(user_id)",
  "CREATE INDEX IF NOT EXISTS fm_discussions_created_idx ON fm_discussions(created_at DESC)",
];

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  for (const s of STATEMENTS) await query(s);
  return NextResponse.json({ ok: true, migrated: "002 fm_discussions" });
}
