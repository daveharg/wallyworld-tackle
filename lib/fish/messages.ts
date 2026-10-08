// FishMB end-to-end encrypted direct messages.
//
// Encryption model (all crypto runs client-side with tweetnacl):
// - Each user has one X25519 keypair. The public key lives here in
//   fm_user_keys; the private key NEVER leaves the user's device
//   (browser localStorage).
// - For a 1:1 conversation, both sides derive the same shared secret via
//   ECDH (nacl.box.before) and encrypt with XSalsa20-Poly1305 (secretbox).
// - The server stores and relays only opaque ciphertext + nonces. It
//   cannot read message contents.
//
// v1 scope: 1:1 conversations only. Keys are per-user (not per-device):
// a new device generates a new keypair and cannot read older messages.

import { query, queryOne } from "./db";

export interface ConversationPreview {
  id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_nonce: string | null;
  last_ciphertext: string | null;
  last_at: string | null;
  last_sender_id: string | null;
  unread: number;
}

export interface StoredMessage {
  id: string;
  sender_id: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
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
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS fm_conversation_members (
    conversation_id uuid NOT NULL REFERENCES fm_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS fm_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES fm_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    nonce text NOT NULL,
    ciphertext text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_messages_conv_idx ON fm_messages (conversation_id, created_at)`
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

export async function listConversations(userId: string): Promise<ConversationPreview[]> {
  await ensureMsgTables();
  return query<ConversationPreview>(
    `WITH mine AS (
       SELECT conversation_id, last_read_at
         FROM fm_conversation_members WHERE user_id = $1
     )
     SELECT c.id,
            o.id AS other_id, o.name AS other_name, o.avatar_url AS other_avatar,
            m.nonce AS last_nonce, m.ciphertext AS last_ciphertext,
            m.created_at AS last_at, m.sender_id AS last_sender_id,
            (SELECT COUNT(*)::int FROM fm_messages mm
              WHERE mm.conversation_id = c.id
                AND mm.created_at > mine.last_read_at
                AND mm.sender_id <> $1) AS unread
       FROM mine
       JOIN fm_conversations c ON c.id = mine.conversation_id
       JOIN fm_conversation_members om
         ON om.conversation_id = c.id AND om.user_id <> $1
       JOIN fm_users o ON o.id = om.user_id
       LEFT JOIN LATERAL (
         SELECT nonce, ciphertext, created_at, sender_id
           FROM fm_messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC LIMIT 1
       ) m ON true
      ORDER BY m.created_at DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );
}

/** Find the existing 1:1 conversation between two users, if any. */
export async function findConversation(a: string, b: string): Promise<string | null> {
  await ensureMsgTables();
  const row = await queryOne<{ id: string }>(
    `SELECT m1.conversation_id AS id
       FROM fm_conversation_members m1
       JOIN fm_conversation_members m2
         ON m2.conversation_id = m1.conversation_id
      WHERE m1.user_id = $1 AND m2.user_id = $2
      LIMIT 1`,
    [a, b]
  );
  return row?.id ?? null;
}

export async function createConversation(a: string, b: string): Promise<string> {
  await ensureMsgTables();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO fm_conversations DEFAULT VALUES RETURNING id`
  );
  if (!row) throw new Error("Could not create conversation.");
  await query(
    `INSERT INTO fm_conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
    [row.id, a, b]
  );
  return row.id;
}

export async function listMessages(
  conversationId: string,
  after?: string
): Promise<StoredMessage[]> {
  await ensureMsgTables();
  if (after) {
    return query<StoredMessage>(
      `SELECT id, sender_id, nonce, ciphertext, created_at
         FROM fm_messages
        WHERE conversation_id = $1 AND created_at > $2
        ORDER BY created_at ASC`,
      [conversationId, after]
    );
  }
  return query<StoredMessage>(
    `SELECT id, sender_id, nonce, ciphertext, created_at
       FROM fm_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC LIMIT 100`,
    [conversationId]
  ).then((rows) => rows.reverse());
}

export async function storeMessage(
  conversationId: string,
  senderId: string,
  nonce: string,
  ciphertext: string
): Promise<StoredMessage> {
  await ensureMsgTables();
  const row = await queryOne<StoredMessage>(
    `INSERT INTO fm_messages (conversation_id, sender_id, nonce, ciphertext)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, nonce, ciphertext, created_at`,
    [conversationId, senderId, nonce, ciphertext]
  );
  if (!row) throw new Error("Could not store message.");
  await query(
    `UPDATE fm_conversation_members SET last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, senderId]
  );
  return row;
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
           AND mm.created_at > m.last_read_at
           AND mm.sender_id <> $1)
     ), 0)::int AS n
     FROM fm_conversation_members m WHERE m.user_id = $1`,
    [userId]
  );
  return Number(row?.n ?? 0);
}
