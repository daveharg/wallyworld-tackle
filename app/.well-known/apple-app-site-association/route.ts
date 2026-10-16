import { NextResponse } from "next/server";

/**
 * Apple app-site-association — claims fishmb.ca links for the FishMB
 * iOS app (team 97M63RCVU3, bundle ca.fishmb.app) so shared links
 * open the app instead of the browser: tournament pages (challenge
 * shares), shared posts, catches, classifieds, lakes and lodges.
 * Apple fetches this file from the domains in the app's
 * associatedDomains (fishmb.ca + www.fishmb.ca) and will NOT follow
 * redirects — the middleware allow-lists /.well-known/ on fishmb.ca
 * for exactly this reason. Android's assetlinks.json joins it here
 * once an Android signing fingerprint exists.
 */
const association = {
  applinks: {
    details: [
      {
        appIDs: ["97M63RCVU3.ca.fishmb.app"],
        components: [
          {
            "/": "/fishmb/tournaments/*",
            comment: "Tournament pages — challenge links open the tournament in the app.",
          },
          { "/": "/fishmb/share/*", comment: "Shared posts and catches." },
          { "/": "/fishmb/catches/*", comment: "Public catch pages." },
          { "/": "/fishmb/classifieds/*", comment: "Classified listings." },
          { "/": "/fishmb/lakes/*", comment: "Lake pages." },
          { "/": "/fishmb/lodges/*", comment: "Lodge pages." },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(association, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
