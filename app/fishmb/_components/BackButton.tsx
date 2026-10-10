"use client";

import { useRouter } from "next/navigation";

/** Back button that returns to the previous page in history. */
export default function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-pine/60 hover:text-pine font-bold text-sm mb-6 transition-colors"
    >
      <span className="text-lg leading-none">‹</span> {label}
    </button>
  );
}
