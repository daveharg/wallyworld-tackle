// Edit profile page — avatar, display name, bio, account type.
"use client";

import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import DashboardSettings from "../../dashboard/_components/DashboardSettings";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, openLogin } = useFishAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Edit profile
        </h1>
        <p className="text-pine/60 mb-6">Log in to edit your profile.</p>
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
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm font-bold text-pine/50 hover:text-pine mb-4 inline-block"
      >
        ← Back
      </button>
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-6">
        Edit profile
      </h1>
      <DashboardSettings afterSaveHref="/fishmb/dashboard?tab=profile" />
    </div>
  );
}
