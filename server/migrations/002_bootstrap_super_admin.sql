-- ============================================================================
-- BOOTSTRAP SCRIPT: INITIAL SUPER_ADMIN USER
-- Pali Resort & Club Operations Platform
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_auth_user_id   UUID          := '771d3cd6-2cac-4c47-aa22-3be7c6de35fc'::UUID;
  v_email          VARCHAR(150)  := 'debasish.acharya1234@gmail.com';
  v_first_name     VARCHAR(100)  := 'Debasish';
  v_last_name      VARCHAR(100)  := 'Acharya';
  v_phone          VARCHAR(20)   := '9040598529';
  v_employee_code  VARCHAR(30)   := 'ADMIN-001';

  v_user_exists    BOOLEAN;
  v_role_exists    BOOLEAN;
  v_staff_id       UUID;

BEGIN

  -- ============================================================
  -- 1. VERIFY AUTH USER EXISTS
  -- ============================================================

  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = v_auth_user_id
  )
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE EXCEPTION
      'Bootstrap Aborted: User with auth ID % does not exist in auth.users.',
      v_auth_user_id;
  END IF;


  -- ============================================================
  -- 2. VERIFY SUPER_ADMIN ROLE EXISTS
  -- ============================================================

  SELECT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE id = 'SUPER_ADMIN'
  )
  INTO v_role_exists;

  IF NOT v_role_exists THEN
    RAISE EXCEPTION
      'Bootstrap Aborted: SUPER_ADMIN role does not exist. Run Migration 002 seed first.';
  END IF;


  -- ============================================================
  -- 3. CREATE / UPDATE STAFF PROFILE
  -- ============================================================

  INSERT INTO public.staff (
    auth_user_id,
    employee_code,
    first_name,
    last_name,
    email,
    phone,
    pin_hash,
    pin_failed_attempts,
    is_active
  )
  VALUES (
    v_auth_user_id,
    v_employee_code,
    v_first_name,
    v_last_name,
    v_email,
    v_phone,
    NULL,
    0,
    true
  )

  ON CONFLICT (auth_user_id)
  DO UPDATE SET

    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP

  RETURNING id INTO v_staff_id;


  -- ============================================================
  -- 4. SAFETY CHECK
  -- ============================================================

  IF v_staff_id IS NULL THEN

    SELECT id
    INTO v_staff_id
    FROM public.staff
    WHERE auth_user_id = v_auth_user_id;

  END IF;


  -- ============================================================
  -- 5. ASSIGN SUPER_ADMIN ROLE
  -- ============================================================

  INSERT INTO public.staff_roles (
    staff_id,
    role_id
  )

  VALUES (
    v_staff_id,
    'SUPER_ADMIN'
  )

  ON CONFLICT (staff_id, role_id)
  DO NOTHING;


  -- ============================================================
  -- 6. GRANT ACCESS TO BOTH OUTLETS
  -- ============================================================

  INSERT INTO public.staff_outlet_access (
    staff_id,
    outlet_id,
    is_primary
  )

  VALUES

    (
      v_staff_id,
      'rest-1',
      true
    ),

    (
      v_staff_id,
      'rest-2',
      false
    )

  ON CONFLICT (staff_id, outlet_id)

  DO UPDATE SET

    is_primary = EXCLUDED.is_primary;


  -- ============================================================
  -- SUCCESS MESSAGE
  -- ============================================================

  RAISE NOTICE
    'SUCCESS: SUPER_ADMIN created. Staff ID: %, Auth UID: %',
    v_staff_id,
    v_auth_user_id;

END $$;

COMMIT;


-- ============================================================================
-- VERIFICATION
-- ============================================================================


-- ============================================================
-- 1. VERIFY STAFF + ROLE + OUTLETS
-- ============================================================

SELECT

  s.id AS staff_id,

  s.auth_user_id,

  s.employee_code,

  s.first_name || ' ' || s.last_name AS full_name,

  s.email,

  s.phone,

  s.is_active,

  s.pin_hash IS NOT NULL AS has_pin,

  sr.role_id AS assigned_role,

  array_agg(
    soa.outlet_id
    ORDER BY soa.outlet_id
  ) AS assigned_outlets

FROM public.staff s

JOIN public.staff_roles sr
  ON sr.staff_id = s.id

JOIN public.staff_outlet_access soa
  ON soa.staff_id = s.id

WHERE s.auth_user_id =
  '771d3cd6-2cac-4c47-aa22-3be7c6de35fc'::UUID

GROUP BY

  s.id,
  s.auth_user_id,
  s.employee_code,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.is_active,
  s.pin_hash,
  sr.role_id;


-- ============================================================
-- 2. VERIFY PUBLIC SAFE PROFILE
-- ============================================================

SELECT

  id,
  employee_code,
  first_name,
  last_name,
  is_active

FROM public.staff_public_profile

WHERE id = (

  SELECT id

  FROM public.staff

  WHERE auth_user_id =
    '771d3cd6-2cac-4c47-aa22-3be7c6de35fc'::UUID

);