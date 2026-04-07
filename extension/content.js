// content.js — Agency Viz extension content script
//
// Injects a "Save to Agency Viz" button onto every Meta Ad Library card. On
// click, opens a small popover anchored to the button where the user picks a
// swipe folder (dropdown) and optional tags (multi-select combobox sourced
// from the company's existing tags) before the actual save fires.
//
// CAVEAT: Meta Ad Library DOM is heavily obfuscated and changes regularly.
// All scraping logic is isolated in scrapeAdCard() so it can be replaced
// without touching the rest of the extension.

const BUTTON_CLASS = 'agency-viz-save-btn';
const POPOVER_CLASS = 'agency-viz-popover';

let cachedTypes = null;
let cachedTags = null;
let openPopover = null;

/* ─── Remote data (cached for page lifetime) ───────────────────────────── */

async function loadTypes() {
  if (cachedTypes) return cachedTypes;
  const res = await chrome.runtime.sendMessage({ type: 'LIST_TYPES' });
  if (!res?.ok) throw new Error(res?.error || 'Failed to load swipe types');
  cachedTypes = res.data || [];
  return cachedTypes;
}

async function loadTags() {
  if (cachedTags) return cachedTags;
  const res = await chrome.runtime.sendMessage({ type: 'LIST_TAGS' });
  if (!res?.ok) return []; // tags are optional — fail silently
  cachedTags = res.data || [];
  return cachedTags;
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
      <div class="av-combo" data-role="folder">
        <button class="av-combo-btn" type="button">
          <span class="av-combo-value av-combo-placeholder">Choose a folder…</span>
          <svg class="av-combo-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="av-combo-panel" hidden>
          <input class="av-combo-search" type="text" placeholder="Search folders…" />
          <div class="av-combo-list">Loading…</div>
        </div>
      </div>

      <label class="av-pop-label av-pop-label-tags">Tags <span class="av-pop-hint">(optional)</span></label>
      <div class="av-combo av-combo-multi" data-role="tags">
        <button class="av-combo-btn" type="button">
          <span class="av-combo-value av-combo-placeholder">Add tags…</span>
          <svg class="av-combo-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="av-combo-panel" hidden>
          <input class="av-combo-search" type="text" placeholder="Search or create tag…" />
          <div class="av-combo-list">Loading…</div>
        </div>
      </div>
    </div>
    <div class="av-pop-footer">
      <button class="av-pop-cancel" type="button">Cancel</button>
      <button class="av-pop-save" type="button" disabled>Save</button>
    </div>
  `;
  document.body.appendChild(pop);
  openPopover = pop;
  positionPopover(pop, btn);

  const $save = pop.querySelector('.av-pop-save');
  const $folder = pop.querySelector('[data-role="folder"]');
  const $tags = pop.querySelector('[data-role="tags"]');

  const state = {
    selectedTypeId: '',
    selectedTypeName: '',
    selectedTags: [],
  };

  // Close either panel when the other opens, or when clicking its button.
  function togglePanel(combo) {
    const panel = combo.querySelector('.av-combo-panel');
    const isOpen = !panel.hidden;
    pop.querySelectorAll('.av-combo-panel').forEach((p) => (p.hidden = true));
    pop.querySelectorAll('.av-combo').forEach((c) => c.classList.remove('open'));
    if (!isOpen) {
      panel.hidden = false;
      combo.classList.add('open');
      const search = panel.querySelector('.av-combo-search');
      if (search) setTimeout(() => search.focus(), 0);
    }
  }

  $folder.querySelector('.av-combo-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel($folder);
  });
  $tags.querySelector('.av-combo-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel($tags);
  });

  /* ── Folder combobox ─────────────────────────────────────────────────── */

  const $folderValue = $folder.querySelector('.av-combo-value');
  const $folderList = $folder.querySelector('.av-combo-list');
  const $folderSearch = $folder.querySelector('.av-combo-search');

  const renderFolders = (types, filter = '') => {
    const f = filter.toLowerCase().trim();
    const filtered = f ? types.filter((t) => t.name.toLowerCase().includes(f)) : types;
    if (filtered.length === 0) {
      $folderList.innerHTML = '<div class="av-combo-empty">No matches</div>';
      return;
    }
    $folderList.innerHTML = filtered
      .map(
        (t) =>
          `<button class="av-combo-item" data-id="${t.id}" data-name="${escapeHtml(t.name)}" type="button">
            <span class="av-combo-item-name">${escapeHtml(t.name)}</span>
            <span class="av-combo-item-count">${t.file_count || 0}</span>
          </button>`
      )
      .join('');
    $folderList.querySelectorAll('.av-combo-item').forEach((el) => {
      el.addEventListener('click', () => {
        state.selectedTypeId = el.dataset.id;
        state.selectedTypeName = el.dataset.name;
        $folderValue.textContent = state.selectedTypeName;
        $folderValue.classList.remove('av-combo-placeholder');
        $folder.querySelector('.av-combo-panel').hidden = true;
        $folder.classList.remove('open');
        $save.disabled = false;
      });
    });
  };

  try {
    const types = await loadTypes();
    renderFolders(types);
    $folderSearch.addEventListener('input', () => renderFolders(cachedTypes, $folderSearch.value));
  } catch (e) {
    $folderList.innerHTML = `<div class="av-pop-error">${escapeHtml(e.message)}</div>`;
  }

  /* ── Tags combobox (multi) ───────────────────────────────────────────── */

  const $tagsValue = $tags.querySelector('.av-combo-value');
  const $tagsList = $tags.querySelector('.av-combo-list');
  const $tagsSearch = $tags.querySelector('.av-combo-search');

  const renderTagsValue = () => {
    if (state.selectedTags.length === 0) {
      $tagsValue.textContent = 'Add tags…';
      $tagsValue.classList.add('av-combo-placeholder');
      $tagsValue.innerHTML = 'Add tags…';
      return;
    }
    $tagsValue.classList.remove('av-combo-placeholder');
    $tagsValue.innerHTML = state.selectedTags
      .map(
        (t) =>
          `<span class="av-chip">${escapeHtml(t)}<span class="av-chip-x" data-tag="${escapeHtml(t)}">×</span></span>`
      )
      .join('');
    $tagsValue.querySelectorAll('.av-chip-x').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = el.dataset.tag;
        state.selectedTags = state.selectedTags.filter((t) => t !== tag);
        renderTagsValue();
        renderTagsList(cachedTags || [], $tagsSearch.value);
      });
    });
  };

  const renderTagsList = (tags, filter = '') => {
    const f = filter.toLowerCase().trim();
    const available = tags.filter((t) => !state.selectedTags.includes(t));
    const filtered = f ? available.filter((t) => t.toLowerCase().includes(f)) : available;
    let html = filtered
      .map(
        (t) =>
          `<button class="av-combo-item" data-tag="${escapeHtml(t)}" type="button">
            <span class="av-combo-item-name">${escapeHtml(t)}</span>
          </button>`
      )
      .join('');
    // Offer "Create new" if the search term doesn't exactly match anything
    const exact = tags.find((t) => t.toLowerCase() === f) || state.selectedTags.find((t) => t.toLowerCase() === f);
    if (f && !exact) {
      html += `<button class="av-combo-item av-combo-create" data-tag="${escapeHtml(f)}" type="button">
        <span class="av-combo-item-name">Create "${escapeHtml(f)}"</span>
      </button>`;
    }
    if (!html) html = '<div class="av-combo-empty">No tags yet</div>';
    $tagsList.innerHTML = html;
    $tagsList.querySelectorAll('.av-combo-item').forEach((el) => {
      el.addEventListener('click', () => {
        const tag = el.dataset.tag;
        if (!state.selectedTags.includes(tag)) {
          state.selectedTags.push(tag);
          if (!cachedTags.includes(tag)) cachedTags.push(tag);
        }
        $tagsSearch.value = '';
        renderTagsValue();
        renderTagsList(cachedTags, '');
        $tagsSearch.focus();
      });
    });
  };

  try {
    const tags = await loadTags();
    renderTagsList(tags);
    $tagsSearch.addEventListener('input', () => renderTagsList(cachedTags || [], $tagsSearch.value));
    $tagsSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = $tagsSearch.value.trim();
        if (v && !state.selectedTags.includes(v)) {
          state.selectedTags.push(v);
          if (!cachedTags.includes(v)) cachedTags.push(v);
          $tagsSearch.value = '';
          renderTagsValue();
          renderTagsList(cachedTags, '');
        }
      }
    });
  } catch {
    $tagsList.innerHTML = '<div class="av-combo-empty">No tags yet</div>';
  }

  /* ── Save / cancel ───────────────────────────────────────────────────── */

  pop.querySelector('.av-pop-close').addEventListener('click', closePopover);
  pop.querySelector('.av-pop-cancel').addEventListener('click', closePopover);
  $save.addEventListener('click', async () => {
    if (!state.selectedTypeId) return;
    $save.disabled = true;
    $save.textContent = 'Saving…';
    try {
      const payload = scrapeAdCard(card);
      payload.type_id = state.selectedTypeId;
      if (state.selectedTags.length) payload.tags = state.selectedTags;
      const res = await chrome.runtime.sendMessage({ type: 'IMPORT_AD', payload });
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      $save.textContent = '✓ Saved';
      btn.classList.add('saved');
      btn.querySelector('span').textContent = `Saved to ${state.selectedTypeName}`;
      setTimeout(closePopover, 700);
    } catch (e) {
      $save.disabled = false;
      $save.textContent = 'Save';
      const existing = pop.querySelector('.av-pop-error');
      if (existing) existing.remove();
      pop.querySelector('.av-pop-body').insertAdjacentHTML(
        'afterbegin',
        `<div class="av-pop-error">${escapeHtml(e.message)}</div>`
      );
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
