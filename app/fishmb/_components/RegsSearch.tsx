"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Know the regs" lake search — submits to the lake directory. */
export function RegsSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) {
      router.push(`/fishmb/lakes?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl mb-8">
      <div className="flex items-center bg-white rounded-full pl-6 pr-2 py-2 shadow-md border border-pine/10">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your lake for its regulations…"
          aria-label="Search your lake"
          className="flex-1 bg-transparent outline-none px-3 py-2 text-pine placeholder:text-pine/40"
        />
        <button
          type="submit"
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full transition-colors"
        >
          Search
        </button>
      </div>
      <p className="text-xs text-pine/50 mt-2 ml-2">
        Pick your lake from the results to see its full 2026 limits table.
      </p>
    </form>
  );
}
