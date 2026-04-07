// popup.js — OAuth sign-in for the Agency Viz extension.
//
// Flow: click Sign in → chrome.identity.launchWebAuthFlow opens the consent
// screen → on Approve the server redirects back with #code=… → we POST the
// code to /api/oauth/extension/exchange and stash the returned token under
// chrome.storage.sync.apiKey (background.js reads from there unchanged).

const API_BASE = 'https://app.agencyviz.com';

const $signedOut = document.getElementById('signedOut');
const $signedIn = document.getElementById('signedIn');
const $signIn = document.getElementById('signIn');
const $signOut = document.getElementById('signOut');
const $accountLabel = document.getElementById('accountLabel');
const $status = document.getElementById('status');

function setStatus(msg, ok) {
  $status.textContent = msg || '';
  $status.className = 'av-status ' + (msg ? (ok ? 'ok' : 'err') : '');
}

async function render() {
  const { apiKey, accountLabel } = await chrome.storage.sync.get(['apiKey', 'accountLabel']);
  const signedIn = !!apiKey;
  $signedOut.hidden = signedIn;
  $signedIn.hidden = !signedIn;
  if (signedIn) $accountLabel.textContent = accountLabel || 'your account';
}

function randomState() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseFragment(url) {
  return new URLSearchParams((url.split('#')[1] || ''));
}

$signIn.addEventListener('click', async () => {
  setStatus('');
  // Keep apiBase in storage so background.js picks it up.
  await chrome.storage.sync.set({ apiBase: API_BASE });

  const redirectUri = chrome.identity.getRedirectURL();
  const state = randomState();
  const authUrl =
    `${API_BASE}/oauth/extension/authorize` +
    `?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  try {
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
    setStatus('Signed in ✓', true);
    await render();
  } catch (e) {
    setStatus(e.message || 'Sign-in failed', false);
  }
});

$signOut.addEventListener('click', async () => {
  await chrome.storage.sync.remove(['apiKey', 'accountLabel']);
  setStatus('Signed out', true);
  await render();
});

render();
