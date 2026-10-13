"use client";

// First-party visit tracker: one session per browser tab session.
// Sends a "start" on mount, a heartbeat "ping" every 20s while the
// app is visible (with a page view whenever the path changes), and an
// "end" stamp when the tab hides or closes — that's how the admin
// Visits tab knows how long people stayed. No third-party trackers.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

const ENDPOINT = "/api/fishmb/track";
const SESSION_KEY = "fishmb-visit-session";

function send(sessionId: string, event: "start" | "ping" | "end", path: string, newView: boolean) {
  try {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ session_id: sessionId, event, path, new_view: newView }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking is best-effort only.
  }
}

export default function VisitTracker() {
  const pathname = usePathname();
  const sessionRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    sessionRef.current = id;
    lastPathRef.current = window.location.pathname;
    send(id, "start", lastPathRef.current, true);

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || !sessionRef.current) return;
      const path = window.location.pathname;
      const changed = path !== lastPathRef.current;
      lastPathRef.current = path;
      send(sessionRef.current, "ping", path, changed);
    }, 20_000);

    const onHide = () => {
      if (sessionRef.current) send(sessionRef.current, "end", window.location.pathname, false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Route changes count as page views right away (not just on heartbeat).
  useEffect(() => {
    if (!pathname || !sessionRef.current) return;
    if (lastPathRef.current && pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      send(sessionRef.current, "ping", pathname, true);
    }
  }, [pathname]);

  return null;
}
