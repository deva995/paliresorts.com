-- ============================================================================
-- VERIFY 023: ENSURE 20 RESTAURANT TABLES FOR REST-1
-- ============================================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.restaurant_tables
  WHERE outlet_id = 'rest-1' AND is_active = true;

  IF v_count < 20 THEN
    RAISE EXCEPTION 'Verification Failed: Expected at least 20 active tables for rest-1, found %', v_count;
  END IF;

  -- Verify table numbers T-01 through T-20 all exist
  FOR i IN 1..20 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.restaurant_tables
      WHERE outlet_id = 'rest-1' AND table_number = ('T-' || lpad(i::text, 2, '0')) AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Verification Failed: Missing active table T-% for rest-1', lpad(i::text, 2, '0');
    END IF;
  END LOOP;
END $$;
