-- Add platform_config JSONB to agency_access_config
ALTER TABLE agency_access_config
  ADD COLUMN IF NOT EXISTS platform_config jsonb DEFAULT '{
    "meta": {
      "ad_account": {"enabled": true, "role": "advertiser"},
      "page": {"enabled": false, "role": null},
      "product_catalog": {"enabled": false, "role": null},
      "pixel": {"enabled": false, "role": null}
    },
    "google": {
      "google_ads": {"enabled": true, "role": "admin"},
      "google_analytics": {"enabled": true, "role": "admin"},
      "google_business_profile": {"enabled": false, "role": null},
      "google_tag_manager": {"enabled": false, "role": null},
      "google_search_console": {"enabled": false, "role": null},
      "google_merchant_center": {"enabled": false, "role": null}
    }
  }'::jsonb;
