// FishMB fishing-licence wallet — the angler's own digital licence copy,
// uploaded once from manitobaelicensing.ca and shown on demand.
// FishMB never issues licences; it only stores the user's own document.

import { query, queryOne } from "./db";

export interface FishingLicense {
  user_id: string;
  file_url: string;
  file_type: string;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

let ensured = false;

export async function ensureLicenseTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_licenses (
    user_id uuid PRIMARY KEY REFERENCES fm_users(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_type text NOT NULL,
    expiry_date date NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  ensured = true;
}

export async function getLicense(userId: string): Promise<FishingLicense | null> {
  await ensureLicenseTable();
  return queryOne<FishingLicense>(`SELECT * FROM fm_licenses WHERE user_id = $1`, [userId]);
}

export async function saveLicense(
  userId: string,
  fileUrl: string,
  fileType: string,
  expiryDate: string | null
): Promise<FishingLicense> {
  await ensureLicenseTable();
  const row = await queryOne<FishingLicense>(
    `INSERT INTO fm_licenses (user_id, file_url, file_type, expiry_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       file_url = EXCLUDED.file_url,
       file_type = EXCLUDED.file_type,
       expiry_date = EXCLUDED.expiry_date,
       updated_at = now()
     RETURNING *`,
    [userId, fileUrl, fileType, expiryDate]
  );
  if (!row) throw new Error("Could not save licence.");
  return row;
}

export async function deleteLicense(userId: string): Promise<void> {
  await ensureLicenseTable();
  await query(`DELETE FROM fm_licenses WHERE user_id = $1`, [userId]);
}
