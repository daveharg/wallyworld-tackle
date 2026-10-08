// GET /api/fishmb/leaderboards — species leaderboards.
//
// Query params:
//   species: lowercase species key, or "all" (default)
//   category: best | biggest | most | masters | above (default best)
//   min_length: inches threshold for the "above" category (default 20)

import { NextResponse } from "next/server";
import {
  getLeaderboard,
  getLeaderboardSpecies,
  LEADERBOARD_CATEGORIES,
  type LeaderboardCategory,
} from "@/lib/fish/leaderboards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const species = (searchParams.get("species") ?? "all").trim() || "all";
  const rawCat = (searchParams.get("category") ?? "best").trim();
  const category: LeaderboardCategory = (
    LEADERBOARD_CATEGORIES as string[]
  ).includes(rawCat)
    ? (rawCat as LeaderboardCategory)
    : "best";
  const minLength = Math.min(
    Math.max(Number(searchParams.get("min_length")) || 20, 0),
    120
  );

  const [rows, speciesTabs] = await Promise.all([
    getLeaderboard({ species, category, minLength }),
    getLeaderboardSpecies(),
  ]);
  return NextResponse.json({ rows, species: speciesTabs, category, minLength });
}
