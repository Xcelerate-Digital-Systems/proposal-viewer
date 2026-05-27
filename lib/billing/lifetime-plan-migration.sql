-- Lifetime plan: internal-only, unlimited everything, $0.
-- Only assignable by super-admins via /api/admin/accounts/[id]/subscription.
-- is_public = false keeps it off the pricing page and self-serve checkout.

INSERT INTO plans (
  slug,
  name,
  monthly_price_cents,
  yearly_price_cents,
  stripe_monthly_price_id,
  stripe_yearly_price_id,
  seat_limit,
  proposal_limit,
  document_limit,
  review_limit,
  whiteboard_limit,
  meta_connection_limit,
  ai_daily_quota,
  has_custom_domain,
  features,
  is_active,
  is_public
) VALUES (
  'lifetime',
  'Lifetime',
  0,
  0,
  NULL,
  NULL,
  NULL,   -- unlimited seats
  NULL,   -- unlimited proposals
  NULL,   -- unlimited documents
  NULL,   -- unlimited reviews
  NULL,   -- unlimited whiteboards
  NULL,   -- unlimited meta connections
  200,    -- generous AI quota
  true,   -- custom domain
  '{}',
  true,
  false   -- hidden from public pricing / checkout
)
ON CONFLICT (slug) DO UPDATE SET
  name               = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents  = EXCLUDED.yearly_price_cents,
  ai_daily_quota      = EXCLUDED.ai_daily_quota,
  has_custom_domain   = EXCLUDED.has_custom_domain,
  is_active           = EXCLUDED.is_active,
  is_public           = EXCLUDED.is_public;
