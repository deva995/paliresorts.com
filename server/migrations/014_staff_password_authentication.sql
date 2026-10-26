-- ============================================================================
-- MIGRATION 014: REAL STAFF PASSWORD AUTHENTICATION & SESSION TRACKING
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. ADD PASSWORD AND LOCKOUT COLUMNS TO STAFF TABLE
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS password_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_locked_until TIMESTAMPTZ NULL;

-- 2. DEACTIVATE EXISTING STAFF WITHOUT A PASSWORD HASH
-- Guarantees that existing rows without passwords cannot remain active or violate constraints
UPDATE public.staff
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE password_hash IS NULL OR length(trim(password_hash)) = 0;

-- 3. ENFORCE PASSWORD CONSTRAINTS ON STAFF TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'staff' AND constraint_name = 'ck_staff_active_password'
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT ck_staff_active_password
      CHECK (is_active = false OR (password_hash IS NOT NULL AND length(password_hash) >= 20));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'staff' AND constraint_name = 'ck_staff_password_attempts'
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT ck_staff_password_attempts
      CHECK (password_failed_attempts >= 0);
  END IF;
END $$;

-- 4. CREATE STAFF SESSIONS TABLE FOR PERSISTENT TOKEN TRACKING
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  ip VARCHAR(45) NULL,
  user_agent TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff_id ON public.staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token_hash ON public.staff_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_active ON public.staff_sessions(staff_id) WHERE revoked_at IS NULL;
