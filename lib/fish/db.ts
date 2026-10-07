// Fish Manitoba backend — Postgres access for the fm_* tables.
//
// Uses node-postgres directly (the fm_* schema is greenfield SQL, kept out of
// the Prisma schema). The connection URL resolves lazily, same as lib/prisma.ts,
// so `next build` never fails on a missing DATABASE_URL.

import { Pool, PoolClient } from "pg";

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "[fish-db] No Postgres connection string found. Set DATABASE_URL, " +
        "POSTGRES_PRISMA_URL or POSTGRES_URL."
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      `[fish-db] Unsupported database URL scheme — expected postgres://, got ` +
        `"${url.split(":")[0]}:".`
    );
  }
  return url;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: resolveDatabaseUrl(), max: 5 });
    pool.on("error", () => {
      // Drop a poisoned pool so the next request builds a fresh one.
      pool = null;
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run fn inside a transaction; rolls back on throw. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function txQuery<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await client.query(text, params as never[]);
  return res.rows as T[];
}

export async function txQueryOne<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await txQuery<T>(client, text, params);
  return rows[0] ?? null;
}
