-- Atomically claim the next thread_number across all items in a review project.
-- Uses advisory lock on the project ID to serialize concurrent callers.
-- Campaign-wide numbering: pins are numbered across all items, not per-item.
CREATE OR REPLACE FUNCTION public.claim_next_thread_number(p_review_project_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_num int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_review_project_id::text));

  SELECT COALESCE(MAX(thread_number), 0) + 1
    INTO next_num
    FROM review_comments
   WHERE review_item_id IN (
     SELECT id FROM review_items WHERE review_project_id = p_review_project_id
   );

  RETURN next_num;
END;
$$;

-- Only service_role should call this
REVOKE EXECUTE ON FUNCTION public.claim_next_thread_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_thread_number(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_thread_number(uuid) TO service_role;
