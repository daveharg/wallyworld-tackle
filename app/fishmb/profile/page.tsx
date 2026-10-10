import { redirect } from "next/navigation";

/** Legacy profile page — consolidated into the HQ profile tab. */
export default function ProfilePage() {
  redirect("/fishmb/dashboard?tab=profile");
}
