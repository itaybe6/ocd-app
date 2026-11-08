export type ProductBundleTier = {
  qty: number;
  label: string;
  price: number;
  currencyCode: string;
  variantId: string;
  /** כותרת וריאציית המקור שהמבצע שייך אליה. ריק כשהבאנדל חל על כל הווריאציות. */
  sourceVariantTitle: string | null;
  availableForSale: boolean;
};

export type BundleVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  selectedOptions?: Array<{ name: string; value: string }>;
};

const QTY_OPTION = 'כמות';
const SOURCE_OPTION = 'וריאציה';

export function isCatalogBundleProduct(tags: string[] | undefined): boolean {
  return (tags ?? []).some((tag) => tag === 'bundle' || tag.startsWith('bundle-of:'));
}

function normalizeVariantTitle(title: string | null | undefined): string {
  return (title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseQty(label: string): number | null {
  const plain = label.trim();
  const match = plain.match(/^(\d+)/);
  if (match) {
    const qty = Number(match[1]);
    return Number.isFinite(qty) && qty > 1 ? qty : null;
  }
  if (plain === 'זוג') return 2;
  if (plain === 'שלישייה') return 3;
  if (plain === 'רביעייה') return 4;
  return null;
}

function tierLabel(qty: number, raw: string): string {
  const plain = raw.trim();
  if (/^\d+\s*יחידות?$/.test(plain)) {
    if (qty === 2) return 'זוג';
    if (qty === 3) return 'שלישייה';
    if (qty === 4) return 'רביעייה';
    return `${qty} יחידות`;
  }
  return plain;
}

function readOption(node: BundleVariantNode, name: string): string | null {
  const value = node.selectedOptions?.find((option) => option.name === name)?.value?.trim();
  return value || null;
}

export function parseBundleVariantNodes(nodes: BundleVariantNode[]): ProductBundleTier[] {
  const tiers: ProductBundleTier[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (!node?.id || seen.has(node.id)) continue;
    const qtyLabel = readOption(node, QTY_OPTION) ?? node.title.split(' / ').at(-1)?.trim() ?? '';
    const qty = parseQty(qtyLabel);
    const price = Number(node.price?.amount);
    if (!qty || !Number.isFinite(price) || price <= 0) continue;

    const sourceFromOption = readOption(node, SOURCE_OPTION);
    const sourceFromTitle = node.title.includes(' / ')
      ? node.title.split(' / ').slice(0, -1).join(' / ').trim()
      : '';
    const sourceVariantTitle = sourceFromOption || sourceFromTitle || null;

    seen.add(node.id);
    tiers.push({
      qty,
      label: tierLabel(qty, qtyLabel),
      price,
      currencyCode: node.price.currencyCode || 'ILS',
      variantId: node.id,
      sourceVariantTitle,
      availableForSale: node.availableForSale !== false,
    });
  }

  return tiers.sort((a, b) => a.qty - b.qty || a.price - b.price);
}

export function bundleTiersForVariant(
  tiers: ProductBundleTier[],
  variantTitle: string | null | undefined,
): ProductBundleTier[] {
  const key = normalizeVariantTitle(variantTitle);
  const isDefault = key === '' || key === 'default title';

  return tiers
    .filter((tier) => tier.availableForSale)
    .filter((tier) => {
      if (!tier.sourceVariantTitle) return true;
      if (isDefault) return false;
      return normalizeVariantTitle(tier.sourceVariantTitle) === key;
    })
    .sort((a, b) => a.qty - b.qty || a.price - b.price);
}

/** הכמות עם המחיר הנמוך ביותר ליחידה. בתיקו נשמרת הכמות הקטנה יותר. */
export function bestBundleQty(tiers: ProductBundleTier[]): number | null {
  let best: { qty: number; perUnit: number } | null = null;
  for (const tier of tiers) {
    if (tier.qty <= 1) continue;
    const perUnit = tier.price / tier.qty;
    if (!best || perUnit < best.perUnit) {
      best = { qty: tier.qty, perUnit };
    }
  }
  return best?.qty ?? null;
}
