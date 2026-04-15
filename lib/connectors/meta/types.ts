export interface MetaConnection {
  id: string;
  company_id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  access_token_encrypted: string;
  expires_at: string;
  scopes: string[];
  status: 'active' | 'needs_reauth' | 'revoked';
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaAdAccount {
  connection_id: string;
  ad_account_id: string;
  account_name: string | null;
  currency: string | null;
  timezone_name: string | null;
  business_name: string | null;
  enabled: boolean;
  created_at: string;
}

export interface MetaInsightsRequest {
  ad_account_id: string;
  date_from: string;                          // YYYY-MM-DD
  date_to: string;                            // YYYY-MM-DD
  fields?: string[];                          // optional override; defaults to INSIGHT_FIELDS
  level?: 'ad' | 'adset' | 'campaign' | 'account';
}

export interface MetaInsightsResponse {
  rows: Record<string, unknown>[];
  row_count: number;
  elapsed_ms: number;
  meta_pages: number;
}
