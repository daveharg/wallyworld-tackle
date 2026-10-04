import { defineConfig } from "prisma/config";

// Prisma 7: datasource connection strings live here, not in schema.prisma.
// Swap DATABASE_URL to your Vercel Postgres connection string for production.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
