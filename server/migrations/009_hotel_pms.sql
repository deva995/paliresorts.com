-- ============================================================================
-- MIGRATION 009: HOTEL PROPERTY MANAGEMENT SYSTEM (PMS)
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain J)
-- ============================================================================

-- 1. HOTEL ROOMS (Domain J, Table 40)
-- Physical guest rooms, suites, and resort villas.
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  room_number VARCHAR(20) NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  base_tariff_paise BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_hotel_rooms_number UNIQUE (room_number),
  CONSTRAINT ck_hotel_rooms_tariff CHECK (base_tariff_paise >= 0),
  CONSTRAINT ck_hotel_rooms_status CHECK (
    status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_SERVICE')
  )
);

CREATE INDEX IF NOT EXISTS idx_rooms_property ON hotel_rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON hotel_rooms(status);

-- 2. HOTEL GUESTS (Domain J, Table 41)
-- Master guest profiles with privacy-preserving identity document hash.
CREATE TABLE IF NOT EXISTS hotel_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NULL,
  id_proof_type VARCHAR(50) NOT NULL,
  id_proof_number_hash VARCHAR(64) NOT NULL,
  nationality VARCHAR(50) NOT NULL DEFAULT 'Indian',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_hotel_guests_phone UNIQUE (phone),
  CONSTRAINT ck_hotel_guests_id_proof CHECK (
    id_proof_type IN ('AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID')
  )
);

-- Note: Dedicated idx_hotel_guests_phone is omitted; phone is already indexed by uq_hotel_guests_phone UNIQUE B-tree index.

-- 3. HOTEL RESERVATIONS (Domain J, Table 42)
-- Advance and walk-in stay reservations.
CREATE TABLE IF NOT EXISTS hotel_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES hotel_guests(id) ON DELETE RESTRICT,
  booking_reference VARCHAR(30) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_hotel_reservations_booking_ref UNIQUE (booking_reference),
  CONSTRAINT ck_hotel_reservations_dates CHECK (check_out_date > check_in_date),
  CONSTRAINT ck_hotel_reservations_status CHECK (
    status IN ('CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')
  )
);

CREATE INDEX IF NOT EXISTS idx_reservations_property ON hotel_reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON hotel_reservations(guest_id);

-- 4. HOTEL STAYS (Domain J, Table 43)
-- Active and historical checked-in in-house room occupancy.
CREATE TABLE IF NOT EXISTS hotel_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES hotel_guests(id) ON DELETE RESTRICT,
  reservation_id UUID NULL REFERENCES hotel_reservations(id) ON DELETE SET NULL,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_check_out_at TIMESTAMPTZ NOT NULL,
  actual_check_out_at TIMESTAMPTZ NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'CHECKED_IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_hotel_stays_dates CHECK (expected_check_out_at > check_in_at),
  CONSTRAINT ck_hotel_stays_status CHECK (
    status IN ('CHECKED_IN', 'CHECKED_OUT')
  )
);

CREATE INDEX IF NOT EXISTS idx_stays_room ON hotel_stays(room_id);
CREATE INDEX IF NOT EXISTS idx_stays_guest ON hotel_stays(guest_id);
CREATE INDEX IF NOT EXISTS idx_stays_reservation ON hotel_stays(reservation_id);

-- Enforce exactly ONE active checked-in stay per physical hotel room
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_room_stay
  ON hotel_stays(room_id)
  WHERE status = 'CHECKED_IN';

-- 5. ROOM FOLIOS (Domain J, Table 44)
-- Financial billing ledger tied to a hotel stay.
CREATE TABLE IF NOT EXISTS room_folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES hotel_stays(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  total_charges_paise BIGINT NOT NULL DEFAULT 0,
  total_payments_paise BIGINT NOT NULL DEFAULT 0,
  outstanding_balance_paise BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_room_folios_charges CHECK (total_charges_paise >= 0),
  CONSTRAINT ck_room_folios_payments CHECK (total_payments_paise >= 0),
  CONSTRAINT ck_room_folios_status CHECK (
    status IN ('OPEN', 'LOCKED', 'SETTLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_room_folios_stay ON room_folios(stay_id);

-- Enforce exactly ONE open folio per hotel stay
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_room_folio
  ON room_folios(stay_id)
  WHERE status = 'OPEN';

-- 6. FOLIO CHARGES (Domain J, Table 45)
-- Itemized charges posted to a room folio from room tariff or restaurant dining.
CREATE TABLE IF NOT EXISTS folio_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID NOT NULL REFERENCES room_folios(id) ON DELETE RESTRICT,
  charge_type VARCHAR(30) NOT NULL,
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  bill_id UUID NULL REFERENCES bills(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL,
  description TEXT NOT NULL,
  posted_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_folio_charges_amount CHECK (amount_paise > 0),
  CONSTRAINT ck_folio_charges_type CHECK (
    charge_type IN ('ROOM_TARIFF', 'RESTAURANT_DINING', 'LAUNDRY', 'SPA', 'MINIBAR')
  )
);

CREATE INDEX IF NOT EXISTS idx_folio_charges_folio ON folio_charges(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_outlet ON folio_charges(outlet_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_bill ON folio_charges(bill_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_staff ON folio_charges(posted_by_staff_id);

-- ============================================================================
-- INSTALL DELAYED FOREIGN KEYS FROM MIGRATIONS 005 AND 006
-- ============================================================================

-- 1. dining_sessions.hotel_stay_id -> hotel_stays(id) (Delayed from Migration 005)
ALTER TABLE dining_sessions
  ADD CONSTRAINT fk_dining_sessions_hotel_stay
  FOREIGN KEY (hotel_stay_id) REFERENCES hotel_stays(id) ON DELETE RESTRICT;

-- 2. orders.hotel_stay_id -> hotel_stays(id) (Delayed from Migration 006)
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_hotel_stay
  FOREIGN KEY (hotel_stay_id) REFERENCES hotel_stays(id) ON DELETE RESTRICT;

-- 3. orders.room_id -> hotel_rooms(id) (Delayed from Migration 006)
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_room
  FOREIGN KEY (room_id) REFERENCES hotel_rooms(id) ON DELETE RESTRICT;

-- Note: Indexes for these three columns were already created during Migrations 005 and 006:
-- - idx_dining_sessions_hotel_stay ON dining_sessions(hotel_stay_id)
-- - idx_orders_hotel_stay ON orders(hotel_stay_id)
-- - idx_orders_room ON orders(room_id)

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_charges ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public, anon, and authenticated (hotel_guests is strictly backend-only)
REVOKE ALL ON TABLE public.hotel_rooms FROM anon, public;
REVOKE ALL ON TABLE public.hotel_guests FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.hotel_reservations FROM anon, public;
REVOKE ALL ON TABLE public.hotel_stays FROM anon, public;
REVOKE ALL ON TABLE public.room_folios FROM anon, public;
REVOKE ALL ON TABLE public.folio_charges FROM anon, public;

-- Grant selective read to authenticated staff (hotel_guests excluded: backend-only PII protection):
GRANT SELECT ON TABLE public.hotel_rooms TO authenticated;
GRANT SELECT ON TABLE public.hotel_reservations TO authenticated;
GRANT SELECT ON TABLE public.hotel_stays TO authenticated;
GRANT SELECT ON TABLE public.room_folios TO authenticated;
GRANT SELECT ON TABLE public.folio_charges TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 6 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_guests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_stays TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.room_folios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.folio_charges TO service_role;

-- 2. Hardened RLS Policies (Permission-Based Access Control):
-- Note: hotel_guests has RLS enabled with ZERO client policies (backend-only via service_role)

-- Hotel Rooms: Accessible to staff holding hotel:view permission
CREATE POLICY hotel_rooms_select_auth ON hotel_rooms
  FOR SELECT TO authenticated
  USING (public.has_permission('hotel:view'));

-- Hotel Reservations: Accessible to staff holding hotel:view permission
CREATE POLICY hotel_reservations_select_auth ON hotel_reservations
  FOR SELECT TO authenticated
  USING (public.has_permission('hotel:view'));

-- Hotel Stays: Accessible to staff holding hotel:view permission
CREATE POLICY hotel_stays_select_auth ON hotel_stays
  FOR SELECT TO authenticated
  USING (public.has_permission('hotel:view'));

-- Room Folios: Accessible to staff holding hotel:view, folio:charge, or bill:view permission
CREATE POLICY room_folios_select_auth ON room_folios
  FOR SELECT TO authenticated
  USING (
    public.has_permission('hotel:view')
    OR public.has_permission('folio:charge')
    OR public.has_permission('bill:view')
  );

-- Folio Charges: Accessible to staff holding hotel:view, folio:charge, or bill:view permission
CREATE POLICY folio_charges_select_auth ON folio_charges
  FOR SELECT TO authenticated
  USING (
    public.has_permission('hotel:view')
    OR public.has_permission('folio:charge')
    OR public.has_permission('bill:view')
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 6 tables are blocked.
-- All check-in, check-out, folio charge postings, and reservations must route through the trusted Express backend API via Service Role.
