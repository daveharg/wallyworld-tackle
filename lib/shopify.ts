// Shopify Storefront API client.
// Uses NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN.

const STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export function isShopifyConfigured(): boolean {
  return Boolean(STORE_DOMAIN && STOREFRONT_TOKEN);
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
}

export interface ShopifyPrice {
  amount: string;
  currencyCode: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: ShopifyPrice;
  compareAtPrice: ShopifyPrice | null;
  selectedOptions: { name: string; value: string }[];
  image: ShopifyImage | null;
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  images: ShopifyImage[];
  priceRange: { minVariantPrice: ShopifyPrice; maxVariantPrice: ShopifyPrice };
  variants: ShopifyVariant[];
  options: { name: string; values: string[] }[];
}

async function storefront<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!isShopifyConfigured()) {
    throw new Error(
      "Shopify is not configured. Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN."
    );
  }
  const res = await fetch(`https://${STORE_DOMAIN}/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN as string,
    },
    body: JSON.stringify({ query, variables }),
    // Revalidate product data every 5 minutes so the store stays fresh.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Shopify Storefront API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    vendor
    productType
    tags
    availableForSale
    images(first: 20) { edges { node { url altText } } }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    options { name values }
    variants(first: 100) {
      edges {
        node {
          id
          title
          availableForSale
          quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image { url altText }
        }
      }
    }
  }
`;

function mapProduct(node: any): ShopifyProduct {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? "",
    descriptionHtml: node.descriptionHtml ?? "",
    vendor: node.vendor ?? "",
    productType: node.productType ?? "",
    tags: node.tags ?? [],
    availableForSale: node.availableForSale,
    images: (node.images?.edges ?? []).map((e: any) => ({
      url: e.node.url,
      altText: e.node.altText ?? null,
    })),
    priceRange: node.priceRange,
    variants: (node.variants?.edges ?? []).map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      availableForSale: e.node.availableForSale,
      quantityAvailable: e.node.quantityAvailable ?? null,
      price: e.node.price,
      compareAtPrice: e.node.compareAtPrice ?? null,
      selectedOptions: e.node.selectedOptions ?? [],
      image: e.node.image
        ? { url: e.node.image.url, altText: e.node.image.altText ?? null }
        : null,
    })),
    options: node.options ?? [],
  };
}

interface ProductsPage {
  products: {
    edges: { node: any; cursor: string }[];
    pageInfo: { hasNextPage: boolean };
  };
}

export async function getProducts(first = 100): Promise<ShopifyProduct[]> {
  // Paginate through the whole catalog — the store now has more products
  // than a single Storefront API page, so keep fetching until hasNextPage
  // is false (safety cap at 2000 products).
  const pageSize = Math.min(Math.max(first, 100), 250);
  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: ProductsPage = await storefront(
      `
    ${PRODUCT_FRAGMENT}
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { ...ProductFields } cursor }
        pageInfo { hasNextPage }
      }
    }
    `,
      { first: pageSize, after: cursor }
    );
    for (const e of data.products.edges) out.push(mapProduct(e.node));
    if (!data.products.edges.length || !data.products.pageInfo.hasNextPage) break;
    cursor = data.products.edges[data.products.edges.length - 1].cursor;
    if (out.length >= 2000) break;
  }
  return out;
}

export async function getProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const data = await storefront<{ productByHandle: any }>(
    `
    ${PRODUCT_FRAGMENT}
    query GetProduct($handle: String!) {
      productByHandle(handle: $handle) { ...ProductFields }
    }
    `,
    { handle }
  );
  return data.productByHandle ? mapProduct(data.productByHandle) : null;
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}

export async function createCheckoutUrl(lines: CartLineInput[]): Promise<string> {
  const data = await storefront<{
    cartCreate: { cart: { checkoutUrl: string } | null; userErrors: { message: string }[] };
  }>(
    `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }
    `,
    { input: { lines } }
  );
  const errors = data.cartCreate.userErrors;
  if (errors.length > 0) {
    throw new Error(`Checkout failed: ${errors.map((e) => e.message).join("; ")}`);
  }
  if (!data.cartCreate.cart) {
    throw new Error("Checkout failed: no cart returned.");
  }
  return data.cartCreate.cart.checkoutUrl;
}

export function formatPrice(price: ShopifyPrice): string {
  const amount = parseFloat(price.amount);
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: price.currencyCode || "CAD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
