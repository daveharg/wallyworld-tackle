// GET /api/fishmb/push/vapid-key — public VAPID key for push subscription.

import { NextResponse } from "next/server";

const VAPID_PUBLIC_KEY =
  "BPQnbbCGJ6JfzAuF1N7bZ9zbN3fosbdHeVFAjlTCalWqybPwEmWzI1vmtRHaBMB4-Ta1sKVSzn0HUy1Ppm1zJ8Q";

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}
