"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FISHMB_HERO_PHOTO } from "@/lib/fishmb-constants";

interface LakeHit {
  id: string;
  name: string;
  region: string;
  species: string[];
  stocked: boolean;
  photo: string | null;
}

interface LodgeHit {
  id: string;
  name: string;
  kind: string;
  location: string;
}

export default function SearchHero() {
  const [q, setQ] = useState("");
  const [lakes, setLakes] = useState<LakeHit[]>([]);
  const [lodges, setLodges] = useState<LodgeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const runSearch = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setLakes([]);
      setLodges([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fishmb/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setLakes(data.lakes ?? []);
        setLodges(data.lodges ?? []);
        setOpen(true);
      } catch {
        setLakes([]);
        setLodges([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  };

  const hasResults = lakes.length > 0 || lodges.length > 0;

  return (
    <section className="relative overflow-hidden bg-pine-deep" aria-label="Search Manitoba fishing">
      {/* backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FISHMB_HERO_PHOTO}
        alt="Wooden dock on a calm Manitoba lake"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-pine-deep/90 via-pine-deep/55 to-pine-deep/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-pine-deep/70 to-transparent" />

      <div className="relative max-w-4xl mx-auto px-4 pt-12 pb-14 md:pt-16 md:pb-20 text-center">
        <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
          Manitoba fishing, all in one place
        </p>
        <h1 className="font-display font-bold uppercase text-white leading-[0.95] tracking-wide text-4xl md:text-6xl mb-4">
          Find your next bite.
        </h1>
        <p className="text-white/85 text-base md:text-lg max-w-2xl mx-auto mb-6">
          Search your lake or lodge for fishing regulations, stocking info,
          nearby towns and more.
        </p>

        <div ref={boxRef} className="relative max-w-2xl mx-auto text-left">
          <div className="flex items-center bg-white rounded-full pl-6 pr-2 py-2 shadow-2xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-pine/50 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => runSearch(e.target.value)}
              onFocus={() => hasResults && setOpen(true)}
              placeholder="Search 271 lakes or 127 lodges — try “Winnipeg”, “walleye”…"
              className="flex-1 bg-transparent outline-none px-3 py-2.5 text-pine placeholder:text-pine/40 text-base md:text-lg"
              aria-label="Search lakes and lodges"
            />
            {loading && (
              <span className="text-pine/40 text-sm pr-3 animate-pulse">…</span>
            )}
          </div>

          {open && (
            <div className="absolute inset-x-0 top-full mt-2 bg-white rounded-2xl shadow-2xl overflow-hidden z-30 max-h-[60vh] overflow-y-auto">
              {lakes.length > 0 && (
                <div className="py-2">
                  <p className="px-5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-pine/40">
                    Lakes
                  </p>
                  {lakes.map((l) => (
                    <Link
                      key={l.id}
                      href={`/fishmb/lakes/${l.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper-deep transition-colors"
                    >
                      <span className="w-9 h-9 rounded-lg bg-pine/10 flex items-center justify-center shrink-0 text-pine font-bold">
                        ≋
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-pine truncate">
                          {l.name}
                          {l.stocked && (
                            <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-white bg-[#5E8F3E] rounded px-1.5 py-0.5 align-middle">
                              Stocked
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-pine/50 truncate">
                          {l.region} · {l.species.slice(0, 3).join(", ")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {lodges.length > 0 && (
                <div className="py-2 border-t border-pine/10">
                  <p className="px-5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-pine/40">
                    Lodges &amp; guides
                  </p>
                  {lodges.map((l) => (
                    <Link
                      key={l.id}
                      href={`/fishmb/lodges/${l.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper-deep transition-colors"
                    >
                      <span className="w-9 h-9 rounded-lg bg-gold/15 flex items-center justify-center shrink-0 text-gold font-bold">
                        ⌂
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-pine truncate">{l.name}</span>
                        <span className="block text-xs text-pine/50 truncate capitalize">
                          {l.kind} · {l.location}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {!hasResults && !loading && (
                <p className="px-5 py-4 text-sm text-pine/50">
                  No matches for “{q}”. Try a lake, town, species or lodge name.
                </p>
              )}
              {hasResults && (
                <Link
                  href={`/fishmb/lakes?q=${encodeURIComponent(q)}`}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-3 text-sm font-bold text-signal uppercase tracking-wider border-t border-pine/10 hover:bg-paper-deep"
                >
                  See all results →
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2.5 mt-6">
          {["Lake Winnipeg", "Walleye", "Red River", "Stocked trout"].map((s) => (
            <button
              key={s}
              onClick={() => runSearch(s)}
              className="text-sm text-white/85 border border-white/30 rounded-full px-4 py-1.5 hover:bg-white/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
