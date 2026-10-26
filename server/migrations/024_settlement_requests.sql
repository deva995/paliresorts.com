-- ============================================================================
-- MIGRATION 024: WAITER-TO-CASHIER SETTLEMENT REQUESTS
-- Pali Resort & Club Operations Platform
--
-- Provides database-backed workflow for floor servers/waiters to notify
-- cashiers when a table is ready for bill presentation and payment settlement.
-- Prevents duplicate pending requests for the same dining session.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settlement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  dining_session_id UUID NOT NULL REFERENCES public.dining_sessions(id) ON DELETE RESTRICT,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  bill_id UUID NULL REFERENCES public.bills(id) ON DELETE SET NULL,
  requested_by_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  payment_method_preference VARCHAR(30) NULL DEFAULT 'CASH',
  notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  resolved_by_staff_id UUID NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_settlement_requests_status CHECK (
    status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT ck_settlement_requests_payment_method CHECK (
    payment_method_preference IS NULL OR payment_method_preference IN ('CASH', 'UPI', 'CARD', 'ROOM_FOLIO')
  )
);

-- Ensure only one active (PENDING or ACCEPTED) settlement request exists per dining session
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_requests_pending
  ON public.settlement_requests(dining_session_id)
  WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_settlement_requests_outlet_status
  ON public.settlement_requests(outlet_id, status);

CREATE INDEX IF NOT EXISTS idx_settlement_requests_table
  ON public.settlement_requests(table_id);

CREATE INDEX IF NOT EXISTS idx_settlement_requests_bill
  ON public.settlement_requests(bill_id);

-- Row Level Security and permissions
ALTER TABLE public.settlement_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settlement_requests FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'pali_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON public.settlement_requests TO pali_runtime;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.settlement_requests TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.settlement_requests TO service_role;
  END IF;
END $$;
