// GET /api/fishmb/leaderboards — species leaderboards.
//
// Query params:
//   species: lowercase species key, or "all" (default)
//   category: biggest | most | masters | above (default biggest)
//   min_length: inches threshold for the "above" category (default 20)

import { NextResponse } from "next/server";
import {
  getLeaderboard,
  getLeaderboardSpecies,
  LEADERBOARD_CATEGORIES,
  type LegacyLeaderboardCategory,
} from "@/lib/fish/leaderboards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const species = (searchParams.get("species") ?? "all").trim() || "all";
  const rawCat = (searchParams.get("category") ?? "biggest").trim();
  // "best" stays answerable as a legacy shim for pre-2026-10-16 app
  // builds (see lib/fish/leaderboards.ts) — it is not an offered
  // category anywhere anymore.
  const category: LegacyLeaderboardCategory = (
    [...LEADERBOARD_CATEGORIES, "best"] as string[]
  ).includes(rawCat)
    ? (rawCat as LegacyLeaderboardCategory)
    : "biggest";
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
