// TEMPORARY: seeds 5 FishMB marketing stories. Remove after use.
// POST /api/fishmb/seed-stories — creates public stories from generated promo images.
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";
import { query } from "@/lib/fish/db";
import { ensureStoryTables } from "@/lib/fish/feed";

const STORIES = [
  {
    file: "media-generation-fishmb-story-1-0-ad442bfe-7c49-4a9c-9469-0d4c628ece95.webp",
    caption: "Big walleye energy 🎣 Log your catches on FishMB!",
  },
  {
    file: "media-generation-fishmb-story-2-0-729545ec-1212-478c-b5ba-b2d91c10111f.webp",
    caption: "Manitoba mornings hit different. Find your lake on FishMB 🗺️",
  },
  {
    file: "media-generation-fishmb-story-3-0-a7e3842a-df58-498b-ad91-2edda733211c.webp",
    caption: "Dial in your tackle. What's your go-to walleye setup?",
  },
  {
    file: "media-generation-fishmb-story-4-0-45aa14f3-bbe8-4711-86c0-39b8319f1586.webp",
    caption: "Ice season is coming ❄️ Are you ready?",
  },
  {
    file: "media-generation-fishmb-story-5-0-9e6360b0-5cf6-4c04-a129-c78c5b7b2366.webp",
    caption: "Good friends, big pike. Share your catches on FishMB!",
  },
];

export async function POST(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== "fishmb-seed-2026") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureStoryTables();

  // Find Dave's user (the FishMB account owner).
  const users = await query<{ id: string; name: string }>(
    `SELECT id, name FROM fm_users WHERE name ILIKE '%dave%' OR name ILIKE '%DB H%' ORDER BY created_at ASC LIMIT 1`
  );
  if (users.length === 0) {
    return NextResponse.json({ error: "No user found." }, { status: 404 });
  }
  const userId = users[0].id;

  const created: string[] = [];
  for (const s of STORIES) {
    const filePath = join(process.cwd(), "..", "fishmb-stories", s.file);
    let buf: Buffer;
    try {
      buf = await readFile(filePath);
    } catch {
      // Try the workspace path.
      buf = await readFile(join("/home/hatch/workspace/fishmb-stories", s.file));
    }
    const blob = await put(`stories/fishmb-${Date.now()}-${s.file}`, buf, {
      access: "public",
      contentType: "image/webp",
    });
    const rows = await query<{ id: string }>(
      `INSERT INTO fm_stories (user_id, media_url, media_type, caption, is_public)
       VALUES ($1, $2, 'photo', $3, true) RETURNING id`,
      [userId, blob.url, s.caption]
    );
    created.push(rows[0].id);
  }

  return NextResponse.json({ ok: true, user: users[0].name, created });
}
