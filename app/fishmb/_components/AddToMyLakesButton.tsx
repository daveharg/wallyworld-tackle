// "Add to My Lakes" — saves a lake to the signed-in angler's favourite
// lakes (the Maps → Lakes tab list). Shows "In My Lakes" when already saved.

"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "./fishFetch";

type State = "loading" | "add" | "saving" | "saved" | "error";

export default function AddToMyLakesButton({
  lakeId,
  className = "",
}: {
  lakeId: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await fishFetch("/api/fishmb/favorite-lakes");
        const lakes = (f.lakes ?? []) as { id: string }[];
        if (!cancelled) setState(lakes.some((l) => l.id === lakeId) ? "saved" : "add");
      } catch {
        // Signed out or offline — still show the button; a failed add
        // surfaces the error state on tap.
        if (!cancelled) setState("add");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lakeId]);

  const add = async () => {
    if (state !== "add" && state !== "error") return;
    setState("saving");
    try {
      await fishFetch("/api/fishmb/favorite-lakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lake_id: lakeId }),
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  if (state === "loading") return null;

  if (state === "saved") {
    return (
      <div
        className={`text-center bg-pine/10 text-pine text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-full ${className}`}
      >
        ✓ In My Lakes
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === "saving"}
      className={`bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-full disabled:opacity-40 transition-colors ${className}`}
    >
      {state === "saving"
        ? "Adding…"
        : state === "error"
          ? "Couldn't add — sign in and try again"
          : "＋ Add to My Lakes"}
    </button>
  );
}
