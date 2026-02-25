// app/api/review-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RAILWAY_PROXY_URL = process.env.RAILWAY_PROXY_URL || '';
const RAILWAY_PROXY_SECRET = process.env.RAILWAY_PROXY_SECRET || '';

export const runtime = 'nodejs';

/* ================================================================== */
/*  GET /api/review-proxy?url=...&token=...&item=...                   */
/* ================================================================== */

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const token = req.nextUrl.searchParams.get('token');
  const itemId = req.nextUrl.searchParams.get('item');

  if (!url || !token || !itemId) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  // ── Validate share token + item ──
  const { data: project } = await supabaseAdmin
    .from('review_projects')
    .select('id, status')
    .eq('share_token', token)
    .single();

  if (!project || project.status === 'archived') {
    return NextResponse.json({ error: 'Invalid or archived project' }, { status: 403 });
  }

  const { data: item } = await supabaseAdmin
    .from('review_items')
    .select('id, url, type')
    .eq('id', itemId)
    .eq('review_project_id', project.id)
    .eq('type', 'webpage')
    .single();

  if (!item || !item.url) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // Verify the requested URL matches the item URL (prevent arbitrary proxying)
  const requestedOrigin = new URL(url).origin;
  const itemOrigin = new URL(item.url).origin;
  if (requestedOrigin !== itemOrigin) {
    return NextResponse.json({ error: 'URL mismatch' }, { status: 403 });
  }

  // ── Tier 1: Try direct fetch (fast, ~200ms) ──
  let html: string | null = null;
  let usedRailway = false;

  html = await tryDirectFetch(url);

  // ── Tier 2: Railway Chromium proxy (handles Cloudflare, SPAs) ──
  if (!html && RAILWAY_PROXY_URL) {
    console.log(`[review-proxy] Direct fetch failed for ${url} — trying Railway proxy`);
    html = await tryRailwayProxy(url);
    if (html) usedRailway = true;
  }

  // ── Both failed ──
  if (!html) {
    return NextResponse.json(
      {
        error: 'Failed to load page',
        hint: 'The site may have advanced bot protection. Try adding a simpler URL or contact support.',
      },
      { status: 502 }
    );
  }

  // ── Process HTML ──
  html = processHtml(html, url);

  // Inject our pin management script before </body>
  const injectedScript = buildInjectedScript();
  if (html.match(/<\/body>/i)) {
    html = html.replace(/<\/body>/i, `${injectedScript}\n</body>`);
  } else {
    html += injectedScript;
  }

  // ── Return processed HTML ──
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Proxy-Method': usedRailway ? 'railway-chromium' : 'direct-fetch',
      'Content-Security-Policy':
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "img-src * data: blob:; " +
        "font-src * data:; " +
        "style-src * 'unsafe-inline'; " +
        "script-src * 'unsafe-inline' 'unsafe-eval';",
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}


/* ================================================================== */
/*  Tier 1: Direct fetch                                               */
/* ================================================================== */

async function tryDirectFetch(url: string): Promise<string | null> {
  const parsedUrl = new URL(url);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        Referer: parsedUrl.origin + '/',
        DNT: '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000), // 8s timeout for direct fetch
    });

    if (!res.ok) {
      console.log(`[review-proxy] Direct fetch returned ${res.status} for ${url}`);
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      console.log(`[review-proxy] Not HTML: ${contentType}`);
      return null;
    }

    const html = await res.text();

    // Detect Cloudflare challenge pages (they return 200 but with a JS challenge)
    if (isCloudflareChallenge(html)) {
      console.log(`[review-proxy] Cloudflare challenge detected for ${url}`);
      return null;
    }

    return html;
  } catch (err) {
    console.log(`[review-proxy] Direct fetch error for ${url}:`, (err as Error).message);
    return null;
  }
}


/* ================================================================== */
/*  Tier 2: Railway Chromium proxy                                     */
/* ================================================================== */

async function tryRailwayProxy(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${RAILWAY_PROXY_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': RAILWAY_PROXY_SECRET,
      },
      body: JSON.stringify({
        url,
        timeout: 25000,
        waitUntil: 'networkidle2',
        waitAfterLoad: 800,
      }),
      signal: AbortSignal.timeout(35000), // 35s timeout (give Railway time)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[review-proxy] Railway returned ${res.status}: ${body}`);
      return null;
    }

    const data = await res.json();
    return data.html || null;
  } catch (err) {
    console.error(`[review-proxy] Railway error:`, (err as Error).message);
    return null;
  }
}


/* ================================================================== */
/*  Cloudflare challenge detection                                     */
/* ================================================================== */

function isCloudflareChallenge(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  return (
    (lowerHtml.includes('cf-browser-verification') ||
      lowerHtml.includes('cf_chl_opt') ||
      lowerHtml.includes('cloudflare-static/rocket-loader') ||
      lowerHtml.includes('just a moment') ||
      lowerHtml.includes('checking your browser') ||
      lowerHtml.includes('challenge-platform')) &&
    html.length < 50000 // Real pages are usually larger than challenge pages
  );
}


/* ================================================================== */
/*  HTML processing                                                    */
/* ================================================================== */

function processHtml(html: string, url: string): string {
  const baseUrl = new URL(url);
  const baseTag = `<base href="${baseUrl.origin}${baseUrl.pathname.replace(/\/[^/]*$/, '/')}">`;

  // Inject <base> right after <head>
  if (html.match(/<head[^>]*>/i)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n${baseTag}`);
  } else {
    html = baseTag + html;
  }

  // Strip analytics / tracking scripts
  const stripPatterns = [
    /<!-- Facebook Pixel[\s\S]*?End Facebook Pixel -->/gi,
    /<script[^>]*(google-analytics|googletagmanager|gtag|fbevents|facebook\.net|hotjar|segment|mixpanel|amplitude|plausible|umami|clarity|intercom)[^>]*>[\s\S]*?<\/script>/gi,
    /<noscript[^>]*(facebook|pixel|gtag)[^>]*>[\s\S]*?<\/noscript>/gi,
  ];
  for (const pattern of stripPatterns) {
    html = html.replace(pattern, '');
  }

  // Remove existing CSP meta tags (they may block our injected script)
  html = html.replace(
    /<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi,
    ''
  );

  return html;
}


/* ================================================================== */
/*  Injected script — renders pins inside the iframe DOM               */
/* ================================================================== */

function buildInjectedScript(): string {
  return `
<style id="aviz-proxy-styles">
  /* Pin markers */
  .aviz-pin {
    position: absolute;
    z-index: 2147483630;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #017C87;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform 0.15s, box-shadow 0.15s;
    margin-left: -14px;
    margin-top: -14px;
    pointer-events: auto;
    user-select: none;
    line-height: 1;
  }
  .aviz-pin:hover {
    transform: scale(1.15);
    z-index: 2147483631;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }
  .aviz-pin.resolved {
    background: #9ca3af;
    opacity: 0.55;
  }
  .aviz-pin.pending {
    animation: aviz-pulse 1.2s ease-in-out infinite;
  }
  .aviz-pin.highlighted {
    transform: scale(1.3);
    box-shadow: 0 0 0 4px rgba(1,124,135,0.3), 0 4px 16px rgba(0,0,0,0.3);
    z-index: 2147483632;
  }
  @keyframes aviz-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.25); }
  }

  /* Comment mode cursor + element highlight */
  .aviz-comment-mode, .aviz-comment-mode * {
    cursor: crosshair !important;
  }
  .aviz-el-highlight {
    outline: 2px solid #017C87 !important;
    outline-offset: 2px;
  }

  /* Pin mode indicator bar */
  .aviz-mode-bar {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483640;
    padding: 8px 18px;
    border-radius: 10px;
    background: rgba(17, 17, 17, 0.92);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: none;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .aviz-mode-bar.show { display: flex; }
  .aviz-mode-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #017C87;
    animation: aviz-pulse 1.2s ease-in-out infinite;
  }

  /* Proxy method indicator */
  .aviz-proxy-badge {
    position: fixed;
    bottom: 8px;
    right: 8px;
    z-index: 2147483640;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.6);
    font-size: 9px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    pointer-events: none;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
</style>

<script>
(function() {
  'use strict';
  if (window.__aviz_proxy_injected) return;
  window.__aviz_proxy_injected = true;

  var mode = 'browse';
  var pins = [];
  var highlightedEl = null;
  var highlightedPinId = null;

  // ── Mode bar ──
  var modeBar = document.createElement('div');
  modeBar.className = 'aviz-mode-bar';
  modeBar.innerHTML = '<span class="aviz-mode-dot"></span> Click anywhere to place a pin';
  document.body.appendChild(modeBar);

  // ── Block navigation ──
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'browse') {
        window.parent.postMessage({ type: 'aviz-nav-blocked', href: link.href }, '*');
      }
    }
  }, true);

  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.querySelectorAll('a[target]').forEach(function(a) {
    a.removeAttribute('target');
  });

  // ── Element path generator ──
  function getElementPath(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    var parts = [];
    var current = el;
    while (current && current !== document.body && parts.length < 8) {
      var tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(tag + '#' + current.id);
        break;
      }
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) {
          return c.tagName === current.tagName;
        });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(current) + 1;
          tag += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  // ── Position helpers (percentage-based) ──
  function getDocWidth() {
    return Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.documentElement.clientWidth
    );
  }

  function getDocHeight() {
    return Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.clientHeight
    );
  }

  function pctToAbsolute(pctX, pctY) {
    return {
      x: (pctX / 100) * getDocWidth(),
      y: (pctY / 100) * getDocHeight(),
    };
  }

  // ── Render a single pin ──
  function createPinElement(comment) {
    var pos = pctToAbsolute(comment.pin_x, comment.pin_y);
    var el = document.createElement('div');
    el.className = 'aviz-pin' + (comment.resolved ? ' resolved' : '');
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.textContent = comment.thread_number || '';
    el.dataset.commentId = comment.id;

    el.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'aviz-pin-clicked', commentId: comment.id }, '*');
    });

    document.body.appendChild(el);
    return el;
  }

  // ── Reposition all pins (e.g. on window resize) ──
  function repositionPins() {
    pins.forEach(function(p) {
      var pos = pctToAbsolute(p.x, p.y);
      p.el.style.left = pos.x + 'px';
      p.el.style.top = pos.y + 'px';
    });
  }

  // ── Load all comments ──
  function loadComments(comments) {
    pins.forEach(function(p) { p.el.remove(); });
    pins = [];
    if (!comments || !comments.length) return;
    comments.forEach(function(c) {
      if (c.comment_type !== 'pin' || c.pin_x == null || c.pin_y == null || c.parent_comment_id) return;
      var el = createPinElement(c);
      pins.push({ id: c.id, el: el, x: c.pin_x, y: c.pin_y, threadNumber: c.thread_number, resolved: c.resolved });
    });
  }

  // ── Highlight a specific pin ──
  function highlightPin(commentId) {
    pins.forEach(function(p) { p.el.classList.remove('highlighted'); });
    highlightedPinId = commentId;
    if (!commentId) return;
    var pin = pins.find(function(p) { return p.id === commentId; });
    if (pin) {
      pin.el.classList.add('highlighted');
      var pos = pctToAbsolute(pin.x, pin.y);
      window.scrollTo({ top: Math.max(0, pos.y - window.innerHeight / 2), behavior: 'smooth' });
    }
  }

  // ── Add a single comment (real-time) ──
  function addComment(comment) {
    if (!comment || comment.comment_type !== 'pin' || comment.pin_x == null || comment.parent_comment_id) return;
    if (pins.find(function(p) { return p.id === comment.id; })) return;
    var el = createPinElement(comment);
    pins.push({ id: comment.id, el: el, x: comment.pin_x, y: comment.pin_y, threadNumber: comment.thread_number, resolved: comment.resolved });
  }

  // ── Delete a pin ──
  function deleteComment(commentId) {
    var idx = pins.findIndex(function(p) { return p.id === commentId; });
    if (idx > -1) { pins[idx].el.remove(); pins.splice(idx, 1); }
  }

  // ── Update comment state ──
  function updateCommentState(commentId, resolved) {
    var pin = pins.find(function(p) { return p.id === commentId; });
    if (pin) {
      pin.resolved = resolved;
      if (resolved) { pin.el.classList.add('resolved'); } else { pin.el.classList.remove('resolved'); }
    }
  }

  // ── Mode change ──
  function setMode(newMode) {
    mode = newMode;
    if (mode === 'comment') {
      document.documentElement.classList.add('aviz-comment-mode');
      modeBar.classList.add('show');
    } else {
      document.documentElement.classList.remove('aviz-comment-mode');
      modeBar.classList.remove('show');
      if (highlightedEl) { highlightedEl.classList.remove('aviz-el-highlight'); highlightedEl = null; }
    }
  }

  // ── Comment mode: hover highlight ──
  var highlightableTags = ['P','H1','H2','H3','H4','H5','H6','SPAN','A','BUTTON',
    'IMG','TD','TH','LI','SECTION','DIV','ARTICLE','MAIN','NAV','HEADER','FOOTER',
    'FIGURE','FIGCAPTION','BLOCKQUOTE','UL','OL','FORM','INPUT','LABEL'];

  document.addEventListener('mousemove', function(e) {
    if (mode !== 'comment') return;
    var t = e.target;
    if (t.closest('.aviz-pin') || t.closest('.aviz-mode-bar')) return;
    if (highlightedEl) { highlightedEl.classList.remove('aviz-el-highlight'); highlightedEl = null; }
    if (highlightableTags.indexOf(t.tagName) > -1) {
      var rect = t.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 10) { t.classList.add('aviz-el-highlight'); highlightedEl = t; }
    }
  }, { passive: true });

  // ── Comment mode: click to place pin ──
  document.addEventListener('click', function(e) {
    if (mode !== 'comment') return;
    var t = e.target;
    if (t.closest('.aviz-pin') || t.closest('.aviz-mode-bar')) return;
    e.preventDefault();
    e.stopPropagation();

    var docW = getDocWidth();
    var docH = getDocHeight();
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var absX = e.clientX + scrollX;
    var absY = e.clientY + scrollY;
    var pctX = (absX / docW) * 100;
    var pctY = (absY / docH) * 100;

    var targetEl = document.elementFromPoint(e.clientX, e.clientY);
    var elementPath = targetEl ? getElementPath(targetEl) : '';

    if (highlightedEl) { highlightedEl.classList.remove('aviz-el-highlight'); highlightedEl = null; }

    window.parent.postMessage({
      type: 'aviz-pin-placed',
      pin_x: Math.round(pctX * 100) / 100,
      pin_y: Math.round(pctY * 100) / 100,
      element_path: elementPath,
    }, '*');

    var pending = document.createElement('div');
    pending.className = 'aviz-pin pending';
    pending.id = 'aviz-pending-pin';
    pending.style.left = absX + 'px';
    pending.style.top = absY + 'px';
    pending.textContent = '+';
    document.body.appendChild(pending);

    setMode('browse');
  }, true);

  // ── Remove pending pin ──
  function removePendingPin() {
    var el = document.getElementById('aviz-pending-pin');
    if (el) el.remove();
  }

  // ── Listen for messages from parent ──
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.type) return;
    switch (d.type) {
      case 'aviz-set-mode': setMode(d.mode || 'browse'); break;
      case 'aviz-load-comments': loadComments(d.comments || []); break;
      case 'aviz-add-comment': removePendingPin(); addComment(d.comment); break;
      case 'aviz-delete-comment': deleteComment(d.commentId); break;
      case 'aviz-highlight-comment': highlightPin(d.commentId); break;
      case 'aviz-update-comment-state': updateCommentState(d.commentId, d.resolved); break;
      case 'aviz-cancel-pin': removePendingPin(); setMode('browse'); break;
      case 'aviz-scroll-to': window.scrollTo({ top: d.y || 0, behavior: 'smooth' }); break;
    }
  });

  // ── Send frame info to parent on scroll + resize ──
  function sendFrameInfo() {
    window.parent.postMessage({
      type: 'aviz-frame-info',
      scrollY: window.pageYOffset || document.documentElement.scrollTop,
      scrollHeight: getDocHeight(),
      clientHeight: window.innerHeight,
      scrollWidth: getDocWidth(),
      clientWidth: window.innerWidth,
    }, '*');
  }

  window.addEventListener('scroll', sendFrameInfo, { passive: true });
  window.addEventListener('resize', function() { repositionPins(); sendFrameInfo(); });

  if (document.readyState === 'complete') {
    setTimeout(sendFrameInfo, 100);
  } else {
    window.addEventListener('load', function() { setTimeout(sendFrameInfo, 100); });
  }

  var infoTicks = 0;
  var infoInterval = setInterval(function() {
    sendFrameInfo();
    repositionPins();
    infoTicks++;
    if (infoTicks > 10) clearInterval(infoInterval);
  }, 500);

  window.parent.postMessage({ type: 'aviz-proxy-ready' }, '*');
})();
</script>`;
}