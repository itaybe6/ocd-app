const SHOPIFY_API_VERSION = '2025-01';

const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim();
const SHOPIFY_STOREFRONT_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();
const SHOPIFY_MENU_HANDLE = process.env.EXPO_PUBLIC_SHOPIFY_MENU_HANDLE?.trim() || 'main-menu';

export type ShopifyImage = {
  url: string;
  altText: string | null;
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

type ShopifyMoneyV2 = {
  amount: string;
  currencyCode: string;
};

type ShopifyProductVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: ShopifyMoneyV2;
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
  variants(first: 1) {
    edges {
      node {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
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
          subtitle: product.productType?.trim() || 'מוצר',
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

export async function fetchProducts(first = 12): Promise<ShopifyProduct[]> {
  const query = `
    query GetProducts($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            ${PRODUCT_FIELDS}
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyProductsQueryResponse>(query, { first });
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
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
            image {
              url
              altText
            }
          }
        }
      }
    }
  `;

  const payload = await storefrontRequest<ShopifyCollectionsQueryResponse>(query, { first });
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
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

export async function fetchCollectionProducts(handle: string, first = 40): Promise<ShopifyProduct[]> {
  const query = `
    query GetCollectionProducts($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        products(first: $first, sortKey: BEST_SELLING) {
          edges {
            node {
              ${PRODUCT_FIELDS}
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
  const messages = getGraphQlErrors(payload.errors);

  if (messages.length) {
    throw new Error(messages.join(', '));
  }

  return payload.data?.collection?.products.edges.map((edge) => normalizeProduct(edge.node)) ?? [];
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

export async function createCart(lines: ShopifyCartLineInput[] = []): Promise<ShopifyCart> {
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

  const payload = await storefrontRequest<ShopifyCartCreateResponse>(query, {
    input: lines.length ? { lines } : {},
  });

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
