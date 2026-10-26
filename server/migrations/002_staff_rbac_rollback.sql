-- ============================================================================
-- MIGRATION 002: STAFF & RBAC ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Staff and RBAC schema tables, safe views, and helper functions
-- introduced by Migration 002. Intended ONLY for development resets.
--
-- DO NOT:
-- - Drop shared extensions
-- - Drop Migration 001 tables (properties, outlets, settings, zones, counters)
-- - Delete or modify auth.users
-- ============================================================================

-- 1. DROP RBAC HELPER FUNCTIONS
DROP FUNCTION IF EXISTS has_outlet_access(VARCHAR);
DROP FUNCTION IF EXISTS has_permission(VARCHAR);
DROP FUNCTION IF EXISTS has_role(VARCHAR);
DROP FUNCTION IF EXISTS current_staff_id();

-- 2. DROP SAFE STAFF VIEWS (BEFORE DROPPING STAFF TABLE)
DROP VIEW IF EXISTS staff_self_profile;
DROP VIEW IF EXISTS staff_public_profile;

-- 3. DROP CHILD ROSTER & SHIFT TABLES
DROP TABLE IF EXISTS duty_roster;
DROP TABLE IF EXISTS staff_shifts;

-- 4. DROP STAFF MAPPING TABLES
DROP TABLE IF EXISTS staff_outlet_access;
DROP TABLE IF EXISTS staff_roles;

-- 5. DROP STAFF PROFILES
DROP TABLE IF EXISTS staff;

-- 6. DROP ROLE-PERMISSION DICTIONARY TABLES (REVERSE ORDER)
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
