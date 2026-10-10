import { redirect } from "next/navigation";

/** FishMB home — the app opens directly at the feed. */
export default function FishMBPage() {
  redirect("/fishmb/feed");
}
