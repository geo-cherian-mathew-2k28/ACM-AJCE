# ACM AJCE Membership Setup

The membership portal is designed for Cloudflare Workers + D1. It does not use
browser storage for member records, payment keys, roles, coupons, or session
signatures.

## 1. Create the D1 database

Run this from the repository root:

```powershell
npx wrangler d1 create acm-ajce-membership
```

Add the returned database ID to `wrangler.json` under a new top-level binding:

```json
"d1_databases": [
  {
    "binding": "MEMBERSHIP_DB",
    "database_name": "acm-ajce-membership",
    "database_id": "PASTE_THE_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

Apply the schema locally first, then to the production database:

```powershell
npx wrangler d1 migrations apply acm-ajce-membership --local
npx wrangler d1 migrations apply acm-ajce-membership --remote
```

## 2. Configure Google sign-in

Create a Web application OAuth client in Google Cloud Console. Add these exact
redirect URLs for each environment:

```text
http://127.0.0.1:4321/api/auth/google/callback
https://YOUR-PRODUCTION-DOMAIN/api/auth/google/callback
```

The app uses the OpenID Connect authorization-code flow and a signed, HttpOnly
session cookie. The Google account `sub` claim is the stable account identity;
email is only used for contact details and the allow-list below.

## 3. Configure Razorpay

Use Razorpay Test Mode until a full test payment and webhook have been checked.
The server creates the order in paise, sends the public key and order ID to
Checkout, verifies the Checkout signature on the server, and also handles the
signed `payment.captured` webhook idempotently.

Create this webhook in Razorpay:

```text
https://YOUR-PRODUCTION-DOMAIN/api/payments/webhook
```

Subscribe it to `payment.captured` and copy its webhook secret.

## 4. Add Cloudflare secrets

For local development, copy `.dev.vars.example` to `.dev.vars` and fill the
values. For Cloudflare, add each secret with Wrangler:

```powershell
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put MEMBERSHIP_SESSION_SECRET
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put COUPON_HASH_SECRET
npx wrangler secret put ADMIN_EMAILS
```

`ADMIN_EMAILS` is a comma-separated allow-list. Only signed-in accounts whose
email appears there can reach `/membership/admin` or any `/api/admin/*` route.
No administrator control is rendered for ordinary members.

## 5. Run and verify

```powershell
pnpm dev
```

Use the membership button on the main site or open `/membership`. Verify this
flow before using production Razorpay keys:

1. Google sign-in creates a user in D1.
2. Profile completion is required before payment.
3. Razorpay Test checkout creates an order and activates a one-year membership.
4. The card downloads through the browser print-to-PDF dialog.
5. An allow-listed Google account can create events, edit member data, and issue
   a coupon. A coupon is stored as a keyed hash and cannot be used twice.

## Operational notes

- Memberships remain active only while `expires_at` is in the future. No cron
  job is needed to hide expired cards and member-only registrations.
- Do not expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `MEMBERSHIP_SESSION_SECRET`, or `COUPON_HASH_SECRET` in browser code.
- Before launch, collect the actual ACM AJCE admin Google email addresses and
  enter them in `ADMIN_EMAILS`.
