BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF current_database() <> 'pali_resort_staging' THEN
    RAISE EXCEPTION 'Staging database required';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pali_runtime.assign_duty_roster(
  new_outlet_id text,
  new_staff_id uuid,
  new_role_id text,
  new_shift_id uuid,
  new_zone_id uuid,
  new_duty_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  ctx jsonb := pali_runtime.context();
  actor uuid;
  actor_super boolean;
  actor_owner boolean;
  actor_senior boolean;
  actor_captain boolean;
  permitted boolean;
  module_allowed boolean;
  duty_start timestamptz;
  duty_end timestamptz;
  new_id uuid;
BEGIN
  IF ctx->>'mode' IS DISTINCT FROM 'staff'
     OR ctx->>'staffId' IS NULL THEN
    RAISE EXCEPTION 'Authenticated staff context required'
      USING ERRCODE = '42501';
  END IF;

  actor := (ctx->>'staffId')::uuid;

  SELECT
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_id = actor AND role_id = 'SUPER_ADMIN'
    ),
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_id = actor AND role_id = 'RESTAURANT_OWNER'
    ),
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_id = actor AND role_id = 'SENIOR_CAPTAIN'
    ),
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_id = actor AND role_id = 'WAITER_MANAGER'
    )
  INTO actor_super, actor_owner, actor_senior, actor_captain;

  IF NOT (actor_super OR actor_owner OR actor_senior OR actor_captain) THEN
    RAISE EXCEPTION 'Roster editing role required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT actor_super AND NOT EXISTS (
    SELECT 1
    FROM public.staff_roles sr
    JOIN public.role_permissions rp ON rp.role_id = sr.role_id
    WHERE sr.staff_id = actor AND rp.permission_id = 'roster:edit'
  ) THEN
    RAISE EXCEPTION 'Roster editing permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_outlet_access a
    JOIN public.outlets o ON o.id = a.outlet_id
    WHERE a.staff_id = actor
      AND a.outlet_id = new_outlet_id
      AND o.is_active
      AND (ctx->'outlets') ? a.outlet_id
  ) THEN
    RAISE EXCEPTION 'Actor does not have outlet access'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((
    SELECT sma.can_edit
    FROM public.staff_module_access sma
    WHERE sma.staff_id = actor
      AND lower(sma.module) = 'staff'
      AND (sma.outlet_id = new_outlet_id OR sma.outlet_id IS NULL)
    ORDER BY (sma.outlet_id = new_outlet_id) DESC
    LIMIT 1
  ), true)
  INTO module_allowed;

  IF NOT actor_super AND NOT module_allowed THEN
    RAISE EXCEPTION 'Staff module editing denied'
      USING ERRCODE = '42501';
  END IF;

  IF new_duty_date IS NULL
     OR new_duty_date < (now() AT TIME ZONE 'Asia/Kolkata')::date - 1
     OR new_duty_date > (now() AT TIME ZONE 'Asia/Kolkata')::date + 365 THEN
    RAISE EXCEPTION 'Invalid duty date' USING ERRCODE = '22023';
  END IF;

  IF new_role_id NOT IN ('WAITER', 'WAITER_MANAGER', 'SENIOR_CAPTAIN') THEN
    RAISE EXCEPTION 'Invalid floor duty role' USING ERRCODE = '42501';
  END IF;

  IF actor_captain AND NOT (actor_super OR actor_owner OR actor_senior)
     AND new_role_id <> 'WAITER' THEN
    RAISE EXCEPTION 'Captain may assign waiters only'
      USING ERRCODE = '42501';
  END IF;

  IF actor_senior AND NOT (actor_super OR actor_owner)
     AND new_role_id = 'SENIOR_CAPTAIN' THEN
    RAISE EXCEPTION 'Senior Captain cannot assign peers'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.staff_outlet_access a ON a.staff_id = s.id
    JOIN public.staff_roles sr ON sr.staff_id = s.id
    WHERE s.id = new_staff_id
      AND s.is_active
      AND a.outlet_id = new_outlet_id
      AND sr.role_id = new_role_id
  ) THEN
    RAISE EXCEPTION 'Target staff, role or outlet invalid'
      USING ERRCODE = '42501';
  END IF;

  IF new_zone_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.dining_zones
    WHERE id = new_zone_id
      AND outlet_id = new_outlet_id
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Invalid outlet dining area'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    ((new_duty_date + start_time) AT TIME ZONE 'Asia/Kolkata'),
    ((new_duty_date + end_time +
      CASE WHEN is_overnight OR end_time <= start_time
        THEN interval '1 day'
        ELSE interval '0 day'
      END) AT TIME ZONE 'Asia/Kolkata')
  INTO duty_start, duty_end
  FROM public.staff_shifts
  WHERE id = new_shift_id
    AND outlet_id = new_outlet_id
    AND is_active;

  IF duty_start IS NULL OR duty_end IS NULL THEN
    RAISE EXCEPTION 'Invalid outlet shift' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('pali-duty-roster'),
    pg_catalog.hashtext(new_staff_id::text)
  );

  IF EXISTS (
    SELECT 1 FROM public.duty_roster
    WHERE staff_id = new_staff_id
      AND starts_at < duty_end
      AND ends_at > duty_start
  ) THEN
    RAISE EXCEPTION 'Overlapping duty assignment'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.duty_roster (
    outlet_id, staff_id, role_id, shift_id, zone_id,
    starts_at, ends_at, created_by_staff_id,
    is_self_assigned, is_locked
  )
  VALUES (
    new_outlet_id, new_staff_id, new_role_id, new_shift_id, new_zone_id,
    duty_start, duty_end, actor, false, false
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  pali_runtime.assign_duty_roster(text,uuid,text,uuid,uuid,date)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  pali_runtime.assign_duty_roster(text,uuid,text,uuid,uuid,date)
TO pali_runtime;

INSERT INTO public._schema_migrations(name)
VALUES ('029_secure_duty_roster.sql');

COMMIT;
