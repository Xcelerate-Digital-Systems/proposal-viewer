-- Add PKCE columns to oauth_auth_codes for OAuth 2.1 compliance
-- Required by MCP Authorization spec

ALTER TABLE oauth_auth_codes
  ADD COLUMN IF NOT EXISTS code_challenge text,
  ADD COLUMN IF NOT EXISTS code_challenge_method text;

-- Add source column to oauth_clients for tracking dynamic registrations
ALTER TABLE oauth_clients
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
