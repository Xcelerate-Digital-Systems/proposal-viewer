-- Add deal_lost to the review_board_shapes.shape_type CHECK constraint.
-- The funnel_board_shapes table has no CHECK on shape_type so it accepts
-- deal_lost already; this brings the feedback board in line.

ALTER TABLE review_board_shapes DROP CONSTRAINT IF EXISTS review_board_shapes_shape_type_check;

ALTER TABLE review_board_shapes
  ADD CONSTRAINT review_board_shapes_shape_type_check
  CHECK (shape_type = ANY (ARRAY[
    -- drawing primitives
    'rectangle', 'ellipse', 'arrow', 'line', 'text',
    -- custom actions
    'decision', 'wait', 'refund', 'download', 'share', 'login', 'custom_event',
    -- conversion actions
    'purchase', 'form_completed', 'schedule_meeting', 'on_site_visit',
    'send_quote', 'deal_won', 'deal_lost', 'add_to_cart', 'subscribe', 'goal',
    'send_google_review', 'add_to_referral_program',
    -- engagement actions
    'page_view', 'button_click', 'form_submit', 'video_play',
    'scroll_depth', 'time_on_page', 'exit_intent',
    -- integration actions
    'webhook', 'google_sheet', 'call', 'meeting', 'automation',
    -- GoHighLevel actions
    'sms_notification', 'email_notification', 'ghl_notification',
    'ghl_appointment', 'ghl_order', 'ghl_opportunity', 'ghl_opportunity_won'
  ]::text[]));
