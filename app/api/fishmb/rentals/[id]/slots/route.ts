// /api/fishmb/rentals/[id]/slots
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — public availability in a range.
// POST { dates: [...], open: boolean } — owner marks days available/closed.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
} from "@/lib/fish/auth";
import {
  ensureRentalsTables,
  getRental,
  getSlots,
  setSlots,
  todayPlus,
} from "@/lib/fish/rentals";

/** Strict YYYY-MM-DD real-calendar-date check. */
export function validDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || todayPlus(0);
  const to = searchParams.get("to") || todayPlus(90);
  if (!validDate(from) || !validDate(to) || from > to) {
    return badRequest("from/to must be valid YYYY-MM-DD dates.");
  }
  const slots = await getSlots(id, from, to);
  return NextResponse.json({ slots });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRentalsTables();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const rental = await getRental(id);
  if (!rental) return notFound("Rental not found.");
  if (rental.owner_user_id !== me.id) {
    return forbidden("Only the owner can change availability.");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const dates = body.dates;
  if (!Array.isArray(dates) || dates.length === 0) {
    return badRequest("dates must be a non-empty array of YYYY-MM-DD dates.");
  }
  if (dates.length > 200) return badRequest("At most 200 dates per request.");
  for (const d of dates) {
    if (!validDate(d)) return badRequest(`'${d}' is not a valid date.`);
  }
  const open = body.open === true;
  // De-dupe + sort so the returned window is stable.
  const uniq = (dates as string[])
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort();
  await setSlots(id, me.id, uniq, open);
  const slots = await getSlots(id, uniq[0], uniq[uniq.length - 1]);
  return NextResponse.json({ slots });
}
