import { decodeReviewResponse, encodeReviewRequest } from './reviewWireFormat';

const SITE_ORIGIN = 'https://www.ocd-online.co.il';
// Public TanStack Start functions used by the website's own review form.
// Keep these in sync with the website until it exposes a versioned mobile API.
const READ_FUNCTION = process.env.EXPO_PUBLIC_REVIEWS_READ_FUNCTION_ID || '8ec698719fe119575841f970c117f12fa1756e982e966cfe6b31983e57436180';
const WRITE_FUNCTION = process.env.EXPO_PUBLIC_REVIEWS_WRITE_FUNCTION_ID || '3d47858fffedc8981d002e399a5dd8c31fd51dd213cd158e06b0d5fa53090b36';

export type ProductReview = {
  id: string;
  customer_name: string;
  city: string | null;
  avatar_url: string | null;
  review_text: string;
  rating: number;
  image_url: string | null;
  created_at: string;
};

export type ReviewInput = {
  product_handle: string;
  product_title: string;
  customer_name: string;
  city: string;
  review_text: string;
  rating: number;
  image_url: string | null;
};

async function callReviewFunction(id: string, data: unknown, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 30_000);
  try {
    const response = await fetch(`${SITE_ORIGIN}/_serverFn/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-tsr-serverFn': 'true' },
      body: JSON.stringify(encodeReviewRequest(data)),
      signal: controller.signal,
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Review service unavailable');
    const json = await response.json();
    const decoded = response.headers.get('x-tss-serialized')
      ? decodeReviewResponse(json)
      : json;
    if (decoded instanceof Error) throw decoded;
    if (!response.ok || !decoded || typeof decoded !== 'object') throw new Error('Review request failed');
    const envelope = decoded as Record<string, unknown>;
    if (envelope.error) throw envelope.error instanceof Error ? envelope.error : new Error('Review request failed');
    if (!Object.prototype.hasOwnProperty.call(decoded, 'result')) throw new Error('Invalid review response');
    return envelope.result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^https:\/\//i.test(value) || (value.length <= 2_000_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) ? value : null;
}

export async function fetchProductReviews(handle: string, signal?: AbortSignal): Promise<ProductReview[]> {
  const result = await callReviewFunction(READ_FUNCTION, { handle }, signal) as { reviews?: unknown };
  if (!result || !Array.isArray(result.reviews)) throw new Error('Invalid review list');
  return result.reviews.filter((item): item is Record<string, unknown> => (
    !!item && typeof item === 'object' && item.active !== false &&
    (!item.product_handle || item.product_handle === handle) &&
    typeof item.id === 'string' && typeof item.customer_name === 'string' &&
    typeof item.review_text === 'string' && Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5
  )).map(item => ({
    id: item.id as string,
    customer_name: item.customer_name as string,
    city: typeof item.city === 'string' ? item.city : null,
    avatar_url: imageUrl(item.avatar_url),
    review_text: item.review_text as string,
    rating: item.rating as number,
    image_url: imageUrl(item.image_url),
    created_at: typeof item.created_at === 'string' ? item.created_at : '',
  }));
}

export function validateReview(input: ReviewInput): string | null {
  if (!input.product_handle.trim()) return 'לא נמצא מוצר לביקורת';
  if (input.customer_name.trim().length < 2) return 'יש להזין שם עם לפחות 2 תווים';
  if (input.customer_name.trim().length > 100 || input.city.trim().length > 100) return 'השם או שם העיר ארוכים מדי';
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return 'בחרו דירוג בין 1 ל־5';
  if (input.review_text.trim().length < 8) return 'כתבו לפחות 8 תווים על החוויה שלכם';
  if (input.review_text.trim().length > 4000) return 'אפשר לכתוב עד 4,000 תווים';
  if (input.image_url && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.image_url) || input.image_url.length > 2_000_000)) return 'התמונה גדולה מדי, נסו תמונה אחרת';
  return null;
}

export async function submitProductReview(input: ReviewInput): Promise<void> {
  const error = validateReview(input);
  if (error) throw new Error(error);
  // No automatic retries: a lost response must never publish a duplicate review.
  await callReviewFunction(WRITE_FUNCTION, {
    ...input,
    customer_name: input.customer_name.trim(),
    city: input.city.trim(),
    review_text: input.review_text.trim(),
  });
}

export const productReviewsKey = (handle: string) => ['product-reviews', handle] as const;
