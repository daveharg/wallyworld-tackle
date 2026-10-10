import { redirect } from "next/navigation";

/** The FishMB web app — opens directly to the feed. */
export default function FishMBAppPage() {
  redirect("/fishmb/feed");
}
