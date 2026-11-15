import { redirect } from "next/navigation";

/** Tournaments are off the web app (Dave, 2026-11-15) — see ../../page.tsx. */
export default function TournamentLivePage() {
  redirect("/fishmb/home");
}
