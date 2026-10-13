// POST /api/fishmb/reports — report a post, comment, story, catch, or user.
// Reports land in fm_reports for the admin moderation queue.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  suspendedCheck,
} from "@/lib/fish/auth";
import {
  createReport,
  type ReportTargetType,
} from "@/lib/fish/moderation";

const TYPES: readonly string[] = ["post", "comment", "user", "story", "catch"];

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const sus = suspendedCheck(me);
  if (sus) return sus;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const type = String(body.target_type ?? "");
  const targetId = String(body.target_id ?? "");
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!TYPES.includes(type)) return badRequest("target_type is invalid.");
  if (!targetId) return badRequest("target_id required.");
  if (type === "user" && targetId === me.id)
    return badRequest("You can't report yourself.");
  const { targetUserId } = await createReport(
    me.id,
    type as ReportTargetType,
    targetId,
    reason
  );
  return NextResponse.json({ ok: true, target_user_id: targetUserId }, { status: 201 });
}
