import { redirect } from "next/navigation";

/**
 * Tournaments came off the FishMB web app (Dave, 2026-11-15) — they live
 * in the native app now. Old links land on the web home instead of
 * erroring. The original page is preserved in this folder as
 * page.legacy.tsx.
 */
export default function TournamentsPage() {
  redirect("/fishmb/home");
}
