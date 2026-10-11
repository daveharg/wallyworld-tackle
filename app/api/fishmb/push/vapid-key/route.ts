// GET /api/fishmb/push/vapid-key — public VAPID key for push subscription.

import { NextResponse } from "next/server";

const VAPID_PUBLIC_KEY =
  "BPijWs62LtGHaH2ixc6fYHQNiJjzmOJ32_o4cd1R_PHLt5o33dIPvvtZk29hF-V9MA8xs-HYqAR3k7xZ7hBha0g";

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}
