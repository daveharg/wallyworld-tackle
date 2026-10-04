# Wallyworld Tackle Store

A Vercel-ready Next.js 14 storefront for **Wallyworld Tackle** — freshwater fishing tackle.
*good gear, low prices.*

All product data comes from the **Shopify Storefront API** (read-only). Checkout redirects
to Shopify's secure checkout via the Storefront API cart.

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Shopify**

   Copy `.env.example` to `.env.local` and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Your store domain, e.g. `stillwater-bcusl52j.myshopify.com` |
   | `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Shopify Admin → Apps → Develop apps → your custom app → Storefront API access token |

   > Use the **Storefront API** token, not the Admin API token.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

4. **Build**

   ```bash
   npm run build
   ```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), import the repo (Hobby plan is fine).
3. Add the two `NEXT_PUBLIC_SHOPIFY_*` environment variables in
   Project Settings → Environment Variables.
4. Deploy. In Vercel → Domains, add your custom domain
   (e.g. `wallyworldtackle.com`) and follow the DNS instructions.

## Project structure

```
app/
  page.tsx                  Homepage (hero, featured, category rows)
  rods/page.tsx             Rods listing (spinning / casting horizontal rows)
  reels/page.tsx            Reels listing
  tackle/page.tsx           Tackle & More (Jig Heads, Soft Plastics, Hard Baits,
                            Tackle Boxes, Tools & Accessories, Terminal Tackle)
  products/[handle]/page.tsx  Product detail (variant selector, qty, add to cart)
  cart/page.tsx             Cart with quantity controls + Shopify checkout
components/
  CartContext.tsx           Cart state persisted to localStorage
  Header.tsx / Footer.tsx
  ProductCard.tsx / CategoryRow.tsx
  VariantSelector.tsx       Text-only variant buttons (no thumbnails)
lib/
  shopify.ts                Storefront API client + cart checkout
  categories.ts             Title-keyword → category sorting
  variant-names.ts          Supplier code → customer-facing variant labels
```

## Customizing variant labels

Edit `lib/variant-names.ts` — add the product's handle and a map of
`raw option value → display label`. The underlying Shopify values are never
changed, so DSers supplier mapping keeps working.

## Notes

- Product data revalidates every 5 minutes (`revalidate = 300`).
- The cart lives in `localStorage`; checkout creates a real Shopify cart and
  redirects to Shopify's secure checkout.
- Copy rules: tagline is "good gear, low prices"; never describe products as
  "cheap".
