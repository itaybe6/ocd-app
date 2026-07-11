/**
 * Server-only Shopify Admin API client (Client Credentials Grant).
 *
 * ALL Shopify Admin traffic happens here (Edge Functions), never in the app.
 *
 * Auth: the store's "OCD Plus Backend" app uses the OAuth Client Credentials
 * Grant. We exchange the app's client id/secret for a short-lived Admin API
 * access token, cache it in memory, and refresh it before it expires. The token
 * is NEVER persisted to the database and NEVER logged.
 *
 * Required secrets (set via `supabase secrets set`):
 *   SHOPIFY_STORE_DOMAIN   e.g. ocdonlinee.myshopify.com
 *   SHOPIFY_CLIENT_ID      client id of the installed app
 *   SHOPIFY_CLIENT_SECRET  client secret of the installed app
 */

import { toE164Israel } from './phone.ts';

export const OCD_PLUS_TAG = 'OCD_PLUS_ACTIVE';

/** Pinned stable Admin API version (quarterly release). */
const ADMIN_API_VERSION = '2026-04';
const TOKEN_ENDPOINT_PATH = '/admin/oauth/access_token';
/** Refresh at least this long before the token actually expires. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

function getDomain(): string {
  const domain = (Deno.env.get('SHOPIFY_STORE_DOMAIN') ?? '').trim();
  if (!domain) throw new Error('Shopify Admin not configured: missing SHOPIFY_STORE_DOMAIN.');
  return domain;
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = (Deno.env.get('SHOPIFY_CLIENT_ID') ?? '').trim();
  const clientSecret = (Deno.env.get('SHOPIFY_CLIENT_SECRET') ?? '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Shopify Admin not configured: missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

function graphqlEndpoint(): string {
  return `https://${getDomain()}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
}

export function tokenEndpoint(): string {
  return `https://${getDomain()}${TOKEN_ENDPOINT_PATH}`;
}

// ── In-memory token cache (per Edge Function instance) ──────────────────────
type TokenCache = { token: string; expiresAt: number; scope: string; expiresIn: number };
let tokenCache: TokenCache | null = null;

function clearTokenCache(): void {
  tokenCache = null;
}

async function requestFreshToken(): Promise<TokenCache> {
  const { clientId, clientSecret } = getCredentials();

  const res = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    // Do NOT include credentials in the error.
    throw new Error(`Shopify token request failed with status ${res.status}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!json.access_token) {
    throw new Error('Shopify token response did not include an access_token');
  }

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 0;
  const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : Date.now() + 60 * 60 * 1000;

  return {
    token: json.access_token,
    expiresAt,
    scope: json.scope ?? '',
    expiresIn,
  };
}

/**
 * Returns a valid Admin API access token, refreshing when it is missing, forced,
 * or within REFRESH_SKEW_MS of expiry. The raw token is never logged.
 */
export async function getShopifyAdminAccessToken(forceRefresh = false): Promise<string> {
  const fresh = !tokenCache || Date.now() >= tokenCache.expiresAt - REFRESH_SKEW_MS;
  if (forceRefresh || fresh) {
    tokenCache = await requestFreshToken();
  }
  return tokenCache!.token;
}

/** Non-sensitive token metadata for diagnostics (never exposes the token). */
export function getShopifyAdminTokenInfo(): {
  tokenEndpoint: string;
  apiVersion: string;
  expiresIn: number;
  scope: string;
  expiresAt: string;
} | null {
  if (!tokenCache) return null;
  return {
    tokenEndpoint: tokenEndpoint(),
    apiVersion: ADMIN_API_VERSION,
    expiresIn: tokenCache.expiresIn,
    scope: tokenCache.scope,
    expiresAt: new Date(tokenCache.expiresAt).toISOString(),
  };
}

// ── GraphQL request with single 401 retry ──────────────────────────────────
async function adminRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  isRetry = false,
): Promise<T> {
  const token = await getShopifyAdminAccessToken();

  const res = await fetch(graphqlEndpoint(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  // Token expired/revoked → clear cache, get a new token, retry ONCE.
  if (res.status === 401 && !isRetry) {
    clearTokenCache();
    await getShopifyAdminAccessToken(true);
    return adminRequest<T>(query, variables, true);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Shopify Admin ${res.status}: ${JSON.stringify(json ?? {}).slice(0, 300)}`);
  }
  if (json?.errors?.length) {
    throw new Error(`Shopify Admin GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
  }
  return json.data as T;
}

/** Build a Shopify customer GID from a numeric id or pass through an existing GID. */
function toCustomerGid(id: string): string {
  const trimmed = String(id).trim();
  if (trimmed.startsWith('gid://')) return trimmed;
  return `gid://shopify/Customer/${trimmed}`;
}

export type ShopifyCustomer = {
  id: string;
  tags: string[];
  phone: string | null;
  displayName: string | null;
};

/** Read a customer by id (GID or numeric). Returns null if not found. */
export async function getCustomerById(shopifyCustomerId: string): Promise<ShopifyCustomer | null> {
  const data = await adminRequest<{
    customer: { id: string; tags: string[]; phone: string | null; displayName: string | null } | null;
  }>(
    `query GetCustomer($id: ID!) {
      customer(id: $id) { id tags phone displayName }
    }`,
    { id: toCustomerGid(shopifyCustomerId) },
  );
  const c = data.customer;
  if (!c) return null;
  return { id: c.id, tags: c.tags ?? [], phone: c.phone ?? null, displayName: c.displayName ?? null };
}

/**
 * Find an existing Shopify customer by phone, or create one. Returns the
 * customer GID. Phone is the matching key (Shopify allows phone-only customers).
 */
export async function findOrCreateCustomerByPhone(args: {
  phone: string;
  name?: string | null;
}): Promise<string> {
  const e164 = toE164Israel(args.phone);
  if (!e164) throw new Error('Cannot resolve Shopify customer: invalid phone');

  const search = await adminRequest<{
    customers: { edges: Array<{ node: { id: string } }> };
  }>(
    `query FindCustomer($q: String!) {
      customers(first: 1, query: $q) { edges { node { id } } }
    }`,
    { q: `phone:${e164}` },
  );

  const existing = search.customers.edges[0]?.node?.id;
  if (existing) return existing;

  const parts = (args.name ?? '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;

  const created = await adminRequest<{
    customerCreate: {
      customer: { id: string } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(
    `mutation CreateCustomer($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }`,
    { input: { phone: e164, firstName, lastName } },
  );

  const errs = created.customerCreate.userErrors;
  if (errs?.length) {
    // Phone may have been taken between search and create → re-search once.
    const retry = await adminRequest<{
      customers: { edges: Array<{ node: { id: string } }> };
    }>(
      `query FindCustomer($q: String!) {
        customers(first: 1, query: $q) { edges { node { id } } }
      }`,
      { q: `phone:${e164}` },
    );
    const found = retry.customers.edges[0]?.node?.id;
    if (found) return found;
    throw new Error(`customerCreate failed: ${errs.map((e) => e.message).join(', ')}`);
  }

  const id = created.customerCreate.customer?.id;
  if (!id) throw new Error('customerCreate returned no customer');
  return id;
}

export async function addOcdPlusTag(shopifyCustomerId: string): Promise<void> {
  const data = await adminRequest<{
    tagsAdd: { userErrors: Array<{ message: string }> };
  }>(
    `mutation AddTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
    }`,
    { id: toCustomerGid(shopifyCustomerId), tags: [OCD_PLUS_TAG] },
  );
  const errs = data.tagsAdd.userErrors;
  if (errs?.length) throw new Error(`tagsAdd failed: ${errs.map((e) => e.message).join(', ')}`);
}

export async function removeOcdPlusTag(shopifyCustomerId: string): Promise<void> {
  const data = await adminRequest<{
    tagsRemove: { userErrors: Array<{ message: string }> };
  }>(
    `mutation RemoveTags($id: ID!, $tags: [String!]!) {
      tagsRemove(id: $id, tags: $tags) { userErrors { field message } }
    }`,
    { id: toCustomerGid(shopifyCustomerId), tags: [OCD_PLUS_TAG] },
  );
  const errs = data.tagsRemove.userErrors;
  if (errs?.length) throw new Error(`tagsRemove failed: ${errs.map((e) => e.message).join(', ')}`);
}
