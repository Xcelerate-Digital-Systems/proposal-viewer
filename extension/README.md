# Agency Viz — Chrome Extension

Saves Meta Ad Library ads directly into your Agency Viz Swipe File.

## Install (development)

1. Add an `icon.png` (128×128) to this folder.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select this folder.
3. Click the extension icon → paste your API key from Agency Viz → Settings → API Keys.
4. Visit https://www.facebook.com/ads/library/ — each ad card now has a **Save to Agency Viz** button.

## How it works

- `content.js` injects the save button onto Meta Ad Library cards and scrapes ad copy + media URL.
- `background.js` is the only place that talks to the Agency Viz API. It uses your stored `av_live_…` key.
- Backend endpoint: `POST /api/ads/swipe/files/import-from-url` — server-side downloads the Meta CDN media (which has short-lived signed URLs and blocks `chrome-extension://` origins) and stores it in Supabase.

## Publishing (unlisted)

1. Bump `version` in `manifest.json`.
2. Zip the contents of this folder (not the folder itself).
3. Upload to the Chrome Web Store Developer Dashboard.
4. Set visibility to **Unlisted** — installable only via direct link.

## Maintenance: selectors break

Meta Ad Library DOM changes regularly. The scraping logic lives entirely in `scrapeAdCard()` in `content.js`. When ads stop scraping correctly, that's the only function to fix.
