"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Forces the window back to the top on every route change, so page titles
 * are never cut off under the sticky header after clicking a nav link.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // "instant" avoids fighting the global smooth scroll-behavior.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
