-- ============================================================================
-- MIGRATION 009: HOTEL PROPERTY MANAGEMENT SYSTEM (PMS) SEED DATA
-- Pali Resort & Club Operations Platform
--
-- DEVELOPMENT PLACEHOLDER DATA WARNING:
-- The 10 room numbers, room types, and rack tariffs below originate from
-- prototype development datasets (src/data/mockData.ts INITIAL_ROOMS).
-- They are retained here solely for development environment continuity.
--
-- WARNING: These room numbers, categories, floor mappings, and base tariffs
-- MUST be replaced with verified physical resort room inventory and legal
-- production rate cards before deployment to production environments.
--
-- MASTER ROOM INVENTORY SEED:
-- - Linked to master property: '00000000-0000-0000-0000-000000000001' (Pali Resort & Club).
-- - Baseline room physical state is initialized to 'AVAILABLE'.
-- - Idempotent execution via ON CONFLICT (room_number).
--
-- PRIVACY & TRANSACTIONAL INTEGRITY RULE:
-- Zero fake guest profiles, fake identity document hashes, reservations,
-- checked-in stays, room folios, or folio charges are seeded.
--
-- BASELINE STATE:
-- - hotel_rooms: 10
-- - hotel_guests: 0
-- - hotel_reservations: 0
-- - hotel_stays: 0
-- - room_folios: 0
-- - folio_charges: 0
-- ============================================================================

DO $$
DECLARE
  v_property_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN

  -- 1. SEED 10 RESORT ROOMS & SUITES (MASTER INVENTORY)
  INSERT INTO public.hotel_rooms (
    property_id,
    room_number,
    room_type,
    floor,
    status,
    base_tariff_paise,
    is_active
  ) VALUES
    -- Floor 1: Deluxe City & Garden View Rooms (Tariff: ₹3,800/night = 380000 paise)
    (v_property_id, '101', 'Deluxe City View', 1, 'AVAILABLE', 380000, true),
    (v_property_id, '102', 'Deluxe City View', 1, 'AVAILABLE', 380000, true),
    (v_property_id, '103', 'Deluxe City View', 1, 'AVAILABLE', 380000, true),
    (v_property_id, '104', 'Deluxe City View', 1, 'AVAILABLE', 380000, true),
    -- Floor 2: Executive Club Suites (Tariff: ₹6,200/night = 620000 paise)
    (v_property_id, '201', 'Executive Club Suite', 2, 'AVAILABLE', 620000, true),
    (v_property_id, '202', 'Executive Club Suite', 2, 'AVAILABLE', 620000, true),
    (v_property_id, '203', 'Executive Club Suite', 2, 'AVAILABLE', 620000, true),
    (v_property_id, '204', 'Executive Club Suite', 2, 'AVAILABLE', 620000, true),
    -- Floor 3: Presidential Royal Suites (Tariff: ₹11,500/night = 1150000 paise)
    (v_property_id, '301', 'Presidential Royal Suite', 3, 'AVAILABLE', 1150000, true),
    (v_property_id, '302', 'Presidential Royal Suite', 3, 'AVAILABLE', 1150000, true)
  ON CONFLICT (room_number) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    room_type = EXCLUDED.room_type,
    floor = EXCLUDED.floor,
    base_tariff_paise = EXCLUDED.base_tariff_paise,
    is_active = EXCLUDED.is_active;

  -- 2. TRANSACTIONAL TABLES REMAIN STRICTLY CLEAN AT BASELINE:
  -- hotel_guests = 0
  -- hotel_reservations = 0
  -- hotel_stays = 0
  -- room_folios = 0
  -- folio_charges = 0

END $$;
