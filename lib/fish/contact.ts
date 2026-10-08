// FishMB "Contact us" messages — visitors can report bugs, wrong regulations,
// or just say hi. Messages queue for the site owner in the admin dashboard.

import { query } from "@/lib/fish/db";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  user_id: string | null;
  status: "new" | "read" | "archived";
  created_at: string;
}

export async function ensureContactTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS fm_contact_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      user_id UUID REFERENCES fm_users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'read', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON fm_contact_messages(status)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created ON fm_contact_messages(email, created_at)`
  );
}

export async function saveMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  user_id: string | null;
}): Promise<ContactMessage> {
  const rows = await query<ContactMessage>(
    `INSERT INTO fm_contact_messages (name, email, subject, message, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.email, input.subject, input.message, input.user_id]
  );
  return rows[0];
}

/** How many messages this email address sent in the last hour (for rate limiting). */
export async function countRecentByEmail(email: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_contact_messages
     WHERE lower(email) = lower($1) AND created_at > now() - interval '1 hour'`,
    [email]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function listMessages(
  status: string | null
): Promise<ContactMessage[]> {
  if (status) {
    return query<ContactMessage>(
      `SELECT * FROM fm_contact_messages
       WHERE status = $1 ORDER BY created_at DESC LIMIT 100`,
      [status]
    );
  }
  return query<ContactMessage>(
    `SELECT * FROM fm_contact_messages ORDER BY created_at DESC LIMIT 100`
  );
}

export async function markMessage(
  id: string,
  status: "read" | "archived"
): Promise<void> {
  await query(`UPDATE fm_contact_messages SET status = $1 WHERE id = $2`, [
    status,
    id,
  ]);
}
