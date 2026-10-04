# Wallyworld Rewards — Accounts & Loyalty Setup

Customer accounts with Google/email sign-in, a points loyalty program
("Wallyworld Rewards"), cross-device saved carts, saved addresses, and order
history. Built with NextAuth.js v4 + Prisma.

## What was built

- **Sign-in modal** — header account icon opens a tabbed Sign In / Sign Up modal
  with a "Sign up with Gmail / Continue with Google" button plus email+password.
- **Account dropdown** — logged-in users get an avatar button with points badge,
  linking to My Account, Loyalty Points, Order History, and Sign Out.
- **Wallyworld Rewards** — earn 1 point per $1 spent; 100 points = $5 store credit.
- **Saved carts** — the cart syncs to the database when signed in and merges
  across devices on login.
- **Addresses** — saved shipping addresses on the account page.
- **Order history** — orders recorded at checkout; customers claim points for
  completed orders from their account page.

## 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Dev: `file:./dev.db`. Prod: Vercel Postgres connection string |
| `NEXTAUTH_SECRET` | yes | Random string — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | `http://localhost:3000` locally; `https://wallyworldtackle.ca` in prod |
| `GOOGLE_CLIENT_ID` | for Google button | From Google Cloud Console (below) |
| `GOOGLE_CLIENT_SECRET` | for Google button | From Google Cloud Console (below) |
| `POINTS_ADMIN_SECRET` | optional | Shared secret for manual points adjustments via API |

The Google sign-in button is **hidden automatically** until both
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set — email sign-up works
without them.

## 2. Google OAuth setup ("Sign up with Gmail")

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or
   select a project.
2. **APIs & Services → OAuth consent screen** → External → fill in app name
   ("Wallyworld Tackle"), support email, and your contact email. Add the
   `.../auth/userinfo.email` and `.../auth/userinfo.profile` scopes (default).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type: **Web application**.
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://wallyworldtackle.ca/api/auth/callback/google` (production)
   - `https://wallyworld-tackle.vercel.app/api/auth/callback/google` (preview)
5. Copy the **Client ID** → `GOOGLE_CLIENT_ID` and **Client secret** →
   `GOOGLE_CLIENT_SECRET` in `.env` (and in Vercel → Project → Settings →
   Environment Variables for production).
6. Redeploy. The "Continue with Google" button appears in the sign-in modal.

## 3. Database setup

Development uses a SQLite file — zero setup:

```bash
npm install
npm run db:migrate   # creates prisma/dev.db and applies the schema
npm run dev
```

The Prisma schema (`prisma/schema.prisma`) is Postgres-compatible. To move to
**Vercel Postgres** for production:

1. Vercel Dashboard → Storage → Create → Postgres.
2. Copy the connection string into the `DATABASE_URL` env var.
3. In `prisma/schema.prisma`, change `provider = "sqlite"` to
   `provider = "postgresql"`.
4. Run `npx prisma migrate deploy` (or `npm run db:migrate` locally with the
   Postgres URL) to create the tables.
5. No code changes needed — `lib/prisma.ts` picks the Postgres driver
   automatically when `DATABASE_URL` starts with `postgres://`.

Tables: `User`, `LoyaltyPoints`, `PointsTransaction`, `SavedCart`, `Address`,
`Order`, `StoreCredit`.

## 4. How points are earned and redeemed

**Earning (1 pt / $1):**
1. Customer checks out **while signed in** → a `pending` order is recorded
   (`POST /api/orders/record`, called from the cart drawer).
2. After the order is fulfilled, the customer clicks **"Claim my points"** on
   their account page → `POST /api/orders/claim` marks the order `completed`
   and credits `floor(total)` points. Each order credits at most once.
3. Manual credit (e.g. from a future Shopify webhook): `POST /api/points`
   with `{ email, points, note, adminKey: POINTS_ADMIN_SECRET }`.

**Redeeming (100 pts = $5):**
1. Customer clicks **Redeem** on `/account/points` → 100 points are deducted and
   a store-credit code like `WALLY-7X2K9Q` is generated (`StoreCredit` table).
2. The code is shown on their points page. They mention it at checkout (or to
   you directly) and you apply a $5 manual discount on the Shopify order.
3. Future upgrade path: generate a real Shopify discount code via the Admin API
   when the code is redeemed.

**Points API summary:**

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/points` | user | balance, lifetime, history, unused credits |
| `POST /api/points` | user (self earn, capped) or `adminKey` | credit points |
| `POST /api/points/redeem` | user | 100 pts → $5 credit code |
| `GET/PUT /api/cart` | user | fetch / save server cart |
| `GET/POST /api/addresses`, `PUT/DELETE /api/addresses/[id]` | user | address book |
| `GET /api/orders` | user | order history |
| `POST /api/orders/record` | user | record checkout start |
| `POST /api/orders/claim` | user | claim points for latest pending order |
| `POST /api/auth/signup` | — | email registration (bcrypt-hashed) |
| `GET /api/auth/config` | — | whether Google sign-in is enabled |

## 5. Design notes

- Follows the existing Bass Pro-style language: pine green headers, signal
  orange CTAs, warm paper backgrounds.
- Auth is a **modal**, not a page — the header account icon opens it; logged-in
  users get the dropdown instead.
- Points balance appears as a gold badge on the header avatar.
- Nothing about the existing Shopify product/cart/checkout flow was changed
  except: the cart now also syncs to the DB when signed in, and checkout
  records a pending order for points.
