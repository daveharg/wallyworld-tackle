"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** OAuth callback — receives the Google authorization code and passes it to the opener. */
function CallbackInner() {
  const params = useSearchParams();
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDesc = params.get("error_description");
    try {
      const expectedState = sessionStorage.getItem("fishmb-oauth-state");
      if (error) {
        window.opener?.postMessage(
          { type: "fishmb-oauth", error: errorDesc || "Google sign-in failed." },
          window.location.origin
        );
      } else if (!code) {
        window.opener?.postMessage(
          { type: "fishmb-oauth", error: "No authorization code received." },
          window.location.origin
        );
      } else if (expectedState && state !== expectedState) {
        window.opener?.postMessage(
          { type: "fishmb-oauth", error: "Security check failed. Try again." },
          window.location.origin
        );
      } else {
        window.opener?.postMessage({ type: "fishmb-oauth", code, state }, window.location.origin);
      }
    } catch {
      // noop
    }
    window.close();
  }, [params]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <p className="text-pine/60 text-sm">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-pine/60 text-sm">Completing sign-in…</p></div>}>
      <CallbackInner />
    </Suspense>
  );
}
