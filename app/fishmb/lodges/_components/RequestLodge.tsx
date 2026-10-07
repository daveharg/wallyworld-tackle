"use client";

import { useState } from "react";
import { useFishAuth } from "../../_components/FishAuth";

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal";

/** "Missing a lodge?" + guide self-listing — saves to fm_lodge_requests. */
export function RequestLodge() {
  const { user, openLogin } = useFishAuth();
  const [mode, setMode] = useState<"request" | "list">("request");
  const [businessName, setBusinessName] = useState("");
  const [kind, setKind] = useState<"lodge" | "guide">("lodge");
  const [location, setLocation] = useState("");
  const [waters, setWaters] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (businessName.trim().length < 3) {
      setError("Tell us the business name.");
      return;
    }
    if (mode === "list") {
      if (!user) {
        openLogin();
        return;
      }
      if (!contact.trim()) {
        setError("Add a way for anglers to reach you.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fishmb/lodge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          kind,
          location: location.trim(),
          waters: waters.trim(),
          contact: contact.trim(),
          description: description.trim(),
          self_listed: mode === "list",
        }),
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
    <section className="mt-16 bg-paper-deep border border-pine/10 rounded-3xl p-6 md:p-8">
      <div className="flex gap-2 mb-5">
        {(
          [
            ["request", "Missing a lodge?"],
            ["list", "List your business"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => {
              setMode(v);
              setDone(false);
            }}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              mode === v ? "bg-pine text-white" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-2">
        {mode === "request" ? "Missing a lodge or guide?" : "Are you a guide or lodge?"}
      </h2>
      {done ? (
        <p className="text-pine/70">
          Thanks — {mode === "list"
            ? "we'll review your listing and add it to the directory."
            : `we'll research ${businessName} and add it to the directory.`}
        </p>
      ) : (
        <>
          <p className="text-pine/60 text-sm mb-5 max-w-xl">
            {mode === "request"
              ? "Know a lodge or guide that should be listed? Tell us and we'll verify and add them."
              : "Run a guiding business or lodge in Manitoba? List it here — every submission is verified before it goes live."}
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name *" className={inputCls} />
            <select value={kind} onChange={(e) => setKind(e.target.value as "lodge" | "guide")} className={inputCls} aria-label="Business type">
              <option value="lodge">Lodge / resort</option>
              <option value="guide">Fishing guide</option>
            </select>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Town / area" className={inputCls} />
            <input value={waters} onChange={(e) => setWaters(e.target.value)} placeholder="Waters you fish (e.g. Lake Winnipeg)" className={inputCls} />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={mode === "list" ? "Contact (phone/email/website) *" : "Contact (optional)"} className={`${inputCls} sm:col-span-2`} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What do you offer? (species, trips, lodging…)" className={`${inputCls} sm:col-span-2 resize-none`} />
          </div>
          {error && <p className="text-signal-dark text-sm mt-3">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full disabled:opacity-50 transition-colors"
          >
            {busy ? "Sending…" : mode === "list" ? (user ? "Submit my listing" : "Log in & submit") : "Send request"}
          </button>
        </>
      )}
    </section>
  );
}
