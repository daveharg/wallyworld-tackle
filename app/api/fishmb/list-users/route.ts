// TEMPORARY: lists users to find FishMB account. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const users = await query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM fm_users ORDER BY created_at ASC LIMIT 50`
  );
  return NextResponse.json({ users: users.map((u) => ({ id: u.id, name: u.name })) });
}
