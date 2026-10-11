import { query } from "@/lib/fish/db";

/** Ensure the push subscriptions table exists. */
export async function ensurePushTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS fm_push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON fm_push_subscriptions(user_id)
  `);
}

/** Send a push notification to all of a user's subscribed devices. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return;
  try {
    await ensurePushTable();
    const rows = (await query(
      `SELECT endpoint, p256dh, auth FROM fm_push_subscriptions WHERE user_id = $1`,
      [userId]
    )) as { endpoint: string; p256dh: string; auth: string }[];
    if (rows.length === 0) return;
    // Dynamic import so the server bundle doesn't require web-push unless used.
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      "mailto:noreply@fishmb.ca",
      "BPQnbbCGJ6JfzAuF1N7bZ9zbN3fosbdHeVFAjlTCalWqybPwEmWzI1vmtRHaBMB4-Ta1sKVSzn0HUy1Ppm1zJ8Q",
      privateKey
    );
    await Promise.allSettled(
      rows.map((s) => {
        const sub = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        return webpush.sendNotification(sub, JSON.stringify(payload)).catch(async (err: { statusCode?: number }) => {
          // 410 Gone = subscription expired/unsubscribed — clean it up.
          if (err?.statusCode === 410) {
            await query(`DELETE FROM fm_push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
          }
        });
      })
    );
  } catch {
    // Push is best-effort — never break message sending.
  }
}
