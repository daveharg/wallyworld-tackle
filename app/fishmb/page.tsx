import { redirect } from "next/navigation";

/** FishMB home — lands on the web home page (the feed came off the web app, Dave 2026-11-15). */
export default function FishMBPage() {
  redirect("/fishmb/home");
}
