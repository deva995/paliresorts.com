-- ============================================================================
-- MIGRATION 011: HOUSEKEEPING & MAINTENANCE ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Housekeeping & Maintenance schema tables.
-- Intended ONLY for development resets. Unsafe once real hotel room cleaning,
-- room turnover logs, or maintenance defect histories exist.
--
-- DO NOT:
-- - Drop discounts/approval tables (Migration 010)
-- - Drop hotel PMS tables (Migration 009)
-- - Drop bills, bill_items, payments, payment_allocations, refunds (Migration 008)
-- - Drop kitchen_stations, kots, kot_items, kot_status_history (Migration 007)
-- - Drop orders, order_items, or order_status_history (Migration 006)
-- - Drop dining_sessions, customers, or guest_session_tokens (Migration 005)
-- - Drop restaurant_tables or table_assignment_history (Migration 004)
-- - Drop menu catalog tables (Migration 003)
-- - Drop staff, roles, or permissions (Migration 002)
-- - Drop outlets, zones, or properties (Migration 001)
-- - Modify auth.users
-- ============================================================================

-- 1. DROP DOMAIN K TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS maintenance_issues;
DROP TABLE IF EXISTS room_status_history;
DROP TABLE IF EXISTS housekeeping_tasks;
