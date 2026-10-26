-- ============================================================================
-- MIGRATION 007: KITCHEN DISPLAY SYSTEM (KDS) ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Kitchen Display System & KOT schema tables introduced by Migration 007.
-- Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop orders, order_items, or order_status_history (Migration 006)
-- - Drop dining_sessions, customers, or guest_session_tokens (Migration 005)
-- - Drop restaurant_tables or table_assignment_history (Migration 004)
-- - Drop menu catalog tables (Migration 003)
-- - Drop staff, roles, or permissions (Migration 002)
-- - Drop outlets, zones, or properties (Migration 001)
-- - Modify auth.users
-- ============================================================================

-- DROP DOMAIN G TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS kot_status_history;
DROP TABLE IF EXISTS kot_items;
DROP TABLE IF EXISTS kots;
DROP TABLE IF EXISTS kitchen_stations;
