-- ============================================================================
-- MIGRATION 006: ORDERS & ROUNDS ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Orders and Rounds schema tables introduced by Migration 006.
-- Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop dining_sessions, customers, or guest_session_tokens (Migration 005)
-- - Drop restaurant_tables or table_assignment_history (Migration 004)
-- - Drop menu catalog tables (Migration 003)
-- - Drop staff, roles, or permissions (Migration 002)
-- - Drop outlets, zones, or properties (Migration 001)
-- - Modify auth.users
-- ============================================================================

-- DROP DOMAIN F TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
