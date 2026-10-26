-- ============================================================================
-- MIGRATION 006: ORDERS & ROUNDS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain F)
-- ============================================================================

-- 1. ORDERS (Domain F, Table 25)
-- Represents an order round submitted via CUSTOMER_QR, WAITER_POS, or ROOM_SERVICE.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  dining_session_id UUID NULL REFERENCES dining_sessions(id) ON DELETE RESTRICT,
  hotel_stay_id UUID NULL, -- FK to hotel_stays added via ALTER TABLE in Domain J (Hotel PMS)
  room_id UUID NULL,       -- FK to hotel_rooms added via ALTER TABLE in Domain J (Hotel PMS)
  order_number INTEGER NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  order_source VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PLACED',
  created_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(64) NOT NULL,
  special_instructions TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_orders_source CHECK (
    order_source IN ('CUSTOMER_QR', 'WAITER_POS', 'ROOM_SERVICE')
  ),
  CONSTRAINT ck_orders_status CHECK (
    status IN ('PLACED', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')
  ),
  CONSTRAINT ck_orders_round_number CHECK (round_number > 0),
  CONSTRAINT ck_orders_order_number CHECK (order_number > 0),
  CONSTRAINT ck_orders_source_integrity CHECK (
    (order_source IN ('CUSTOMER_QR', 'WAITER_POS') AND dining_session_id IS NOT NULL AND hotel_stay_id IS NULL AND room_id IS NULL)
    OR
    (order_source = 'ROOM_SERVICE' AND dining_session_id IS NULL AND hotel_stay_id IS NOT NULL AND room_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_dining_session ON orders(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_hotel_stay ON orders(hotel_stay_id);
CREATE INDEX IF NOT EXISTS idx_orders_room ON orders(room_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status ON orders(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_staff ON orders(created_by_staff_id);

-- Enforce uniqueness of order round numbers within a physical dining session
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_order_round_per_session 
ON orders(dining_session_id, round_number) 
WHERE dining_session_id IS NOT NULL;

-- 2. ORDER ITEMS (Domain F, Table 26)
-- Line items inside an order. Captures immutable historical pricing & GST snapshots.
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  item_name_snapshot VARCHAR(150) NOT NULL,
  unit_price_paise BIGINT NOT NULL,
  gst_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  quantity INTEGER NOT NULL,
  customization_notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PLACED',
  cancelled_reason TEXT NULL,
  cancelled_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT ck_order_items_unit_price CHECK (unit_price_paise >= 0),
  CONSTRAINT ck_order_items_gst_rate CHECK (gst_rate_snapshot >= 0),
  CONSTRAINT ck_order_items_status CHECK (
    status IN ('PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_cancelled_by ON order_items(cancelled_by_staff_id);

-- 3. ORDER STATUS HISTORY (Domain F, Table 27)
-- Immutable audit trail recording each lifecycle status change of an order.
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_staff ON order_status_history(changed_by_staff_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.orders FROM anon, public;
REVOKE ALL ON TABLE public.order_items FROM anon, public;
REVOKE ALL ON TABLE public.order_status_history FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 3 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_status_history TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped Access Control):

-- Orders: Accessible to staff authorized for the order's outlet
CREATE POLICY orders_select_auth ON orders
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- Order Items: Accessible to staff authorized for the parent order's outlet
CREATE POLICY order_items_select_auth ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.has_outlet_access(o.outlet_id)
    )
  );

-- Order Status History: Accessible to staff authorized for the parent order's outlet
CREATE POLICY order_status_history_select_auth ON order_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND public.has_outlet_access(o.outlet_id)
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 3 tables are blocked.
-- All order creation, price snapshotting, and status transitions must route through the trusted Express backend API via Service Role.
