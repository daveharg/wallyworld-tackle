import { redirect } from "next/navigation";

/**
 * The public business directory ("list your business") has been retired.
 * Business owners still manage listings and ads from their dashboard;
 * individual business pages remain reachable by direct link.
 */
export default function BusinessDirectoryRetired() {
  redirect("/fishmb");
}
