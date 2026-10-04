import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const GOOGLE_ENABLED = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    // We use a modal instead of dedicated auth pages; keep the fallback minimal.
    signIn: "/",
    error: "/",
  },
  providers: [
    ...(GOOGLE_ENABLED
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Link/create the DB user for Google OAuth logins.
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase();
        const googleId = account.providerAccountId;
        let dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name ?? null,
              googleId,
              loyalty: { create: {} },
            },
          });
        } else {
          const updates: { googleId?: string; name?: string } = {};
          if (!dbUser.googleId) updates.googleId = googleId;
          if (!dbUser.name && user.name) updates.name = user.name;
          if (Object.keys(updates).length > 0) {
            dbUser = await prisma.user.update({ where: { id: dbUser.id }, data: updates });
          }
          // Ensure a loyalty row exists for older accounts.
          await prisma.loyaltyPoints.upsert({
            where: { userId: dbUser.id },
            update: {},
            create: { userId: dbUser.id },
          });
        }
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
