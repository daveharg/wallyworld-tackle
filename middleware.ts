import { NextRequest, NextResponse } from "next/server";

/**
 * fishmb.ca routing — FishMB is completely separate from the Wallyworld store.
 * - fishmb.ca/ → coming soon page (fishmb-coming-soon)
 * - fishmb.ca/demo, fishmb.ca/demo/* → the full FishMB app (/fishmb, /fishmb/*)
 * - everything else on fishmb.ca → redirect to / (never the store)
 * - all other hosts → unchanged (wallyworldtackle.ca serves store + /fishmb)
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const isFishMb = host === "fishmb.ca" || host === "www.fishmb.ca";
  if (!isFishMb) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/fishmb-coming-soon", req.url));
  }
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    const rest = pathname === "/demo" ? "/feed" : pathname.slice("/demo".length);
    const url = req.nextUrl.clone();
    url.pathname = `/fishmb${rest}`;
    return NextResponse.rewrite(url);
  }
  // The demo navigates within /fishmb/* — keep those working on fishmb.ca.
  if (pathname === "/fishmb" || pathname.startsWith("/fishmb/")) {
    return NextResponse.next();
  }
  // Allow the internal app routes the demo needs (API, assets, auth callbacks).
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }
  // Nothing else on fishmb.ca — never the Wallyworld store.
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
