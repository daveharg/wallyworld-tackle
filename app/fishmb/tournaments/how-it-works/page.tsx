import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How tournaments work | FishMB",
  description:
    "Learn how FishMB fishing tournaments work — creating, joining, logging catches, anti-cheat, organizer review, and the manage dashboard.",
};

const steps = [
  {
    n: "1",
    title: "Create your tournament",
    body: "Name it, pick your dates, waters and species, set the rules, entry fee and prize payouts. You'll get a private invite code and a shareable link — only people with the link can join.",
  },
  {
    n: "2",
    title: "Invite your anglers",
    body: "Share the link by text, social, or word of mouth. Anglers see the full tournament details first, then create a free FishMB account and join with one tap — the invite code is already in the link.",
  },
  {
    n: "3",
    title: "Anglers log catches",
    body: "During the tournament window, anglers photograph each catch in the app. The phone's capture timestamp is the official catch time, and every entry is GPS-stamped.",
  },
  {
    n: "4",
    title: "You review every fish",
    body: "Catches land in your review queue on the manage dashboard. Approve the legit ones, reject the rest — only approved catches hit the leaderboard. Turn on auto-approve if you'd rather skip review.",
  },
  {
    n: "5",
    title: "Crown a winner",
    body: "The live leaderboard ranks anglers by your scoring rule as approved catches come in. Settle up prizes yourself — entry fees stay manual and off-platform.",
  },
];

const cheat = [
  {
    title: "Phone-timestamped photos",
    body: "The official catch time comes from the phone's camera capture — not when the entry is uploaded. Late uploads of in-window catches still count; backdated ones get flagged.",
  },
  {
    title: "Tournament-waters check",
    body: "When your tournament names specific lakes, every entry's GPS is measured against those waters. Catches logged far from the chosen lakes are flagged for your review — along with how far away they were caught.",
  },
  {
    title: "Manitoba GPS check",
    body: "Every entry's location is verified against Manitoba waters. Catches logged outside Manitoba are rejected automatically.",
  },
  {
    title: "Duplicate-photo detection",
    body: "Each photo is fingerprinted twice: an exact match catches the same image submitted again, and a perceptual match catches the same fish photographed from a different angle. Same species, near-identical length, caught minutes apart by one angler is flagged too.",
  },
  {
    title: "Organizer review",
    body: "Nothing reaches the leaderboard until the organizer approves it (unless auto-approve is on). Suspicious entries stay in the review queue.",
  },
];

const dashboard = [
  {
    title: "Edit everything",
    body: "Fix details, dates, waters, entry fees and payouts any time — one save updates the whole tournament.",
  },
  {
    title: "Invite anglers",
    body: "Your invite code, a copy-link button and native phone sharing, all in one place.",
  },
  {
    title: "Entry fees",
    body: "For paid tournaments: see every angler and tap to confirm who's paid. Anglers see their payment confirmation on the tournament page. (You collect the money directly — FishMB never touches it.)",
  },
  {
    title: "Review queue",
    body: "Every submitted catch with its photos, species, length, GPS stamp and capture time. Catches outside your tournament waters are flagged with how far away they were caught. Approve or reject each one, and see everything you've already reviewed.",
  },
  {
    title: "Entry keys",
    body: "Hand out single-use entry keys for extra control over who can submit catches.",
  },
  {
    title: "Live leaderboard",
    body: "Watch the standings update as you approve catches.",
  },
];

export default function HowTournamentsWorkPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">
        Organizers
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-4">
        How tournaments work
      </h1>
      <p className="text-pine/65 mb-10 max-w-2xl">
        Real anti-cheat on every catch — phone-timestamped photos, GPS stamps,
        tournament-waters checks, duplicate-photo detection and organizer
        review. No entry caps, no platform cut, and FishMB never touches the
        money.
      </p>

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-6">
        Anti-cheat, built in
      </h2>
      <div className="grid md:grid-cols-2 gap-4 mb-14">
        {cheat.map((c) => (
          <div
            key={c.title}
            className="bg-pine/[0.04] border border-pine/10 rounded-2xl p-6"
          >
            <h3 className="font-bold text-pine mb-1.5">{c.title}</h3>
            <p className="text-pine/65 text-sm leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-2xl p-6 mb-14 max-w-2xl">
        <p className="font-display font-bold uppercase text-pine tracking-wide mb-3">
          Example: a June friends challenge
        </p>
        <p className="text-pine/70 text-sm leading-relaxed">
          Say you and five friends want to compete all through June for the
          longest walleye. One of you creates the tournament — name it, set the
          dates to June 1–30, pick your lakes (or leave it open to any Manitoba
          water), choose longest-fish scoring, and set a $20 entry fee. Share
          the invite code in the group chat and everyone joins.
        </p>
        <p className="text-pine/70 text-sm leading-relaxed mt-3">
          All June, whenever anyone lands a walleye, they snap its photo in the
          app — the GPS location and capture time are stamped automatically —
          and submit it as an entry. You approve catches as the organizer (or
          turn on auto-approve), the leaderboard updates all month, and on June
          30 the longest fish takes the pot. Entry money stays between you and
          your friends — cash, e-transfer, whatever you agree on.
        </p>
      </div>

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-6">
        Running a tournament
      </h2>
      <div className="space-y-4 mb-14">
        {steps.map((s) => (
          <div
            key={s.n}
            className="bg-white border border-pine/10 rounded-2xl p-6 flex gap-5"
          >
            <span className="shrink-0 w-10 h-10 rounded-lg bg-signal text-white font-display font-bold text-lg flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <h3 className="font-bold text-pine text-lg mb-1">{s.title}</h3>
              <p className="text-pine/65 text-sm leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-6">
        Your manage dashboard
      </h2>
      <p className="text-pine/65 text-sm mb-6 max-w-2xl">
        Every tournament you organize gets a private dashboard — only you can
        see it. Here&apos;s what&apos;s inside:
      </p>
      <div className="space-y-4 mb-14">
        {dashboard.map((d) => (
          <div
            key={d.title}
            className="bg-white border border-pine/10 rounded-2xl p-6"
          >
            <h3 className="font-bold text-pine mb-1">{d.title}</h3>
            <p className="text-pine/65 text-sm leading-relaxed">{d.body}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-6">
        Money
      </h2>
      <p className="text-pine/65 text-sm leading-relaxed mb-4 max-w-2xl">
        Entry fees are collected by you, directly from your anglers — cash,
        e-transfer, whatever you agree on. FishMB never handles tournament
        money and takes no cut of the prize pot. The prize breakdown you set
        when creating the tournament is shown to every angler up front.
      </p>
      <p className="text-pine/65 text-sm leading-relaxed mb-14 max-w-2xl">
        For paid tournaments, your manage dashboard tracks who&apos;s paid:
        tap to confirm each angler once their money is in, and they&apos;ll see
        the confirmation on the tournament page.
      </p>

      <div className="bg-signal/10 border border-signal/40 rounded-2xl p-6 mb-10 max-w-2xl">
        <p className="font-bold text-pine uppercase tracking-wider text-xs mb-1.5">
          Know the law
        </p>
        <p className="text-pine/70 text-sm leading-relaxed">
          In Manitoba, fishing tournaments with{" "}
          <strong>more than 25 participants</strong> need a provincial
          tournament licence.{" "}
          <a
            href="https://www.manitobaelicensing.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal-dark font-bold underline"
          >
            Get a licence at manitobaelicensing.ca
          </a>
          .
        </p>
        <p className="text-pine/55 text-xs mt-2">
          FishMB is a listings and leaderboard tool only — organizers are
          responsible for running a legal event. We are not responsible if you
          break the law.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/fishmb/tournaments/create"
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          Create a tournament
        </Link>
        <Link
          href="/fishmb/tournaments"
          className="border-2 border-pine/20 hover:border-pine/40 text-pine font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
        >
          Browse tournaments
        </Link>
      </div>
    </div>
  );
}
