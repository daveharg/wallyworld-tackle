import { NextRequest, NextResponse } from "next/server";

/**
 * fishmb.ca routing (Dave, 2026-11-15) — fishmb.ca's home is the MAIN
 * WEBSITE's home screen, not the FishMB app page:
 * - fishmb.ca/ → the Wallyworld Tackle storefront home page (exactly what
 *   wallyworldtackle.ca/ serves, full store chrome — no x-fishmb-site flag)
 * - fishmb.ca/app → the FishMB app landing page (fishmb-coming-soon),
 *   reachable by link only (the storefront home links here: "Get the app")
 * - fishmb.ca/demo, fishmb.ca/demo/* → the full FishMB app (/fishmb, /fishmb/*)
 * - everything else on fishmb.ca → redirect to /
 * - all other hosts → unchanged (wallyworldtackle.ca serves store + /fishmb)
 *
 * FishMB app responses carry x-fishmb-site: 1 so the root layout can
 * skip the Wallyworld store chrome (usePathname sees the pre-rewrite URL,
 * so the layout can't rely on the path alone). The storefront home at /
 * deliberately does NOT carry the flag — it renders with the store chrome.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const isFishMb = host === "fishmb.ca" || host === "www.fishmb.ca";
  if (!isFishMb) return NextResponse.next();

  const withFlag = (res: NextResponse) => {
    res.headers.set("x-fishmb-site", "1");
    return res;
  };

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    // The main website's home screen: the storefront home page (app/page.tsx),
    // same as wallyworldtackle.ca/. No rewrite, no x-fishmb-site flag — the
    // root layout wraps it in the full Wallyworld store chrome.
    return NextResponse.next();
  }
  if (pathname === "/app") {
    // The FishMB app landing page — link-only, never the fishmb.ca home.
    return withFlag(NextResponse.rewrite(new URL("/fishmb-coming-soon", req.url)));
  }
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    const rest = pathname === "/demo" ? "/feed" : pathname.slice("/demo".length);
    const url = req.nextUrl.clone();
    url.pathname = `/fishmb${rest}`;
    return withFlag(NextResponse.rewrite(url));
  }
  // The demo navigates within /fishmb/* — keep those working on fishmb.ca.
  if (pathname === "/fishmb" || pathname.startsWith("/fishmb/")) {
    return withFlag(NextResponse.next());
  }
  // Allow the internal app routes the demo needs (API, assets, auth callbacks).
  // /.well-known/ carries the app-link files (apple-app-site-association) —
  // Apple fetches them from fishmb.ca and will not follow the site redirect.
  // /embed-yt.html is the app's YouTube player page — the native WebView
  // loads it by URL and it must not be bounced to the coming-soon page.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/fish-manitoba/") ||
    pathname === "/embed-yt.html" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return withFlag(NextResponse.next());
  }
  // Nothing else on fishmb.ca — never the Wallyworld store.
  return withFlag(NextResponse.redirect(new URL("/", req.url)));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
