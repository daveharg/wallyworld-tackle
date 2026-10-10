// FishMB end-to-end encrypted messages — 1:1 and group chats.
//
// Encryption model (all crypto runs client-side with tweetnacl):
// - Each user has one X25519 keypair. The public key lives here in
//   fm_user_keys; the private key NEVER leaves the user's device
//   (browser localStorage).
// - Every message is encrypted separately for EACH member (including the
//   sender, so they can read their own history later) via ECDH
//   (nacl.box.before) + XSalsa20-Poly1305 (secretbox). One row per
//   recipient — the server only relays opaque ciphertext and cannot
//   read anything.
// - Groups: any member can add friends or leave. New members can't read
//   history from before they joined (their rows don't exist).
//
// v1 scope: keys are per-user (not per-device). A new device generates a
// new keypair and cannot read older messages.

import { query, queryOne, withTransaction, txQuery, txQueryOne } from "./db";

export interface ConversationMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  public_key: string | null;
}

export interface ConversationPreview {
  id: string;
  name: string | null;
  is_group: boolean;
  members: ConversationMember[];
  last_at: string | null;
  last_sender_id: string | null;
  last_nonce: string | null;
  last_ciphertext: string | null;
  unread: number;
  pinned_at: string | null;
}

export interface StoredMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
}

export interface MessagePart {
  recipient_id: string;
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
  await query(`CREATE TABLE IF NOT EXISTS fm_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`ALTER TABLE fm_conversations ADD COLUMN IF NOT EXISTS name text`);
  await query(`CREATE TABLE IF NOT EXISTS fm_conversation_members (
    conversation_id uuid NOT NULL REFERENCES fm_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
  )`);
  await query(`ALTER TABLE fm_conversation_members ADD COLUMN IF NOT EXISTS pinned_at timestamptz`);
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
  await query(
    `CREATE INDEX IF NOT EXISTS fm_messages_conv_idx ON fm_messages (conversation_id, created_at)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_messages_recipient_idx ON fm_messages (conversation_id, recipient_id, created_at)`
  );
  ensured = true;
}

export async function getPublicKey(userId: string): Promise<string | null> {
  await ensureMsgTables();
  const row = await queryOne<{ public_key: string }>(
    `SELECT public_key FROM fm_user_keys WHERE user_id = $1`,
    [userId]
  );
  return row?.public_key ?? null;
}

export async function setPublicKey(userId: string, publicKey: string): Promise<void> {
  await ensureMsgTables();
  await query(
    `INSERT INTO fm_user_keys (user_id, public_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET public_key = EXCLUDED.public_key, created_at = now()`,
    [userId, publicKey]
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
  return query<ConversationMember>(
    `SELECT u.id AS user_id, u.name, u.avatar_url, k.public_key
       FROM fm_conversation_members m
       JOIN fm_users u ON u.id = m.user_id
       LEFT JOIN fm_user_keys k ON k.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY u.name`,
    [conversationId]
  );
}

export async function listConversations(userId: string): Promise<ConversationPreview[]> {
  await ensureMsgTables();
  const rows = await query<{
    id: string;
    name: string | null;
    member_count: number;
    last_at: string | null;
    last_sender_id: string | null;
    last_nonce: string | null;
    last_ciphertext: string | null;
    unread: number;
    pinned_at: string | null;
  }>(
    `WITH mine AS (
       SELECT conversation_id, last_read_at, pinned_at
         FROM fm_conversation_members WHERE user_id = $1
     )
     SELECT c.id, c.name,
            (SELECT COUNT(*)::int FROM fm_conversation_members mm WHERE mm.conversation_id = c.id) AS member_count,
            m.created_at AS last_at, m.sender_id AS last_sender_id,
            m.nonce AS last_nonce, m.ciphertext AS last_ciphertext,
            (SELECT COUNT(*)::int FROM fm_messages mm
              WHERE mm.conversation_id = c.id
                AND mm.recipient_id = $1
                AND mm.created_at > mine.last_read_at
                AND mm.sender_id <> $1) AS unread,
            mine.pinned_at AS pinned_at
       FROM mine
       JOIN fm_conversations c ON c.id = mine.conversation_id
       LEFT JOIN LATERAL (
         SELECT created_at, sender_id, nonce, ciphertext
           FROM fm_messages
          WHERE conversation_id = c.id AND recipient_id = $1
          ORDER BY created_at DESC LIMIT 1
       ) m ON true
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
      is_group: r.member_count > 2,
      members,
      last_at: r.last_at,
      last_sender_id: r.last_sender_id,
      last_nonce: r.last_nonce,
      last_ciphertext: r.last_ciphertext,
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
  if (after) {
    return query<StoredMessage>(
      `SELECT id, sender_id, nonce, ciphertext, created_at
         FROM fm_messages
        WHERE conversation_id = $1 AND recipient_id = $2 AND created_at > $3
        ORDER BY created_at ASC`,
      [conversationId, userId, after]
    );
  }
  return query<StoredMessage>(
    `SELECT id, sender_id, nonce, ciphertext, created_at
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
  const stored: StoredMessage[] = [];
  for (const p of parts) {
    if (!memberIds.has(p.recipient_id)) {
      throw new Error("Recipient is not a member.");
    }
    const row = await queryOne<StoredMessage>(
      `INSERT INTO fm_messages (conversation_id, sender_id, recipient_id, nonce, ciphertext)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sender_id, recipient_id, nonce, ciphertext, created_at`,
      [conversationId, senderId, p.recipient_id, p.nonce, p.ciphertext]
    );
    if (row) stored.push(row);
  }
  await query(
    `UPDATE fm_conversation_members SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, senderId]
  );
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
