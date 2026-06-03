-- Atomic resource limit check: acquires an advisory lock per (company, resource)
-- to prevent TOCTOU races where two concurrent requests both pass the count
-- check before either inserts.
CREATE OR REPLACE FUNCTION public.check_resource_limit_atomic(
  p_company_id uuid,
  p_table text,
  p_limit int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count int;
BEGIN
  -- Whitelist allowed tables
  IF p_table NOT IN ('proposals', 'documents', 'review_projects') THEN
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;

  -- Advisory lock keyed on company + table name prevents concurrent callers
  -- from both passing the count check before either inserts.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_company_id::text || ':' || p_table)
  );

  EXECUTE format(
    'SELECT COUNT(*)::int FROM %I WHERE company_id = $1',
    p_table
  ) USING p_company_id INTO current_count;

  RETURN current_count < p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_resource_limit_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_resource_limit_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_resource_limit_atomic(uuid, text, int) TO service_role;
