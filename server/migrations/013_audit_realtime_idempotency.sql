-- ============================================================================
-- MIGRATION 013: AUDIT, REALTIME & IDEMPOTENCY
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain N, Tables 55–57)
-- ============================================================================

-- 1. IDEMPOTENCY KEYS (Domain N, Table 55 - Central API Authority)
-- Enforces exactly-once execution for all state-mutating API operations.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  actor_staff_id UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
  request_hash VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'LOCKED',
  resource_type VARCHAR(50) NULL,
  resource_id UUID NULL,
  response_status INTEGER NULL,
  response_body JSONB NULL,
  locked_until TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_idempotency_keys UNIQUE (operation_type, idempotency_key),
  CONSTRAINT ck_idempotency_status CHECK (status IN ('LOCKED', 'COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_outlet ON idempotency_keys(outlet_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_staff ON idempotency_keys(actor_staff_id);
-- Note: (operation_type, idempotency_key) lookup is covered by uq_idempotency_keys UNIQUE B-tree index.

-- 2. OUTLET EVENT LOG (Domain N, Table 56)
-- Monotonically increasing sequence stream powering Supabase Realtime catch-up sync.
-- ARCHITECTURAL EXCEPTION: Uses BIGSERIAL sequence PK for deterministic ordering.
CREATE TABLE IF NOT EXISTS outlet_event_log (
  sequence_number BIGSERIAL PRIMARY KEY,
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  channel VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_log_catchup ON outlet_event_log(outlet_id, sequence_number ASC);

-- 3. AUDIT LOGS (Domain N, Table 57)
-- Immutable security and operational audit trail.
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(30) NOT NULL,
  actor_id UUID NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE SET NULL,
  old_state JSONB NULL,
  new_state JSONB NULL,
  request_id VARCHAR(64) NOT NULL,
  ip_address INET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_audit_logs_actor_type CHECK (actor_type IN ('STAFF', 'CUSTOMER', 'SYSTEM'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_outlet_created ON audit_logs(outlet_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon across all 3 tables
REVOKE ALL ON TABLE public.idempotency_keys FROM anon, public;
REVOKE ALL ON TABLE public.outlet_event_log FROM anon, public;
REVOKE ALL ON TABLE public.audit_logs FROM anon, public;

-- Backend-only tables: idempotency_keys and audit_logs are revoked from authenticated
REVOKE ALL ON TABLE public.idempotency_keys FROM authenticated;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;

-- Realtime event stream: Grant SELECT to authenticated staff for authorized outlets
GRANT SELECT ON TABLE public.outlet_event_log TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 3 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.idempotency_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outlet_event_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_logs TO service_role;

-- Sequence usage for outlet_event_log
GRANT USAGE, SELECT ON SEQUENCE public.outlet_event_log_sequence_number_seq TO service_role;

-- 2. Hardened RLS Policies:

-- Outlet Event Log: Staff can subscribe/read events strictly for assigned outlets
CREATE POLICY outlet_event_log_select_auth ON outlet_event_log
  FOR SELECT TO authenticated
  USING (public.has_outlet_access(outlet_id));

-- idempotency_keys & audit_logs: Defense-in-depth with zero client policies.
-- Access is restricted strictly to backend transactions via service_role.
-- Direct client mutations (INSERT/UPDATE/DELETE) on all 3 tables are blocked.
