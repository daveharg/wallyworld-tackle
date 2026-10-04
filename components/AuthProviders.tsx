"use client";

import { SessionProvider } from "next-auth/react";

// Wraps the app so useSession()/signIn()/signOut() work in client components.
export default function AuthProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
