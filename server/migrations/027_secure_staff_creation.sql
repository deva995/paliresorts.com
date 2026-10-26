-- Migration 027: restricted operational staff creation
-- Preserve existing runtime RLS and authenticated context verification.

INSERT INTO public.roles (id, display_name, description, is_system_role)
VALUES (
  'RESTAURANT_MANAGER',
  'Restaurant Admin',
  'Outlet-scoped operational administrator',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'RESTAURANT_MANAGER', p.id
FROM public.permissions p
WHERE p.id IN ('staff:view', 'staff:manage', 'roster:view', 'table:view')
ON CONFLICT DO NOTHING;


-- Senior Captain: authorized floor supervision and daily roster assignments.
INSERT INTO public.roles (id, display_name, description, is_system_role)
VALUES (
  'SENIOR_CAPTAIN',
  'Senior Captain',
  'Outlet-scoped daily Captain and Waiter supervision',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'SENIOR_CAPTAIN', p.id
FROM public.permissions p
WHERE p.id IN (
  'table:view', 'table:assign',
  'order:view', 'order:create', 'order:update',
  'kds:view', 'bill:view', 'menu:view',
  'staff:view', 'roster:view', 'roster:edit'
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pali_runtime.create_operational_staff(
  new_employee_code text,
  new_first_name text,
  new_last_name text,
  new_email text,
  new_phone text,
  new_password_hash text,
  new_role_id text,
  new_outlet_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  c jsonb := pali_runtime.context();
  actor uuid;
  created_staff uuid;
  allowed_roles text[] := ARRAY[
    'WAITER', 'WAITER_MANAGER', 'SENIOR_CAPTAIN',
    'KITCHEN_STAFF', 'KITCHEN_USER',
    'KITCHEN_COOKING', 'KITCHEN_BAR',
    'KITCHEN_EXECUTIVE', 'BEVERAGES', 'DRINKS'
  ];
BEGIN
  IF c->>'mode' IS DISTINCT FROM 'staff'
    OR c->>'staffId' IS NULL THEN
    RAISE EXCEPTION 'Authenticated staff context required'
      USING ERRCODE = '42501';
  END IF;

  actor := (c->>'staffId')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.staff_roles sr ON sr.staff_id = s.id
    WHERE s.id = actor
      AND s.is_active
      AND sr.role_id IN (
        'SUPER_ADMIN',
        'RESTAURANT_OWNER',
        'RESTAURANT_MANAGER'
      )
  ) THEN
    RAISE EXCEPTION 'Staff management role required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE((c->>'superAdmin')::boolean, false)
     AND NOT EXISTS (
       SELECT 1
       FROM public.staff_roles sr
       JOIN public.role_permissions rp ON rp.role_id = sr.role_id
       WHERE sr.staff_id = actor
         AND rp.permission_id = 'staff:manage'
     ) THEN
    RAISE EXCEPTION 'Staff management permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF new_role_id IS NULL OR
     NOT (new_role_id = ANY(allowed_roles)) THEN
    RAISE EXCEPTION 'Operational role not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF new_outlet_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.staff_outlet_access soa
    JOIN public.outlets o ON o.id = soa.outlet_id
    WHERE soa.staff_id = actor
      AND soa.outlet_id = new_outlet_id
      AND o.is_active
      AND (c->'outlets') ? soa.outlet_id
  ) THEN
    RAISE EXCEPTION 'Outlet assignment denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE((c->>'superAdmin')::boolean, false)
     AND COALESCE((
       SELECT sma.can_view AND sma.can_edit
       FROM public.staff_module_access sma
       WHERE sma.staff_id = actor
         AND lower(sma.module) = 'staff'
         AND (sma.outlet_id IS NULL OR sma.outlet_id = new_outlet_id)
       ORDER BY (sma.outlet_id = new_outlet_id) DESC,
                sma.outlet_id NULLS LAST
       LIMIT 1
     ), true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Staff module edit access denied'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(new_employee_code), '') IS NULL
    OR nullif(trim(new_first_name), '') IS NULL
    OR nullif(trim(new_email), '') IS NULL
    OR nullif(trim(new_phone), '') IS NULL
    OR nullif(new_password_hash, '') IS NULL THEN
    RAISE EXCEPTION 'Required staff details missing'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.staff (
    employee_code, first_name, last_name, email,
    phone, password_hash, is_active
  )
  VALUES (
    upper(trim(new_employee_code)), trim(new_first_name),
    coalesce(trim(new_last_name), ''), lower(trim(new_email)),
    trim(new_phone), new_password_hash, true
  )
  RETURNING id INTO created_staff;

  INSERT INTO public.staff_roles (staff_id, role_id)
  VALUES (created_staff, new_role_id);

  INSERT INTO public.staff_outlet_access (
    staff_id, outlet_id, is_primary
  )
  VALUES (created_staff, new_outlet_id, true);

  RETURN created_staff;
END;
$function$;

REVOKE ALL ON FUNCTION pali_runtime.create_operational_staff(
  text,text,text,text,text,text,text,text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION pali_runtime.create_operational_staff(
  text,text,text,text,text,text,text,text
) TO pali_runtime;
