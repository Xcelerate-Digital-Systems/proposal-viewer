# AgencyViz — Facebook Ads Looker Studio Connector

Source code for the Community Connector that brings Facebook Ads data from
AgencyViz into Looker Studio via OAuth2.

## Files

| File | Purpose |
|------|---------|
| `appsscript.json` | Apps Script manifest. Declares the `OAuth2` library dependency and the Community Connector metadata (name, description, support URL). |
| `Config.gs`       | The one place you edit when credentials or the API base URL change. |
| `OAuth.gs`        | OAuth2 lifecycle hooks (`getAuthType`, `authCallback`, `resetAuth`, etc.). |
| `Schema.gs`       | Field catalog — dimensions and metrics exposed to Looker Studio. |
| `Code.gs`         | `getConfig` (ad-account picker) and `getData` (the hot path). |

## Deploying to a Google Apps Script project

1. Open <https://script.google.com> and create a new project (or open the
   existing one with id `1kZtHBdop8gy0gIAaRnuugj7n2uWP9ru7r31tDG5NILuZPfS-jJcGtOrV`).
2. Click **Project Settings** → check **Show "appsscript.json" manifest file
   in editor**.
3. Replace the contents of every file in the Apps Script editor with the
   matching file from this folder. If a file doesn't exist yet (e.g.
   `Config.gs`), click **+ → Script** to create it first.
4. Add the OAuth2 library:
   - Editor sidebar → **Libraries +**
   - Script ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`
   - Look up → select the latest version → user symbol `OAuth2` → Save.
5. Save. Hit **Deploy → Test deployments → Type: Looker Studio**. Follow the
   "deploy from manifest" link.
6. In Looker Studio, add a data source using the test deployment URL. You'll
   see an "Authorize" button → sign into AgencyViz → pick an ad account →
   build your report.

## Changing credentials

Edit `Config.gs`. The client must already be registered in the
`oauth_clients` table with a redirect URI of
`https://script.google.com/macros/d/<SCRIPT_ID>/usercallback`. If the
SCRIPT_ID changes, update the `redirect_uris` array on the matching
`oauth_clients` row.

## Adding fields

1. Add the field name to `ALLOWED_INSIGHT_FIELDS` in
   `proposal-viewer/lib/connectors/meta/fields.ts`.
2. Add a matching `fields.newDimension()` / `fields.newMetric()` entry in
   `Schema.gs`.
3. Add a corresponding `formatValue` special case in `Code.gs` if the field
   needs type coercion (dates, percentages stored as strings, etc.).
