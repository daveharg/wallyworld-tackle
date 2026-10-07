"use client";

import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

/** fetch with the FishMB session token when the user is logged in. */
export async function fishFetch(path: string, init: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(FISHMB_TOKEN_KEY) : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export { formatDateTime } from "./formatDate";
