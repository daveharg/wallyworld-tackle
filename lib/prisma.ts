import { PrismaClient } from "@prisma/client";

// Prisma 7 requires a driver adapter. Production uses Postgres (Vercel Postgres).
//
// The connection URL is resolved in this order:
//   1. DATABASE_URL            — set manually to the Postgres connection string
//   2. POSTGRES_PRISMA_URL     — auto-set when a Vercel Postgres store is
//                                connected to the project (pooled, preferred)
//   3. POSTGRES_URL            — auto-set when a Vercel Postgres store is
//                                connected to the project (direct)
//
// The URL is resolved LAZILY inside connect(), which Prisma only calls on the
// first query — never at module import. That keeps `next build` (which
// evaluates route modules while collecting page data) from failing, while a
// missing/invalid URL still fails loudly with a clear message at request time.
//
// There is intentionally NO SQLite fallback: a file-based DB cannot work on
// Vercel (read-only, ephemeral filesystem), and that silent fallback is what
// broke Google sign-in with a blank white screen on 2026-10-04.
function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "[prisma] No Postgres connection string found. Set DATABASE_URL, or " +
        "connect a Vercel Postgres store to this project (provides " +
        "POSTGRES_PRISMA_URL / POSTGRES_URL automatically)."
    );
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      `[prisma] Unsupported database URL scheme — production requires a ` +
        `Postgres connection string (postgres://...), got scheme ` +
        `"${url.split(":")[0]}:".`
    );
  }
  return url;
}

function createAdapter() {
  // Lazy factory: defers require() and URL resolution until Prisma calls
  // connect() on the first query. Mirrors the DriverAdapterFactory shape
  // ({ provider, adapterName, connect() }).
  return {
    provider: "postgres" as const,
    adapterName: "LazyPrismaPg",
    connect: () => {
      // Dynamic require so the pg packages are only loaded when actually used.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaPg } = require("@prisma/adapter-pg");
      const factory = new PrismaPg({ connectionString: resolveDatabaseUrl() });
      return factory.connect();
    },
  };
}

// Singleton Prisma client — safe across Next.js dev hot-reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
