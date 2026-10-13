"use client";

// "Give a recommendation" box — lands in the admin dashboard's
// Recommendations tab. Works signed in or anonymously (name/email
// optional when signed out; the account supplies them when signed in).

import { useState } from "react";
import { fishFetch } from "./fishFetch";
import { useFishAuth } from "./FishAuth";

const KIND_LABELS: Record<string, string> = {
  general: "General recommendation",
  lake: "A lake",
  lodge: "A lodge or resort",
  guide: "A guide or outfitter",
  feature: "An app feature",
  correction: "A correction",
};

export default function RecommendBox({
  kind = "general",
  subject = "",
  heading = "💡 Recommend something",
  blurb = "A lake we're missing, a lodge or guide anglers should know about, a feature you'd love — send it in. Every recommendation lands on the FishMB team's desk.",
}: {
  kind?: string;
  subject?: string;
  heading?: string;
  blurb?: string;
}) {
  const { user } = useFishAuth();
  const [chosenKind, setChosenKind] = useState(kind);
  const [subjectText, setSubjectText] = useState(subject);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (message.trim().length < 3) {
      setError("Tell us the recommendation first.");
      setState("error");
      return;
    }
    setState("sending");
    setError("");
    try {
      await fishFetch("/api/fishmb/recommendations", {
        method: "POST",
        body: JSON.stringify({
          kind: chosenKind,
          subject: subjectText.trim(),
          message: message.trim(),
          name: name.trim(),
          page: window.location.pathname,
        }),
      });
      setState("sent");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send — try again.");
      setState("error");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-pine/20 px-3.5 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:ring-2 focus:ring-signal/50 bg-white";
  const labelCls = "block text-xs font-bold uppercase tracking-wide text-pine/60 mb-1.5";

  return (
    <section id="recommend" className="bg-lake-mist border border-pine/10 rounded-3xl px-5 py-6 sm:px-7">
      <h2 className="font-display font-bold uppercase text-pine text-xl">{heading}</h2>
      <p className="text-sm text-pine/70 mt-1.5 mb-5">{blurb}</p>

      {state === "sent" ? (
        <div className="bg-white border border-pine/15 rounded-2xl px-5 py-5 text-center">
          <p className="text-2xl mb-1">🎣</p>
          <p className="font-bold text-pine">Got it — thanks!</p>
          <p className="text-sm text-pine/60 mt-1">
            Your recommendation is on the team's desk.
          </p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="mt-3 text-sm font-bold text-signal-dark underline"
          >
            Send another
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="rec-kind">What kind?</label>
              <select
                id="rec-kind"
                value={chosenKind}
                onChange={(e) => setChosenKind(e.target.value)}
                className={inputCls}
              >
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="rec-subject">Name / title</label>
              <input
                id="rec-subject"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                placeholder="e.g. the lake, lodge, or feature name"
                className={inputCls}
                maxLength={200}
              />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="rec-message">Your recommendation</label>
            <textarea
              id="rec-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Tell us about it — where it is, why anglers will love it, a link if you have one…"
              className={inputCls}
              maxLength={3000}
            />
          </div>
          {!user && (
            <div>
              <label className={labelCls} htmlFor="rec-name">Your name (optional)</label>
              <input
                id="rec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="So we know who to thank"
                className={inputCls}
                maxLength={80}
              />
            </div>
          )}
          {state === "error" && <p className="text-sm font-semibold text-red-700">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={state === "sending"}
            className="bg-signal text-pine-dark font-display font-bold uppercase tracking-wide text-sm rounded-full px-6 py-3 disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : "Send recommendation"}
          </button>
        </div>
      )}
    </section>
  );
}
