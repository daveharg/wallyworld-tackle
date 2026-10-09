// Own profile — Instagram-style public view. Private organization
// (spots, lake notes, stats, settings) lives in the dashboard.

"use client";

import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import ProfileView from "./_components/ProfileView";
import StatsPrivacyEditor from "./_components/StatsPrivacyEditor";

export default function ProfilePage() {
  const { user, openLogin } = useFishAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Your profile
        </h1>
        <p className="text-pine/60 mb-6">
          Log in to see your profile, catches and friends.
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

  const isBusiness =
    (user as { account_type?: string }).account_type === "business";

  return (
    <>
      {isBusiness && (
        <div className="max-w-3xl mx-auto px-4 pt-10">
          <Link
            href="/fishmb/business/dashboard"
            className="flex items-center justify-between gap-4 bg-pine hover:bg-pine-deep text-white rounded-3xl p-5 transition-colors"
          >
            <div>
              <p className="font-display font-bold uppercase text-xl tracking-wide">
                💼 Business dashboard
              </p>
              <p className="text-white/70 text-sm mt-1">
                Classified listings, booking requests, tournaments, business page & ads —
                all in one place.
              </p>
            </div>
            <span className="text-2xl shrink-0">→</span>
          </Link>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Link
          href="/fishmb/dashboard"
          className="flex items-center justify-between gap-4 bg-signal hover:bg-signal-dark text-white rounded-3xl p-5 transition-colors"
        >
          <div>
            <p className="font-display font-bold uppercase text-xl tracking-wide">
              📊 My dashboard
            </p>
            <p className="text-white/80 text-sm mt-1">
              Stats, spots, lake notes and settings — your private fishing HQ.
            </p>
          </div>
          <span className="text-2xl shrink-0">→</span>
        </Link>
      </div>
      <ProfileView userId={user.id} editor={<StatsPrivacyEditor userId={user.id} />} />
    </>
  );
}
