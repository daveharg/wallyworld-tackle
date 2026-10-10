// TEMPORARY: re-posts the 5 FishMB marketing stories to Dave's account
// with 7-day expiry so they stay visible for the week. Remove after use.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureStoryTables } from "@/lib/fish/feed";

const STORIES = [
  {
    file: "fishmb-story-1.webp",
    caption: "Big walleye energy 🎣 Log your catches on FishMB!",
  },
  {
    file: "fishmb-story-2.webp",
    caption: "Manitoba mornings hit different. Find your lake on FishMB 🗺️",
  },
  {
    file: "fishmb-story-3.webp",
    caption: "Dial in your tackle. What's your go-to walleye setup?",
  },
  {
    file: "fishmb-story-4.webp",
    caption: "Ice season is coming ❄️ Are you ready?",
  },
  {
    file: "fishmb-story-5.webp",
    caption: "Good friends, big pike. Share your catches on FishMB!",
  },
];

export async function POST(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureStoryTables();

  // Dave's account.
  const users = await query<{ id: string; name: string }>(
    `SELECT id, name FROM fm_users WHERE name ILIKE '%dave%' OR name ILIKE '%DB H%' ORDER BY created_at ASC LIMIT 1`
  );
  if (users.length === 0) {
    return NextResponse.json({ error: "Dave's account not found." }, { status: 404 });
  }
  const userId = users[0].id;

  // Remove any existing copies of these stories for this user (avoid dupes).
  await query(
    `DELETE FROM fm_stories WHERE user_id = $1 AND media_url LIKE '%/fishmb/stories/fishmb-story-%'`,
    [userId]
  );

  const created: string[] = [];
  for (const s of STORIES) {
    const url = `https://www.fishmb.ca/fishmb/stories/${s.file}`;
    const rows = await query<{ id: string }>(
      `INSERT INTO fm_stories (user_id, media_url, media_type, caption, is_public, expires_at)
       VALUES ($1, $2, 'photo', $3, true, NOW() + INTERVAL '7 days') RETURNING id`,
      [userId, url, s.caption]
    );
    created.push(rows[0].id);
  }

  return NextResponse.json({ ok: true, user: users[0].name, created });
}
