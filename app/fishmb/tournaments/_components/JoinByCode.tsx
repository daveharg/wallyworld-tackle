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
      router.push(`/fishmb/tournaments/join/${c}`);
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
          className="flex-1 min-w-0 bg-white border border-pine/20 rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-pine placeholder:text-pine/35 focus:outline-none focus:border-signal"
        />
        <button
          onClick={go}
          className="border border-pine/25 text-pine hover:bg-pine/5 font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
        >
          Join
        </button>
      </div>
      {error && <p className="text-signal-dark text-xs mt-1.5 ml-2">{error}</p>}
    </div>
  );
}
