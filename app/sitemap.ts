import type { MetadataRoute } from "next";
import { getProducts } from "../lib/shopify";

const BASE = "https://www.wallyworldtackle.ca";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/rods`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/reels`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/tackle`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ice-fishing`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const products = await getProducts(250);
    const productPages: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${BASE}/products/${p.handle}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
