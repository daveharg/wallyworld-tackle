import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 requires a driver adapter.
// - Development: SQLite file via better-sqlite3 (DATABASE_URL="file:./dev.db")
// - Production (Vercel Postgres): set DATABASE_URL to a postgres:// URL and the
//   pg adapter is used automatically. Also flip the datasource provider to
//   "postgresql" in prisma/schema.prisma and re-run `prisma migrate`.
function createAdapter() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:\/\//.test(url)) {
    // Dynamic require so the pg packages are only loaded when actually used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    return new PrismaPg({ connectionString: url });
  }
  return new PrismaBetterSqlite3({ url });
}

// Singleton Prisma client — safe across Next.js dev hot-reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
