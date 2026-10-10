import { redirect } from "next/navigation";

/** Legacy business dashboard — consolidated into the HQ profile tab. */
export default function BusinessDashboardPage() {
  redirect("/fishmb/dashboard?tab=profile");
}
