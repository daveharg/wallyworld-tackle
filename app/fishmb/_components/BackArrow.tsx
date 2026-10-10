"use client";

import { useRouter } from "next/navigation";

/** Top-left back arrow for mobile pages. */
export default function BackArrow() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-pine active:scale-95 transition-transform"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
