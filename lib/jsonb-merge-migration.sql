-- Atomically merge a JSONB patch into a page's payload column.
-- Avoids the read-modify-write race where two concurrent PATCH requests
-- on different keys overwrite each other.
CREATE OR REPLACE FUNCTION public.merge_page_payload(
  p_table text,
  p_page_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_table NOT IN ('proposal_pages', 'document_pages', 'template_pages') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table;
  END IF;

  EXECUTE format(
    'UPDATE %I SET payload = COALESCE(payload, ''{}''::jsonb) || $1 WHERE id = $2 RETURNING payload',
    p_table
  ) USING p_patch, p_page_id INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_page_payload(text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_page_payload(text, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_page_payload(text, uuid, jsonb) TO service_role;
