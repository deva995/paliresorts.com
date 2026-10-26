-- ============================================================================
-- MIGRATION 016: STAFF MODULE ACCESS & PER-USER OVERRIDES
-- Pali Resort & Club Operations Platform
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  outlet_id VARCHAR(32) NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  set_by_staff_id UUID NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_module_access_staff_outlet_mod
  ON public.staff_module_access (staff_id, COALESCE(outlet_id, '__GLOBAL__'), module);

CREATE INDEX IF NOT EXISTS idx_staff_module_access_staff
  ON public.staff_module_access (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_module_access_outlet
  ON public.staff_module_access (outlet_id);

-- Row Level Security and Privilege Hardening
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_module_access') THEN
    ALTER TABLE public.staff_module_access ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

REVOKE ALL ON TABLE public.staff_module_access FROM anon, public;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_module_access TO service_role;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public.staff_module_access TO authenticated;
  END IF;
END $$;
