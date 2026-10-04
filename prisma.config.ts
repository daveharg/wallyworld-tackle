import { defineConfig } from "prisma/config";

// Prisma 7: datasource connection strings live here, not in schema.prisma.
// For production, set DATABASE_URL to the Vercel Postgres connection string
// (use the NON-pooled / direct URL for `prisma migrate deploy`).
// When a Vercel Postgres store is connected to the project, POSTGRES_URL is
// provided automatically.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  },
});
