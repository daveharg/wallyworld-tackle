// Angler dashboard — your private fishing HQ: stats, spots, lake notes, settings.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import DashboardStats from "./_components/DashboardStats";
import DashboardProfile from "./_components/DashboardProfile";
import DashboardLicence from "./_components/DashboardLicence";
import DashboardTournaments from "./_components/DashboardTournaments";
import BackArrow from "../_components/BackArrow";

const TABS = [
 { id: "stats", label: "Stats", icon: "" },
 { id: "tournaments", label: "Tournaments", icon: "" },
 { id: "licence", label: "Licence", icon: "" },
 { id: "profile", label: "Profile", icon: "" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardPage() {
  const { user, openLogin } = useFishAuth();
  const searchParams = useSearchParams();
  const initialTab = ((): TabId => {
    const t = searchParams.get("tab");
    return t === "tournaments" || t === "licence" || t === "profile" ? t : "stats";
  })();
  const [tab, setTab] = useState<TabId>(initialTab);
  // Friend-request badge on the Profile tab — the trail from the bottom
  // bar's badge leads here (requests live at the top of the Profile tab).
  const [friendReqCount, setFriendReqCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fishFetch("/api/fish/friends")
      .then((d) =>
        setFriendReqCount(
          ((d as { pending_incoming?: unknown[] }).pending_incoming ?? []).length
        )
      )
      .catch(() => {});
  }, [user]);

  // Keep the tab in sync when navigating with ?tab= (e.g. the bottom-bar
  // Tournaments shortcut) while already on this page.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "tournaments" || t === "licence" || t === "profile" || t === "stats") {
      setTab(t);
    }
  }, [searchParams]);

  if (!user) {
    const perks = [
      {
 icon: "",
        title: "Your angler stats",
        text: "Total catches, species count, personal bests and how you stack up against friends — all tracked automatically from your catch log.",
      },
      {
 icon: "",
        title: "Catch history",
        text: "Every fish you've logged, with photos, lengths, locations and dates. Your lifetime record on the water.",
      },
      {
 icon: "",
        title: "Tournament record",
        text: "Events you've joined or organized, your finishes, and live leaderboards for tournaments running now.",
      },
      {
 icon: "",
        title: "Profile & settings",
        text: "Your public angler profile, privacy controls, notification preferences and account settings live here.",
      },
    ];
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-3">
          Your angler HQ
        </h1>
        <p className="text-pine/60 text-sm mb-6">
          The dashboard is your personal fishing record — stats, catches,
          tournaments and settings in one place.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full mb-8"
        >
          Log in — it's free
        </button>
        <div className="flex flex-col gap-3 text-left">
          {perks.map((p) => (
            <div
              key={p.title}
              className="bg-white border border-pine/10 rounded-2xl px-4 py-3.5 flex items-start gap-3"
            >
              <span className="text-2xl shrink-0">{p.icon}</span>
              <span>
                <span className="block text-sm font-black text-pine">{p.title}</span>
                <span className="block text-xs text-pine/65 leading-snug mt-0.5">{p.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <BackArrow />
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        Angler HQ
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative rounded-3xl border flex flex-col items-center justify-center gap-1.5 py-5 transition-colors ${
              tab === t.id
                ? "bg-pine text-white border-pine shadow-lg"
                : "bg-white text-pine border-pine/10 hover:border-signal/40"
            }`}
          >
            <span className="text-3xl leading-none">{t.icon}</span>
            <span className="font-bold uppercase tracking-wider text-xs">{t.label}</span>
            {t.id === "profile" && friendReqCount > 0 && (
              <span className="absolute top-2.5 right-2.5 min-w-[22px] h-[22px] px-1 rounded-full bg-signal text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                {friendReqCount > 99 ? "99+" : friendReqCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "stats" && <DashboardStats />}
      {tab === "tournaments" && <DashboardTournaments />}
      {tab === "licence" && <DashboardLicence />}
      {tab === "profile" && <DashboardProfile />}
    </div>
  );
}
