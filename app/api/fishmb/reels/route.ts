// GET /api/fishmb/reels?user_id= — reels for a user (permanent stories).
import { NextRequest, NextResponse } from "next/server";
import { getReels } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required." }, { status: 400 });
  const reels = await getReels(userId);
  return NextResponse.json({ reels });
}
