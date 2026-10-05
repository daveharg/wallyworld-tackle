"use client";

import { useState } from "react";

/** Newsletter signup block. */
export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section id="newsletter" className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 scroll-mt-28">
      <div className="rounded-2xl bg-paper-deep border border-pine/10 px-6 py-12 md:py-14 text-center">
        <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-signal/10 text-signal mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide mb-2">
          Get tackle deals in your inbox
        </h2>
        <p className="text-pine/60 max-w-xl mx-auto mb-7">
          New arrivals, restocks and subscriber-only deals. No spam — unsubscribe anytime.
        </p>
        {done ? (
          <p className="font-semibold text-pine">
            You&apos;re in! Watch your inbox for tackle deals.
          </p>
        ) : (
          <form
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.includes("@")) return;
              try {
                await fetch("/api/newsletter", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
              } catch {}
              setDone(true);
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="flex-1 rounded-full bg-white border border-pine/20 px-5 py-3 text-pine placeholder:text-pine/40 outline-none focus:border-signal transition"
            />
            <button
              type="submit"
              className="rounded-full bg-signal hover:bg-signal-dark text-white font-display font-bold uppercase tracking-widest px-8 py-3 transition"
            >
              Subscribe
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
