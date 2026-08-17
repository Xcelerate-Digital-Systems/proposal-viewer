export type AccessPlatform =
  | 'meta'
  | 'google_ga4'
  | 'google_gtm'
  | 'google_ads'
  | 'google_gbp'
  | 'google_search_console'
  | 'wordpress';

export type AccessRequestStatus =
  | 'pending'
  | 'partial'
  | 'complete'
  | 'expired'
  | 'revoked';

export type AccessGrantStatus =
  | 'pending'
  | 'oauth_complete'
  | 'request_sent'
  | 'granted'
  | 'failed'
  | 'self_reported';

export interface ClientAccessRequest {
  id: string;
  company_id: string;
  client_id: string | null;
  share_token: string;
  platforms: AccessPlatform[];
  status: AccessRequestStatus;
  expires_at: string | null;
  created_by: string | null;
  client_name: string | null;
  client_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientAccessGrant {
  id: string;
  request_id: string;
  platform: AccessPlatform;
  status: AccessGrantStatus;
  oauth_token_encrypted: string | null;
  oauth_refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  platform_user_id: string | null;
  platform_user_name: string | null;
  platform_account_id: string | null;
  platform_account_name: string | null;
  partner_request_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  granted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyAccessConfig {
  id: string;
  company_id: string;
  universal_share_token: string | null;
  default_platforms: AccessPlatform[] | null;
  meta_business_id: string | null;
  meta_business_name: string | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  google_mcc_id: string | null;
  google_mcc_name: string | null;
  google_analytics_email: string | null;
  google_gtm_email: string | null;
  google_gbp_email: string | null;
  google_search_console_email: string | null;
  google_user_name: string | null;
  wordpress_admin_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientAccessOAuthState {
  state_hash: string;
  access_request_id: string;
  grant_id: string;
  platform: AccessPlatform;
  redirect_token: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export const VALID_PLATFORMS: AccessPlatform[] = [
  'meta',
  'google_ga4',
  'google_gtm',
  'google_ads',
  'google_gbp',
  'google_search_console',
  'wordpress',
];

export const PLATFORM_LABELS: Record<AccessPlatform, string> = {
  meta: 'Meta (Facebook & Instagram)',
  google_ga4: 'Google Analytics 4',
  google_gtm: 'Google Tag Manager',
  google_ads: 'Google Ads',
  google_gbp: 'Google Business Profile',
  google_search_console: 'Google Search Console',
  wordpress: 'WordPress',
};
