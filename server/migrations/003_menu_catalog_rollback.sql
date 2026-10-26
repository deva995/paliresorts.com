-- ============================================================================
-- MIGRATION 003: MENU CATALOG ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Menu Catalog schema tables, triggers, and safe views introduced by
-- Migration 003. Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop shared extensions
-- - Drop Migration 001 tables (properties, outlets, settings, zones, counters)
-- - Drop Migration 002 tables (roles, permissions, staff, roster, shifts)
-- - Modify auth.users
-- ============================================================================

-- 1. DROP MAKER-CHECKER TRIGGER & FUNCTION
DROP TRIGGER IF EXISTS trg_menu_revision_maker_checker ON menu_revision_approvals;
DROP FUNCTION IF EXISTS check_menu_revision_maker_checker();

-- 2. DROP SAFE PUBLIC MENU VIEW
DROP VIEW IF EXISTS public_outlet_menu;

-- 3. DROP MENU CATALOG TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS menu_revision_approvals;
DROP TABLE IF EXISTS menu_item_revisions;
DROP TABLE IF EXISTS outlet_menu_items;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menu_categories;
