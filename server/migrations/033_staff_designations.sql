-- Migration 033: Independent staff designations
-- Designations are descriptive job titles, NOT security roles.
-- No changes to staff_roles, role_permissions or outlet access.

CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT designation_code_format
      CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT designation_name_not_blank
      CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_designations_name_ci
ON public.designations (lower(name));

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS designation_id UUID NULL
REFERENCES public.designations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_staff_designation_id
ON public.staff(designation_id);

-- No role assignment, permission grant, or automatic designation mapping.
-- Existing employee records retain NULL designation until explicitly assigned.
-- Database privileges/RLS must be reviewed before applying this migration.
