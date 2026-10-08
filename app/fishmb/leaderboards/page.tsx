// FishMB species leaderboards — best fishers, biggest fish, most fish,
// most Master Anglers, and above-average fish, all with the 4-biggest-per-day
// anti-farming rule.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../_components/fishFetch";

type Category = "best" | "biggest" | "most" | "masters" | "above";

const CATEGORIES: { key: Category; icon: string; label: string; unit: string }[] = [
  { key: "best", icon: "🏆", label: "Best fishers", unit: "total inches" },
  { key: "biggest", icon: "📏", label: "Biggest fish", unit: "inches" },
  { key: "most", icon: "🎣", label: "Most fish", unit: "fish" },
  { key: "masters", icon: "🎖️", label: "Most Masters", unit: "masters" },
  { key: "above", icon: "⭐", label: "Above average", unit: "fish" },
];

interface Row {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  value: number;
  extra?: { species: string; date: string | null };
}

interface SpeciesTab {
  key: string;
  display: string;
  count: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="w-11 h-11 rounded-full object-cover bg-pine/10" />;
  }
  return (
    <span className="w-11 h-11 rounded-full bg-pine text-white flex items-center justify-center font-bold text-sm shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function LeaderboardsPage() {
  const [species, setSpecies] = useState("all");
  const [category, setCategory] = useState<Category>("best");
  const [minLength, setMinLength] = useState(20);
  const [rows, setRows] = useState<Row[]>([]);
  const [tabs, setTabs] = useState<SpeciesTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ species, category, min_length: String(minLength) });
    fishFetch(`/api/fishmb/leaderboards?${q}`)
      .then((d) => {
        setRows((d as { rows: Row[] }).rows ?? []);
        setTabs((d as { species: SpeciesTab[] }).species ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [species, category, minLength]);

  const unit = CATEGORIES.find((c) => c.key === category)?.unit ?? "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Bragging rights
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3">
        Leaderboards
      </h1>
      <p className="text-pine/60 text-sm max-w-2xl mb-8">
        Ranked from public catches and approved tournament fish. Anti-farming
        rule: only each angler&apos;s <strong>4 biggest fish per day</strong>{" "}
        count toward the totals.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
              category === c.key
                ? "bg-pine text-white"
                : "bg-white border border-pine/15 text-pine/70 hover:border-pine/40"
            }`}
          >
            <span>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      {/* Species tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <button
          onClick={() => setSpecies("all")}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
            species === "all"
              ? "bg-signal text-white"
              : "bg-white border border-pine/15 text-pine/70 hover:border-pine/40"
          }`}
        >
          All species
        </button>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSpecies(t.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              species === t.key
                ? "bg-signal text-white"
                : "bg-white border border-pine/15 text-pine/70 hover:border-pine/40"
            }`}
          >
            {t.display} · {t.count}
          </button>
        ))}
      </div>

      {/* Above-average threshold */}
      {category === "above" && (
        <div className="flex items-center gap-3 bg-gold/15 border border-gold/40 rounded-2xl px-5 py-4 mb-6">
          <label htmlFor="minlen" className="text-sm font-bold text-pine">
            Count fish at least
          </label>
          <input
            id="minlen"
            type="number"
            min={0}
            max={120}
            step={0.5}
            value={minLength}
            onChange={(e) => setMinLength(Math.min(120, Math.max(0, Number(e.target.value) || 0)))}
            className="w-24 bg-white border border-pine/20 rounded-xl px-3 py-2 text-pine font-bold focus:outline-none focus:border-signal"
          />
          <span className="text-sm font-bold text-pine">inches long</span>
        </div>
      )}

      {/* Rankings */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-pine/5 rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60">No qualifying fish yet — log a catch to take the lead.</p>
        </div>
      ) : (
        <ol className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-pine/10" : ""} ${
                i < 3 ? "bg-gold/10" : ""
              }`}
            >
              <span
                className={`font-display font-bold text-xl w-8 text-center shrink-0 ${
                  i === 0 ? "text-gold" : i === 1 ? "text-pine/60" : i === 2 ? "text-signal-dark" : "text-pine/35"
                }`}
              >
                {i + 1}
              </span>
              <Avatar name={r.user_name} url={r.avatar_url} />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/fishmb/anglers/${r.user_id}`}
                  className="font-bold text-pine text-sm hover:text-signal-dark truncate block"
                >
                  {r.user_name}
                </Link>
                {r.extra && (
                  <p className="text-xs text-pine/50">
                    {r.extra.species}
                    {r.extra.date ? ` · ${formatDate(r.extra.date)}` : ""}
                  </p>
                )}
              </div>
              <span className="text-right shrink-0">
                <span className="font-display font-bold text-pine text-xl">
                  {category === "best" || category === "biggest"
                    ? `${Number(r.value).toFixed(1)}″`
                    : Math.round(r.value)}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-pine/45">
                  {unit}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
