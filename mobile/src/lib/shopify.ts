const SHOPIFY_API_VERSION = '2025-01';

const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim();
const SHOPIFY_STOREFRONT_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();
const SHOPIFY_MENU_HANDLE = process.env.EXPO_PUBLIC_SHOPIFY_MENU_HANDLE?.trim() || 'main-menu';

export type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  handle: string;
  imageUrl: string | null;
  imageAltText: string | null;
  price: number;
  currencyCode: string;
  productType: string;
};

export type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
  description: string;
};

export type ShopifyMenuItem = {
  id: string;
  title: string;
  collectionHandle?: string;
  collectionDescription?: string;
  children?: ShopifyMenuItem[];
};

type ShopifyMoneyV2 = {
  amount: string;
  currencyCode: string;
};

type ShopifyImage = {
  url: string;
  altText: string | null;
};

type ShopifyProductNode = {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  featuredImage: ShopifyImage | null;
  priceRange: {
    minVariantPrice: ShopifyMoneyV2;
  };
};

type ShopifyProductsQueryResponse = {
  data?: {
    products: {
      edges: Array<{
        node: ShopifyProductNode;
      }>;
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
  } | null;
};

type ShopifyCollectionsQueryResponse = {
  data?: {
    collections: {
      edges: Array<{
        node: ShopifyCollectionNode;
      }>;
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

function getShopifyEndpoint() {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
    return null;
  }

  return `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

function normalizeProduct(node: ShopifyProductNode): ShopifyProduct {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    handle: node.handle,
    imageUrl: node.featuredImage?.url ?? null,
    imageAltText: node.featuredImage?.altText ?? null,
    price: Number(node.priceRange.minVariantPrice.amount),
    currencyCode: node.priceRange.minVariantPrice.currencyCode,
    productType: node.productType?.trim() || 'מוצרים',
  };
}

function normalizeCollection(node: ShopifyCollectionNode): ShopifyCollection {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: node.description,
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
    children: children.length ? children : undefined,
  };
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

export async function fetchProducts(first = 12): Promise<ShopifyProduct[]> {
  const query = `
    query GetProducts($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            handle
            productType
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyProductsQueryResponse>(query, { first });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(', '));
  }

  return payload.data?.products.edges.map((edge) => normalizeProduct(edge.node)) ?? [];
}

export async function fetchCollections(first = 50): Promise<ShopifyCollection[]> {
  const query = `
    query GetCollections($first: Int!) {
      collections(first: $first, sortKey: UPDATED_AT) {
        edges {
          node {
            id
            title
            handle
            description
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCollectionsQueryResponse>(query, { first });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(', '));
  }

  return payload.data?.collections.edges.map((edge) => normalizeCollection(edge.node)) ?? [];
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
                }
              }
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyMenuQueryResponse>(query, { handle });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(', '));
  }

  return payload.data?.menu?.items.map((item) => normalizeMenuItem(item)).filter((item): item is ShopifyMenuItem => !!item) ?? [];
}

export async function fetchCollectionProducts(handle: string, first = 40): Promise<ShopifyProduct[]> {
  const query = `
    query GetCollectionProducts($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        products(first: $first, sortKey: BEST_SELLING) {
          edges {
            node {
              id
              title
              description
              handle
              productType
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCollectionProductsQueryResponse>(query, {
    handle,
    first,
  });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(', '));
  }

  return payload.data?.collection?.products.edges.map((edge) => normalizeProduct(edge.node)) ?? [];
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const normalizedHandle = handle.trim();
  if (!normalizedHandle) return null;

  const query = `
    query GetProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        description
        handle
        productType
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyProductByHandleQueryResponse>(query, { handle: normalizedHandle });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join(', '));
  }

  const node = payload.data?.productByHandle ?? null;
  return node ? normalizeProduct(node) : null;
}
