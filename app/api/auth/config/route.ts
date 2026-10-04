import { NextResponse } from "next/server";
import { GOOGLE_ENABLED } from "../../../../lib/auth";

// Lets the sign-in modal show/hide the Google button without leaking secrets.
export async function GET() {
  return NextResponse.json({ googleEnabled: GOOGLE_ENABLED });
}
