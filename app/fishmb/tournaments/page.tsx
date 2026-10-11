import { redirect } from "next/navigation";

/** Tournament hub now lives in the Angler HQ tournaments tab. */
export default function TournamentsPage() {
  redirect("/fishmb/dashboard?tab=tournaments");
}
