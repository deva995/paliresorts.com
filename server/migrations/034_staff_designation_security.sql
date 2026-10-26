-- Migration 034: Secure designation and employee-profile operations.
-- Depends on 020 (signed runtime context) and 033 (designations).
-- No general UPDATE privilege is granted on public.staff.

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.designations FROM PUBLIC;

GRANT SELECT ON public.designations TO pali_runtime;
GRANT SELECT(designation_id) ON public.staff TO pali_runtime;

CREATE POLICY designation_runtime_read
ON public.designations
FOR SELECT TO pali_runtime
USING (
  pali_runtime.context()->>'mode' = 'staff'
  AND (
    COALESCE(
      (pali_runtime.context()->>'superAdmin')::boolean,
      false
    )
    OR (pali_runtime.context()->'permissions') ? 'staff:view'
    OR (pali_runtime.context()->'permissions') ? 'table:assign'
    OR (pali_runtime.context()->'permissions') ? 'table:manage'
  )
);

-- Only signed Super Admin requests may use these write functions.
CREATE FUNCTION pali_runtime.designation_admin_required()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  ctx jsonb := pali_runtime.context();
BEGIN
  IF ctx->>'mode' IS DISTINCT FROM 'staff'
     OR ctx->>'staffId' IS NULL
     OR NOT COALESCE((ctx->>'superAdmin')::boolean, false)
  THEN
    RAISE EXCEPTION 'Super Admin authorization required'
      USING ERRCODE = '42501';
  END IF;
END;
$fn$;

CREATE FUNCTION pali_runtime.create_staff_designation(
  p_code text,
  p_name text
)
RETURNS TABLE(
  id uuid,
  code varchar,
  name varchar,
  "isActive" boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  PERFORM pali_runtime.designation_admin_required();

  IF p_code IS NULL
     OR p_code !~ '^[A-Z][A-Z0-9_]{0,49}$'
     OR p_name IS NULL
     OR length(btrim(p_name)) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Invalid designation'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.designations(
    code, name
  )
  VALUES (p_code, btrim(p_name))
  RETURNING
    designations.id,
    designations.code,
    designations.name,
    designations.is_active;
END;
$fn$;

CREATE FUNCTION pali_runtime.update_staff_designation_master(
  p_id uuid,
  p_name text,
  p_active boolean
)
RETURNS TABLE(
  id uuid,
  code varchar,
  name varchar,
  "isActive" boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  PERFORM pali_runtime.designation_admin_required();

  IF p_name IS NOT NULL
     AND length(btrim(p_name)) NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Invalid designation name'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.designations AS d
  SET name = COALESCE(btrim(p_name), d.name),
      is_active = COALESCE(p_active, d.is_active),
      updated_at = CURRENT_TIMESTAMP
  WHERE d.id = p_id
  RETURNING d.id, d.code, d.name, d.is_active;
END;
$fn$;

CREATE FUNCTION pali_runtime.assign_employee_designation(
  p_staff_id uuid,
  p_designation_id uuid
)
RETURNS TABLE(
  id uuid,
  employee_code varchar,
  "designationId" uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  PERFORM pali_runtime.designation_admin_required();

  RETURN QUERY
  UPDATE public.staff AS s
  SET designation_id = p_designation_id
  WHERE s.id = p_staff_id
    AND (
      p_designation_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.designations AS d
        WHERE d.id = p_designation_id
          AND d.is_active = true
      )
    )
  RETURNING s.id, s.employee_code, s.designation_id;
END;
$fn$;

CREATE FUNCTION pali_runtime.edit_employee_profile(
  p_staff_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text
)
RETURNS TABLE(
  id uuid,
  "employeeCode" varchar,
  "firstName" varchar,
  "lastName" varchar,
  email varchar,
  phone varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
BEGIN
  PERFORM pali_runtime.designation_admin_required();

  IF (p_first_name IS NOT NULL AND
        (length(btrim(p_first_name)) NOT BETWEEN 1 AND 100))
     OR (p_last_name IS NOT NULL AND length(btrim(p_last_name)) > 100)
     OR (p_email IS NOT NULL AND
        (length(btrim(p_email)) NOT BETWEEN 1 AND 150))
     OR (p_phone IS NOT NULL AND
        (length(btrim(p_phone)) NOT BETWEEN 5 AND 20))
  THEN
    RAISE EXCEPTION 'Invalid employee profile'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.staff AS s
  SET first_name = COALESCE(btrim(p_first_name), s.first_name),
      last_name = COALESCE(btrim(p_last_name), s.last_name),
      email = COALESCE(lower(btrim(p_email)), s.email),
      phone = COALESCE(btrim(p_phone), s.phone)
  WHERE s.id = p_staff_id
  RETURNING
    s.id, s.employee_code, s.first_name,
    s.last_name, s.email, s.phone;
END;
$fn$;

REVOKE ALL ON FUNCTION
  pali_runtime.designation_admin_required()
FROM PUBLIC;

REVOKE ALL ON FUNCTION
  pali_runtime.create_staff_designation(text,text),
  pali_runtime.update_staff_designation_master(uuid,text,boolean),
  pali_runtime.assign_employee_designation(uuid,uuid),
  pali_runtime.edit_employee_profile(
    uuid,text,text,text,text
  )
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  pali_runtime.create_staff_designation(text,text),
  pali_runtime.update_staff_designation_master(uuid,text,boolean),
  pali_runtime.assign_employee_designation(uuid,uuid),
  pali_runtime.edit_employee_profile(
    uuid,text,text,text,text
  )
TO pali_runtime;
