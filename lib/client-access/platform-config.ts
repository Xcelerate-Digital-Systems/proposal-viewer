export interface AssetConfig {
  enabled: boolean;
  role: string | null;
}

export interface PlatformConfig {
  meta: {
    ad_account: AssetConfig;
    page: AssetConfig;
    product_catalog: AssetConfig;
    pixel: AssetConfig;
  };
  google: {
    google_ads: AssetConfig;
    google_analytics: AssetConfig;
    google_business_profile: AssetConfig;
    google_tag_manager: AssetConfig;
    google_search_console: AssetConfig;
    google_merchant_center: AssetConfig;
  };
}

export interface AssetDefinition {
  key: string;
  label: string;
  roles: { value: string; label: string }[];
}

export const META_ASSETS: AssetDefinition[] = [
  {
    key: 'ad_account',
    label: 'Ad Account',
    roles: [
      { value: 'analyst', label: 'Analyst' },
      { value: 'advertiser', label: 'Advertiser' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'page',
    label: 'Page',
    roles: [
      { value: 'analyst', label: 'Analyst' },
      { value: 'moderator', label: 'Moderator' },
      { value: 'advertiser', label: 'Advertiser' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'product_catalog',
    label: 'Product Catalog',
    roles: [
      { value: 'analyst', label: 'Analyst' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'pixel',
    label: 'Dataset (Pixel)',
    roles: [
      { value: 'analyst', label: 'Analyst' },
      { value: 'admin', label: 'Admin' },
    ],
  },
];

export const GOOGLE_ASSETS: AssetDefinition[] = [
  {
    key: 'google_ads',
    label: 'Google Ads',
    roles: [
      { value: 'standard', label: 'Standard' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'google_analytics',
    label: 'Google Analytics',
    roles: [
      { value: 'viewer', label: 'Viewer' },
      { value: 'editor', label: 'Editor' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'google_business_profile',
    label: 'Google Business Profile',
    roles: [
      { value: 'manager', label: 'Manager' },
      { value: 'owner', label: 'Owner' },
    ],
  },
  {
    key: 'google_tag_manager',
    label: 'Google Tag Manager',
    roles: [
      { value: 'read', label: 'Read' },
      { value: 'edit', label: 'Edit' },
      { value: 'admin', label: 'Admin' },
    ],
  },
  {
    key: 'google_search_console',
    label: 'Google Search Console',
    roles: [
      { value: 'restricted', label: 'Restricted' },
      { value: 'full', label: 'Full' },
    ],
  },
  {
    key: 'google_merchant_center',
    label: 'Google Merchant Center',
    roles: [
      { value: 'standard', label: 'Standard' },
      { value: 'admin', label: 'Admin' },
    ],
  },
];

// AccessPlatform → PlatformConfig.google key (naming skew between DB/types and config)
export const GOOGLE_PLATFORM_TO_CONFIG_KEY: Record<string, keyof PlatformConfig['google']> = {
  google_ads: 'google_ads',
  google_ga4: 'google_analytics',
  google_gtm: 'google_tag_manager',
  google_business_profile: 'google_business_profile',
  google_search_console: 'google_search_console',
  google_merchant_center: 'google_merchant_center',
};

export function defaultPlatformConfig(): PlatformConfig {
  return {
    meta: {
      ad_account: { enabled: true, role: 'advertiser' },
      page: { enabled: false, role: null },
      product_catalog: { enabled: false, role: null },
      pixel: { enabled: false, role: null },
    },
    google: {
      google_ads: { enabled: true, role: 'admin' },
      google_analytics: { enabled: true, role: 'admin' },
      google_business_profile: { enabled: false, role: null },
      google_tag_manager: { enabled: false, role: null },
      google_search_console: { enabled: false, role: null },
      google_merchant_center: { enabled: false, role: null },
    },
  };
}
