// TEMPORARY: counts real vs anonymous accounts. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rows = await query<{ kind: string; count: string }>(
    `SELECT CASE WHEN google_sub LIKE 'anon:%' THEN 'anonymous' ELSE 'real' END AS kind,
            COUNT(*) AS count
     FROM fm_users GROUP BY 1`
  );
  return NextResponse.json({ counts: rows });
}
