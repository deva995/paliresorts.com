-- ============================================================================
-- MIGRATION 009: HOTEL PROPERTY MANAGEMENT SYSTEM (PMS) ROLLBACK (DEVELOPMENT ONLY)
-- Pali Resort & Club Operations Platform
--
-- CAUTION:
-- Drops all Hotel PMS schema tables and removes delayed foreign keys installed by Migration 009.
-- Intended ONLY for development resets. Unsafe once real PMS or financial folio data exists.
--
-- DO NOT:
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

-- 1. DROP DELAYED FOREIGN KEY CONSTRAINTS FROM EARLIER TABLES
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_room;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_hotel_stay;
ALTER TABLE dining_sessions DROP CONSTRAINT IF EXISTS fk_dining_sessions_hotel_stay;

-- 2. DROP DOMAIN J TABLES (REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS folio_charges;
DROP TABLE IF EXISTS room_folios;
DROP TABLE IF EXISTS hotel_stays;
DROP TABLE IF EXISTS hotel_reservations;
DROP TABLE IF EXISTS hotel_guests;
DROP TABLE IF EXISTS hotel_rooms;
