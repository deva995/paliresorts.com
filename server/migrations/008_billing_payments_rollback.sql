-- ============================================================================
-- MIGRATION 008: BILLING, PAYMENTS & REFUNDS ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Billing, Payment & Refund schema tables introduced by Migration 008.
-- Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop kitchen_stations, kots, kot_items, kot_status_history (Migration 007)
-- - Drop orders, order_items, or order_status_history (Migration 006)
-- - Drop dining_sessions, customers, or guest_session_tokens (Migration 005)
-- - Drop restaurant_tables or table_assignment_history (Migration 004)
-- - Drop menu catalog tables (Migration 003)
-- - Drop staff, roles, or permissions (Migration 002)
-- - Drop outlets, zones, or properties (Migration 001)
-- - Modify auth.users
-- ============================================================================

-- DROP DOMAIN H TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payment_allocations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bill_items;
DROP TABLE IF EXISTS bills;
