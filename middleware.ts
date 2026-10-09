import { NextRequest, NextResponse } from "next/server";

/**
 * fishmb.ca routing:
 * - fishmb.ca/ → coming soon page (fishmb-coming-soon)
 * - fishmb.ca/demo, fishmb.ca/demo/* → the full FishMB app (/fishmb, /fishmb/*)
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
    const rest = pathname === "/demo" ? "" : pathname.slice("/demo".length);
    const url = req.nextUrl.clone();
    url.pathname = `/fishmb${rest}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
