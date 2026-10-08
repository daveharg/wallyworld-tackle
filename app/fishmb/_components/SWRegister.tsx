"use client";

import { useEffect } from "react";

/** Registers the FishMB service worker (PWA installability). */
export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/fishmb/sw.js").catch(() => {
        // Not fatal — the site works fine without it.
      });
    }
  }, []);
  return null;
}
