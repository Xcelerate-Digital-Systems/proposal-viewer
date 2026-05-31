-- E-signature support for proposals and quotes.
-- Agencies toggle require_signature per proposal in the Decision tab.
-- When enabled, clients must sign (type or draw) before accepting.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS require_signature boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_data jsonb;

COMMENT ON COLUMN proposals.require_signature IS 'When true, client must provide a signature to accept';
COMMENT ON COLUMN proposals.signature_data IS 'Captured signature: { mode, typed_name, signature_image_base64, signer_name, signer_email, signer_ip, user_agent, signed_at }';
