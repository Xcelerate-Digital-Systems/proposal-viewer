-- Atomically reorder pages via a single transaction.
-- Accepts a JSON array of {id, position} pairs and applies them in one shot.
-- The two-pass negative-intermediary approach runs inside the transaction
-- so a crash between passes doesn't leave corrupted positions.
CREATE OR REPLACE FUNCTION public.reorder_pages(
  p_table text,
  p_id_column text,
  p_entity_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  i int;
  tbl text;
  col text;
BEGIN
  -- Whitelist allowed table/column names to prevent SQL injection
  IF p_table NOT IN ('proposal_pages', 'document_pages', 'template_pages') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table;
  END IF;
  IF p_id_column NOT IN ('proposal_id', 'document_id', 'template_id') THEN
    RAISE EXCEPTION 'Invalid column name: %', p_id_column;
  END IF;

  tbl := p_table;
  col := p_id_column;

  -- Pass 1: negative intermediary positions
  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    EXECUTE format(
      'UPDATE %I SET position = $1 WHERE id = $2 AND %I = $3',
      tbl, col
    ) USING -(i), p_ordered_ids[i], p_entity_id;
  END LOOP;

  -- Pass 2: final positions
  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    EXECUTE format(
      'UPDATE %I SET position = $1 WHERE id = $2 AND %I = $3',
      tbl, col
    ) USING (i - 1), p_ordered_ids[i], p_entity_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reorder_pages(text, text, uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_pages(text, text, uuid, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_pages(text, text, uuid, uuid[]) TO service_role;
