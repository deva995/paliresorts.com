-- Temporary migration-only membership permits replacing guard-owned functions atomically.
DO $$ BEGIN
  EXECUTE format('GRANT pali_context_guard TO %I',current_user);
  GRANT CREATE ON SCHEMA pali_runtime TO pali_context_guard;
END $$;
-- Bind global capabilities to current database role membership, not signed assertions.
-- Existing 001–020 migrations and provider auth.uid() remain unchanged.
GRANT SELECT(staff_id,role_id) ON public.staff_roles TO pali_context_guard;
CREATE POLICY runtime_verifier_role_read ON public.staff_roles FOR SELECT TO pali_context_guard USING (true);

CREATE OR REPLACE FUNCTION pali_runtime.context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
DECLARE payload text:=current_setting('pali.context',true); sig text:=current_setting('pali.signature',true);
  k text; c jsonb; actor uuid; actual_super boolean;
BEGIN
  IF payload IS NULL OR payload='' OR sig IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT secret INTO k FROM pali_runtime.context_key WHERE singleton;
  IF k IS NULL OR public.digest(sig,'sha256')<>public.digest(encode(public.hmac(payload,k,'sha256'),'hex'),'sha256') THEN RETURN '{}'::jsonb; END IF;
  c:=payload::jsonb;
  IF (c->>'pid')::integer IS DISTINCT FROM pg_backend_pid() OR c->>'tx' IS DISTINCT FROM txid_current()::text OR c->>'expires' IS NULL
    OR (c->>'expires')::bigint<extract(epoch FROM statement_timestamp())
    OR (c->>'expires')::bigint>extract(epoch FROM statement_timestamp())+120 THEN RETURN '{}'::jsonb; END IF;
  IF c->>'mode' IN ('authenticate','staff') THEN
    SELECT s.id INTO actor FROM public.staff_sessions ss JOIN public.staff s ON s.id=ss.staff_id
      WHERE ss.token_hash=c->>'tokenHash'
      AND (ss.revoked_at IS NULL OR (c->>'mode'='staff' AND ss.xmin::text=(txid_current()%4294967296)::text))
      AND ss.expires_at>statement_timestamp()
      AND (s.is_active OR c->>'mode'='authenticate');
    IF actor IS NULL OR (c->>'mode'='staff' AND c->>'staffId'<>actor::text) THEN RETURN '{}'::jsonb; END IF;
    c:=c || jsonb_build_object('staffId',actor);
    IF c->>'mode'='staff' THEN
      SELECT EXISTS (SELECT FROM public.staff_roles sr WHERE sr.staff_id=actor AND sr.role_id='SUPER_ADMIN') INTO actual_super;
      c:=c || jsonb_build_object('superAdmin',actual_super AND COALESCE((c->>'superAdmin')::boolean,false),
        'globalOutlets',actual_super AND COALESCE((c->>'globalOutlets')::boolean,false));
      c:=jsonb_set(c,'{outlets}',COALESCE((SELECT jsonb_agg(a.outlet_id) FROM public.staff_outlet_access a JOIN public.outlets o ON o.id=a.outlet_id
        WHERE a.staff_id=actor AND o.is_active AND COALESCE(c->'outlets','[]'::jsonb) ? a.outlet_id),'[]'::jsonb));
    END IF;
  ELSIF c->>'mode' IN ('guest','guest_auth') THEN
    IF NOT EXISTS (SELECT FROM public.guest_session_tokens g JOIN public.dining_sessions d ON d.id=g.dining_session_id
      JOIN public.restaurant_tables t ON t.id=d.table_id JOIN public.outlets o ON o.id=d.outlet_id
      WHERE g.token_hash=c->>'tokenHash' AND NOT g.is_revoked AND g.expires_at>statement_timestamp()
      AND g.verified_at IS NOT NULL AND g.otp_hash IS NULL
      AND (c->>'mode'='guest_auth' OR (d.status IN ('ACTIVE','BILLED') AND t.is_active AND o.is_active AND t.active_dining_session_id=d.id))
      AND (c->>'mode'='guest_auth' OR (c->>'sessionId'=d.id::text AND c->>'tableId'=t.id::text AND c->>'outletId'=d.outlet_id)))
      THEN RETURN '{}'::jsonb; END IF;
  END IF;
  RETURN c;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN '{}'::jsonb;
END $$;

REVOKE ALL ON FUNCTION pali_runtime.context() FROM PUBLIC;
ALTER FUNCTION pali_runtime.context() OWNER TO pali_context_guard;
GRANT EXECUTE ON FUNCTION pali_runtime.context() TO pali_runtime;

-- Catalog master rows have no outlet_id. Check complete allocation metadata through
-- the verifier; invoker RLS must not hide a foreign allocation during this check.
GRANT SELECT(id,category_id,property_id) ON public.menu_items TO pali_context_guard;
CREATE POLICY runtime_verifier_catalog_read ON public.menu_items FOR SELECT TO pali_context_guard USING (true);
CREATE FUNCTION pali_runtime.catalog_write_allowed(kind text,target uuid,property uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb:=pali_runtime.context();
BEGIN
  IF c->>'mode' IS DISTINCT FROM 'staff' THEN RETURN false; END IF;
  IF COALESCE((c->>'superAdmin')::boolean,false) THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT FROM public.outlets o WHERE o.property_id=property AND o.is_active
    AND COALESCE(c->'outlets','[]'::jsonb) ? o.id) THEN RETURN false; END IF;
  IF kind='menu_items' THEN
    RETURN NOT EXISTS (SELECT FROM public.outlet_menu_items a WHERE a.menu_item_id=target
      AND NOT (COALESCE(c->'outlets','[]'::jsonb) ? a.outlet_id));
  ELSIF kind='menu_categories' THEN
    RETURN NOT EXISTS (SELECT FROM public.outlet_menu_items a JOIN public.menu_items m ON m.id=a.menu_item_id
      WHERE m.category_id=target AND NOT (COALESCE(c->'outlets','[]'::jsonb) ? a.outlet_id));
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION pali_runtime.catalog_write_allowed(text,uuid,uuid) FROM PUBLIC;
ALTER FUNCTION pali_runtime.catalog_write_allowed(text,uuid,uuid) OWNER TO pali_context_guard;
GRANT EXECUTE ON FUNCTION pali_runtime.catalog_write_allowed(text,uuid,uuid) TO pali_runtime;

CREATE FUNCTION pali_runtime.check_catalog_outlet_write() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT pg_has_role(current_user,'pali_runtime','usage') OR
    EXISTS (SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
  IF NOT pali_runtime.catalog_write_allowed(TG_TABLE_NAME,NEW.id,NEW.property_id) OR
    (TG_OP='UPDATE' AND NOT pali_runtime.catalog_write_allowed(TG_TABLE_NAME,OLD.id,OLD.property_id)) THEN
    RAISE EXCEPTION 'Catalog mutation requires every affected outlet membership' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pali_runtime.check_catalog_outlet_write() FROM PUBLIC;
CREATE TRIGGER runtime_catalog_outlet_write BEFORE INSERT OR UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION pali_runtime.check_catalog_outlet_write();
CREATE TRIGGER runtime_category_outlet_write BEFORE INSERT OR UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION pali_runtime.check_catalog_outlet_write();

DO $$ BEGIN
  REVOKE CREATE ON SCHEMA pali_runtime FROM pali_context_guard;
  EXECUTE format('REVOKE pali_context_guard FROM %I',current_user);
END $$;
