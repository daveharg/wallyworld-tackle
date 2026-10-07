"use client";

import Link from "next/link";
import { useFishAuth } from "./FishAuth";

/** Homepage login CTA — replaces the old "get the app" block. */
export function LoginCtaSection() {
  const { user, openLogin } = useFishAuth();
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 mb-4">
      <div className="relative overflow-hidden rounded-3xl bg-pine-deep">
        <div className="absolute inset-0 bg-gradient-to-r from-pine-deep to-pine-deep/60" />
        <div className="relative px-6 py-12 md:px-12 md:py-16 max-w-2xl">
          <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
            Join the community
          </p>
          <h2 className="font-display font-bold uppercase text-white text-4xl md:text-5xl tracking-wide mb-4">
            Log in to FishMB
          </h2>
          <p className="text-white/80 text-lg mb-8">
            One account for the website and the app — log your catches, join
            the angler feed, and enter contests. Free, and browsing the lakes
            never needs a login.
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <p className="text-white font-bold text-lg">
                You&apos;re logged in as {user.name} — tight lines!
              </p>
            ) : (
              <button
                onClick={openLogin}
                className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
              >
                Log in with Google
              </button>
            )}
            <Link
              href="/fish-manitoba-preview/"
              className="border border-white/40 text-white hover:bg-white/10 font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
            >
              Open the app
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
