// FishMB local shop directory — bait shops and tackle & rod retailers for the
// Maps shop overlays. Two sources, one listing:
//   1. fm_local_shops — the curated directory (researched + verified entries;
//      a row can later be claimed by a real business via claimed_business_id).
//   2. fm_businesses — business pages whose owner flipped "we sell live bait"
//      and/or "we sell tackle & rods" and dropped a map pin.
// Every row carries its evidence/source so listings stay honest: nothing is
// listed as selling bait or tackle without a source saying so.

import { query } from "./db";
import { ensureBusinessTables } from "./business";

let ensured = false;

export async function ensureShopTables(): Promise<void> {
  await ensureBusinessTables();
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_local_shops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    town text NOT NULL DEFAULT '',
    address text,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    phone text,
    website text,
    sells_bait boolean NOT NULL DEFAULT false,
    sells_tackle boolean NOT NULL DEFAULT false,
    bait_types text,
    evidence text NOT NULL DEFAULT '',
    source_url text,
    seed_key text UNIQUE,
    claimed_business_id uuid REFERENCES fm_businesses(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_local_shops_flags_idx ON fm_local_shops(sells_bait, sells_tackle)`
  );
  ensured = true;
}

export type ShopKind = "bait" | "tackle";

export interface ShopListing {
  id: string;
  name: string;
  town: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  contact: string | null;
  sells_bait: boolean;
  sells_tackle: boolean;
  bait_types: string | null;
  /** Set when this listing is (or is claimed by) a FishMB business page. */
  business_id: string | null;
  source: "directory" | "business";
}

interface DirectoryRow {
  id: string;
  name: string;
  town: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  sells_bait: boolean;
  sells_tackle: boolean;
  bait_types: string | null;
  claimed_business_id: string | null;
}

interface BusinessRow {
  id: string;
  name: string;
  location: string | null;
  lat: number;
  lng: number;
  contact: string;
  website: string | null;
  sells_live_bait: boolean;
  sells_tackle: boolean;
}

/** All shops for one overlay kind (or both when kind is null). */
export async function listShops(kind: ShopKind | null): Promise<ShopListing[]> {
  await ensureShopTables();
  const baitCond = kind === null || kind === "bait";
  const tackleCond = kind === null || kind === "tackle";

  const out: ShopListing[] = [];
  const seenBusiness = new Set<string>();

  const dir = await query<DirectoryRow>(
    `SELECT id, name, town, address, lat, lng, phone, website,
            sells_bait, sells_tackle, bait_types, claimed_business_id
       FROM fm_local_shops
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY name`
  );
  for (const r of dir) {
    if (kind === "bait" && !r.sells_bait) continue;
    if (kind === "tackle" && !r.sells_tackle) continue;
    if (r.claimed_business_id) seenBusiness.add(r.claimed_business_id);
    out.push({
      id: `dir:${r.id}`,
      name: r.name,
      town: r.town,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      phone: r.phone,
      website: r.website,
      contact: null,
      sells_bait: r.sells_bait,
      sells_tackle: r.sells_tackle,
      bait_types: r.bait_types,
      business_id: r.claimed_business_id,
      source: "directory",
    });
  }

  const biz = await query<BusinessRow>(
    `SELECT id, name, location, lat, lng, contact, website,
            sells_live_bait, sells_tackle
       FROM fm_businesses
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND (sells_live_bait OR sells_tackle)
      ORDER BY name`
  );
  for (const b of biz) {
    if (seenBusiness.has(b.id)) continue; // directory row already covers it
    if (baitCond && tackleCond) {
      // kind === null: include all flagged businesses.
    } else if (kind === "bait" && !b.sells_live_bait) continue;
    else if (kind === "tackle" && !b.sells_tackle) continue;
    out.push({
      id: `biz:${b.id}`,
      name: b.name,
      town: b.location ?? "",
      address: null,
      lat: b.lat,
      lng: b.lng,
      phone: null,
      website: b.website,
      contact: b.contact || null,
      sells_bait: b.sells_live_bait,
      sells_tackle: b.sells_tackle,
      bait_types: null,
      business_id: b.id,
      source: "business",
    });
  }

  return out;
}
