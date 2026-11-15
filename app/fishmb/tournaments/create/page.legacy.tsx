import { redirect } from "next/navigation";

/** Legacy tournament create page — now built into the HQ tournaments tab. */
export default function CreateTournamentPage() {
  redirect("/fishmb/dashboard?tab=tournaments");
}
