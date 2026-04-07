// popup.js — settings UI for the Agency Viz extension

const $apiBase = document.getElementById('apiBase');
const $apiKey = document.getElementById('apiKey');
const $save = document.getElementById('save');
const $status = document.getElementById('status');

function setStatus(msg, ok) {
  $status.textContent = msg;
  $status.className = 'av-status ' + (ok ? 'ok' : 'err');
}

async function loadSettings() {
  const cfg = await chrome.storage.sync.get(['apiBase', 'apiKey']);
  $apiBase.value = cfg.apiBase || 'https://app.agencyviz.com';
  $apiKey.value = cfg.apiKey || '';
}

$save.addEventListener('click', async () => {
  await chrome.storage.sync.set({
    apiBase: $apiBase.value.trim().replace(/\/$/, ''),
    apiKey: $apiKey.value.trim(),
  });
  setStatus('Saved ✓', true);
});

loadSettings();
