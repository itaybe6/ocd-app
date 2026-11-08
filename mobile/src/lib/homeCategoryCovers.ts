const SITE_ORIGIN = 'https://www.ocd-online.co.il';

/** Mobile bento art from the Lovable homepage, keyed by Shopify collection handle. */
export function extractHomeCategoryCovers(html: string): Record<string, string> {
  const covers: Record<string, string> = {};
  const tiles = html.match(/<a class="tile[\s\S]*?<\/a>/g) ?? [];

  for (const block of tiles) {
    const href = block.match(/href="([^"]+)"/)?.[1];
    if (!href?.includes('/collection/')) continue;

    const rawHandle = href.split('/collection/')[1]?.split(/[?#]/)[0] ?? '';
    let handle = rawHandle;
    try {
      handle = decodeURIComponent(rawHandle);
    } catch {
      handle = rawHandle;
    }
    handle = handle.trim();
    if (!handle) continue;

    const mobile =
      block.match(/media="\(max-width:\s*767px\)"[^>]*srcSet="([^"]+)"/i)?.[1] ??
      block.match(/\ssrc="([^"]+)"/i)?.[1];
    if (!mobile) continue;

    covers[handle] = mobile.startsWith('http') ? mobile : `${SITE_ORIGIN}${mobile}`;
  }

  return covers;
}

export async function fetchHomeCategoryCovers(): Promise<Record<string, string>> {
  const res = await fetch(SITE_ORIGIN + '/');
  if (!res.ok) throw new Error(`home categories ${res.status}`);
  const html = await res.text();
  const covers = extractHomeCategoryCovers(html);
  if (!Object.keys(covers).length) throw new Error('home categories empty');
  return covers;
}
