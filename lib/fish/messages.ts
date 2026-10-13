// FishMB end-to-end encrypted messages — 1:1 and group chats.
//
// Encryption model (all crypto runs client-side with tweetnacl):
// - Each user can have SEVERAL X25519 keypairs — one per device / browser
//   context. Public keys live here in fm_user_keys (multi-key per user,
//   add-only registration, pruned to the 5 most recent). Private keys
//   NEVER leave the user's devices (browser localStorage). Registering a
//   new key can never erase an older one, so a fresh sign-in context can
//   no longer silently break existing chats.
// - New messages (v2) are self-contained: a random per-message key is
//   secretbox-encrypted with the plaintext, then wrapped to EACH of a
//   recipient's registered public keys with a fresh ephemeral keypair.
//   One row per (recipient, key) — the server only relays opaque
//   ciphertext and cannot read anything. A v2 copy decrypts with only
//   the recipient's own secret key; the sender's key state is
//   irrelevant, and fm_messages.recipient_key records which key a copy
//   was wrapped to.
// - Legacy messages (pre-v2) were encrypted per member via pairwise ECDH
//   (nacl.box.before) + XSalsa20-Poly1305 (secretbox), one row per
//   recipient with recipient_key NULL. The web client can still read
//   them by trying the shared secret for each of the sender's
//   registered public keys.
// - Groups: any member can add friends or leave. New members can't read
//   history from before they joined (their rows don't exist).

import { query, queryOne, withTransaction, txQuery, txQueryOne } from "./db";

export interface ConversationMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  /** Newest registered public key (back-compat for the native app). */
  public_key: string | null;
  /** All registered public keys, newest first. */
  public_keys: string[];
}

export interface ConversationPreview {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_group: boolean;
  members: ConversationMember[];
  last_at: string | null;
  last_sender_id: string | null;
  last_nonce: string | null;
  last_ciphertext: string | null;
  last_recipient_key: string | null;
  /** Protocol of the newest copy ("sig1" for Signal), null for v2/legacy. */
  last_proto: string | null;
  unread: number;
  pinned_at: string | null;
}

export interface StoredMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  /** Which of the recipient's public keys this copy was wrapped to (v2).
   *  NULL for legacy pairwise copies. */
  recipient_key: string | null;
  /** Wire protocol of this copy ("sig1" for Signal-protocol copies).
   *  NULL for v2 wrapped-key and legacy pairwise copies. */
  proto: string | null;
  nonce: string;
  ciphertext: string;
  created_at: string;
  reactions?: { emoji: string; n: number; mine: boolean }[];
}

/** Fetch reaction summaries for a batch of message IDs. Never throws. */
export async function getReactions(
  messageIds: string[],
  viewerId: string
): Promise<Map<string, { emoji: string; n: number; mine: boolean }[]>> {
  const map = new Map<string, { emoji: string; n: number; mine: boolean }[]>();
  if (messageIds.length === 0) return map;
  try {
    await ensureMsgTables();
    const rows = (await query(
      `SELECT message_id, emoji, COUNT(*)::int AS n, BOOL_OR(user_id = $2) AS mine
         FROM fm_message_reactions
        WHERE message_id = ANY($1)
        GROUP BY message_id, emoji`,
      [messageIds, viewerId]
    )) as { message_id: string; emoji: string; n: number; mine: boolean }[];
    for (const r of rows) {
      const arr = map.get(r.message_id) ?? [];
      arr.push({ emoji: r.emoji, n: r.n, mine: r.mine });
      map.set(r.message_id, arr);
    }
  } catch {
    // Reactions are optional — never break message loading.
  }
  return map;
}

export interface MessagePart {
  recipient_id: string;
  /** Public key (base64) this copy is wrapped to; null/absent = legacy copy.
   *  For proto "sig1" copies: the recipient device's identity key. */
  recipient_key?: string | null;
  /** Wire protocol of this copy ("sig1" for Signal); absent/null = v2/legacy. */
  proto?: string | null;
  nonce: string;
  ciphertext: string;
}

let ensured = false;

export async function ensureMsgTables(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_user_keys (
    user_id uuid PRIMARY KEY REFERENCES fm_users(id) ON DELETE CASCADE,
    public_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Multi-key migration: fm_user_keys used to hold ONE key per user (PK on
  // user_id alone) and setPublicKey overwrote it — any fresh device/PWA
  // context registering its key silently orphaned every message encrypted
  // to the previous key. Widen the PK to (user_id, public_key) so a user
  // can hold several keys at once. Idempotent: once the PK has both
  // columns this is a no-op, so it is safe on every cold start.
  const pkCols = await query<{ attname: string }>(
    `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'fm_user_keys'::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`
  );
  if (pkCols.length === 1 && pkCols[0].attname === "user_id") {
    const pk = await queryOne<{ conname: string }>(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'fm_user_keys'::regclass AND contype = 'p'`
    );
    if (pk) {
      try {
        await query(
          `ALTER TABLE fm_user_keys DROP CONSTRAINT "${pk.conname.replace(/"/g, '""')}"`
        );
        await query(
          `ALTER TABLE fm_user_keys ADD PRIMARY KEY (user_id, public_key)`
        );
      } catch {
        // A concurrent cold start may have run the same migration first —
        // re-check below and only fail if the PK is still single-column.
        const after = await query<{ attname: string }>(
          `SELECT a.attname
             FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'fm_user_keys'::regclass AND i.indisprimary`
        );
        if (after.length === 1) {
          throw new Error("fm_user_keys multi-key migration failed.");
        }
      }
    }
  }
  await query(`CREATE TABLE IF NOT EXISTS fm_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`ALTER TABLE fm_conversations ADD COLUMN IF NOT EXISTS name text`);
  await query(`ALTER TABLE fm_conversations ADD COLUMN IF NOT EXISTS avatar_url text`);
  await query(`CREATE TABLE IF NOT EXISTS fm_conversation_members (
    conversation_id uuid NOT NULL REFERENCES fm_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
  )`);
  await query(`ALTER TABLE fm_conversation_members ADD COLUMN IF NOT EXISTS pinned_at timestamptz`);
  // Per-user "delete chat": hides the conversation from that member's
  // list until a newer message arrives. Membership itself is untouched.
  await query(`ALTER TABLE fm_conversation_members ADD COLUMN IF NOT EXISTS hidden_at timestamptz`);
  await query(`CREATE TABLE IF NOT EXISTS fm_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES fm_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    nonce text NOT NULL,
    ciphertext text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Per-recipient rows: one ciphertext per member, each encrypted to them.
  await query(`ALTER TABLE fm_messages ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES fm_users(id) ON DELETE CASCADE`);
  // v2 copies record which of the recipient's public keys they were
  // wrapped to, so the recipient can pick the copy their device can open.
  await query(`ALTER TABLE fm_messages ADD COLUMN IF NOT EXISTS recipient_key text`);
  // Signal-protocol copies record their wire protocol ("sig1") so clients
  // can route them to the Signal stack instead of the v2/legacy path.
  await query(`ALTER TABLE fm_messages ADD COLUMN IF NOT EXISTS proto text`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_messages_conv_idx ON fm_messages (conversation_id, created_at)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_messages_recipient_idx ON fm_messages (conversation_id, recipient_id, created_at)`
  );
  // Message reactions (e.g. ❤️, 🖕).
  await query(`CREATE TABLE IF NOT EXISTS fm_message_reactions (
    message_id uuid NOT NULL REFERENCES fm_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, emoji)
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_reactions_msg_idx ON fm_message_reactions (message_id)`
  );
  ensured = true;
}

/** All of a user's registered public keys, newest first (max 5 kept). */
export async function getPublicKeys(userId: string): Promise<string[]> {
  await ensureMsgTables();
  const rows = await query<{ public_key: string }>(
    `SELECT public_key FROM fm_user_keys
      WHERE user_id = $1
      ORDER BY created_at DESC, public_key`,
    [userId]
  );
  return rows.map((r) => r.public_key);
}

/** The user's newest registered public key, or null if they have none. */
export async function getPublicKey(userId: string): Promise<string | null> {
  const keys = await getPublicKeys(userId);
  return keys[0] ?? null;
}

/** How many keys a user keeps — older devices' keys stay deliverable. */
const MAX_KEYS_PER_USER = 5;

/**
 * Register a public key — ADD-ONLY. An existing key is never overwritten:
 * another device/context registering its key must not orphan the messages
 * encrypted to keys already in use. After inserting, prune to the newest
 * MAX_KEYS_PER_USER keys so the table (and per-message copy fan-out)
 * stays bounded.
 */
export async function setPublicKey(userId: string, publicKey: string): Promise<void> {
  await ensureMsgTables();
  await query(
    `INSERT INTO fm_user_keys (user_id, public_key)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, publicKey]
  );
  await query(
    `DELETE FROM fm_user_keys
      WHERE user_id = $1
        AND public_key NOT IN (
          SELECT public_key FROM fm_user_keys
           WHERE user_id = $1
           ORDER BY created_at DESC, public_key
           LIMIT $2
        )`,
    [userId, MAX_KEYS_PER_USER]
  );
}

/** Is userId a member of conversationId? */
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  await ensureMsgTables();
  const row = await queryOne<{ n: string }>(
    `SELECT 1 AS n FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return !!row;
}

export async function getMembers(conversationId: string): Promise<ConversationMember[]> {
  await ensureMsgTables();
  const rows = await query<{
    user_id: string;
    name: string;
    avatar_url: string | null;
    public_key: string | null;
    public_keys: string[] | null;
  }>(
    `SELECT u.id AS user_id, u.name, u.avatar_url,
            (SELECT k.public_key FROM fm_user_keys k
              WHERE k.user_id = u.id
              ORDER BY k.created_at DESC, k.public_key
              LIMIT 1) AS public_key,
            (SELECT array_agg(k.public_key ORDER BY k.created_at DESC, k.public_key)
               FROM fm_user_keys k
              WHERE k.user_id = u.id) AS public_keys
       FROM fm_conversation_members m
       JOIN fm_users u ON u.id = m.user_id
      WHERE m.conversation_id = $1
      ORDER BY u.name`,
    [conversationId]
  );
  return rows.map((r) => ({
    user_id: r.user_id,
    name: r.name,
    avatar_url: r.avatar_url,
    public_key: r.public_key,
    public_keys: r.public_keys ?? [],
  }));
}

export async function listConversations(userId: string): Promise<ConversationPreview[]> {
  await ensureMsgTables();
  const rows = await query<{
    id: string;
    name: string | null;
    avatar_url: string | null;
    member_count: number;
    last_at: string | null;
    last_sender_id: string | null;
    last_nonce: string | null;
    last_ciphertext: string | null;
    last_recipient_key: string | null;
    last_proto: string | null;
    unread: number;
    pinned_at: string | null;
  }>(
    `WITH mine AS (
       SELECT conversation_id, last_read_at, pinned_at, hidden_at
         FROM fm_conversation_members WHERE user_id = $1
     )
     SELECT c.id, c.name, c.avatar_url,
            (SELECT COUNT(*)::int FROM fm_conversation_members mm WHERE mm.conversation_id = c.id) AS member_count,
            m.created_at AS last_at, m.sender_id AS last_sender_id,
            m.nonce AS last_nonce, m.ciphertext AS last_ciphertext,
            m.recipient_key AS last_recipient_key,
            m.proto AS last_proto,
            (SELECT COUNT(*)::int FROM fm_messages mm
              WHERE mm.conversation_id = c.id
                AND mm.recipient_id = $1
                AND mm.created_at > mine.last_read_at
                AND mm.sender_id <> $1) AS unread,
            mine.pinned_at AS pinned_at
       FROM mine
       JOIN fm_conversations c ON c.id = mine.conversation_id
       LEFT JOIN LATERAL (
         SELECT created_at, sender_id, nonce, ciphertext, recipient_key, proto
           FROM fm_messages
          WHERE conversation_id = c.id AND recipient_id = $1
          ORDER BY created_at DESC LIMIT 1
       ) m ON true
       -- "Deleted" chats stay out of the list until a message newer
       -- than the hide arrives for me — new activity resurrects the
       -- chat with history intact. A chat whose messages all predate
       -- the hide (or that has none newer) stays hidden.
      WHERE mine.hidden_at IS NULL
         OR EXISTS (
           SELECT 1 FROM fm_messages hm
            WHERE hm.conversation_id = c.id
              AND hm.recipient_id = $1
              AND hm.created_at > mine.hidden_at
         )
      ORDER BY (mine.pinned_at IS NULL), mine.pinned_at DESC,
               m.created_at DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );
  const previews: ConversationPreview[] = [];
  for (const r of rows) {
    const members = await getMembers(r.id);
    previews.push({
      id: r.id,
      name: r.name,
      avatar_url: r.avatar_url,
      is_group: r.member_count > 2,
      members,
      last_at: r.last_at,
      last_sender_id: r.last_sender_id,
      last_nonce: r.last_nonce,
      last_ciphertext: r.last_ciphertext,
      last_recipient_key: r.last_recipient_key,
      last_proto: r.last_proto ?? null,
      unread: r.unread,
      pinned_at: r.pinned_at,
    });
  }
  return previews;
}

/** Pin or unpin a conversation for one user (pins are personal). */
export async function setPinned(
  conversationId: string,
  userId: string,
  pinned: boolean
): Promise<void> {
  await ensureMsgTables();
  await query(
    `UPDATE fm_conversation_members
        SET pinned_at = CASE WHEN $3 THEN now() ELSE NULL END
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId, pinned]
  );
}

/**
 * Hide a conversation from one user's list ("delete chat"). This is a
 * per-user view setting only — membership, messages, and everyone
 * else's view are untouched. The chat reappears in their list when a
 * newer message arrives (see listConversations) or when they open the
 * thread directly (see listMessages).
 */
export async function hideConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  await ensureMsgTables();
  await query(
    `UPDATE fm_conversation_members SET hidden_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
}

/** All 1:1 conversation ids between two users (healthy state: at most one). */
export async function findDirectConversations(a: string, b: string): Promise<string[]> {
  await ensureMsgTables();
  const rows = await query<{ id: string }>(
    `SELECT m1.conversation_id AS id
       FROM fm_conversation_members m1
       JOIN fm_conversation_members m2 ON m2.conversation_id = m1.conversation_id
      WHERE m1.user_id = $1 AND m2.user_id = $2
        AND (SELECT COUNT(*) FROM fm_conversation_members mm WHERE mm.conversation_id = m1.conversation_id) = 2`,
    [a, b]
  );
  return rows.map((r) => r.id);
}

/**
 * One thread per pair, guaranteed. Serializes find-or-create on the pair with
 * an advisory lock (so double-taps can't mint duplicate threads), and heals
 * any pre-existing duplicate 1:1 threads by folding them into the most active
 * one — messages moved over, read positions kept.
 */
export async function getOrCreateDirectConversation(a: string, b: string): Promise<string> {
  await ensureMsgTables();
  return withTransaction(async (client) => {
    const pair = [a, b].sort();
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `fishmb-dm:${pair[0]}:${pair[1]}`,
    ]);
    const ids = (
      await txQuery<{ id: string }>(
        client,
        `SELECT m1.conversation_id AS id
           FROM fm_conversation_members m1
           JOIN fm_conversation_members m2 ON m2.conversation_id = m1.conversation_id
          WHERE m1.user_id = $1 AND m2.user_id = $2
            AND (SELECT COUNT(*) FROM fm_conversation_members mm WHERE mm.conversation_id = m1.conversation_id) = 2`,
        [a, b]
      )
    ).map((r) => r.id);

    if (ids.length === 0) {
      const row = await txQueryOne<{ id: string }>(
        client,
        `INSERT INTO fm_conversations (name) VALUES (NULL) RETURNING id`
      );
      if (!row) throw new Error("Could not create conversation.");
      for (const uid of [a, b]) {
        await client.query(
          `INSERT INTO fm_conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.id, uid]
        );
      }
      return row.id;
    }
    if (ids.length === 1) return ids[0];

    // Heal duplicates: keep the most active thread, fold the rest into it.
    const stats = await txQuery<{ id: string; msg_count: string; last_msg_at: string | null }>(
      client,
      `SELECT c.id,
              (SELECT COUNT(*) FROM fm_messages m WHERE m.conversation_id = c.id) AS msg_count,
              (SELECT MAX(created_at) FROM fm_messages m WHERE m.conversation_id = c.id) AS last_msg_at
         FROM fm_conversations c
        WHERE c.id = ANY($1)`,
      [ids]
    );
    stats.sort((x, y) => {
      const c = Number(y.msg_count) - Number(x.msg_count);
      if (c !== 0) return c;
      const ly = y.last_msg_at ? new Date(y.last_msg_at).getTime() : 0;
      const lx = x.last_msg_at ? new Date(x.last_msg_at).getTime() : 0;
      return ly - lx;
    });
    const canonical = stats[0].id;
    for (const dupe of stats.slice(1).map((s) => s.id)) {
      // Move the dupe's messages into the canonical thread.
      await client.query(`UPDATE fm_messages SET conversation_id = $1 WHERE conversation_id = $2`, [
        canonical,
        dupe,
      ]);
      // Keep the furthest-read position per member.
      await client.query(
        `UPDATE fm_conversation_members cm
            SET last_read_at = GREATEST(cm.last_read_at, dm.last_read_at)
           FROM fm_conversation_members dm
          WHERE cm.conversation_id = $1 AND dm.conversation_id = $2 AND cm.user_id = dm.user_id`,
        [canonical, dupe]
      );
      // Cascades to the dupe's member rows and any leftover message rows.
      await client.query(`DELETE FROM fm_conversations WHERE id = $1`, [dupe]);
    }
    return canonical;
  });
}

/** Find the existing 1:1 conversation between two users, if any. */
export async function findDirectConversation(a: string, b: string): Promise<string | null> {
  const ids = await findDirectConversations(a, b);
  return ids[0] ?? null;
}

export async function createConversation(
  memberIds: string[],
  name: string | null
): Promise<string> {
  await ensureMsgTables();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO fm_conversations (name) VALUES ($1) RETURNING id`,
    [name]
  );
  if (!row) throw new Error("Could not create conversation.");
  const unique = Array.from(new Set(memberIds));
  for (const uid of unique) {
    await query(
      `INSERT INTO fm_conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [row.id, uid]
    );
  }
  return row.id;
}

export async function addMember(conversationId: string, userId: string): Promise<void> {
  await ensureMsgTables();
  await query(
    `INSERT INTO fm_conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [conversationId, userId]
  );
}

export async function removeMember(conversationId: string, userId: string): Promise<void> {
  await ensureMsgTables();
  await query(
    `DELETE FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
}

/** My rows only — each member reads only their own ciphertext. */
export async function listMessages(
  conversationId: string,
  userId: string,
  after?: string
): Promise<StoredMessage[]> {
  await ensureMsgTables();
  // Opening a thread directly (e.g. a deep link) un-hides it: reading
  // the conversation is the natural "bring this chat back" action.
  await query(
    `UPDATE fm_conversation_members SET hidden_at = NULL
      WHERE conversation_id = $1 AND user_id = $2 AND hidden_at IS NOT NULL`,
    [conversationId, userId]
  );
  if (after) {
    return query<StoredMessage>(
      `SELECT id, sender_id, recipient_id, recipient_key, proto, nonce, ciphertext, created_at
         FROM fm_messages
        WHERE conversation_id = $1 AND recipient_id = $2 AND created_at > $3
        ORDER BY created_at ASC`,
      [conversationId, userId, after]
    );
  }
  return query<StoredMessage>(
    `SELECT id, sender_id, recipient_id, recipient_key, proto, nonce, ciphertext, created_at
       FROM fm_messages
      WHERE conversation_id = $1 AND recipient_id = $2
      ORDER BY created_at DESC LIMIT 100`,
    [conversationId, userId]
  ).then((rows) => rows.reverse());
}

/** Stores one row per recipient part. All recipients must be members. */
export async function storeMessage(
  conversationId: string,
  senderId: string,
  parts: MessagePart[]
): Promise<StoredMessage[]> {
  await ensureMsgTables();
  const members = await getMembers(conversationId);
  const memberIds = new Set(members.map((m) => m.user_id));
  const memberNames = new Map(members.map((m) => [m.user_id, m.name]));
  const stored: StoredMessage[] = [];
  // One timestamp for the whole send: all copies of a logical message
  // (one per recipient/key) share sender_id + created_at, which is how
  // clients group copies back into a single bubble.
  const createdAt = new Date().toISOString();
  for (const p of parts) {
    if (!memberIds.has(p.recipient_id)) {
      throw new Error("Recipient is not a member.");
    }
    const row = await queryOne<StoredMessage>(
      `INSERT INTO fm_messages (conversation_id, sender_id, recipient_id, recipient_key, proto, nonce, ciphertext, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, sender_id, recipient_id, recipient_key, proto, nonce, ciphertext, created_at`,
      [conversationId, senderId, p.recipient_id, p.recipient_key ?? null, p.proto ?? null, p.nonce, p.ciphertext, createdAt]
    );
    if (row) stored.push(row);
  }
  await query(
    `UPDATE fm_conversation_members SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, senderId]
  );
  // Push-notify recipients (not the sender). Best-effort, never throws.
  // Respects each recipient's "new message" alert setting.
  try {
    const { sendPushToUser, wantsAlert } = await import("./push");
    const senderName = memberNames.get(senderId) ?? "Someone";
    const recipientSet = new Set<string>();
    parts.forEach((p) => {
      if (p.recipient_id !== senderId) recipientSet.add(p.recipient_id);
    });
    const recipients = Array.from(recipientSet);
    await Promise.allSettled(
      recipients.map(async (rid) => {
        if (!(await wantsAlert(rid, "new_message"))) return;
        // Count total unread for the app icon badge.
        let unread = 0;
        try {
          const r = await queryOne<{ n: string }>(
            `SELECT COUNT(*) AS n FROM fm_messages m
             JOIN fm_conversation_members cm ON cm.conversation_id = m.conversation_id
             WHERE m.recipient_id = $1 AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')`,
            [rid]
          );
          unread = parseInt(r?.n ?? "0", 10) || 0;
        } catch {}
        return sendPushToUser(rid, {
          title: senderName,
          body: "Sent you a message.",
          url: `/fishmb/messages?c=${conversationId}`,
          tag: `fishmb-msg-${conversationId}`,
          unread,
        });
      })
    );
  } catch {
    // ignore
  }
  return stored;
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  await ensureMsgTables();
  await query(
    `UPDATE fm_conversation_members SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
}

export async function totalUnread(userId: string): Promise<number> {
  await ensureMsgTables();
  const row = await queryOne<{ n: string }>(
    `SELECT COALESCE(SUM(
       (SELECT COUNT(*) FROM fm_messages mm
         WHERE mm.conversation_id = m.conversation_id
           AND mm.recipient_id = $1
           AND mm.created_at > m.last_read_at
           AND mm.sender_id <> $1)
     ), 0)::int AS n
     FROM fm_conversation_members m WHERE m.user_id = $1`,
    [userId]
  );
  return Number(row?.n ?? 0);
}
