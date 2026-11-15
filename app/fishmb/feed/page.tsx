import { redirect } from "next/navigation";

/**
 * The feed came off the FishMB web app (Dave, 2026-11-15) — it lives in
 * the native app now. Old links land on the web home instead of erroring.
 * The original feed page is preserved in this folder as page.legacy.tsx.
 */
export default function FeedPage() {
  redirect("/fishmb/home");
}
