-- ============================================================================
-- MIGRATION 008: BILLING, PAYMENTS & REFUNDS SEED DATA
-- Pali Resort & Club Operations Platform
--
-- FINANCIAL INTEGRITY RULE:
-- Zero fake bills, bill items, payments, payment allocations, or refunds are seeded.
-- Invoices, payment transactions, and refunds represent legal financial records
-- and must be generated strictly through real operations via the Express backend API.
--
-- BASELINE STATE:
-- - bills: 0
-- - bill_items: 0
-- - payments: 0
-- - payment_allocations: 0
-- - refunds: 0
-- ============================================================================

DO $$
BEGIN
  -- Verification placeholder: Migration 008 introduces purely transactional
  -- financial domain tables. No master configuration or mock financial records.
  NULL;
END $$;
