# OCD+ / HYP Pay deployment record — 2026-11-08

Price: **49 ILS monthly**. Terminal: **4502503022**. Project:
`wlzreoiumzmfbskzuywj`. Release gate: **HYP_CHECKOUT_ENABLED=false** (verified
from the deployed server). Do not enable purchases yet.

## Deployed and verified

- HYP server-side `APISign / SIGN` succeeds with the saved credentials. The
  diagnostic validates a signed monthly payment link with `HK=True`, `freq=1`,
  `Tash=999`, `OnlyOnApprove=True`, amount 49 ILS. It discards the URL and never
  opens it. **No charge or recurring agreement was created.**
- Shopify client-credentials authentication succeeds. Installed scopes are
  `read_customers,write_customers`. The live segment is **OCD+ Members**, with
  `customer_tags CONTAINS 'OCD_PLUS_ACTIVE'`.
- Create-payment resolves/creates the Shopify customer by verified app-user
  identity and links the Shopify ID to both user and subscription. A cached
  Shopify customer must still exist before preparing checkout.
- A database lock and a unique open-attempt index make concurrent app requests
  reuse one payment page. An uncertain signing attempt stays blocked for review,
  rather than blindly generating another payment reference.
- The public HYP completion endpoint forwards the original completion fields to
  `APISign / VERIFY`. Only an approved 49 ILS charge with HKId can grant access.
  Unsigned callbacks, authorization-only statuses, other amounts/currencies and
  mismatched agreements cannot activate membership.
- Payment ledger, membership dates and app entitlement commit atomically.
  Replayed transactions do not extend access. Older events cannot shorten a paid
  period or override a newer successful payment.
- Shopify tags use a durable pending revision and a lease. A temporary outage
  retains work for retry; an old worker cannot acknowledge a newer payment.
- Cancellation is durably requested first. Only `HKStatus / NewStat=1` success
  for the exact agreement confirms cancellation. Paid access remains until the
  paid-through date. The app distinguishes pending cancellation from success.
- `ocd-plus-sync` runs every minute using pg_cron + pg_net. It expires **managed
  HYP memberships only** and retries synchronization. Its JWT and independent
  maintenance credential are checked; credentials are read from Vault. The user
  explicitly approved activation. Cron execution and Edge HTTP 200/ok were
  observed. Both preexisting manual subscriptions remain unchanged.
- Legacy `ocd-plus-admin-seed` and `ocd-plus-shopify-test` return 410. Their old
  public-key-only tag mutation diagnostics are retired.
- Browser preflight now allows `X-App-Session`. Customer functions require the
  verified app session and also have platform JWT verification enabled. Only the
  existing HYP callback stays public; it requires HYP verification before writes.

## Deployment files

- `20261107231413_ocd_plus_payment_lifecycle.sql`: attempts, atomic transitions,
  payment ledger metadata, server-only privileges, outbox revisions and leases.
- `20261107232654_ocd_plus_scheduled_sync.sql`: minute schedule and trigger
  search-path hardening. Vault secrets must exist before applying this migration.
- Both migrations were applied, verified and marked applied in migration history.
- Functions deployed: create-payment, hyp-callback, cancel, status, maintenance;
  both retired diagnostics were also replaced remotely.

## Release blockers

1. **HYP subsequent-payment delivery contract.** The public HYP Pay recurring
   guide describes automatic charging and the initial browser redirect, but not
   reliable server notifications for later charges or when the browser closes.
   Obtain official payload examples, authentication, unique transaction ID,
   HKId/Order mapping, billing timestamp, retries, failed-charge/cancellation
   events, and a reconciliation API. Do not substitute the unrelated Enterprise
   protocol or invent timestamp fields. The database intentionally refuses a new
   renewal event without an independently verified billing timestamp. The public
   initial-completion handler does **not** supply one for later renewals.
2. **Terminal return settings and payment return UX.** Enable signature
   verification in the terminal and configure its success URL:
   `https://wlzreoiumzmfbskzuywj.supabase.co/functions/v1/ocd-plus-hyp-callback`.
   This endpoint currently returns a JSON acknowledgement. Configure a proper
   customer-facing return page/deep link before launch. A successful signing
   probe does not prove these portal settings. Confirm whether HYP prevents a
   previously issued signed URL from creating a second HK agreement. A different
   agreement on an already completed reference is rejected for reconciliation;
   this prevents duplicate access, **not a duplicate provider charge**.
3. **End-to-end test on provider-approved test configuration.** Confirm initial
   payment, abandoned browser recovery, renewal success/failure, replay,
   cancellation and expiry. Verify the Shopify tag and the member discount in
   checkout as the actual customer. No card payment or live customer-tag mutation
   was performed in this session.
4. **Shopify discount identity.** The app attaches phone/email and discount codes
   `OCDPLUS` / `OCDSHIP`. These contact fields do not create a Shopify Customer
   Account login session. Segment eligibility and the final discount must be
   tested at checkout. Current scopes do not allow inspecting discount rules.

## Optional Shopify order recording

Shopify supports recording an externally paid transaction using `orderCreate`.
This is **not enabled or implemented** here: the installed app has no order
permissions. Add `write_orders` (and read access for reconciliation) to the
installed backend app before implementing this optional feature. Confirm the
membership product/tax treatment rather than inventing a VAT rate; the store
currently reports `taxesIncluded=false`. Record only verified HYP transactions,
with a durable unique HYP reference and an uncertain-result reconciliation path.
Never blindly retry `orderCreate` after a timeout, and never charge the card again.

## Verification performed

- `mobile/`: `node --test scripts/test-hyp-pay.cjs scripts/test-ocd-lifecycle.cjs`
  — **15 passing tests** (protocol and worker failure/retry/revision behavior).
- `supabase/tests/ocd-plus-lifecycle.sql` ran in BEGIN/ROLLBACK against Postgres:
  duplicate checkout, wrong amount, atomic activation, replay, conflicting event,
  missing renewal timestamp, old success/failure, different agreement, lease
  contention/recovery, cancellation confirmation, expiry, rejoin and privileges.
  Zero test attempts/events remain.
- `deno check --no-config` passes for all five lifecycle endpoints.
- Deployed negative checks: missing app sessions 401, missing maintenance secret
  401, retired diagnostics 410, unsigned HYP callback 400, browser CORS passes.
- Security advisors: no OCD/Vault/Cron findings after search-path hardening.
  Preexisting unrelated project findings remain outside this payment change.
- HYP signing probe succeeds; Shopify scopes/segment verified read-only; cron
  and worker responses verified. **These are not a full payment acceptance test.**

## Operations and secrets

### Restricted live checkout (2026-11-08)

At the owner's request, create-payment supports a server-only
`HYP_CHECKOUT_CUSTOMER_IDS` comma-separated list of customer UUIDs. The endpoint
passes only the user ID from the verified app session to both checkout gates.
An explicitly listed customer can open the real 49 ILS monthly payment page
while `HYP_CHECKOUT_ENABLED=false` keeps general enrollment disabled. This is
real billing, not a sandbox; it does not resolve the release blockers above.
One existing customer account was allowlisted at the owner's explicit request.
Its stale manual membership (expired paid-through date, no HYP agreement,
payment attempts or events) was changed to cancelled, its subscriber flag
cleared, and a new sync revision queued to remove the old Shopify entitlement.
Historical dates were retained. No charge or new agreement was created.
The owner must sign in normally. Never allowlist the local Adir fixture or trust
a phone/user ID sent in the checkout request body.

The local Adir join flow now explains the need for a real account and provides
the normal sign-in handoff instead of displaying the captured payment image.
Real customer checkout continues through the existing server-created HYP URL.

Server secrets: `HYP_MASOF`, `HYP_API_KEY`, `HYP_PASS_P`,
`HYP_CHECKOUT_ENABLED`, existing `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET`, and `OCD_MAINTENANCE_SECRET`.
Vault entries: `ocd_project_url`, `ocd_project_anon_key`, `ocd_maintenance_secret`.
The maintenance secret is not a service-role key and must never ship in the app.
Local setup files match `.env*.local` and are git-ignored; never print their values.

Maintenance requests require platform `Authorization: Bearer <project JWT>` and
`x-ocd-maintenance-secret`. Actions: `run`, `readiness`, `hyp_sign_check` (signing
only, no payment link returned). Readiness must continue to report checkout false
until the blockers are resolved. Monitor `sync_version <> synced_version`,
`sync_error`, blocked payment attempts, cron failures and pending cancellations.

## Primary references

- https://developers.hyp.co.il/pay/advanced-features/recurring-payments
- https://developers.hyp.co.il/pay/security/transaction-validation
- https://developers.hyp.co.il/pay/getting-started/creating-a-payment-page
- https://shopify.dev/docs/api/admin-graphql/2026-04/mutations/orderCreate
- https://supabase.com/docs/guides/functions/schedule-functions
