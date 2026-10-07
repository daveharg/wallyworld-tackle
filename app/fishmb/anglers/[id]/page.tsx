// Public angler profile.

import ProfileView from "../../profile/_components/ProfileView";

export default function AnglerPage({ params }: { params: { id: string } }) {
  return <ProfileView userId={params.id} />;
}
