// POST /api/fish/auth/apple — exchange an Apple identity token for a Fish session.
//
// Body: { id_token: string, full_name?: string, email?: string }
//   (from Sign in with Apple on the iOS app)
// Verifies the token signature/issuer/audience/expiry against Apple's JWKS,
// upserts fm_users keyed on the Apple subject id (apple_sub), creates a
// 30-day session. New users start with 1000 play-money chips + a signup_bonus
// ledger row. The id_token is never logged.
//
// APPLE SPECIFICS vs the Google route:
// - Apple returns the user's name and email to the APP only on the first
//   consent, and the name never appears in the token at all. The client
//   forwards full_name/email from that first-consent credential; both are
//   stored when present and never required afterwards. The token's own
//   email claim (also first-consent only) wins when both are present.
// - The email may be a Hide My Email relay address
//   (@privaterelay.appleid.com) — stored as-is, it is the user's chosen
//   contact address.
// - fm_users.google_sub stays the NOT NULL identity column: Apple-keyed
//   accounts carry the placeholder 'apple:' + sub there.
// - Apple provides no avatar, so avatar_url starts null.
//
// OPTIONAL LINK FLOW (identical to Google's): if the request carries
// `Authorization: Bearer <token>` and that session belongs to an ANONYMOUS
// user (google_sub starts with 'anon:'), the Apple account is LINKED to the
// guest account instead of creating a new user: apple_sub is set, the
// google_sub placeholder is replaced with 'apple:' + sub (so the account
// stops reading as anonymous, exactly like the Google link), email is
// filled in, and name is updated only if it is still 'Guest Angler'. All
// history — catches, friends, contests, play_balance and ledger rows —
// carries over. The existing session token is KEPT (no rotation) and
// returned unchanged, with `linked: true`.
// A malformed Bearer header is a 401; linking to an Apple account that
// already belongs to a different FishMB user is a 409.
// Without a Bearer token, the classic upsert-by-apple_sub behavior applies.

import { NextRequest, NextResponse } from "next/server";
import { withTransaction, txQueryOne } from "@/lib/fish/db";
import {
  createSession,
  pruneExpiredSessions,
  getBearerToken,
  fishUserFromRequest,
  isAnonymousUser,
  ensureProfileColumns,
  toApiUser,
  type FishUser,
} from "@/lib/fish/auth";
import { verifyAppleIdToken } from "@/lib/fish/apple";

/** Pick a unique display name, appending " 2", " 3", … when taken. */
async function uniqueDisplayName(
  base: string,
  client: unknown,
  excludeId?: string
): Promise<string> {
  const clean = base.trim().slice(0, 80) || "Angler";
  const check = async (n: string) => {
    const rows = await txQueryOne<{ id: string }>(
      client as never,
      `SELECT id FROM fm_users WHERE LOWER(name) = LOWER($1)${excludeId ? " AND id != $2" : ""} LIMIT 1`,
      excludeId ? [n, excludeId] : [n]
    );
    return !rows;
  };
  if (await check(clean)) return clean;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${clean} ${i}`.slice(0, 80);
    if (await check(candidate)) return candidate;
  }
  return `${clean} ${Date.now().toString(36)}`.slice(0, 80);
}

/** Optional string field from the first-consent credential, else null. */
function cleanOptionalString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length > 0 ? s : null;
}

export async function POST(req: NextRequest) {
  let body: {
    id_token?: unknown;
    full_name?: unknown;
    email?: unknown;
    age_confirmed?: unknown;
    terms_accepted?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const idToken = body?.id_token;
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 8192) {
    return NextResponse.json({ error: "id_token is required." }, { status: 400 });
  }
  // 13+ self-declaration (OPC: under-13s need a parent/guardian to consent)
  // + terms acceptance — both required to create an account.
  const ageConfirmed = body?.age_confirmed === true;
  const termsAccepted = body?.terms_accepted === true;
  await ensureProfileColumns();

  let profile;
  try {
    profile = await verifyAppleIdToken(idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apple sign-in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // The token's verified email claim wins; the client-forwarded
  // first-consent email is the fallback (same consent event, and on the
  // first sign-in both describe the same address).
  const email = profile.email ?? cleanOptionalString(body?.email, 320);
  // Apple never puts the name in the token — it only exists in the
  // first-consent credential the client forwards.
  const name = cleanOptionalString(body?.full_name, 80) ?? email ?? "Angler";
  const googleSubPlaceholder = `apple:${profile.sub}`;

  // Optional link flow: Bearer token present → must be a valid session.
  const rawAuth = req.headers.get("authorization");
  const bearer = getBearerToken(req);
  if (rawAuth !== null && bearer === null) {
    return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
  }
  if (bearer !== null) {
    const current = await fishUserFromRequest(req);
    if (!current) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
    }
    if (isAnonymousUser(current)) {
      if (!ageConfirmed || !termsAccepted) {
        return NextResponse.json(
          { error: "You must confirm you are 13 or older and accept the Terms to join FishMB." },
          { status: 400 }
        );
      }
      let linked: FishUser | null;
      try {
        linked = await withTransaction(async (client) => {
          const clash = await txQueryOne<{ id: string }>(
            client,
            `SELECT id FROM fm_users WHERE apple_sub = $1 AND id <> $2`,
            [profile.sub, current.id]
          );
          if (clash) throw new Error("LINK_CONFLICT");
          const updated = await txQueryOne<FishUser>(
            client,
            `UPDATE fm_users
                SET apple_sub = $2,
                    google_sub = $5,
                    name = CASE WHEN name = 'Guest Angler' THEN $3 ELSE name END,
                    email = COALESCE($4, email),
                    age_confirmed = true,
                    terms_accepted = true
              WHERE id = $1 RETURNING *`,
            [current.id, profile.sub, name, email, googleSubPlaceholder]
          );
          return updated!;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "LINK_CONFLICT") {
          return NextResponse.json(
            { error: "This Apple account is already linked to another FishMB user." },
            { status: 409 }
          );
        }
        throw err;
      }
      // Keep the existing session token (no rotation); the client already holds it.
      return NextResponse.json({ token: bearer, user: toApiUser(linked!), linked: true });
    }
    // Non-anonymous Bearer: fall through to the classic upsert below.
  }

  let user: FishUser;
  let isNew: boolean;
  try {
    ({ user, isNew } = await withTransaction(async (client) => {
    const existing = await txQueryOne<FishUser>(
      client,
      `SELECT * FROM fm_users WHERE apple_sub = $1`,
      [profile.sub]
    );
    if (existing) {
      // Never overwrite the angler's chosen display name with Apple's on
      // sign-in — once set (by them or at creation), it stays. (Apple only
      // sends the name on the first consent anyway.)
      const updated = await txQueryOne<FishUser>(
        client,
        `UPDATE fm_users
            SET email = COALESCE($2, email),
                age_confirmed = age_confirmed OR $3,
                terms_accepted = terms_accepted OR $4
          WHERE id = $1 RETURNING *`,
        [existing.id, email, ageConfirmed, termsAccepted]
      );
      return { user: updated!, isNew: false };
    }
    if (!ageConfirmed || !termsAccepted) {
      throw new Error("AGE_GATE");
    }
    const freshName = await uniqueDisplayName(name, client);
    const created = await txQueryOne<FishUser>(
      client,
      `INSERT INTO fm_users (google_sub, apple_sub, name, email, avatar_url, age_confirmed, terms_accepted)
       VALUES ($1, $2, $3, $4, NULL, true, true) RETURNING *`,
      [googleSubPlaceholder, profile.sub, freshName, email]
    );
    // Signup bonus: 1000 starting chips (balance default) + audit row.
    await txQueryOne(
      client,
      `INSERT INTO fm_ledger (user_id, contest_id, amount, reason)
       VALUES ($1, NULL, 1000, 'signup_bonus')`,
      [created!.id]
    );
    // New users automatically follow the FishMB brand account (can unfollow later).
    await client.query(
      `INSERT INTO fm_follows (follower_id, followee_id)
       SELECT $1::uuid, id FROM fm_users WHERE name ILIKE '%fishmb%' ORDER BY created_at ASC LIMIT 1
       ON CONFLICT DO NOTHING`,
      [created!.id]
    );
    return { user: created!, isNew: true };
    }));
  } catch (err) {
    if (err instanceof Error && err.message === "AGE_GATE") {
      return NextResponse.json(
        { error: "You must confirm you are 13 or older and accept the Terms to join FishMB." },
        { status: 400 }
      );
    }
    throw err;
  }

  const token = await createSession(user.id);
  pruneExpiredSessions();

  return NextResponse.json({ token, user: toApiUser(user), is_new_user: isNew });
}
