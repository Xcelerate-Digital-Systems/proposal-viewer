// background.js — Agency Viz extension service worker
//
// All network calls to the Agency Viz API go through here. The reason: MV3
// background workers fetch with host_permissions and bypass page CORS, while
// content scripts do not. Centralising fetch here also keeps the token out of
// the page-side context.
//
// The OAuth sign-in flow also runs here (not in the popup) because clicking
// Sign In opens chrome.identity.launchWebAuthFlow in a new window, which
// immediately closes the popup and tears down any promise chain running
// there. Running it in the service worker keeps the flow alive.

const API_BASE = 'https://app.agencyviz.io';

async function getSettings() {
  const { apiKey, defaultTypeId, defaultTypeName } = await chrome.storage.sync.get([
    'apiKey',
    'defaultTypeId',
    'defaultTypeName',
  ]);
  return {
    apiKey: apiKey || '',
    apiBase: API_BASE,
    defaultTypeId: defaultTypeId || '',
    defaultTypeName: defaultTypeName || '',
  };
}

async function apiFetch(path, init = {}) {
  const { apiKey } = await getSettings();
  if (!apiKey) throw new Error('Not signed in — open the extension popup.');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
  return json;
}

function randomState() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseFragment(url) {
  return new URLSearchParams(url.split('#')[1] || '');
}

async function signIn() {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = randomState();
  const authUrl =
    `${API_BASE}/oauth/extension/authorize` +
    `?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  const redirectedTo = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!redirectedTo) throw new Error('No response from Agency Viz');

  const frag = parseFragment(redirectedTo);
  if (frag.get('error')) throw new Error(frag.get('error'));
  if (frag.get('state') !== state) throw new Error('State mismatch');
  const code = frag.get('code');
  if (!code) throw new Error('Missing code');

  const res = await fetch(`${API_BASE}/api/oauth/extension/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = await res.json();
  if (!res.ok || !json.token) throw new Error(json.error || 'Exchange failed');

  await chrome.storage.sync.set({
    apiKey: json.token,
    accountLabel: 'Agency Viz',
  });
}

async function signOut() {
  await chrome.storage.sync.remove(['apiKey', 'accountLabel']);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'SIGN_IN') {
        await signIn();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'SIGN_OUT') {
        await signOut();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'LIST_TYPES') {
        const json = await apiFetch('/api/ads/swipe/types');
        sendResponse({ ok: true, data: json.data });
        return;
      }
      if (msg.type === 'LIST_TAGS') {
        const json = await apiFetch('/api/ads/swipe/tags');
        sendResponse({ ok: true, data: json.data });
        return;
      }
      if (msg.type === 'IMPORT_AD') {
        const settings = await getSettings();
        const payload = {
          ...msg.payload,
          type_id: msg.payload.type_id || settings.defaultTypeId || undefined,
          type_name:
            !msg.payload.type_id && !settings.defaultTypeId
              ? settings.defaultTypeName || undefined
              : undefined,
        };
        const json = await apiFetch('/api/ads/swipe/files/import-from-url', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        sendResponse({ ok: true, data: json.data });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message type' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep port open for async sendResponse
});
