// popup.js — thin UI over background.js sign-in/out.
//
// The actual OAuth flow runs in background.js because launchWebAuthFlow
// closes the popup the moment it opens a new window. We just kick it off
// here and re-render when storage changes.

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

function send(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (resp) => resolve(resp || { ok: false, error: 'No response' }));
  });
}

$signIn.addEventListener('click', async () => {
  setStatus('Opening sign-in…');
  const resp = await send('SIGN_IN');
  if (resp.ok) {
    setStatus('Signed in ✓', true);
    await render();
  } else {
    setStatus(resp.error || 'Sign-in failed', false);
  }
});

$signOut.addEventListener('click', async () => {
  const resp = await send('SIGN_OUT');
  if (resp.ok) {
    setStatus('Signed out', true);
    await render();
  }
});

// Re-render if the token changes while popup is open (e.g. sign-in completes
// in background after popup was closed and reopened).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.apiKey || changes.accountLabel)) render();
});

render();
