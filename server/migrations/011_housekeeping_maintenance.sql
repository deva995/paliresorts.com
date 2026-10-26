-- ============================================================================
-- MIGRATION 011: HOUSEKEEPING & MAINTENANCE
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain K)
-- ============================================================================

-- 1. HOUSEKEEPING TASKS (Domain K, Table 46)
-- Room turnover cleaning jobs and turnover lifecycle tracking.
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  task_type VARCHAR(50) NOT NULL DEFAULT 'CHECKOUT_CLEANING',
  assigned_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  inspected_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  inspected_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_housekeeping_tasks_type CHECK (
    task_type IN ('CHECKOUT_CLEANING', 'STAYOVER_CLEANING', 'DEEP_CLEANING')
  ),
  CONSTRAINT ck_housekeeping_tasks_status CHECK (
    status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_room ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_staff ON housekeeping_tasks(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_inspector ON housekeeping_tasks(inspected_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_pending ON housekeeping_tasks(status) WHERE status IN ('PENDING', 'IN_PROGRESS');

-- 2. ROOM STATUS HISTORY (Domain K, Table 47)
-- Immutable audit log of hotel room physical transitions.
CREATE TABLE IF NOT EXISTS room_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_history_room ON room_status_history(room_id);
CREATE INDEX IF NOT EXISTS idx_room_history_staff ON room_status_history(changed_by_staff_id);

-- 3. MAINTENANCE ISSUES (Domain K, Table 48)
-- Defect and repair tracking for resort rooms and outlet facilities.
CREATE TABLE IF NOT EXISTS maintenance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NULL REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'REPORTED',
  reported_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  resolved_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_maintenance_issues_category CHECK (
    category IN ('PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'OTHER')
  ),
  CONSTRAINT ck_maintenance_issues_severity CHECK (
    severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  ),
  CONSTRAINT ck_maintenance_issues_status CHECK (
    status IN ('REPORTED', 'IN_REPAIR', 'RESOLVED')
  )
);

CREATE INDEX IF NOT EXISTS idx_maintenance_room ON maintenance_issues(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_outlet ON maintenance_issues(outlet_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reporter ON maintenance_issues(reported_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_resolver ON maintenance_issues(resolved_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_open ON maintenance_issues(status) WHERE status != 'RESOLVED';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.housekeeping_tasks FROM anon, public;
REVOKE ALL ON TABLE public.room_status_history FROM anon, public;
REVOKE ALL ON TABLE public.maintenance_issues FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.housekeeping_tasks TO authenticated;
GRANT SELECT ON TABLE public.room_status_history TO authenticated;
GRANT SELECT ON TABLE public.maintenance_issues TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 3 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.housekeeping_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.room_status_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.maintenance_issues TO service_role;

-- 2. Hardened RLS Policies (Capability & Scoped Access Control):

-- Housekeeping Tasks: Visible to housekeeping, PMS, or directly assigned/inspecting staff
CREATE POLICY housekeeping_tasks_select_auth ON housekeeping_tasks
  FOR SELECT TO authenticated
  USING (
    public.has_permission('housekeeping:view')
    OR public.has_permission('housekeeping:update')
    OR public.has_permission('hotel:view')
    OR assigned_staff_id = public.current_staff_id()
    OR inspected_by_staff_id = public.current_staff_id()
  );

-- Room Status History: Visible to housekeeping and hotel PMS staff
CREATE POLICY room_status_history_select_auth ON room_status_history
  FOR SELECT TO authenticated
  USING (
    public.has_permission('housekeeping:view')
    OR public.has_permission('housekeeping:update')
    OR public.has_permission('hotel:view')
  );

-- Maintenance Issues: Strictly scoped: room issues require housekeeping/hotel capability, outlet issues require outlet access or housekeeping, and self-access for reporters/resolvers
CREATE POLICY maintenance_issues_select_auth ON maintenance_issues
  FOR SELECT TO authenticated
  USING (
    -- 1. Self-access for reporter or assigned repair staff
    reported_by_staff_id = public.current_staff_id()
    OR resolved_by_staff_id = public.current_staff_id()
    -- 2. Room defects: strictly capability-based (never leaked to staff with unrelated restaurant outlet access)
    OR (
      room_id IS NOT NULL
      AND (
        public.has_permission('housekeeping:view')
        OR public.has_permission('housekeeping:update')
        OR public.has_permission('hotel:view')
      )
    )
    -- 3. Outlet facility defects: visible to staff with assigned outlet access or housekeeping
    OR (
      outlet_id IS NOT NULL
      AND (
        public.has_outlet_access(outlet_id)
        OR public.has_permission('housekeeping:view')
        OR public.has_permission('housekeeping:update')
      )
    )
    -- 4. General facility defects (unlinked): visible to housekeeping staff
    OR (
      room_id IS NULL AND outlet_id IS NULL
      AND (
        public.has_permission('housekeeping:view')
        OR public.has_permission('housekeeping:update')
      )
    )
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 3 tables are blocked.
-- All task dispatches, room cleaning status updates, history logging, and defect reports
-- must route through the trusted Express backend API via Service Role.
