// Angler dashboard — your private fishing HQ: stats, spots, lake notes, settings.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import DashboardStats from "./_components/DashboardStats";
import DashboardSettings from "./_components/DashboardSettings";
import DashboardLicence from "./_components/DashboardLicence";
import DashboardTournaments from "./_components/DashboardTournaments";

const TABS = [
  { id: "stats", label: "📊 Stats" },
  { id: "tournaments", label: "🏆 Tournaments" },
  { id: "settings", label: "⚙️ Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardPage() {
  const { user, openLogin } = useFishAuth();
  const [tab, setTab] = useState<TabId>("stats");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Dashboard
        </h1>
        <p className="text-pine/60 mb-6">
          Log in to see your stats and settings.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Angler HQ
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        Dashboard
      </h1>

      <div className="flex gap-2 pb-2 mb-8 sticky top-16 z-10 bg-paper/95 backdrop-blur py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 md:flex-none whitespace-nowrap font-bold uppercase tracking-wider text-xs md:text-sm px-2 py-2 md:px-5 md:py-2.5 rounded-full transition-colors ${
              tab === t.id
                ? "bg-pine text-white"
                : "bg-pine/10 text-pine hover:bg-pine/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <DashboardStats />}
      {tab === "tournaments" && <DashboardTournaments />}
      {tab === "settings" && <DashboardSettings />}

      <DashboardLicence />
    </div>
  );
}
