import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  if (host.includes("fishmb.ca")) {
    return {
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/fishmb/admin/"] }],
      sitemap: "https://www.fishmb.ca/sitemap.xml",
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account/"],
      },
    ],
    sitemap: "https://www.wallyworldtackle.ca/sitemap.xml",
  };
}
