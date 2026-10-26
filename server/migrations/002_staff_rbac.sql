-- ============================================================================
-- MIGRATION 002: STAFF & ROLE-BASED ACCESS CONTROL (RBAC)
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain B)
-- ============================================================================

-- 1. ROLES (Domain B, Table 7)
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_system_role BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS (Domain B, Table 8)
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(100) PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_permissions_module CHECK (
    module IN ('MENU', 'ORDER', 'KITCHEN', 'BILLING', 'STAFF', 'FLOOR', 'PMS', 'HOUSEKEEPING', 'INVENTORY', 'AUDIT')
  )
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- 3. ROLE PERMISSIONS (Domain B, Table 9)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

-- 4. STAFF (Domain B, Table 6)
-- Maps to Supabase auth.users(id) via auth_user_id
-- Note: Redundant indexes on auth_user_id and phone were removed as UNIQUE constraints create them automatically.
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NULL UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code VARCHAR(30) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  pin_hash VARCHAR(255) NULL,
  pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_staff_employee_code UNIQUE (employee_code),
  CONSTRAINT uq_staff_email UNIQUE (email),
  CONSTRAINT uq_staff_phone UNIQUE (phone),
  CONSTRAINT ck_staff_pin_attempts CHECK (pin_failed_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);

-- 5. STAFF ROLES (Domain B, Table 10)
CREATE TABLE IF NOT EXISTS staff_roles (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_roles_role ON staff_roles(role_id);

-- 6. STAFF OUTLET ACCESS (Domain B, Table 11)
CREATE TABLE IF NOT EXISTS staff_outlet_access (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_outlet_access_outlet ON staff_outlet_access(outlet_id);

-- 7. STAFF SHIFTS (Domain B, Table 12)
CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_outlet ON staff_shifts(outlet_id);

-- 8. DUTY ROSTER (Domain B, Table 13)
CREATE TABLE IF NOT EXISTS duty_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  shift_id UUID NULL REFERENCES staff_shifts(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_self_assigned BOOLEAN NOT NULL DEFAULT false,
  created_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_duty_roster_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_roster_active ON duty_roster(outlet_id, starts_at, ends_at, staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_staff ON duty_roster(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_shift ON duty_roster(shift_id);
CREATE INDEX IF NOT EXISTS idx_roster_role ON duty_roster(role_id);

-- ============================================================================
-- SAFE STAFF VIEWS (PREVENTS SENSITIVE PIN & CREDENTIAL EXPOSURE TO FRONTEND)
-- ============================================================================

-- Safe View 1: Floor directory view (non-sensitive: steward name badges, active roster)
CREATE OR REPLACE VIEW staff_public_profile AS
SELECT 
  id,
  employee_code,
  first_name,
  last_name,
  is_active
FROM public.staff
WHERE is_active = true;

-- Safe View 2: Self profile view (logged-in user viewing their own contact details)
CREATE OR REPLACE VIEW staff_self_profile AS
SELECT 
  s.id,
  s.auth_user_id,
  s.employee_code,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.is_active,
  s.created_at
FROM public.staff s
WHERE s.auth_user_id = auth.uid()
  AND s.is_active = true;

-- Revoke direct SELECT on base staff table from normal browser roles (authenticated, anon, public).
-- Normal browser clients must use staff_self_profile or staff_public_profile.
REVOKE ALL ON TABLE public.staff FROM authenticated, anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff TO service_role;

GRANT SELECT ON staff_public_profile TO authenticated;
GRANT SELECT ON staff_self_profile TO authenticated;

-- ============================================================================
-- HARDENED SECURITY-DEFINER RBAC HELPER FUNCTIONS
-- Explicit search_path, fully qualified tables, no trust of client parameters
-- ============================================================================

-- Function 1: Resolves staff.id for the currently authenticated Supabase user
CREATE OR REPLACE FUNCTION current_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT s.id 
  FROM public.staff s 
  WHERE s.auth_user_id = auth.uid() 
    AND s.is_active = true
  LIMIT 1;
$$;

-- Function 2: Checks if currently authenticated user holds a specific role
CREATE OR REPLACE FUNCTION has_role(role_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.staff s
    JOIN public.staff_roles sr ON sr.staff_id = s.id
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
      AND (sr.role_id = role_code OR sr.role_id = 'SUPER_ADMIN')
  );
$$;

-- Function 3: Checks if currently authenticated user holds a specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.staff s
    JOIN public.staff_roles sr ON sr.staff_id = s.id
    JOIN public.role_permissions rp ON rp.role_id = sr.role_id
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
      AND (rp.permission_id = permission_code OR sr.role_id = 'SUPER_ADMIN')
  );
$$;

-- Function 4: Checks if currently authenticated user has access to a specific outlet
CREATE OR REPLACE FUNCTION has_outlet_access(target_outlet_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.staff s
    JOIN public.staff_roles sr ON sr.staff_id = s.id
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
      AND (sr.role_id IN ('SUPER_ADMIN', 'RESTAURANT_OWNER'))
  )
  OR EXISTS (
    SELECT 1 
    FROM public.staff s
    JOIN public.staff_outlet_access soa ON soa.staff_id = s.id
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = true
      AND soa.outlet_id = target_outlet_id
  );
$$;

-- Revoke default public execution privileges and grant only to authenticated & service_role
REVOKE ALL ON FUNCTION current_staff_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_staff_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION has_role(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_role(VARCHAR) TO authenticated, service_role;

REVOKE ALL ON FUNCTION has_permission(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_permission(VARCHAR) TO authenticated, service_role;

REVOKE ALL ON FUNCTION has_outlet_access(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_outlet_access(VARCHAR) TO authenticated, service_role;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all 8 tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_outlet_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_roster ENABLE ROW LEVEL SECURITY;

-- 1. Read policies for role & permission dictionary tables
CREATE POLICY roles_select_authenticated ON roles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY permissions_select_authenticated ON permissions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Restrict role_permissions to only the user's assigned roles or administrative leadership
CREATE POLICY role_permissions_select_assigned ON role_permissions
  FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT sr.role_id 
      FROM public.staff_roles sr 
      WHERE sr.staff_id = public.current_staff_id()
    )
    OR public.has_role('SUPER_ADMIN')
    OR public.has_role('RESTAURANT_OWNER')
  );

-- 2. Staff table: Row access restricted strictly to user's OWN row or SUPER_ADMIN
-- Sensitive columns (pin_hash, pin_failed_attempts) are blocked from general exposure.
CREATE POLICY staff_select_self ON staff
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_role('SUPER_ADMIN'));

-- 3. Staff assignments: Users can read ONLY their own assigned roles and outlet allocations
CREATE POLICY staff_roles_select_own ON staff_roles
  FOR SELECT TO authenticated
  USING (staff_id = public.current_staff_id() OR public.has_role('SUPER_ADMIN'));

CREATE POLICY staff_outlet_access_select_own ON staff_outlet_access
  FOR SELECT TO authenticated
  USING (staff_id = public.current_staff_id() OR public.has_role('SUPER_ADMIN'));

-- 4. Shifts and Rosters: Authenticated staff can view shifts and duty rosters
CREATE POLICY staff_shifts_select_authenticated ON staff_shifts
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY duty_roster_select_authenticated ON duty_roster
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Direct client mutations (INSERT/UPDATE/DELETE) on RBAC tables are blocked for public/anon/authenticated.
-- All staff, role, and roster modifications must route through the trusted Express backend API via Service Role.
