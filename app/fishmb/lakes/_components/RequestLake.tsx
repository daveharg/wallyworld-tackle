"use client";

import { useState } from "react";

/** "Missing a lake?" form — saves to fm_lake_requests. */
export function RequestLake() {
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 3) {
      setError("Tell us the lake's name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fishmb/lake-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_name: name.trim(), location_hint: hint.trim(), contact: contact.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send that.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="request-lake" className="mt-16 bg-paper-deep border border-pine/10 rounded-3xl p-6 md:p-8">
      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-2">
        Missing a lake?
      </h2>
      {done ? (
        <p className="text-pine/70">
          Thanks — we&apos;ll research <strong>{name}</strong> and add it to the directory.
        </p>
      ) : (
        <>
          <p className="text-pine/60 text-sm mb-5 max-w-xl">
            We&apos;re still mapping Manitoba&apos;s waters. Tell us what&apos;s missing and
            we&apos;ll add it with regulations, species and nearby services.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lake name *"
              className="bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Where is it? (nearest town, region)"
              className="bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Your email (optional)"
              className="bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
            />
          </div>
          {error && <p className="text-signal-dark text-sm mt-3">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors disabled:opacity-50"
          >
            {busy ? "Sending…" : "Request this lake"}
          </button>
        </>
      )}
    </section>
  );
}
