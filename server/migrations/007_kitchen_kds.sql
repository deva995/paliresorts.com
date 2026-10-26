-- ============================================================================
-- MIGRATION 007: KITCHEN DISPLAY SYSTEM (KDS) & KOTS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain G)
-- ============================================================================

-- 1. KITCHEN STATIONS (Domain G, Table 28)
-- Physical preparation and dispense stations within an outlet.
CREATE TABLE IF NOT EXISTS kitchen_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_kitchen_stations_outlet_code UNIQUE (outlet_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stations_outlet ON kitchen_stations(outlet_id);

-- 2. KOTS (Domain G, Table 29)
-- Kitchen Order Tickets routed to specific kitchen stations.
CREATE TABLE IF NOT EXISTS kots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE RESTRICT,
  kot_number INTEGER NOT NULL,
  location_label_snapshot VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  accepted_at TIMESTAMPTZ NULL,
  preparing_at TIMESTAMPTZ NULL,
  ready_at TIMESTAMPTZ NULL,
  served_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_kots_kot_number CHECK (kot_number > 0),
  CONSTRAINT ck_kots_status CHECK (
    status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_kots_station_status ON kots(outlet_id, station_id, status);
CREATE INDEX IF NOT EXISTS idx_kots_order ON kots(order_id);
CREATE INDEX IF NOT EXISTS idx_kots_station ON kots(station_id);
-- Note: Dedicated idx_kots_outlet is omitted as redundant; outlet_id is the leading column of idx_kots_station_status.

-- 3. KOT ITEMS (Domain G, Table 30)
-- Line items printed/displayed on a KOT ticket for station preparation.
CREATE TABLE IF NOT EXISTS kot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_id UUID NOT NULL REFERENCES kots(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  item_name_snapshot VARCHAR(150) NOT NULL,
  quantity INTEGER NOT NULL,
  customization_notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_kot_items_quantity CHECK (quantity > 0),
  CONSTRAINT ck_kot_items_status CHECK (
    status IN ('NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_kot_items_kot ON kot_items(kot_id);
CREATE INDEX IF NOT EXISTS idx_kot_items_order_item ON kot_items(order_item_id);

-- 4. KOT STATUS HISTORY (Domain G, Table 31)
-- Timestamps and lifecycle progression audit for kitchen preparation speed analytics.
CREATE TABLE IF NOT EXISTS kot_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kot_id UUID NOT NULL REFERENCES kots(id) ON DELETE RESTRICT,
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kot_history_kot ON kot_status_history(kot_id);
CREATE INDEX IF NOT EXISTS idx_kot_history_staff ON kot_status_history(changed_by_staff_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_status_history ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.kitchen_stations FROM anon, public;
REVOKE ALL ON TABLE public.kots FROM anon, public;
REVOKE ALL ON TABLE public.kot_items FROM anon, public;
REVOKE ALL ON TABLE public.kot_status_history FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.kitchen_stations TO authenticated;
GRANT SELECT ON TABLE public.kots TO authenticated;
GRANT SELECT ON TABLE public.kot_items TO authenticated;
GRANT SELECT ON TABLE public.kot_status_history TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 4 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kitchen_stations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kot_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kot_status_history TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped & Permission-Based Access Control):

-- Kitchen Stations: Accessible to staff authorized for the station's outlet (master station layout metadata)
CREATE POLICY kitchen_stations_select_auth ON kitchen_stations
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- KOTs: Accessible to staff authorized for the KOT's outlet AND holding kds:view permission
CREATE POLICY kots_select_auth ON kots
  FOR SELECT TO authenticated
  USING (
    public.has_outlet_access(outlet_id)
    AND public.has_permission('kds:view')
  );

-- KOT Items: Accessible to staff authorized for the parent KOT's outlet AND holding kds:view permission
CREATE POLICY kot_items_select_auth ON kot_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kots k
      WHERE k.id = kot_items.kot_id
        AND public.has_outlet_access(k.outlet_id)
        AND public.has_permission('kds:view')
    )
  );

-- KOT Status History: Accessible to staff authorized for the parent KOT's outlet AND holding kds:view permission
CREATE POLICY kot_status_history_select_auth ON kot_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kots k
      WHERE k.id = kot_status_history.kot_id
        AND public.has_outlet_access(k.outlet_id)
        AND public.has_permission('kds:view')
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 4 tables are blocked.
-- All KOT generation, station routing, and kitchen status updates must route through the trusted Express backend API via Service Role.
