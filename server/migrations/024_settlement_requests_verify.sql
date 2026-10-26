-- ============================================================================
-- VERIFY 024: WAITER-TO-CASHIER SETTLEMENT REQUESTS
-- ============================================================================

DO $$
BEGIN
  -- 1. Verify settlement_requests table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'settlement_requests'
  ) THEN
    RAISE EXCEPTION 'Verification Failed: public.settlement_requests table does not exist';
  END IF;

  -- 2. Verify unique index for single active request per session
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'settlement_requests' 
      AND indexname = 'uq_settlement_requests_pending'
  ) THEN
    RAISE EXCEPTION 'Verification Failed: uq_settlement_requests_pending unique index missing';
  END IF;

  -- 3. Verify status constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'ck_settlement_requests_status'
  ) THEN
    RAISE EXCEPTION 'Verification Failed: ck_settlement_requests_status check constraint missing';
  END IF;
END $$;
