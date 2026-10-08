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
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "tournaments", label: "Tournaments", icon: "🏆" },
  { id: "licence", label: "Licence", icon: "🪪" },
  { id: "settings", label: "Settings", icon: "⚙️" },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`aspect-square rounded-3xl border flex flex-col items-center justify-center gap-2 transition-colors ${
              tab === t.id
                ? "bg-pine text-white border-pine shadow-lg"
                : "bg-white text-pine border-pine/10 hover:border-signal/40"
            }`}
          >
            <span className="text-4xl leading-none">{t.icon}</span>
            <span className="font-bold uppercase tracking-wider text-xs">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "stats" && <DashboardStats />}
      {tab === "tournaments" && <DashboardTournaments />}
      {tab === "licence" && <DashboardLicence />}
      {tab === "settings" && <DashboardSettings />}
    </div>
  );
}
