// FishMB contact page — report a bug, flag a wrong regulation, or say hi.

"use client";

import { useEffect, useState } from "react";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";

const inputCls =
  "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";

export default function ContactPage() {
  const { user } = useFishAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user && !user.is_anonymous) {
      if (user.name && !name) setName(user.name);
      if (user.email && !email) setEmail(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("That email address doesn't look right.");
    if (message.trim().length < 10)
      return setError("Please write a little more — at least 10 characters.");
    setSending(true);
    try {
      await fishFetch("/api/fishmb/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
        Get in touch
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3">
        Contact us
      </h1>
      <p className="text-pine/65 mb-8">
        Found a bug, a wrong regulation, or just want to say hi? Send it our way.
      </p>

      {sent ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-4xl mb-3">📬</p>
          <p className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-2">
            Message sent
          </p>
          <p className="text-pine/60">Thanks — we read every message.</p>
        </div>
      ) : (
        <div className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8">
          {error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
              {error}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Jane Doe"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                type="email"
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
              Subject <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={160}
              placeholder="e.g. Wrong walleye limit on Lake X"
              className={inputCls}
            />
          </div>
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-1.5">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={3000}
              rows={6}
              placeholder="Tell us what's up…"
              className={`${inputCls} resize-y`}
            />
          </div>
          <button
            onClick={submit}
            disabled={sending}
            className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      )}

      <p className="text-sm text-pine/55 mt-6 text-center">
        For order issues with tackle, use{" "}
        <a
          href="https://www.wallyworldtackle.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal-dark font-bold underline"
        >
          the main store site
        </a>{" "}
        instead.
      </p>
    </div>
  );
}
