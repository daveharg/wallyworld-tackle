"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Hit {
  id: string;
  name: string;
  region: string;
}

/** Lake search at the top of the regulations page — jumps straight to the lake page. */
export function LakeSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onChange = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fishmb/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setHits((data.lakes ?? []).slice(0, 8));
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 220);
  };

  return (
    <div ref={boxRef} className="relative max-w-xl mb-10">
      <div className="flex items-center bg-pine border border-pine-deep rounded-full pl-5 pr-2 py-1.5 shadow-sm focus-within:border-gold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/70 shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search your lake for its regulations…"
          className="flex-1 bg-transparent outline-none px-3 py-2 text-white placeholder:text-white/50"
          aria-label="Search lakes"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute inset-x-0 top-full mt-2 bg-white rounded-2xl shadow-2xl overflow-hidden z-30 border border-pine/10">
          {hits.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push(`/fishmb/lakes/${l.id}`)}
              className="w-full text-left px-5 py-3 hover:bg-paper-deep transition-colors border-b border-pine/5 last:border-0"
            >
              <span className="block font-bold text-pine">{l.name}</span>
              <span className="block text-xs text-pine/50">{l.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
