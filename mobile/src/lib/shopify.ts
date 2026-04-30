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
const SHOPIFY_MENU_HANDLE = process.env.EXPO_PUBLIC_SHOPIFY_MENU_HANDLE?.trim() || 'main-menu';

export type ShopifyImage = {
  url: string;
  altText: string | null;
};

export type ShopifyProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: number;
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
  price: number;
  currencyCode: string;
  productType: string;
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
  image: ShopifyImage | null;
};

type ShopifyProductNode = {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  featuredImage: ShopifyImage | null;
  images?: {
    edges: Array<{
      node: ShopifyImage;
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

type ShopifyMenuItemNode = {
  id: string;
  title: string;
  url: string | null;
  items?: ShopifyMenuItemNode[];
  resource?: {
    __typename: 'Collection';
    id: string;
    title: string;
    handle: string;
    description: string;
    image: ShopifyImage | null;
  } | null;
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

type ShopifyMenuQueryResponse = {
  data?: {
    menu: {
      id: string;
      title: string;
      items: ShopifyMenuItemNode[];
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

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
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

function normalizeProduct(node: ShopifyProductNode): ShopifyProduct {
  const galleryImages = node.images?.edges.map((edge) => edge.node).filter((image) => !!image?.url) ?? [];
  const images = galleryImages.length
    ? galleryImages
    : node.featuredImage?.url
      ? [node.featuredImage]
      : [];
  const variant = getVariant(node);
  const fallbackPrice = node.priceRange.minVariantPrice;

  const variants: ShopifyProductVariant[] = (node.variants?.edges ?? []).map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    availableForSale: edge.node.availableForSale,
    price: toNumber(edge.node.price.amount),
    currencyCode: edge.node.price.currencyCode,
    imageUrl: edge.node.image?.url ?? null,
    imageAltText: edge.node.image?.altText ?? null,
  }));

  return {
    id: node.id,
    title: node.title,
    description: node.description,
    handle: node.handle,
    imageUrl: node.featuredImage?.url ?? null,
    imageAltText: node.featuredImage?.altText ?? null,
    images,
    price: toNumber(variant?.price.amount ?? fallbackPrice.amount),
    currencyCode: variant?.price.currencyCode ?? fallbackPrice.currencyCode,
    productType: node.productType?.trim() || 'מוצרים',
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

function extractCollectionHandleFromUrl(url: string | null | undefined) {
  if (!url) return undefined;

  const match = url.match(/\/collections\/([^/?#]+)/i);
  return match?.[1];
}

function normalizeMenuItem(node: ShopifyMenuItemNode): ShopifyMenuItem | null {
  const collectionHandle = node.resource?.handle ?? extractCollectionHandleFromUrl(node.url);
  const collectionDescription = node.resource?.description || undefined;
  const collectionImageUrl = node.resource?.image?.url ?? undefined;
  const children = (node.items ?? [])
    .map((child) => normalizeMenuItem(child))
    .filter((child): child is ShopifyMenuItem => !!child);

  if (!collectionHandle && !children.length) {
    return null;
  }

  return {
    id: node.id,
    title: node.title.trim(),
    collectionHandle,
    collectionDescription,
    collectionImageUrl,
    children: children.length ? children : undefined,
  };
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
    checkoutUrl: cart.checkoutUrl,
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
 * Fetch products from Shopify. When `limit` is omitted, ALL products are
 * fetched via cursor pagination. Pass a number to cap the result.
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

export async function fetchMenuItems(handle = SHOPIFY_MENU_HANDLE): Promise<ShopifyMenuItem[]> {
  const query = `
    query GetMenu($handle: String!) {
      menu(handle: $handle) {
        id
        title
        items {
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
              image {
                url
                altText
              }
            }
          }
          items {
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
                image {
                  url
                  altText
                }
              }
            }
            items {
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
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyMenuQueryResponse>(query, { handle });
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  return payload.data?.menu?.items.map((item) => normalizeMenuItem(item)).filter((item): item is ShopifyMenuItem => !!item) ?? [];
}

/**
 * Fetch products inside a single collection. When `limit` is omitted, ALL
 * products in the collection are fetched via cursor pagination.
 */
export async function fetchCollectionProducts(handle: string, limit?: number): Promise<ShopifyProduct[]> {
  const query = `
    query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
      collection(handle: $handle) {
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
