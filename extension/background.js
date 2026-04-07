// background.js — Agency Viz extension service worker
//
// All network calls to the Agency Viz API go through here. The reason: MV3
// background workers fetch with host_permissions and bypass page CORS, while
// content scripts do not. Centralising fetch here also keeps the API key out
// of the page-side context.

const DEFAULT_API_BASE = 'https://app.agencyviz.com';

async function getSettings() {
  const { apiKey, apiBase, defaultTypeId, defaultTypeName } =
    await chrome.storage.sync.get(['apiKey', 'apiBase', 'defaultTypeId', 'defaultTypeName']);
  return {
    apiKey: apiKey || '',
    apiBase: apiBase || DEFAULT_API_BASE,
    defaultTypeId: defaultTypeId || '',
    defaultTypeName: defaultTypeName || '',
  };
}

async function apiFetch(path, init = {}) {
  const { apiKey, apiBase } = await getSettings();
  if (!apiKey) throw new Error('Missing API key — open the extension popup to set one.');
  const res = await fetch(`${apiBase}${path}`, {
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'LIST_TYPES') {
        const json = await apiFetch('/api/ads/swipe/types');
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
