-- ============================================================================
-- MIGRATION 004: RESTAURANT FLOOR ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Restaurant Floor schema tables and safe views introduced by
-- Migration 004. Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop shared extensions
-- - Drop Migration 001 tables (properties, outlets, settings, zones, counters)
-- - Drop Migration 002 tables (roles, permissions, staff, roster, shifts)
-- - Drop Migration 003 tables (menu_categories, menu_items, outlet_menu_items)
-- - Modify auth.users
-- ============================================================================

-- 1. DROP SAFE FLOOR VIEW
DROP VIEW IF EXISTS public.restaurant_floor_view;

-- 2. DROP FLOOR TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS table_assignment_history;
DROP TABLE IF EXISTS restaurant_tables;
