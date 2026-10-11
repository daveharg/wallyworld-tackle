import { redirect } from "next/navigation";

// Consolidated into HQ — profile editing lives on the HQ profile tab.
export default function EditProfileRedirect() {
  redirect("/fishmb/dashboard?tab=profile&edit=1");
}
