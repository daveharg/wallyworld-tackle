// Dashboard "Profile" tab — your public profile.

"use client";

import { useFishAuth } from "../../_components/FishAuth";
import ProfileView from "../../profile/_components/ProfileView";
import ProfileFriends from "./ProfileFriends";

export default function DashboardProfile() {
  const { user } = useFishAuth();

  if (!user) return null;

  return (
    <>
      <ProfileView userId={user.id} />
      <ProfileFriends />
    </>
  );
}
