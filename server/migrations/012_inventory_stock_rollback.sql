-- ============================================================================
-- MIGRATION 012: INVENTORY & STOCK CONTROL ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Inventory & Stock Control schema tables (Domain M).
-- Intended ONLY for development resets. Unsafe once real ingredient masters,
-- storeroom locations, stock balances, or movement audit ledgers exist.
--
-- DO NOT:
-- - Drop housekeeping or maintenance tables (Migration 011)
-- - Drop discounts or approval tables (Migration 010)
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

-- 1. DROP DOMAIN M TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS inventory_balances;
DROP TABLE IF EXISTS inventory_locations;
DROP TABLE IF EXISTS inventory_items;
