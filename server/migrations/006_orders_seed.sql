-- ============================================================================
-- MIGRATION 006: ORDERS & ROUNDS SEED SCRIPT
-- Pali Resort & Club Operations Platform
--
-- FINANCIAL & OPERATIONAL HYGIENE:
-- - In compliance with financial auditability and billing integrity, NO synthetic
--   or mock orders, rounds, line items, or status changes are pre-seeded.
-- - Order records, sequential daily numbers, and immutable price snapshots are
--   generated exclusively at runtime via verified POS and QR workflows.
--
-- EXPECTED SEED RECORD COUNTS:
-- - orders: 0
-- - order_items: 0
-- - order_status_history: 0
-- ============================================================================

DO $$
BEGIN
  -- Intentionally zero seed records to maintain clean operational slate
  RAISE NOTICE 'Migration 006 Seed: Retained clean state (0 orders, 0 order_items, 0 order_status_history).';
END $$;
