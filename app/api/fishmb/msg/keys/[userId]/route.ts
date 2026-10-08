// /api/fishmb/msg/keys/[userId] — another user's messaging public key.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { getPublicKey } from "@/lib/fish/messages";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { userId } = await params;
  return NextResponse.json({ public_key: await getPublicKey(userId) });
}
