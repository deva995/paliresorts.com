-- ============================================================================
-- MIGRATION 010: DISCOUNTS & APPROVALS SEED DATA
-- Pali Resort & Club Operations Platform
--
-- FINANCIAL INTEGRITY RULE:
-- Zero unverified or invented discount reason codes are seeded.
-- Canonical schema (docs/SCHEMA_DESIGN.md) specifies master discount reason
-- metadata structure without hardcoding unverified business discount codes.
-- To avoid inventing non-canonical financial categories, production reason
-- codes must be configured through verified management administrative setup.
--
-- Zero fake discount approval requests or authorization actions are seeded.
--
-- BASELINE STATE:
-- - discount_reason_codes: 0
-- - approval_requests: 0
-- - approval_actions: 0
-- ============================================================================

DO $$
BEGIN
  -- Safe idempotent placeholder:
  -- Domain I tables initialize at a verified clean zero baseline.
  NULL;
END $$;
