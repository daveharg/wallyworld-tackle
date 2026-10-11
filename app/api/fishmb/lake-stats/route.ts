// /api/fishmb/lake-stats — per-lake aggregates for the saved-lakes rows:
// Master Angler record-book entries in the last 2 years, and total fish
// stocked in the last 20 years. Public data, no auth needed.
import { NextResponse } from "next/server";
import { getTrophyCatches, getStockingHistory, getLakes } from "@/lib/fishmb";

export const dynamic = "force-dynamic";

function trophyYear(date: string): number | null {
  const m = date.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

export async function GET() {
  const nowYear = new Date().getFullYear();
  const mastersCutoff = nowYear - 1; // last 2 calendar years
  const stockCutoff = nowYear - 19; // last 20 calendar years
  const stats: Record<string, { masters_2yr: number; stocked_20yr: number }> = {};
  for (const lake of getLakes()) {
    let masters = 0;
    for (const c of getTrophyCatches(lake.id)) {
      const y = trophyYear(c.date);
      if (y !== null && y >= mastersCutoff) masters++;
    }
    let stocked = 0;
    for (const e of getStockingHistory(lake.id)) {
      if (e.year !== null && e.year >= stockCutoff && e.quantity) stocked += e.quantity;
    }
    if (masters > 0 || stocked > 0) stats[lake.id] = { masters_2yr: masters, stocked_20yr: stocked };
  }
  return NextResponse.json({ stats });
}
