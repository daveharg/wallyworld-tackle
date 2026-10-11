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

/** Ensure the per-user notification preferences table exists. */
export async function ensurePrefsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS fm_notification_prefs (
      user_id TEXT PRIMARY KEY,
      friend_catch BOOLEAN NOT NULL DEFAULT true,
      friend_post BOOLEAN NOT NULL DEFAULT true,
      new_message BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export type NotifyKind = "friend_catch" | "friend_post" | "new_message";

export interface NotificationPrefs {
  friend_catch: boolean;
  friend_post: boolean;
  new_message: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  friend_catch: true,
  friend_post: true,
  new_message: true,
};

/** A user's alert preferences — defaults (all on) when no row exists yet. */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    await ensurePrefsTable();
    const row = (await query(
      `SELECT friend_catch, friend_post, new_message FROM fm_notification_prefs WHERE user_id = $1`,
      [userId]
    )) as { friend_catch: boolean; friend_post: boolean; new_message: boolean }[];
    if (row.length === 0) return { ...DEFAULT_PREFS };
    return {
      friend_catch: row[0].friend_catch ?? true,
      friend_post: row[0].friend_post ?? true,
      new_message: row[0].new_message ?? true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Save a user's alert preferences (upsert). */
export async function setNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPrefs>
): Promise<NotificationPrefs> {
  await ensurePrefsTable();
  const current = await getNotificationPrefs(userId);
  const next: NotificationPrefs = {
    friend_catch: prefs.friend_catch ?? current.friend_catch,
    friend_post: prefs.friend_post ?? current.friend_post,
    new_message: prefs.new_message ?? current.new_message,
  };
  await query(
    `INSERT INTO fm_notification_prefs (user_id, friend_catch, friend_post, new_message, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       friend_catch = EXCLUDED.friend_catch,
       friend_post = EXCLUDED.friend_post,
       new_message = EXCLUDED.new_message,
       updated_at = NOW()`,
    [userId, next.friend_catch, next.friend_post, next.new_message]
  );
  return next;
}

/** True when the user wants this kind of push alert. */
export async function wantsAlert(userId: string, kind: NotifyKind): Promise<boolean> {
  const prefs = await getNotificationPrefs(userId);
  return prefs[kind];
}

async function getUserName(userId: string): Promise<string> {
  try {
    const row = await query(`SELECT name FROM fm_users WHERE id = $1`, [userId]);
    return (row as { name: string }[])[0]?.name ?? "Someone";
  } catch {
    return "Someone";
  }
}

/**
 * Push-notify a user's accepted friends who have this alert enabled.
 * Fire-and-forget — never await, never throws.
 */
export function notifyFriends(
  userId: string,
  kind: "friend_catch" | "friend_post",
  makePayload: (authorName: string) => { title: string; body: string; url?: string; tag?: string }
): void {
  (async () => {
    try {
      await ensurePushTable();
      await ensurePrefsTable();
      const rows = (await query(
        `SELECT DISTINCT
           CASE WHEN f.requester_id = $1::uuid THEN f.addressee_id ELSE f.requester_id END AS friend_id
         FROM fm_friendships f
         WHERE f.status = 'accepted'
           AND (f.requester_id = $1::uuid OR f.addressee_id = $1::uuid)`,
        [userId]
      )) as { friend_id: string }[];
      if (rows.length === 0) return;
      const authorName = await getUserName(userId);
      const payload = makePayload(authorName);
      await Promise.allSettled(
        rows.map(async (r) => {
          if (!(await wantsAlert(r.friend_id, kind))) return;
          return sendPushToUser(r.friend_id, payload);
        })
      );
    } catch {
      // Best-effort — never break posting.
    }
  })();
}

/** Send a push notification to all of a user's subscribed devices. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string; unread?: number }
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
      "BPijWs62LtGHaH2ixc6fYHQNiJjzmOJ32_o4cd1R_PHLt5o33dIPvvtZk29hF-V9MA8xs-HYqAR3k7xZ7hBha0g",
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
