// TEMPORARY: lists account emails for the site owner. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await query<{ name: string; email: string | null; created_at: string }>(
    `SELECT name, email, created_at::text AS created_at
     FROM fm_users WHERE google_sub NOT LIKE 'anon:%'
     ORDER BY created_at ASC`
  );
  return NextResponse.json({ accounts: rows });
}
