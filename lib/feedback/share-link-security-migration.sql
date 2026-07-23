-- Share Link Security: password protection + expiration for review share links
-- 2026-07-23

-- Project-level share link security
ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- Item-level share link security (items have individual share tokens too)
ALTER TABLE review_items
  ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN review_projects.share_password_hash IS 'PBKDF2 hash of the share link password. NULL = no password required.';
COMMENT ON COLUMN review_projects.share_expires_at IS 'Expiration timestamp for the share link. NULL = never expires.';
COMMENT ON COLUMN review_items.share_password_hash IS 'PBKDF2 hash of the item share link password. NULL = inherits project setting.';
COMMENT ON COLUMN review_items.share_expires_at IS 'Expiration timestamp for the item share link. NULL = inherits project setting.';
