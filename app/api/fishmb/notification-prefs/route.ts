// /api/fishmb/notification-prefs — the user's push alert settings.
// GET → { friend_catch, friend_post, new_message } (all true by default).
// PUT { friend_catch?, friend_post?, new_message? } → saves and returns prefs.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getNotificationPrefs, setNotificationPrefs } from "@/lib/fish/push";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  return NextResponse.json(await getNotificationPrefs(me.id));
}

export async function PUT(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const pick = (v: unknown) =>
    typeof v === "boolean" ? v : undefined;
  const prefs = await setNotificationPrefs(me.id, {
    friend_catch: pick(body.friend_catch),
    friend_post: pick(body.friend_post),
    new_message: pick(body.new_message),
  });
  return NextResponse.json(prefs);
}
