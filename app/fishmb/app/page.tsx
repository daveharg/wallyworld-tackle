import { redirect } from "next/navigation";

// The FishMB app launches later — this page now redirects home.
export default function FishMBAppPage() {
  redirect("/fishmb");
}
