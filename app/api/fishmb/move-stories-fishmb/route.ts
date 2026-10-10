// TEMPORARY: moves the 5 FishMB marketing stories from Dave's account
// to the FishMB brand account. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureStoryTables, ensureFollowTables } from "@/lib/fish/feed";

export async function POST(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureStoryTables();
  await ensureFollowTables();

  // Find the FishMB brand account.
  const fishmb = await query<{ id: string; name: string }>(
    `SELECT id, name FROM fm_users WHERE name ILIKE '%fishmb%' ORDER BY created_at ASC LIMIT 1`
  );
  if (fishmb.length === 0) {
    return NextResponse.json({ error: "FishMB account not found." }, { status: 404 });
  }
  const fishmbId = fishmb[0].id;

  // Find Dave's account.
  const dave = await query<{ id: string; name: string }>(
    `SELECT id, name FROM fm_users WHERE name ILIKE '%dave%' OR name ILIKE '%DB H%' ORDER BY created_at ASC LIMIT 1`
  );
  if (dave.length === 0) {
    return NextResponse.json({ error: "Dave's account not found." }, { status: 404 });
  }
  const daveId = dave[0].id;

  // Move the 5 marketing stories to the FishMB account.
  const moved = await query<{ id: string }>(
    `UPDATE fm_stories SET user_id = $1
     WHERE user_id = $2 AND media_url LIKE '%/fishmb/stories/fishmb-story-%'
     RETURNING id`,
    [fishmbId, daveId]
  );

  // Dave follows the FishMB account so he sees its stories.
  await query(
    `INSERT INTO fm_follows (follower_id, followee_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [daveId, fishmbId]
  );

  return NextResponse.json({
    ok: true,
    fishmb_account: fishmb[0].name,
    moved: moved.map((r) => r.id),
  });
}
