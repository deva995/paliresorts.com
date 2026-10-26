-- ============================================================================
-- MIGRATION 004: RESTAURANT FLOOR & TABLES
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain D)
-- ============================================================================

-- 1. RESTAURANT TABLES (Domain D, Table 19)
-- Represents physical floor dining tables belonging to an outlet and dining zone.
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  zone_id UUID NOT NULL REFERENCES dining_zones(id) ON DELETE RESTRICT,
  table_number VARCHAR(20) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  active_dining_session_id UUID NULL, -- Circular FK to dining_sessions added in Domain E
  current_waiter_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NULL,
  qr_public_code VARCHAR(32) NOT NULL,
  qr_secret_token_hash VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_restaurant_tables_outlet_number UNIQUE (outlet_id, table_number),
  CONSTRAINT uq_restaurant_tables_qr_public UNIQUE (qr_public_code),
  CONSTRAINT uq_restaurant_tables_qr_hash UNIQUE (qr_secret_token_hash),
  CONSTRAINT ck_restaurant_tables_capacity CHECK (capacity > 0),
  CONSTRAINT ck_restaurant_tables_status CHECK (
    status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'BILLED', 'CLEANING', 'OUT_OF_SERVICE')
  )
);

CREATE INDEX IF NOT EXISTS idx_tables_outlet_status ON restaurant_tables(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_tables_zone ON restaurant_tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_tables_waiter ON restaurant_tables(current_waiter_staff_id);

-- 2. TABLE ASSIGNMENT HISTORY (Domain D, Table 20)
-- Immutable audit trail of waiter assignments to tables.
CREATE TABLE IF NOT EXISTS table_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  dining_session_id UUID NULL, -- FK to dining_sessions added in Domain E
  waiter_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  assigned_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_table_assign_window CHECK (released_at IS NULL OR released_at >= assigned_at)
);

CREATE INDEX IF NOT EXISTS idx_table_assign_table ON table_assignment_history(table_id);
CREATE INDEX IF NOT EXISTS idx_table_assign_waiter ON table_assignment_history(waiter_staff_id);
CREATE INDEX IF NOT EXISTS idx_table_assign_by ON table_assignment_history(assigned_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_table_assign_active ON table_assignment_history(table_id) WHERE released_at IS NULL;

-- ============================================================================
-- SAFE FLOOR VIEW (OPERATIONAL INFORMATION FOR FLOOR POS / STEWARDS)
-- Uses security_invoker = true to enforce caller RLS and permissions.
-- Exposes strictly operational fields.
-- Completely excludes qr_secret_token_hash and qr_public_code.
-- ============================================================================

CREATE OR REPLACE VIEW public.restaurant_floor_view
WITH (security_invoker = true)
AS
SELECT 
  t.id AS table_id,
  t.outlet_id,
  t.zone_id AS dining_zone_id,
  z.name AS zone_name,
  z.code AS zone_code,
  t.table_number,
  t.capacity,
  t.status,
  CASE 
    WHEN s.id IS NOT NULL THEN s.first_name || ' ' || s.last_name 
    ELSE NULL 
  END AS current_waiter_name,
  t.is_active
FROM public.restaurant_tables t
JOIN public.dining_zones z ON z.id = t.zone_id
LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id
WHERE t.is_active = true;

-- For Migration 004: Accessible ONLY by authenticated staff.
-- Anonymous access is explicitly revoked.
REVOKE ALL ON public.restaurant_floor_view FROM anon, public;
GRANT SELECT ON public.restaurant_floor_view TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_assignment_history ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all table-level access from anon and public.
REVOKE ALL ON TABLE public.restaurant_tables FROM anon, public;
REVOKE ALL ON TABLE public.table_assignment_history FROM authenticated, anon, public;

-- Grant column-restricted SELECT to authenticated on restaurant_tables strictly for view resolution.
-- qr_secret_token_hash and qr_public_code are deliberately NOT granted to client roles!
GRANT SELECT (
  id, outlet_id, zone_id, table_number, capacity, status,
  current_waiter_staff_id, is_active
) ON public.restaurant_tables TO authenticated;

-- Full CRUD granted strictly to backend service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restaurant_tables TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_assignment_history TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped Access Control):
-- Authenticated staff can read tables strictly for outlets they are authorized to access.
CREATE POLICY restaurant_tables_select_auth ON restaurant_tables
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- Assignment history is restricted to staff authorized for the associated table's outlet.
CREATE POLICY table_assign_select_auth ON table_assignment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurant_tables rt
      WHERE rt.id = table_assignment_history.table_id
        AND public.has_outlet_access(rt.outlet_id)
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on tables and assignment history are blocked.
-- All table creation, capacity changes, and waiter reassignments must route through the trusted Express backend API.
