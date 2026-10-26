-- ============================================================================
-- MIGRATION 005: CUSTOMER & DINING SESSIONS ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Customer and Dining Session schema tables and delayed FK constraints
-- introduced by Migration 005. Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop restaurant_tables or table_assignment_history (Migration 004)
-- - Drop menu catalog tables (Migration 003)
-- - Drop staff, roles, or permissions (Migration 002)
-- - Drop outlets, zones, or properties (Migration 001)
-- - Modify auth.users
-- ============================================================================

-- 1. DROP CIRCULAR DELAYED FK ON restaurant_tables
ALTER TABLE public.restaurant_tables
DROP CONSTRAINT IF EXISTS fk_tables_active_session;

-- 2. DROP DOMAIN E TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS guest_session_tokens;
DROP TABLE IF EXISTS dining_sessions;
DROP TABLE IF EXISTS customers;
