const SITE_ORIGIN = 'https://www.ocd-online.co.il';

export type SiteLinkTarget = {
  type: 'collection' | 'product';
  handle: string;
};

export type HomeHeroSlide = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  alt: string;
  durationMs: number;
  width: number;
  height: number;
  target: SiteLinkTarget | null;
  ctaLabel: string | null;
};

export type SitePopup = {
  id: string;
  imageUrl: string;
  alt: string;
  dismissKey: string;
  delayMs: number;
  /** שנת JS. null = בלי הגבלת שנה. */
  year: number | null;
  /** חודש JS, 0 = ינואר. null = בלי הגבלת חודש. */
  month: number | null;
  target: SiteLinkTarget | null;
};

const DEFAULT_IMAGE_MS = 7000;
const DEFAULT_VIDEO_MS = 16500;
const DEFAULT_RATIO = { width: 1248, height: 1664 };

const dismissedPopupKeys = new Set<string>();

export function dismissSitePopup(key: string) {
  dismissedPopupKeys.add(key);
}

export function isSitePopupDismissed(key: string) {
  return dismissedPopupKeys.has(key);
}

export function isPopupActive(popup: SitePopup, now = new Date()) {
  if (popup.year != null && now.getFullYear() !== popup.year) return false;
  if (popup.month != null && now.getMonth() !== popup.month) return false;
  return true;
}

function absoluteSiteUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${SITE_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function targetFromHref(href: string | null | undefined): SiteLinkTarget | null {
  if (!href) return null;
  const path = href.startsWith('http') ? safePathname(href) : href;
  const product = path.match(/\/products?\/([^/?#]+)/i);
  if (product) return { type: 'product', handle: decodeURIComponent(product[1]) };
  const collection = path.match(/\/collections?\/([^/?#]+)/i);
  if (collection) return { type: 'collection', handle: decodeURIComponent(collection[1]) };
  return null;
}

function safePathname(href: string) {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

function parseDuration(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1000) return fallback;
  return value;
}

type HeroTiming = {
  imageMs: number;
  videoMs: number;
  productHandle: string | null;
  collectionHandle: string | null;
  ctaLabel: string | null;
  imageRatio: { width: number; height: number } | null;
  videoRatio: { width: number; height: number } | null;
};

function extractHeroTiming(js: string): HeroTiming {
  const packed = js.match(/="([^"]+)",Gt=([0-9.eE]+),\$t=(\d+),[\w$]+="([^"]+)"/);
  const cta = js.match(/hero-video-cta-btn",children:"([^"]+)"/);
  const ratios = js.match(
    /imageRatio:"(\d+)\s*\/\s*(\d+)",videoRatio:"(\d+)\s*\/\s*(\d+)",visibilityClass:"md:hidden"/,
  );
  return {
    imageMs: parseDuration(packed?.[2], DEFAULT_IMAGE_MS),
    videoMs: parseDuration(packed?.[3], DEFAULT_VIDEO_MS),
    productHandle: packed?.[1] ?? null,
    collectionHandle: packed?.[4] ?? null,
    ctaLabel: cta?.[1] ? decodeHtml(cta[1]) : null,
    imageRatio: ratios ? { width: Number(ratios[1]), height: Number(ratios[2]) } : null,
    videoRatio: ratios ? { width: Number(ratios[3]), height: Number(ratios[4]) } : null,
  };
}

export function extractMobileHeroSlides(html: string, js = ''): HomeHeroSlide[] {
  const marker = html.indexOf('hero-carousel md:hidden');
  if (marker < 0) return [];
  const sectionStart = html.lastIndexOf('<section', marker);
  const sectionEnd = html.indexOf('</section>', marker);
  if (sectionStart < 0 || sectionEnd < 0) return [];
  const section = html.slice(sectionStart, sectionEnd);
  const ratioMatch = section.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/i);
  const sectionRatio = ratioMatch
    ? { width: Number(ratioMatch[1]), height: Number(ratioMatch[2]) }
    : DEFAULT_RATIO;
  const timing = js.includes('hero-carousel') || js.includes('hero-video-cta-btn') ? extractHeroTiming(js) : extractHeroTiming('');
  const fallbackTarget =
    targetFromHref(attr(section, 'href') || (section.match(/href="([^"]+)"/)?.[1] ?? '')) ??
    (timing.collectionHandle ? { type: 'collection' as const, handle: timing.collectionHandle } : null);

  const slides: HomeHeroSlide[] = [];
  const tagRe = /<(img|video)\b([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(section))) {
    const kind = match[1].toLowerCase() === 'video' ? 'video' : 'image';
    let url = attr(match[2], 'src');
    if (!url && kind === 'video') {
      const ahead = section.slice(match.index, match.index + 400);
      url = ahead.match(/<source\b[^>]*src="([^"]+)"/i)?.[1] ?? '';
    }
    if (!url) continue;
    const ratio = kind === 'video' ? timing.videoRatio ?? sectionRatio : timing.imageRatio ?? sectionRatio;
    const target =
      kind === 'video' && timing.productHandle
        ? { type: 'product' as const, handle: timing.productHandle }
        : kind === 'image' && timing.collectionHandle
          ? { type: 'collection' as const, handle: timing.collectionHandle }
          : fallbackTarget;
    slides.push({
      id: `${kind}-${slides.length}-${url}`,
      kind,
      url: absoluteSiteUrl(url),
      alt: attr(match[2], 'alt'),
      durationMs: kind === 'video' ? timing.videoMs : timing.imageMs,
      width: ratio.width || sectionRatio.width,
      height: ratio.height || sectionRatio.height,
      target,
      ctaLabel: kind === 'video' && timing.productHandle ? timing.ctaLabel ?? 'למארז לחץ כאן' : null,
    });
  }
  return slides;
}

export function extractSitePopups(js: string): SitePopup[] {
  const popups: SitePopup[] = [];
  const re =
    /["']((?:\/assets\/|https?:\/\/)[^"']+\.(?:jpe?g|png|webp))["']\s*,\s*[A-Za-z_$][\w$]*\s*=\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(js))) {
    const window = js.slice(match.index, match.index + 4500);
    if (!window.includes('sessionStorage') && !window.includes('getMonth')) continue;
    const year = window.match(/getFullYear\(\)\s*===\s*(\d+)/);
    const month = window.match(/getMonth\(\)\s*===\s*(\d+)/);
    const delay = window.match(/setTimeout\(\(\)\s*=>\s*[\w$]+\(!0\),\s*(\d+)\)/);
    const handle = window.match(/params:\s*\{\s*handle:\s*"([^"]+)"\s*\}/);
    const route = window.match(/to:\s*"(\/(?:collection|product)\/\$handle)"/);
    const alt = window.match(/children:\s*"([^"]{8,240})"/);
    const seen = popups.some((popup) => popup.dismissKey === match![2]);
    if (seen) continue;
    popups.push({
      id: match[2],
      imageUrl: absoluteSiteUrl(match[1]),
      alt: alt ? decodeHtml(alt[1]) : '',
      dismissKey: match[2],
      delayMs: delay ? Number(delay[1]) : 700,
      year: year ? Number(year[1]) : null,
      month: month ? Number(month[1]) : null,
      target: handle
        ? {
            type: route?.[1].includes('product') ? 'product' : 'collection',
            handle: decodeURIComponent(handle[1]),
          }
        : null,
    });
  }
  return popups;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`site home ${response.status}`);
  return response.text();
}

export async function fetchSiteHomeExperience(): Promise<{ slides: HomeHeroSlide[]; popups: SitePopup[] }> {
  const html = await fetchText(`${SITE_ORIGIN}/`);
  const scriptPaths = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]),
    ),
  ];
  const scripts = await Promise.all(
    scriptPaths.map(async (path) => {
      try {
        return await fetchText(absoluteSiteUrl(path));
      } catch {
        return '';
      }
    }),
  );
  const heroJs = scripts.find((script) => script.includes('hero-video-cta-btn') || script.includes('md:hidden')) ?? '';
  const popupJs = scripts.find((script) => script.includes('getMonth()===') || script.includes('getMonth() ===')) ?? scripts.join('\n');
  return {
    slides: extractMobileHeroSlides(html, heroJs),
    popups: extractSitePopups(popupJs),
  };
}
