-- ============================================================================
-- MIGRATION 005: CUSTOMERS & DINING SESSIONS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain E)
-- ============================================================================

-- 1. CUSTOMERS (Domain E, Table 21)
-- Optional guest loyalty/contact profile. PII is strictly protected.
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(150) NULL,
  email VARCHAR(150) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_customers_phone UNIQUE (phone)
);

-- 2. DINING SESSIONS (Domain E, Table 22)
-- Represents one physical restaurant sitting from table claim to settlement and release.
CREATE TABLE IF NOT EXISTS dining_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
  guest_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  hotel_stay_id UUID NULL, -- FK to hotel_stays added via ALTER TABLE in Domain J (Hotel PMS)
  opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_dining_sessions_guest_count CHECK (guest_count > 0),
  CONSTRAINT ck_dining_sessions_status CHECK (
    status IN ('ACTIVE', 'BILLED', 'CLOSED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_dining_sessions_outlet ON dining_sessions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_table ON dining_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_customer ON dining_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_hotel_stay ON dining_sessions(hotel_stay_id);

-- Enforce exactly ONE active or billed session per physical restaurant table
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_session 
ON dining_sessions(table_id) 
WHERE status IN ('ACTIVE', 'BILLED');

-- 3. LINK CIRCULAR FK ON RESTAURANT TABLES (from Migration 004)
-- Connects restaurant_tables.active_dining_session_id to dining_sessions(id) safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tables_active_session'
      AND table_name = 'restaurant_tables'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT fk_tables_active_session
    FOREIGN KEY (active_dining_session_id)
    REFERENCES public.dining_sessions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4. GUEST SESSION TOKENS (Domain E, Table 23)
-- Ephemeral session tokens issued to guest mobile phones scanning table QR.
-- Plaintext bearer tokens and raw OTPs are NEVER stored.
CREATE TABLE IF NOT EXISTS guest_session_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE RESTRICT,
  token_hash VARCHAR(64) NOT NULL,
  otp_hash VARCHAR(64) NULL,
  otp_expires_at TIMESTAMPTZ NULL,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_guest_tokens_hash UNIQUE (token_hash),
  CONSTRAINT ck_guest_tokens_otp_attempts CHECK (otp_attempts >= 0 AND otp_attempts <= 3)
);

CREATE INDEX IF NOT EXISTS idx_guest_tokens_session ON guest_session_tokens(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_lookup ON guest_session_tokens(token_hash, is_revoked);

-- 5. SERVICE REQUESTS (Domain E, Table 24)
-- Table call-bell actions (Call Waiter, Water, Bill, Cutlery, Cleaning).
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  dining_session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE RESTRICT,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  request_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  acknowledged_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_service_requests_type CHECK (
    request_type IN ('CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEANING')
  ),
  CONSTRAINT ck_service_requests_status CHECK (
    status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_service_requests_active ON service_requests(outlet_id, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_service_requests_session ON service_requests(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_table ON service_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_staff ON service_requests(acknowledged_by_staff_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_session_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges on sensitive security and PII tables from anon and public
REVOKE ALL ON TABLE public.customers FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.guest_session_tokens FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.dining_sessions FROM anon, public;
REVOKE ALL ON TABLE public.service_requests FROM anon, public;

-- Grant selective read to authenticated staff:
-- Staff can query dining_sessions and service_requests under outlet scoping
GRANT SELECT ON TABLE public.dining_sessions TO authenticated;
GRANT SELECT ON TABLE public.service_requests TO authenticated;

-- Customers table direct SELECT is restricted; trusted Express backend queries via service_role
-- Full CRUD granted strictly to backend service_role across all 4 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dining_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_session_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_requests TO service_role;

-- 2. Hardened RLS Policies (Outlet-Scoped Access Control):
-- Note: customers and guest_session_tokens are backend-only tables; all browser access
-- is revoked and no client policies are defined. RLS remains enabled for defense-in-depth.

-- Dining Sessions: Restricted strictly to staff authorized for the outlet
CREATE POLICY dining_sessions_select_auth ON dining_sessions
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- Service Requests: Restricted strictly to staff authorized for the outlet
CREATE POLICY service_requests_select_auth ON service_requests
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 4 tables are blocked.
-- All session creation, token issuance, and service requests must route through the trusted Express backend API via Service Role.
