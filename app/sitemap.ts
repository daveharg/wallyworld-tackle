import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getProducts } from "../lib/shopify";

const STORE_BASE = "https://www.wallyworldtackle.ca";
const FISHMB_BASE = "https://www.fishmb.ca";

/** FishMB sitemap served when the request comes in on fishmb.ca. */
async function fishmbSitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: FISHMB_BASE, changeFrequency: "daily", priority: 1 },
    { url: `${FISHMB_BASE}/fishmb/tips`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${FISHMB_BASE}/fishmb/weather`, changeFrequency: "daily", priority: 0.9 },
    { url: `${FISHMB_BASE}/fishmb/tournaments`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${FISHMB_BASE}/fishmb/lakes`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${FISHMB_BASE}/fishmb/lodges`, changeFrequency: "weekly", priority: 0.8 },
  ];
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "public", "fish-manitoba", "data.json"), "utf8")
    );
    const lakes: MetadataRoute.Sitemap = (data.lakes ?? []).map(
      (l: { id: string }) => ({
        url: `${FISHMB_BASE}/fishmb/lakes/${l.id}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })
    );
    const lodges: MetadataRoute.Sitemap = (data.lodges ?? []).map(
      (l: { id: string }) => ({
        url: `${FISHMB_BASE}/fishmb/lodges/${l.id}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })
    );
    return [...staticPages, ...lakes, ...lodges];
  } catch {
    return staticPages;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") ?? "";
  if (host.includes("fishmb.ca")) return fishmbSitemap();

  const staticPages: MetadataRoute.Sitemap = [
    { url: STORE_BASE, changeFrequency: "daily", priority: 1 },
    { url: `${STORE_BASE}/rods`, changeFrequency: "daily", priority: 0.9 },
    { url: `${STORE_BASE}/reels`, changeFrequency: "daily", priority: 0.9 },
    { url: `${STORE_BASE}/tackle`, changeFrequency: "daily", priority: 0.9 },
    { url: `${STORE_BASE}/ice-fishing`, changeFrequency: "daily", priority: 0.9 },
    { url: `${STORE_BASE}/returns`, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const products = await getProducts(250);
    const productPages: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${STORE_BASE}/products/${p.handle}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
