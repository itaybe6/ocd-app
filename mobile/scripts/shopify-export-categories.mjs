/**
 * מושך מ-Shopify Storefront API:
 * 1) עץ תפריט ניווט (קטגוריות / תתי־קטגוריות לפי מה שהוגדר ב־Online Store → Navigation)
 * 2) רשימת כל הקולקציות (ממוינות לפי עדכון אחרון)
 *
 * שימוש (מתיקיית mobile):
 *   node scripts/shopify-export-categories.mjs
 *   node scripts/shopify-export-categories.mjs my-custom-menu-handle
 *
 * משתני סביבה (מ־.env או מערכת): כמו ב־`src/lib/shopify.ts`
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_VERSION = '2026-04';
const MENU_DEPTH = 8;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

function pickDomain(env) {
  return (
    process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() ||
    process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
    process.env.SHOPIFY_STORE_DOMAIN?.trim() ||
    env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() ||
    env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
    env.SHOPIFY_STORE_DOMAIN?.trim() ||
    ''
  );
}

function pickToken(env) {
  return (
    process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim() ||
    process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
    env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim() ||
    env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
    env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
    ''
  );
}

function extractCollectionHandleFromUrl(url) {
  if (!url) return undefined;
  const m = String(url).match(/\/collections\/([^/?#]+)/i);
  return m ? m[1] : undefined;
}

const MENU_ITEM_FIELDS = `
  id
  title
  url
  resource {
    __typename
    ... on Collection {
      id
      title
      handle
      description
      image { url altText }
    }
  }
`;

function menuItemsNested(remaining) {
  if (remaining <= 1) return MENU_ITEM_FIELDS;
  return `
    ${MENU_ITEM_FIELDS}
    items {
      ${menuItemsNested(remaining - 1)}
    }
  `;
}

function normalizeMenuItem(node) {
  const coll = node.resource?.__typename === 'Collection' ? node.resource : null;
  const collectionHandle = coll?.handle ?? extractCollectionHandleFromUrl(node.url);
  const collectionDescription = coll?.description || undefined;
  const collectionImageUrl = coll?.image?.url ?? undefined;
  const children = (node.items ?? []).map((c) => normalizeMenuItem(c)).filter(Boolean);
  if (!collectionHandle && !children.length) return null;
  return {
    id: node.id,
    title: node.title,
    url: node.url,
    collectionHandle,
    collectionDescription,
    collectionImageUrl,
    children,
  };
}

async function storefrontRequest(domain, token, query, variables) {
  const endpoint = `https://${domain}/api/${API_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

function gqlErrors(payload) {
  const e = payload.errors?.map((x) => x.message) ?? [];
  return e;
}

async function fetchAllCollections(domain, token) {
  const query = `
    query GetCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after, sortKey: UPDATED_AT) {
        edges {
          node {
            id
            title
            handle
            updatedAt
            description
            image { url altText }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  const out = [];
  let cursor = null;
  while (true) {
    const payload = await storefrontRequest(domain, token, query, { first: 250, after: cursor });
    const err = gqlErrors(payload);
    if (err.length) throw new Error(err.join('; '));
    const conn = payload.data?.collections;
    if (!conn) break;
    for (const { node } of conn.edges) {
      out.push({
        id: node.id,
        title: node.title,
        handle: node.handle,
        updatedAt: node.updatedAt,
        description: node.description,
        imageUrl: node.image?.url ?? null,
      });
    }
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }
  return out;
}

async function fetchMenu(domain, token, handle) {
  const q = `
    query GetMenu($handle: String!) {
      menu(handle: $handle) {
        id
        title
        handle
        items {
          ${menuItemsNested(MENU_DEPTH)}
        }
      }
    }
  `;
  const payload = await storefrontRequest(domain, token, q, { handle });
  const err = gqlErrors(payload);
  if (err.length) throw new Error(err.join('; '));
  const menu = payload.data?.menu;
  if (!menu) return null;
  const items = (menu.items ?? []).map(normalizeMenuItem).filter(Boolean);
  return {
    menuId: menu.id,
    menuTitle: menu.title,
    menuHandle: menu.handle,
    items,
  };
}

function flattenMenuTree(items, prefix = '') {
  const rows = [];
  for (const it of items) {
    const path = prefix ? `${prefix} / ${it.title}` : it.title;
    rows.push({
      path,
      title: it.title,
      collectionHandle: it.collectionHandle ?? null,
      url: it.url,
    });
    if (it.children?.length) rows.push(...flattenMenuTree(it.children, path));
  }
  return rows;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const fileEnv = loadEnvFile(envPath);
  const domain = pickDomain(fileEnv);
  const token = pickToken(fileEnv);
  if (!domain || !token) {
    console.error('חסרים EXPO_PUBLIC_SHOPIFY_DOMAIN ו־EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ב־mobile/.env (או בסביבה).');
    process.exit(1);
  }

  const menuHandleArg = process.argv[2]?.trim();
  const menuHandle =
    menuHandleArg ||
    process.env.EXPO_PUBLIC_SHOPIFY_MENU_HANDLE?.trim() ||
    fileEnv.EXPO_PUBLIC_SHOPIFY_MENU_HANDLE?.trim() ||
    'main-menu';

  console.error(`חנות: ${domain}`);
  console.error(`תפריט (handle): ${menuHandle}`);

  let menuTree = null;
  let menuErr = null;
  try {
    menuTree = await fetchMenu(domain, token, menuHandle);
  } catch (e) {
    menuErr = String(e?.message ?? e);
  }

  const collections = await fetchAllCollections(domain, token);

  const outDir = path.join(__dirname, '..', 'shopify-export');
  fs.mkdirSync(outDir, { recursive: true });

  const menuPath = path.join(outDir, 'navigation-menu.json');
  const flatPath = path.join(outDir, 'navigation-menu-flat.json');
  const collPath = path.join(outDir, 'collections-all.json');

  const flat = menuTree?.items ? flattenMenuTree(menuTree.items) : [];

  fs.writeFileSync(menuPath, JSON.stringify({ menuHandle, error: menuErr, ...menuTree }, null, 2), 'utf8');
  fs.writeFileSync(flatPath, JSON.stringify(flat, null, 2), 'utf8');
  fs.writeFileSync(collPath, JSON.stringify(collections, null, 2), 'utf8');

  console.error(`נכתב: ${menuPath}`);
  console.error(`נכתב: ${flatPath}`);
  console.error(`נכתב: ${collPath}`);
  if (menuErr) console.error('אזהרה (תפריט):', menuErr);

  // הדפסה קצרה לקונסול
  console.log(JSON.stringify({ menuHandle, menuError: menuErr, topLevelCategories: menuTree?.items?.length ?? 0, collectionsCount: collections.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
