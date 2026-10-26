-- ============================================================================
-- MIGRATION 001: FOUNDATION ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- This rollback script drops all foundation tables and is intended ONLY for
-- local development teardown and testing before any production data exists.
-- Do NOT execute against a live production environment with active transactions.
-- Note: Shared extensions (e.g. pgcrypto) are NOT dropped as they may be shared.
-- ============================================================================

-- 1. DROP CHILD DOMAIN TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS dining_zones;
DROP TABLE IF EXISTS outlet_counters;
DROP TABLE IF EXISTS outlet_settings;

-- 2. DROP CORE VENUE ENTITIES
DROP TABLE IF EXISTS outlets;

-- 3. DROP ROOT PROPERTY ENTITY
DROP TABLE IF EXISTS properties;
