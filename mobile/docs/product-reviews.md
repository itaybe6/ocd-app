# Product reviews

`ProductReviews` uses the same public read and submit functions as the live website,
keyed by Shopify product handle. No separate database, admin credentials, or app
session is used. The website currently accepts guest submissions with a name,
optional city, 1–5 rating, review text, and optional JPEG data URL. Its backend
remains responsible for storage and publication/moderation.

The website is deployed with TanStack Start. `src/lib/productReviews.ts` uses its
JSON/Seroval protocol, including the `$TSR/Error` envelope. Requests contain
`{ data: ... }`; responses contain `{ result, error, context }`.

`reviewWireFormat.ts` handles only the plain-data subset needed by reviews, with
bounded decoding and explicit rejection of unsupported types. The Seroval package
is a **dev-only test oracle**, never a native runtime import: its initialization
reads `.description` from well-known Symbols that some Hermes versions lack.
Regression tests reproduce that crash and verify the adapter in the same runtime
conditions, plus bidirectional compatibility with the website serializer.

## Website deployment dependency

There is currently no versioned reviews REST endpoint in this workspace. The
public function IDs were verified against the live site on 2026-11-07. They can
change when the website's server functions change. Override these Expo build-time
values if needed:

- `EXPO_PUBLIC_REVIEWS_READ_FUNCTION_ID`
- `EXPO_PUBLIC_REVIEWS_WRITE_FUNCTION_ID`

Before changing/deploying the website's review backend, verify this contract or
expose stable versioned endpoints and update this adapter. Do not discover IDs by
downloading/evaluating the website's JavaScript on customers' devices.

## Validation

`node --test scripts/test-product-reviews.cjs scripts/test-product-page.cjs`

Read-only integration check confirmed 17 existing public Vitro Plus reviews.
Submission is tested with a mocked transport, not by publishing test content to
the production store. Verify a genuine customer submission, native keyboard and
photo picker on iOS/Android before release. No automatic mutation retry is used
because the website does not expose an idempotency key.
