// POST /api/fish/auth/google/code — exchange OAuth authorization code for session.
// Body: { code: string, code_verifier: string, redirect_uri: string }
// Uses PKCE + client_secret on the server to get tokens from Google,
// then creates a FishMB session (same as the id_token flow).

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.FISHMB_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export async function POST(req: NextRequest) {
  let body: { code?: unknown; code_verifier?: unknown; redirect_uri?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const verifier = typeof body.code_verifier === "string" ? body.code_verifier : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  if (!code || !verifier || !redirectUri) {
    return NextResponse.json({ error: "code, code_verifier and redirect_uri are required." }, { status: 400 });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google OAuth not configured." }, { status: 500 });
  }

  // Exchange the code for tokens.
  let tokens: { id_token?: string; error?: string; error_description?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });
    tokens = await tokenRes.json();
  } catch {
    return NextResponse.json({ error: "Could not reach Google." }, { status: 502 });
  }
  if (!tokens.id_token) {
    return NextResponse.json(
      { error: tokens.error_description || tokens.error || "Google sign-in failed." },
      { status: 401 }
    );
  }

  // Forward to the existing id_token handler by returning the id_token.
  // The frontend will then POST it to /api/fish/auth/google.
  return NextResponse.json({ id_token: tokens.id_token });
}
