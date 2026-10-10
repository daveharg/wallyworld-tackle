// Dashboard "Profile" tab — your public profile.

"use client";

import { useState } from "react";
import { useFishAuth } from "../../_components/FishAuth";
import ProfileView from "../../profile/_components/ProfileView";
import ProfileFriends from "./ProfileFriends";
import BusinessSettings from "./BusinessSettings";

export default function DashboardProfile() {
  const { user } = useFishAuth();
  const [businessOpen, setBusinessOpen] = useState(false);

  if (!user) return null;

  const isBusiness =
    (user as { account_type?: string }).account_type === "business";

  return (
    <>
      <ProfileView userId={user.id} />
      <ProfileFriends />
      {isBusiness && (
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <button
            type="button"
            onClick={() => setBusinessOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-4 bg-pine hover:bg-pine-deep text-white rounded-3xl p-5 transition-colors"
          >
            <div className="text-left">
              <p className="font-display font-bold uppercase text-xl tracking-wide">
 Business profile options
              </p>
              <p className="text-white/70 text-sm mt-1">
                Classified listings, booking requests, tournaments, business page & ads —
                all in one place.
              </p>
            </div>
            <span
              className={`text-2xl shrink-0 transition-transform ${
                businessOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>
          {businessOpen && (
            <div className="mt-4 bg-white border border-pine/10 rounded-3xl p-5">
              <BusinessSettings />
            </div>
          )}
        </div>
      )}
    </>
  );
}
