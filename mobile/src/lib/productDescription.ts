export type ProductDescriptionBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] };

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

const BULLET_PREFIX = /^([•·▪▫◦\-–—*]|\d+[.)])\s+/;

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function stripHtmlToLines(source: string): string[] {
  const withBreaks = source
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|section|article|blockquote|tr)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(withBreaks)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function plainTextToLines(source: string): string[] {
  return decodeHtmlEntities(source)
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX.test(line);
}

function normalizeBulletLine(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim();
}

function linesToBlocks(lines: string[]): ProductDescriptionBlock[] {
  const blocks: ProductDescriptionBlock[] = [];
  let bulletItems: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    blocks.push({ type: 'bullet', items: bulletItems });
    bulletItems = [];
  };

  for (const line of lines) {
    if (isBulletLine(line)) {
      bulletItems.push(normalizeBulletLine(line));
      continue;
    }

    flushBullets();
    blocks.push({ type: 'paragraph', text: line });
  }

  flushBullets();
  return blocks;
}

export function parseProductDescription(
  description: string,
  descriptionHtml?: string | null,
  emptyMessage = 'אין כרגע תיאור למוצר הזה.',
): ProductDescriptionBlock[] {
  const htmlSource = descriptionHtml?.trim();
  const textSource = description.trim();
  const source = htmlSource || textSource;

  if (!source) {
    return [{ type: 'paragraph', text: emptyMessage }];
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(source);
  const lines = looksLikeHtml ? stripHtmlToLines(source) : plainTextToLines(source);
  const blocks = linesToBlocks(lines);

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', text: emptyMessage }];
}

export function getProductDescriptionLength(blocks: ProductDescriptionBlock[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === 'paragraph') return total + block.text.length;
    return total + block.items.join(' ').length;
  }, 0);
}

export const PRODUCT_DESCRIPTION_COLLAPSE_CHAR_LIMIT = 280;

export function shouldCollapseProductDescription(blocks: ProductDescriptionBlock[]): boolean {
  if (blocks.length > 3) return true;
  return getProductDescriptionLength(blocks) > PRODUCT_DESCRIPTION_COLLAPSE_CHAR_LIMIT;
}

export function getCollapsedProductDescriptionBlocks(
  blocks: ProductDescriptionBlock[],
): ProductDescriptionBlock[] {
  if (blocks.length <= 2) {
    const first = blocks[0];
    if (first?.type === 'paragraph' && first.text.length > PRODUCT_DESCRIPTION_COLLAPSE_CHAR_LIMIT) {
      return [{ type: 'paragraph', text: `${first.text.slice(0, PRODUCT_DESCRIPTION_COLLAPSE_CHAR_LIMIT).trim()}…` }];
    }
    return blocks;
  }

  return blocks.slice(0, 2);
}
