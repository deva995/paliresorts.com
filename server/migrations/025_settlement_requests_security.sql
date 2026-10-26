-- Migration 025: signed-context security for settlement requests.
-- Requires migrations 020 and 024.
-- Does not modify the existing runtime authorization function.

CREATE OR REPLACE FUNCTION pali_runtime.settlement_allowed(
  operation text,
  record jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  ctx jsonb := pali_runtime.context();
  perms jsonb := COALESCE(ctx->'permissions', '[]'::jsonb);
  outlet text := record->>'outlet_id';
BEGIN
  IF ctx->>'mode' IS DISTINCT FROM 'staff'
     OR ctx->>'staffId' IS NULL
     OR outlet IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    COALESCE((ctx->>'globalOutlets')::boolean, false)
    OR COALESCE(ctx->'outlets', '[]'::jsonb) ? outlet
  ) THEN
    RETURN false;
  END IF;

  IF ctx->>'scope' IS NOT NULL AND ctx->>'scope' <> outlet THEN
    RETURN false;
  END IF;

  IF operation = 'INSERT' THEN
    RETURN record->>'requested_by_staff_id' = ctx->>'staffId'
      AND (perms ? 'table:assign' OR COALESCE((ctx->>'superAdmin')::boolean, false));
  END IF;

  IF operation = 'UPDATE' THEN
    -- UPDATE row access includes SELECT FOR UPDATE.
    -- Actual mutations are checked separately by the write guard.
    RETURN COALESCE((ctx->>'superAdmin')::boolean, false)
      OR perms ?| ARRAY['payment:process', 'bill:settle'];
  END IF;

  IF operation = 'SELECT' THEN
    RETURN COALESCE((ctx->>'superAdmin')::boolean, false)
      OR perms ?| ARRAY['bill:view', 'payment:process', 'bill:settle'];
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION pali_runtime.settlement_allowed(text,jsonb)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION pali_runtime.settlement_allowed(text,jsonb)
TO pali_runtime;

CREATE POLICY settlement_runtime_select
ON public.settlement_requests
FOR SELECT TO pali_runtime
USING (
  pali_runtime.settlement_allowed('SELECT', to_jsonb(settlement_requests))
);

CREATE POLICY settlement_runtime_insert
ON public.settlement_requests
FOR INSERT TO pali_runtime
WITH CHECK (
  pali_runtime.settlement_allowed('INSERT', to_jsonb(settlement_requests))
);

CREATE POLICY settlement_runtime_update
ON public.settlement_requests
FOR UPDATE TO pali_runtime
USING (
  pali_runtime.settlement_allowed('UPDATE', to_jsonb(settlement_requests))
)
WITH CHECK (
  pali_runtime.settlement_allowed('UPDATE', to_jsonb(settlement_requests))
);

-- Verify linked entities and prevent unauthorized changes to request identity.
CREATE OR REPLACE FUNCTION pali_runtime.settlement_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  c jsonb := pali_runtime.context();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT pali_runtime.settlement_allowed('INSERT', to_jsonb(NEW))
       OR NEW.requested_by_staff_id::text IS DISTINCT FROM c->>'staffId'
       OR NEW.status <> 'PENDING'
       OR NEW.resolved_by_staff_id IS NOT NULL
       OR NEW.resolved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Settlement creation denied'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT pali_runtime.settlement_allowed('UPDATE', to_jsonb(OLD))
       OR NOT pali_runtime.settlement_allowed('UPDATE', to_jsonb(NEW))
       OR (to_jsonb(OLD) - ARRAY[
         'status','resolved_by_staff_id','resolved_at','updated_at','notes'
       ]) IS DISTINCT FROM
       (to_jsonb(NEW) - ARRAY[
         'status','resolved_by_staff_id','resolved_at','updated_at','notes'
       ])
       OR NEW.resolved_by_staff_id::text IS DISTINCT FROM c->>'staffId'
       OR NOT (
         (OLD.status = 'PENDING' AND NEW.status IN ('ACCEPTED','COMPLETED','CANCELLED'))
         OR
         (OLD.status = 'ACCEPTED' AND NEW.status IN ('COMPLETED','CANCELLED'))
       ) THEN
      RAISE EXCEPTION 'Settlement update denied'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dining_sessions ds
    JOIN public.restaurant_tables rt ON rt.id = ds.table_id
    WHERE ds.id = NEW.dining_session_id
      AND ds.outlet_id = NEW.outlet_id
      AND rt.id = NEW.table_id
      AND rt.outlet_id = NEW.outlet_id
  ) THEN
    RAISE EXCEPTION 'Settlement table/session outlet mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.bill_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = NEW.bill_id
      AND b.dining_session_id = NEW.dining_session_id
      AND b.outlet_id = NEW.outlet_id
  ) THEN
    RAISE EXCEPTION 'Settlement bill mismatch'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION pali_runtime.settlement_write_guard()
FROM PUBLIC;

-- Only the database trigger should invoke this function.
-- Runtime roles do not receive direct EXECUTE privileges.

CREATE TRIGGER settlement_write_guard
BEFORE INSERT OR UPDATE
ON public.settlement_requests
FOR EACH ROW
EXECUTE FUNCTION pali_runtime.settlement_write_guard();
