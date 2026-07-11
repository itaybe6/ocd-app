import { normalizeCheckoutUrl } from './checkoutUrl';

/** Pinned Storefront API version (see https://shopify.dev/docs/api/usage/versioning) */
const SHOPIFY_API_VERSION = '2026-04';

const SHOPIFY_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() ||
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
  process.env.SHOPIFY_STORE_DOMAIN?.trim();

const SHOPIFY_STOREFRONT_TOKEN =
  process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim() ||
  process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();

export type ShopifyImage = {
  url: string;
  altText: string | null;
};

/** פריט מדיה בגלריית מוצר — תמונה או סרטון מ־Shopify Media */
export type ShopifyProductMediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  altText: string | null;
  /** תמונת תצוגה מקדימה לסרטון (poster) */
  previewUrl: string | null;
};

export type ShopifyProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: number;
  compareAtPrice: number | null;
  currencyCode: string;
  imageUrl: string | null;
  imageAltText: string | null;
};

export type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  handle: string;
  imageUrl: string | null;
  imageAltText: string | null;
  images: ShopifyImage[];
  /** גלריה מסודרת מ־Shopify media (תמונות + סרטונים). ריק אם לא נטען. */
  media: ShopifyProductMediaItem[];
  price: number;
  compareAtPrice: number | null;
  currencyCode: string;
  productType: string;
  vendor: string | null;
  tags: string[];
  /** Collection handles/titles used to resolve brand badges (e.g. סוסיטסא). */
  collectionHandles: string[];
  collectionTitles: string[];
  /** קולקציית Shopify ראשונה (מסודר ע״י Shopify) — לתווית קטגוריה בכרטיס מוצר */
  primaryCollectionTitle: string | null;
  variantId: string | null;
  variantTitle: string | null;
  availableForSale: boolean;
  variants: ShopifyProductVariant[];
};

export type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
  description: string;
  imageUrl: string | null;
};

export type ShopifyMenuItem = {
  id: string;
  title: string;
  collectionHandle?: string;
  collectionDescription?: string;
  collectionImageUrl?: string;
  children?: ShopifyMenuItem[];
};

export type ShopifyCartProduct = {
  id: string;
  name: string;
  subtitle: string;
  /** כותרת אוסף Shopify לגיבוי כשאין קטגוריה/תת־קטגוריה (מייצגת "עמוד" בחנות) */
  collectionTitle: string | null;
  price: number;
  currencyCode: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  imageAltText: string | null;
  variantId: string;
  variantTitle: string | null;
  coverColor: string;
  accentColor: string;
};

export type ShopifyCartLine = {
  id: string;
  quantity: number;
  merchandiseId: string;
  cost: {
    totalAmount: number;
    amountPerQuantity: number;
    currencyCode: string;
  };
  product: ShopifyCartProduct;
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: number;
    totalAmount: number;
    currencyCode: string;
  };
  lines: ShopifyCartLine[];
};

export type ShopifyCartLineInput = {
  merchandiseId: string;
  quantity: number;
};

export type ShopifyCartLineUpdateInput = {
  id: string;
  quantity: number;
};

export type ShopifyCartAttributeInput = {
  key: string;
  value: string;
};

export type ShopifyCreateCartOptions = {
  /**
   * Custom cart attributes that surface on the order in Shopify Admin under
   * "Additional details". Useful for tagging the channel/source of the order.
   */
  attributes?: ShopifyCartAttributeInput[];
  /** Free-form note that appears on the order in Shopify Admin. */
  note?: string;
};

type ShopifyMoneyV2 = {
  amount: string;
  currencyCode: string;
};

type ShopifyProductVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: ShopifyMoneyV2;
  compareAtPrice: ShopifyMoneyV2 | null;
  image: ShopifyImage | null;
};

type ShopifyVideoSource = {
  url: string;
  mimeType: string;
  format: string;
  height: number;
  width: number;
};

type ShopifyMediaNode = {
  mediaContentType: string;
  alt?: string | null;
  id?: string;
  image?: ShopifyImage | null;
  previewImage?: ShopifyImage | null;
  sources?: ShopifyVideoSource[];
};

type ShopifyProductNode = {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  vendor?: string | null;
  tags?: string[];
  featuredImage: ShopifyImage | null;
  collections?: {
    edges: Array<{
      node: {
        title: string;
        handle?: string;
      };
    }>;
  };
  images?: {
    edges: Array<{
      node: ShopifyImage;
    }>;
  };
  media?: {
    edges: Array<{
      node: ShopifyMediaNode;
    }>;
  };
  variants?: {
    edges: Array<{
      node: ShopifyProductVariantNode;
    }>;
  };
  priceRange: {
    minVariantPrice: ShopifyMoneyV2;
  };
};

type ShopifyPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

type ShopifyProductsQueryResponse = {
  data?: {
    products: {
      edges: Array<{
        node: ShopifyProductNode;
      }>;
      pageInfo: ShopifyPageInfo;
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCollectionNode = {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: ShopifyImage | null;
};

type ShopifyCollectionsQueryResponse = {
  data?: {
    collections: {
      edges: Array<{
        node: ShopifyCollectionNode;
      }>;
      pageInfo: ShopifyPageInfo;
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCollectionProductsQueryResponse = {
  data?: {
    collection: {
      products: {
        edges: Array<{
          node: ShopifyProductNode;
        }>;
        pageInfo: ShopifyPageInfo;
      };
    } | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCollectionImageQueryResponse = {
  data?: {
    collection: {
      image: ShopifyImage | null;
      products: {
        edges: Array<{
          node: {
            featuredImage: ShopifyImage | null;
          };
        }>;
      };
    } | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyProductByHandleQueryResponse = {
  data?: {
    productByHandle: ShopifyProductNode | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCartLineNode = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: ShopifyMoneyV2;
    amountPerQuantity: ShopifyMoneyV2;
  };
  merchandise: {
    __typename: 'ProductVariant';
    id: string;
    title: string;
    image: ShopifyImage | null;
    product: {
      id: string;
      title: string;
      handle: string;
      description: string;
      productType: string;
      featuredImage: ShopifyImage | null;
      collections?: {
        edges: Array<{
          node: {
            title: string;
          };
        }>;
      };
    };
    price: ShopifyMoneyV2;
  } | null;
};

type ShopifyCartNode = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: ShopifyMoneyV2;
    totalAmount: ShopifyMoneyV2;
  };
  lines: {
    edges: Array<{
      node: ShopifyCartLineNode;
    }>;
  };
};

type ShopifyCartResponse = {
  data?: {
    cart: ShopifyCartNode | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCartMutationPayload = {
  cart: ShopifyCartNode | null;
  userErrors: Array<{
    field: string[] | null;
    message: string;
  }>;
};

type ShopifyCartCreateResponse = {
  data?: {
    cartCreate: ShopifyCartMutationPayload;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCartLinesAddResponse = {
  data?: {
    cartLinesAdd: ShopifyCartMutationPayload;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCartLinesUpdateResponse = {
  data?: {
    cartLinesUpdate: ShopifyCartMutationPayload;
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCartLinesRemoveResponse = {
  data?: {
    cartLinesRemove: ShopifyCartMutationPayload;
  };
  errors?: Array<{
    message: string;
  }>;
};

const PRODUCT_FIELDS = `
  id
  title
  description
  handle
  productType
  vendor
  tags
  collections(first: 8) {
    edges {
      node {
        title
        handle
      }
    }
  }
  featuredImage {
    url
    altText
  }
  images(first: 10) {
    edges {
      node {
        url
        altText
      }
    }
  }
  variants(first: 20) {
    edges {
      node {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        image {
          url
          altText
        }
      }
    }
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
`;

/** מדיה מלאה (תמונות + סרטונים) — נטען רק במסך מוצר כדי לא להכביד על רשימות */
const PRODUCT_MEDIA_FIELDS = `
  media(first: 20) {
    edges {
      node {
        mediaContentType
        alt
        ... on MediaImage {
          id
          image {
            url
            altText
          }
        }
        ... on Video {
          id
          previewImage {
            url
            altText
          }
          sources {
            url
            mimeType
            format
            height
            width
          }
        }
      }
    }
  }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  buyerIdentity {
    phone
    email
  }
  discountCodes {
    code
    applicable
  }
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          amountPerQuantity {
            amount
            currencyCode
          }
        }
        merchandise {
          __typename
          ... on ProductVariant {
            id
            title
            image {
              url
              altText
            }
            price {
              amount
              currencyCode
            }
            product {
              id
              title
              handle
              description
              productType
              featuredImage {
                url
                altText
              }
              collections(first: 1) {
                edges {
                  node {
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function getShopifyEndpoint() {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
    return null;
  }

  return `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function getVariant(node: ShopifyProductNode) {
  return node.variants?.edges[0]?.node ?? null;
}

/**
 * כתובות וידאו משופיפיי מגיעות לפעמים עם דומיין מותאם (למשל ocd-online.co.il)
 * שמחזיר 404 ל־/cdn/shop/videos. מעבירים ל־cdn.shopify.com שעובד.
 */
function rewriteShopifyVideoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:cdn\/shop\/)?videos\/(.+)$/i);
    if (!match) return url;
    return `https://cdn.shopify.com/videos/${match[1]}${parsed.search}`;
  } catch {
    return url;
  }
}

function pickVideoSourceUrl(sources: ShopifyVideoSource[] | undefined): string | null {
  if (!sources?.length) return null;
  const mp4 = sources.filter(
    (source) => source.format?.toLowerCase() === 'mp4' || source.mimeType?.toLowerCase().includes('mp4'),
  );
  const pool = mp4.length ? mp4 : sources;
  // Prefer ~720–1080p — מקורות 4K כבדים יותר ועלולים להיכשל בניגון במובייל
  const ranked = [...pool].sort((a, b) => {
    const score = (width: number) => Math.abs((width || 0) - 900);
    return score(a.width) - score(b.width);
  });
  const rawUrl = ranked[0]?.url ?? null;
  return rawUrl ? rewriteShopifyVideoUrl(rawUrl) : null;
}

function normalizeProductMedia(node: ShopifyProductNode): ShopifyProductMediaItem[] {
  const edges = node.media?.edges ?? [];
  const items: ShopifyProductMediaItem[] = [];

  for (const edge of edges) {
    const media = edge.node;
    const contentType = media.mediaContentType?.toUpperCase();

    if (contentType === 'IMAGE' && media.image?.url) {
      items.push({
        id: media.id ?? `image-${items.length}`,
        type: 'image',
        url: media.image.url,
        altText: media.image.altText ?? media.alt ?? null,
        previewUrl: null,
      });
      continue;
    }

    if (contentType === 'VIDEO') {
      const videoUrl = pickVideoSourceUrl(media.sources);
      if (!videoUrl) continue;
      items.push({
        id: media.id ?? `video-${items.length}`,
        type: 'video',
        url: videoUrl,
        altText: media.alt ?? media.previewImage?.altText ?? null,
        previewUrl: media.previewImage?.url ?? null,
      });
    }
  }

  return items;
}

function normalizeProduct(node: ShopifyProductNode): ShopifyProduct {
  const galleryImages = node.images?.edges.map((edge) => edge.node).filter((image) => !!image?.url) ?? [];
  const images = galleryImages.length
    ? galleryImages
    : node.featuredImage?.url
      ? [node.featuredImage]
      : [];
  const media = normalizeProductMedia(node);
  const variant = getVariant(node);
  const fallbackPrice = node.priceRange.minVariantPrice;

  const variants: ShopifyProductVariant[] = (node.variants?.edges ?? []).map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    availableForSale: edge.node.availableForSale,
    price: toNumber(edge.node.price.amount),
    compareAtPrice: edge.node.compareAtPrice ? toNumber(edge.node.compareAtPrice.amount) : null,
    currencyCode: edge.node.price.currencyCode,
    imageUrl: edge.node.image?.url ?? null,
    imageAltText: edge.node.image?.altText ?? null,
  }));

  const compareAtPrice = variant?.compareAtPrice && toNumber(variant.compareAtPrice.amount) > toNumber(variant.price.amount)
    ? toNumber(variant.compareAtPrice.amount)
    : null;

  const collectionTitles =
    node.collections?.edges
      ?.map((e) => e.node?.title?.trim())
      .filter((t): t is string => !!t && t.length > 0) ?? [];
  const collectionHandles =
    node.collections?.edges
      ?.map((e) => e.node?.handle?.trim())
      .filter((t): t is string => !!t && t.length > 0) ?? [];
  const primaryCollectionTitle = collectionTitles[0] ?? null;

  return {
    id: node.id,
    title: node.title,
    description: node.description,
    handle: node.handle,
    imageUrl: node.featuredImage?.url ?? null,
    imageAltText: node.featuredImage?.altText ?? null,
    images,
    media,
    price: toNumber(variant?.price.amount ?? fallbackPrice.amount),
    compareAtPrice,
    currencyCode: variant?.price.currencyCode ?? fallbackPrice.currencyCode,
    productType: node.productType?.trim() || 'מוצרים',
    vendor: node.vendor?.trim() || null,
    tags: node.tags ?? [],
    collectionHandles,
    collectionTitles,
    primaryCollectionTitle,
    variantId: variant?.id ?? null,
    variantTitle: variant?.title ?? null,
    availableForSale: variant?.availableForSale ?? false,
    variants,
  };
}

function normalizeCollection(node: ShopifyCollectionNode): ShopifyCollection {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: node.description,
    imageUrl: node.image?.url ?? null,
  };
}

/** חיפוש פריט תפריט לפי handle של קולקציה (רקורסיבי) — לרצועת «חברות נבחרות» לפי API */
export function findMenuItemByCollectionHandle(
  menuItems: ShopifyMenuItem[],
  collectionHandle: string,
): ShopifyMenuItem | null {
  const want = collectionHandle.trim().toLowerCase();
  if (!want) return null;
  for (const item of menuItems) {
    if (item.collectionHandle?.trim().toLowerCase() === want) return item;
    if (item.children?.length) {
      const nested = findMenuItemByCollectionHandle(item.children, collectionHandle);
      if (nested) return nested;
    }
  }
  return null;
}

function getCartPalette(index: number) {
  const palettes = [
    { coverColor: '#89A89C', accentColor: '#DCE9E2' },
    { coverColor: '#F2EADD', accentColor: '#FCF8F2' },
    { coverColor: '#E7F0D6', accentColor: '#F8FBEF' },
    { coverColor: '#DDEAF3', accentColor: '#F5FAFD' },
  ];

  return palettes[index % palettes.length];
}

function normalizeCart(cart: ShopifyCartNode | null): ShopifyCart | null {
  if (!cart) return null;

  const lines: ShopifyCartLine[] = cart.lines.edges.reduce<ShopifyCartLine[]>((acc, edge, index) => {
      const merchandise = edge.node.merchandise;
      const product = merchandise?.product;
      if (!merchandise || !product) {
        return acc;
      }

      const palette = getCartPalette(index);
      const collectionTitle =
        product.collections?.edges?.[0]?.node?.title?.trim() || null;

      acc.push({
        id: edge.node.id,
        quantity: edge.node.quantity,
        merchandiseId: merchandise.id,
        cost: {
          totalAmount: toNumber(edge.node.cost.totalAmount.amount),
          amountPerQuantity: toNumber(edge.node.cost.amountPerQuantity.amount),
          currencyCode: edge.node.cost.totalAmount.currencyCode,
        },
        product: {
          id: product.id,
          name: product.title,
          subtitle: product.productType?.trim() ?? '',
          collectionTitle,
          price: toNumber(merchandise.price.amount),
          currencyCode: merchandise.price.currencyCode,
          handle: product.handle,
          description: product.description,
          imageUrl: merchandise.image?.url ?? product.featuredImage?.url ?? null,
          imageAltText: merchandise.image?.altText ?? product.featuredImage?.altText ?? null,
          variantId: merchandise.id,
          variantTitle: merchandise.title,
          coverColor: palette.coverColor,
          accentColor: palette.accentColor,
        },
      });

      return acc;
    }, []);

  return {
    id: cart.id,
    checkoutUrl: normalizeCheckoutUrl(cart.checkoutUrl),
    totalQuantity: cart.totalQuantity,
    cost: {
      subtotalAmount: toNumber(cart.cost.subtotalAmount.amount),
      totalAmount: toNumber(cart.cost.totalAmount.amount),
      currencyCode: cart.cost.totalAmount.currencyCode,
    },
    lines,
  };
}

function getGraphQlErrors(errors?: Array<{ message: string }>) {
  return errors?.map((item) => item.message).filter(Boolean) ?? [];
}

function getUserErrors(payload?: ShopifyCartMutationPayload | null) {
  return payload?.userErrors?.map((item) => item.message).filter(Boolean) ?? [];
}

async function storefrontRequest<TResponse>(query: string, variables?: Record<string, unknown>): Promise<TResponse> {
  const endpoint = getShopifyEndpoint();

  if (!endpoint || !SHOPIFY_STOREFRONT_TOKEN) {
    throw new Error('Shopify storefront is not configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

function assertCartMutation(payload: ShopifyCartMutationPayload | undefined | null, errors?: Array<{ message: string }>) {
  const messages = [...getGraphQlErrors(errors), ...getUserErrors(payload)];
  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  const normalizedCart = normalizeCart(payload?.cart ?? null);
  if (!normalizedCart) {
    throw new Error('Shopify did not return a valid cart');
  }

  return normalizedCart;
}

/**
 * Shopify Storefront API caps each connection request at 250 nodes.
 * To retrieve more, we follow the `pageInfo.hasNextPage` cursor in a loop.
 */
const SHOPIFY_PAGE_SIZE_MAX = 250;

/**
 * Compute how many items to request on the next page when an optional
 * `limit` is provided. When `limit` is undefined, we always request the
 * maximum page size and rely on `hasNextPage` to terminate the loop.
 */
function getNextPageSize(collected: number, limit: number | undefined): number {
  if (limit === undefined) return SHOPIFY_PAGE_SIZE_MAX;
  return Math.max(0, Math.min(SHOPIFY_PAGE_SIZE_MAX, limit - collected));
}

/**
 * מוצרים בקטלוג לפי **הכי נמכר** ב-Shopify (`BEST_SELLING`) — מתאים לטאב «הכי נמכרים» בדף הבית.
 * כשמועבר `limit`, מוחזרים רק הראשונים (למשל 10). הסדר מתעדכן לפי נתוני המכירות ששופיפיי מחשבים.
 *
 * When `limit` is omitted, ALL products are fetched via cursor pagination.
 */
export async function fetchProducts(limit?: number): Promise<ShopifyProduct[]> {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: BEST_SELLING) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const first = getNextPageSize(out.length, limit);
    if (first <= 0) break;

    const payload = await storefrontRequest<ShopifyProductsQueryResponse>(query, {
      first,
      after: cursor,
    });
    const messages = getGraphQlErrors(payload.errors);
    if (messages.length) {
      throw new Error(messages.join(', '));
    }

    const conn = payload.data?.products;
    if (!conn) break;

    for (const edge of conn.edges) {
      out.push(normalizeProduct(edge.node));
      if (limit !== undefined && out.length >= limit) break;
    }

    if (limit !== undefined && out.length >= limit) break;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }

  return out;
}

/**
 * Products שהועלו לאחרונה לקטלוג — לפי תאריך יצירה ב-Shopify (`created_at`), החדשים ראשון.
 * מתעדכן אוטומטית כשמוסיפים מוצרים בחנות (בכניסה הבאה לטעינת הנתונים).
 */
export async function fetchNewestProducts(limit?: number): Promise<ShopifyProduct[]> {
  const query = `
    query GetNewestProducts($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const first = getNextPageSize(out.length, limit);
    if (first <= 0) break;

    const payload = await storefrontRequest<ShopifyProductsQueryResponse>(query, {
      first,
      after: cursor,
    });
    const messages = getGraphQlErrors(payload.errors);
    if (messages.length) {
      throw new Error(messages.join(', '));
    }

    const conn = payload.data?.products;
    if (!conn) break;

    for (const edge of conn.edges) {
      out.push(normalizeProduct(edge.node));
      if (limit !== undefined && out.length >= limit) break;
    }

    if (limit !== undefined && out.length >= limit) break;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }

  return out;
}

/**
 * Search products via Shopify's `query` argument. When `limit` is omitted,
 * ALL matching products are fetched via cursor pagination.
 */
export async function searchProducts(searchQuery: string, limit?: number): Promise<ShopifyProduct[]> {
  const query = `
    query SearchProducts($first: Int!, $after: String, $query: String!) {
      products(first: $first, after: $after, query: $query) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const first = getNextPageSize(out.length, limit);
    if (first <= 0) break;

    const payload = await storefrontRequest<ShopifyProductsQueryResponse>(query, {
      first,
      after: cursor,
      query: searchQuery,
    });
    const messages = getGraphQlErrors(payload.errors);
    if (messages.length) {
      throw new Error(messages.join(', '));
    }

    const conn = payload.data?.products;
    if (!conn) break;

    for (const edge of conn.edges) {
      out.push(normalizeProduct(edge.node));
      if (limit !== undefined && out.length >= limit) break;
    }

    if (limit !== undefined && out.length >= limit) break;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }

  return out;
}

/**
 * Fetch collections from Shopify. When `limit` is omitted, ALL collections
 * are fetched via cursor pagination.
 */
export async function fetchCollections(limit?: number): Promise<ShopifyCollection[]> {
  const query = `
    query GetCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after, sortKey: UPDATED_AT) {
        edges {
          node {
            id
            title
            handle
            description
            image {
              url
              altText
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const out: ShopifyCollection[] = [];
  let cursor: string | null = null;

  while (true) {
    const first = getNextPageSize(out.length, limit);
    if (first <= 0) break;

    const payload = await storefrontRequest<ShopifyCollectionsQueryResponse>(query, {
      first,
      after: cursor,
    });
    const messages = getGraphQlErrors(payload.errors);
    if (messages.length) {
      throw new Error(messages.join(', '));
    }

    const conn = payload.data?.collections;
    if (!conn) break;

    for (const edge of conn.edges) {
      out.push(normalizeCollection(edge.node));
      if (limit !== undefined && out.length >= limit) break;
    }

    if (limit !== undefined && out.length >= limit) break;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }

  return out;
}

type ShopifyCollectionSummaryQueryResponse = {
  data?: {
    collection: {
      title: string;
      handle: string;
      description: string;
      image: ShopifyImage | null;
    } | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

/** פרטי קולקציה מה־Storefront API — לרצועת «חברות נבחרות» כשמזהים לפי handle */
export async function fetchCollectionSummary(handle: string): Promise<{
  handle: string;
  title: string;
  description: string;
  imageUrl: string | null;
} | null> {
  const normalized = handle.trim();
  if (!normalized) return null;

  const query = `
    query GetCollectionSummary($handle: String!) {
      collection(handle: $handle) {
        title
        handle
        description
        image {
          url
          altText
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCollectionSummaryQueryResponse>(query, {
    handle: normalized,
  });
  const messages = getGraphQlErrors(payload.errors);
  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  const node = payload.data?.collection;
  if (!node?.handle) return null;

  return {
    handle: node.handle,
    title: node.title,
    description: node.description ?? '',
    imageUrl: node.image?.url ?? null,
  };
}

/** מיון מוצרים בקולקציה — ראה `ProductCollectionSortKeys` ב־Storefront API */
export type CollectionProductsSortKey =
  | 'BEST_SELLING'
  | 'COLLECTION_DEFAULT'
  | 'CREATED'
  | 'ID'
  | 'MANUAL'
  | 'PRICE'
  | 'TITLE';

export type FetchCollectionProductsOptions = {
  sortKey?: CollectionProductsSortKey;
  /** רלוונטי ל־CREATED / PRICE / TITLE וכו׳ */
  reverse?: boolean;
};

/**
 * Fetch products inside a single collection. When `limit` is omitted, ALL
 * products in the collection are fetched via cursor pagination.
 */
export async function fetchCollectionProducts(
  handle: string,
  limit?: number,
  options?: FetchCollectionProductsOptions,
): Promise<ShopifyProduct[]> {
  const sortKey: CollectionProductsSortKey = options?.sortKey ?? 'BEST_SELLING';
  const reverse = options?.reverse ?? false;

  const query = `
    query GetCollectionProducts($handle: String!, $first: Int!, $after: String, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean!) {
      collection(handle: $handle) {
        products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
          edges {
            node {
              ${PRODUCT_FIELDS}
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const out: ShopifyProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const first = getNextPageSize(out.length, limit);
    if (first <= 0) break;

    const payload = await storefrontRequest<ShopifyCollectionProductsQueryResponse>(query, {
      handle,
      first,
      after: cursor,
      sortKey,
      reverse,
    });
    const messages = getGraphQlErrors(payload.errors);
    if (messages.length) {
      throw new Error(messages.join(', '));
    }

    const conn = payload.data?.collection?.products;
    if (!conn) break;

    for (const edge of conn.edges) {
      out.push(normalizeProduct(edge.node));
      if (limit !== undefined && out.length >= limit) break;
    }

    if (limit !== undefined && out.length >= limit) break;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    cursor = conn.pageInfo.endCursor;
  }

  return out;
}

export async function fetchCollectionImage(handle: string): Promise<string | null> {
  const query = `
    query GetCollectionImage($handle: String!) {
      collection(handle: $handle) {
        image {
          url
        }
        products(first: 6, sortKey: BEST_SELLING) {
          edges {
            node {
              featuredImage {
                url
              }
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCollectionImageQueryResponse>(query, { handle });
  const collection = payload.data?.collection;
  if (!collection) return null;

  if (collection.image?.url) return collection.image.url;

  const firstProductImage = collection.products.edges.find((e) => e.node.featuredImage?.url)?.node.featuredImage?.url;
  return firstProductImage ?? null;
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const normalizedHandle = handle.trim();
  if (!normalizedHandle) return null;

  const query = `
    query GetProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        ${PRODUCT_FIELDS}
        ${PRODUCT_MEDIA_FIELDS}
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyProductByHandleQueryResponse>(query, { handle: normalizedHandle });
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  const node = payload.data?.productByHandle ?? null;
  return node ? normalizeProduct(node) : null;
}

export async function fetchCart(cartId: string): Promise<ShopifyCart | null> {
  const query = `
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FIELDS}
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartResponse>(query, { cartId });
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  return normalizeCart(payload.data?.cart ?? null);
}

export async function createCart(
  lines: ShopifyCartLineInput[] = [],
  options: ShopifyCreateCartOptions = {},
): Promise<ShopifyCart> {
  const query = `
    mutation CreateCart($input: CartInput) {
      cartCreate(input: $input) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input: Record<string, unknown> = {};
  if (lines.length) input.lines = lines;
  if (options.attributes?.length) input.attributes = options.attributes;
  if (options.note) input.note = options.note;

  const payload = await storefrontRequest<ShopifyCartCreateResponse>(query, { input });

  return assertCartMutation(payload.data?.cartCreate, payload.errors);
}

export async function addCartLines(cartId: string, lines: ShopifyCartLineInput[]): Promise<ShopifyCart> {
  const query = `
    mutation AddCartLines($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartLinesAddResponse>(query, { cartId, lines });
  return assertCartMutation(payload.data?.cartLinesAdd, payload.errors);
}

export async function updateCartLines(cartId: string, lines: ShopifyCartLineUpdateInput[]): Promise<ShopifyCart> {
  const query = `
    mutation UpdateCartLines($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartLinesUpdateResponse>(query, { cartId, lines });
  return assertCartMutation(payload.data?.cartLinesUpdate, payload.errors);
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const query = `
    mutation RemoveCartLines($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartLinesRemoveResponse>(query, { cartId, lineIds });
  return assertCartMutation(payload.data?.cartLinesRemove, payload.errors);
}

type ShopifyCartBuyerIdentityUpdateResponse = {
  data?: {
    cartBuyerIdentityUpdate: ShopifyCartMutationPayload;
  };
  errors?: Array<{ message: string }>;
};

type ShopifyCartDiscountCodesUpdateResponse = {
  data?: {
    cartDiscountCodesUpdate: ShopifyCartMutationPayload;
  };
  errors?: Array<{ message: string }>;
};

export type ShopifyCartBuyerIdentityInput = {
  /** E.164 phone (e.g. +972501234567). Pass null to clear a previously set phone. */
  phone?: string | null;
  email?: string | null;
  countryCode?: string;
};

/**
 * Associate the cart with the logged-in buyer. Storefront can only set
 * email/phone/country without a customerAccessToken — this pre-fills identity
 * at checkout but does NOT authenticate the customer.
 */
export async function updateCartBuyerIdentity(
  cartId: string,
  buyerIdentity: ShopifyCartBuyerIdentityInput,
): Promise<ShopifyCart> {
  const query = `
    mutation UpdateCartBuyerIdentity($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartBuyerIdentityUpdateResponse>(query, {
    cartId,
    buyerIdentity,
  });
  return assertCartMutation(payload.data?.cartBuyerIdentityUpdate, payload.errors);
}

/** Apply discount code(s) to the cart (empty array clears them). */
export async function updateCartDiscountCodes(
  cartId: string,
  discountCodes: string[],
): Promise<ShopifyCart> {
  const query = `
    mutation UpdateCartDiscountCodes($cartId: ID!, $discountCodes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCartDiscountCodesUpdateResponse>(query, {
    cartId,
    discountCodes,
  });
  return assertCartMutation(payload.data?.cartDiscountCodesUpdate, payload.errors);
}

/** Public Storefront GraphQL helper (Lovable / shop menu pipeline) */
export async function storefrontApiRequest<TResponse>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TResponse> {
  return storefrontRequest<TResponse>(query, variables);
}
