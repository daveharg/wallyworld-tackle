"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinByCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const go = async () => {
    setError(null);
    const c = code.trim().toUpperCase();
    if (!c) return;
    try {
      const res = await fetch(`/api/fishmb/tournaments/by-code/${encodeURIComponent(c)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code not found.");
      // Entry keys join in one step — pass the key so the join page redeems it.
      const dest = data.entry_key
        ? `/fishmb/tournaments/join/${c}?key=${encodeURIComponent(data.entry_key)}`
        : `/fishmb/tournaments/join/${c}`;
      router.push(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code not found.");
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Invite code"
          maxLength={8}
          className="flex-1 min-w-0 bg-white border border-pine/20 rounded-lg px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-pine placeholder:text-pine/35 focus:outline-none focus:border-signal"
        />
        <button
          onClick={go}
          className="bg-white border-2 border-pine/15 hover:border-pine/40 text-pine font-black uppercase tracking-widest text-sm px-8 py-4 rounded-lg shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_2px_0_rgba(0,0,0,0.08)] hover:translate-y-[2px] transition-all"
        >
          Join
        </button>
      </div>
      {error && <p className="text-signal-dark text-xs mt-1.5 ml-2">{error}</p>}
    </div>
  );
}
