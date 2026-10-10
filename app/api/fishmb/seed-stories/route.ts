// TEMPORARY: moves FishMB marketing stories to FishMB account. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureStoryTables } from "@/lib/fish/feed";

export async function POST(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureStoryTables();

  // Find or create the FishMB official account.
  let fishmb = await query<{ id: string; name: string }>(
    `SELECT id, name FROM fm_users WHERE name ILIKE 'fishmb' LIMIT 1`
  );
  let fishmbId: string;
  if (fishmb.length === 0) {
    const rows = await query<{ id: string }>(
      `INSERT INTO fm_users (name, email) VALUES ('FishMB', 'fishmb@fishmb.ca') RETURNING id`
    );
    fishmbId = rows[0].id;
  } else {
    fishmbId = fishmb[0].id;
  }

  // Move the 5 marketing stories to the FishMB account.
  const result = await query<{ id: string }>(
    `UPDATE fm_stories SET user_id = $1
     WHERE media_url LIKE '%/fishmb/stories/fishmb-story-%'
     RETURNING id`,
    [fishmbId]
  );

  return NextResponse.json({ ok: true, fishmbId, moved: result.map((r) => r.id) });
}
