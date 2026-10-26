-- ============================================================================
-- MIGRATION 005: CUSTOMER & DINING SESSIONS SEED SCRIPT
-- Pali Resort & Club Operations Platform
--
-- PRIVACY & SECURITY POLICY:
-- - In compliance with data privacy standards, NO fake customer PII, phone OTPs,
--   or guest bearer tokens are pre-seeded into the database.
-- - Operating sessions, guest tokens, and service requests are ephemeral operational
--   records created dynamically at runtime during live service.
--
-- EXPECTED SEED RECORD COUNTS:
-- - customers: 0
-- - dining_sessions: 0
-- - guest_session_tokens: 0
-- - service_requests: 0
-- ============================================================================

DO $$
BEGIN
  -- Intentionally zero seed records to ensure clean operational slate
  RAISE NOTICE 'Migration 005 Seed: Retained clean state (0 customers, 0 sessions, 0 tokens, 0 service requests).';
END $$;
