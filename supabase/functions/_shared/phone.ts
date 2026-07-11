/**
 * Phone helpers shared across OCD+ functions.
 *
 * `public.users.phone` is stored in mixed historical formats (e.g. `0502307500`,
 * `972502307500`, `+972502307500`, `050-230-7500`). These helpers normalise to
 * the variants we need for lookups and for third-party APIs.
 */

/** All reasonable variants to match a phone against rows in `public.users`. */
export function phoneLookupVariants(input: string): string[] {
  const raw = (input ?? '').trim();
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return [];

  const variants = new Set<string>();
  variants.add(raw);
  variants.add(digits);

  if (digits.startsWith('972')) {
    variants.add(`+${digits}`);
    variants.add(`0${digits.slice(3)}`);
  } else if (digits.startsWith('0')) {
    variants.add(`972${digits.slice(1)}`);
    variants.add(`+972${digits.slice(1)}`);
  }

  return Array.from(variants).filter((v) => v.length > 0);
}

/** E.164 form for Israeli numbers (e.g. `+972502307500`) — used by Shopify. */
export function toE164Israel(input: string): string {
  const digits = (input ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}
