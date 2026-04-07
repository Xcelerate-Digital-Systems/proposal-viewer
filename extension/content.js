// content.js — Agency Viz extension content script
//
// Injects a "Save to Agency Viz" button onto every Meta Ad Library card. On
// click, opens a small popover anchored to the button where the user picks a
// swipe type (and optional tags) before the actual save fires.
//
// CAVEAT: Meta Ad Library DOM is heavily obfuscated and changes regularly.
// All scraping logic is isolated in scrapeAdCard() so it can be replaced
// without touching the rest of the extension.

const BUTTON_CLASS = 'agency-viz-save-btn';
const POPOVER_CLASS = 'agency-viz-popover';

let cachedTypes = null;
let openPopover = null;

/* ─── Type list (cached for the page lifetime) ─────────────────────────── */

async function loadTypes() {
  if (cachedTypes) return cachedTypes;
  const res = await chrome.runtime.sendMessage({ type: 'LIST_TYPES' });
  if (!res?.ok) throw new Error(res?.error || 'Failed to load swipe types');
  cachedTypes = res.data || [];
  return cachedTypes;
}

/* ─── Button injection ─────────────────────────────────────────────────── */

function injectButton(card) {
  if (card.querySelector(`.${BUTTON_CLASS}`)) return;

  const btn = document.createElement('button');
  btn.className = BUTTON_CLASS;
  btn.type = 'button';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Save to Agency Viz</span>
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openTypePicker(card, btn);
  });
  card.appendChild(btn);
}

/* ─── Popover ──────────────────────────────────────────────────────────── */

function closePopover() {
  if (openPopover) {
    openPopover.remove();
    openPopover = null;
    document.removeEventListener('mousedown', onDocClick, true);
    document.removeEventListener('keydown', onKey, true);
  }
}

function onDocClick(e) {
  if (openPopover && !openPopover.contains(e.target)) closePopover();
}

function onKey(e) {
  if (e.key === 'Escape') closePopover();
}

async function openTypePicker(card, btn) {
  closePopover();

  const pop = document.createElement('div');
  pop.className = POPOVER_CLASS;
  pop.innerHTML = `
    <div class="av-pop-header">
      <span class="av-pop-title">Save to Swipe File</span>
      <button class="av-pop-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="av-pop-body">
      <label class="av-pop-label">Folder</label>
      <div class="av-pop-search-wrap">
        <input class="av-pop-search" type="text" placeholder="Search folders…" />
      </div>
      <div class="av-pop-list">Loading…</div>
      <label class="av-pop-label av-pop-label-tags">Tags <span class="av-pop-hint">(optional)</span></label>
      <input class="av-pop-tags" type="text" placeholder="e.g. Social Proof, Pain/Agitation" />
    </div>
    <div class="av-pop-footer">
      <button class="av-pop-cancel" type="button">Cancel</button>
      <button class="av-pop-save" type="button" disabled>Save</button>
    </div>
  `;
  document.body.appendChild(pop);
  openPopover = pop;
  positionPopover(pop, btn);

  const $list = pop.querySelector('.av-pop-list');
  const $search = pop.querySelector('.av-pop-search');
  const $save = pop.querySelector('.av-pop-save');
  const $tags = pop.querySelector('.av-pop-tags');
  let selectedId = '';
  let selectedName = '';

  const renderList = (types, filter = '') => {
    const f = filter.toLowerCase().trim();
    const filtered = f ? types.filter((t) => t.name.toLowerCase().includes(f)) : types;
    if (filtered.length === 0) {
      $list.innerHTML = '<div class="av-pop-empty">No matches</div>';
      return;
    }
    $list.innerHTML = filtered
      .map(
        (t) =>
          `<button class="av-pop-item" data-id="${t.id}" data-name="${escapeHtml(t.name)}" type="button">
            <span class="av-pop-item-name">${escapeHtml(t.name)}</span>
            <span class="av-pop-item-count">${t.file_count || 0}</span>
          </button>`
      )
      .join('');
    $list.querySelectorAll('.av-pop-item').forEach((el) => {
      el.addEventListener('click', () => {
        $list.querySelectorAll('.av-pop-item').forEach((e) => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedId = el.dataset.id;
        selectedName = el.dataset.name;
        $save.disabled = false;
      });
    });
  };

  try {
    const types = await loadTypes();
    renderList(types);
    $search.addEventListener('input', () => renderList(cachedTypes, $search.value));
    $search.focus();
  } catch (e) {
    $list.innerHTML = `<div class="av-pop-error">${escapeHtml(e.message)}</div>`;
  }

  pop.querySelector('.av-pop-close').addEventListener('click', closePopover);
  pop.querySelector('.av-pop-cancel').addEventListener('click', closePopover);
  $save.addEventListener('click', async () => {
    if (!selectedId) return;
    $save.disabled = true;
    $save.textContent = 'Saving…';
    try {
      const payload = scrapeAdCard(card);
      payload.type_id = selectedId;
      const tags = $tags.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) payload.tags = tags;
      const res = await chrome.runtime.sendMessage({ type: 'IMPORT_AD', payload });
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      $save.textContent = '✓ Saved';
      btn.classList.add('saved');
      btn.querySelector('span').textContent = `Saved to ${selectedName}`;
      setTimeout(closePopover, 700);
    } catch (e) {
      $save.disabled = false;
      $save.textContent = 'Save';
      $list.insertAdjacentHTML('beforebegin', `<div class="av-pop-error">${escapeHtml(e.message)}</div>`);
    }
  });

  // Defer the doc-click listener so the click that opened the popover doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
}

function positionPopover(pop, anchor) {
  const rect = anchor.getBoundingClientRect();
  const popW = 320;
  const popH = 420;
  let left = rect.left + window.scrollX + rect.width / 2 - popW / 2;
  let top = rect.top + window.scrollY - popH - 10;
  // If it would go off the top, flip below
  if (top < window.scrollY + 10) top = rect.bottom + window.scrollY + 10;
  // Clamp horizontally
  left = Math.max(10, Math.min(left, window.scrollX + window.innerWidth - popW - 10));
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.width = `${popW}px`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ─── Scraping ─────────────────────────────────────────────────────────── */

function scrapeAdCard(card) {
  const brandLink = Array.from(card.querySelectorAll('a[href*="facebook.com/"]')).find(
    (a) => !a.href.includes('/ads/library')
  );
  const brand = brandLink?.innerText?.trim() || '';

  const video = card.querySelector('video');
  let media_src_url = '';
  let thumbnail_src_url = '';
  if (video) {
    media_src_url = video.src || video.querySelector('source')?.src || '';
    thumbnail_src_url = video.poster || '';
  } else {
    const imgs = Array.from(card.querySelectorAll('img[src*="fbcdn"]')).filter(
      (i) => !/s\d{2}x\d{2}/.test(i.src)
    );
    const big = imgs.sort(
      (a, b) =>
        (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0) -
        (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0)
    )[0];
    if (big) media_src_url = big.src;
  }

  const primaryEl = card.querySelector(
    'div[style*="white-space: pre-wrap"], div[style*="white-space:pre-wrap"]'
  );
  const primary_text = primaryEl?.innerText?.trim() || '';

  const SKIP_LABELS = new Set(['Sponsored', 'Suggested for you', 'Paid partnership']);
  const linkBlocks = Array.from(card.querySelectorAll('._4ik4'))
    .map((el) => el.innerText?.trim() || '')
    .filter(Boolean)
    .filter((t) => !SKIP_LABELS.has(t))
    .filter((t) => !/^[A-Z0-9.\-]+\.[A-Z]{2,}$/.test(t));
  const headline = linkBlocks[0] || '';
  const description = linkBlocks[1] || '';

  const CTA_LABELS = new Set([
    'Shop Now', 'Shop now', 'Learn More', 'Learn more', 'Sign Up', 'Sign up',
    'Get Offer', 'Get offer', 'Download', 'Book Now', 'Book now',
    'Contact Us', 'Contact us', 'Get Quote', 'Get quote', 'Subscribe',
    'Apply Now', 'Apply now', 'Order Now', 'Order now', 'Watch More',
    'Watch more', 'Send Message', 'Send message', 'See Menu', 'Donate Now',
    'Get Showtimes', 'Install Now', 'Play Game',
  ]);
  let cta = '';
  card.querySelectorAll('div[role="button"], a[role="button"], button').forEach((el) => {
    const t = el.innerText?.trim() || '';
    if (CTA_LABELS.has(t)) cta = t;
  });

  const landingLink = Array.from(card.querySelectorAll('a[href^="http"]')).find(
    (a) => !a.href.includes('facebook.com')
  );
  const source_url = landingLink?.href || window.location.href;

  return {
    brand,
    headline,
    primary_text,
    description,
    cta,
    source_url,
    media_src_url,
    thumbnail_src_url,
  };
}

/* ─── Card discovery ───────────────────────────────────────────────────── */

function findCards(root) {
  const cards = [];
  const seen = new Set();
  root.querySelectorAll('span').forEach((span) => {
    if (!span.innerText || !span.innerText.startsWith('Library ID:')) return;
    let el = span.parentElement;
    let lastCardSized = null;
    for (let i = 0; i < 20 && el; i++) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && w <= 600 && h >= 200) {
        lastCardSized = el;
      } else if (lastCardSized && w > 600) {
        break;
      }
      el = el.parentElement;
    }
    if (lastCardSized && !seen.has(lastCardSized)) {
      seen.add(lastCardSized);
      cards.push(lastCardSized);
    }
  });
  return cards;
}

function scan() {
  findCards(document).forEach(injectButton);
}

const observer = new MutationObserver(() => {
  if (observer._raf) return;
  observer._raf = requestAnimationFrame(() => {
    observer._raf = null;
    scan();
  });
});

observer.observe(document.body, { childList: true, subtree: true });
scan();
