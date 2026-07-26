import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';

interface DiscoveredPage {
  url: string;
  path: string;
  title: string;
}

const MAX_PAGES = 100;
const FETCH_TIMEOUT = 8000;
const MAX_DEPTH = 2;

function extractTitle(html: string, path: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!match) return '';
  const raw = match[1].trim();
  // Split on common separators (` | `, ` - `, ` – `, ` — `) and take
  // the first segment, which is typically the human-readable page name
  // before the brand/SEO tail.
  const parts = raw.split(/\s+[|–—]\s+|\s+-\s+/);
  const cleaned = (parts[0] || raw).trim();
  if (!cleaned || cleaned.length > 60) return pathToTitle(path);
  return cleaned;
}

function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const links: string[] = [];
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.hostname !== baseUrl.hostname) continue;
      if (!/^https?:$/.test(resolved.protocol)) continue;
      // Skip common non-page resources
      if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|pdf|zip|mp4|mp3|webp|avif)(\?|$)/i.test(resolved.pathname)) continue;

      resolved.hash = '';
      resolved.search = '';
      const clean = resolved.toString();
      if (!links.includes(clean)) links.push(clean);
    } catch {
      // Invalid URL — skip
    }
  }
  return links;
}

async function fetchPage(url: string): Promise<{ html: string; ok: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AgencyViz-SitemapScanner/1.0',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return { html: '', ok: false };
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return { html: '', ok: false };
    const html = await res.text();
    return { html, ok: true };
  } catch {
    return { html: '', ok: false };
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let rootUrl: URL;
  try {
    rootUrl = new URL(body.url);
    if (!/^https?:$/.test(rootUrl.protocol)) throw new Error('Invalid protocol');
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const visited = new Set<string>();
  const pages: DiscoveredPage[] = [];

  // BFS crawl
  type QueueItem = { url: string; depth: number };
  const queue: QueueItem[] = [{ url: rootUrl.toString(), depth: 0 }];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const batch = queue.splice(0, Math.min(5, queue.length));

    const results = await Promise.all(
      batch.map(async ({ url, depth }) => {
        if (visited.has(url)) return null;
        visited.add(url);

        const { html, ok } = await fetchPage(url);
        if (!ok) return null;

        const parsed = new URL(url);
        const path = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/$/, '');
        const title = extractTitle(html, path) || pathToTitle(path);

        const page: DiscoveredPage = { url, path, title };

        let childLinks: string[] = [];
        if (depth < MAX_DEPTH) {
          childLinks = extractInternalLinks(html, parsed)
            .filter((l) => !visited.has(l));
        }

        return { page, childLinks, depth };
      }),
    );

    for (const result of results) {
      if (!result) continue;
      if (pages.length >= MAX_PAGES) break;

      // Dedupe by path
      if (!pages.some((p) => p.path === result.page.path)) {
        pages.push(result.page);
      }

      for (const link of result.childLinks) {
        if (!visited.has(link) && pages.length + queue.length < MAX_PAGES * 2) {
          queue.push({ url: link, depth: result.depth + 1 });
        }
      }
    }
  }

  // Sort: root first, then alphabetically by path
  pages.sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });

  return NextResponse.json({ pages });
}

function pathToTitle(path: string): string {
  if (path === '/') return 'Homepage';
  const segment = path.split('/').filter(Boolean).pop() || '';
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
