-- Standalone Express capabilities. Historical/provider auth.uid() remains unchanged.
-- Roles have no login; provision a dedicated login inheriting ONLY pali_runtime.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pali_runtime') THEN
    CREATE ROLE pali_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pali_context_guard') THEN
    CREATE ROLE pali_context_guard NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('pali_runtime','pali_context_guard')
    AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'Unsafe existing standalone roles';
  END IF;
  IF EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
    WHERE r.rolname IN ('pali_runtime','pali_context_guard')) THEN
    RAISE EXCEPTION 'Standalone roles must not inherit other roles';
  END IF;
END $$;
CREATE SCHEMA pali_runtime;
REVOKE ALL ON SCHEMA pali_runtime FROM PUBLIC;
CREATE TABLE pali_runtime.context_key (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), secret text NOT NULL CHECK(secret ~ '^[0-9a-f]{64}$'));
REVOKE ALL ON pali_runtime.context_key FROM PUBLIC, pali_runtime;
GRANT USAGE ON SCHEMA public, pali_runtime TO pali_runtime, pali_context_guard;
GRANT SELECT ON pali_runtime.context_key TO pali_context_guard;

-- A non-login verifier can read only identity/lifecycle metadata. Runtime has no
-- membership in this role and cannot SET ROLE to it. No definer writes business data.
GRANT SELECT ON public.staff_sessions,public.staff_outlet_access,
  public.guest_session_tokens,public.dining_sessions,public.restaurant_tables,public.outlets,public.outlet_menu_items TO pali_context_guard;
GRANT SELECT(id,employee_code,first_name,last_name,email,phone,password_hash,password_failed_attempts,password_locked_until,is_active) ON public.staff TO pali_context_guard;
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ADD COLUMN runtime_guest_session_id uuid NULL REFERENCES public.dining_sessions(id) ON DELETE RESTRICT;
CREATE INDEX idempotency_runtime_guest_session ON public.idempotency_keys(runtime_guest_session_id) WHERE runtime_guest_session_id IS NOT NULL;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['staff','staff_sessions','staff_outlet_access','guest_session_tokens','dining_sessions','restaurant_tables','outlets','outlet_menu_items'] LOOP
    EXECUTE format('CREATE POLICY runtime_verifier_read ON public.%I FOR SELECT TO pali_context_guard USING (true)',t);
  END LOOP;
END $$;

CREATE FUNCTION pali_runtime.context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
DECLARE payload text:=current_setting('pali.context',true); sig text:=current_setting('pali.signature',true);
  k text; c jsonb; actor uuid;
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
      c:=jsonb_set(c,'{outlets}',COALESCE((SELECT jsonb_agg(a.outlet_id) FROM public.staff_outlet_access a
        WHERE a.staff_id=actor AND COALESCE(c->'outlets','[]'::jsonb) ? a.outlet_id),'[]'::jsonb));
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

CREATE FUNCTION pali_runtime.staff_visible(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT target::text=pali_runtime.context()->>'staffId'
    OR COALESCE((pali_runtime.context()->>'globalOutlets')::boolean,false)
    OR EXISTS (SELECT FROM public.staff_outlet_access a WHERE a.staff_id=target
      AND (pali_runtime.context()->'outlets') ? a.outlet_id);
$$;

CREATE FUNCTION pali_runtime.guest_session() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT g.dining_session_id FROM public.guest_session_tokens g
  WHERE (pali_runtime.context()->>'mode' IN ('guest','guest_auth') AND g.token_hash=pali_runtime.context()->>'tokenHash')
    OR (pali_runtime.context()->>'mode'='public' AND (g.id::text=pali_runtime.context()->>'challenge'
      OR (pali_runtime.context()->>'path'='/api/v1/guest/menu' AND g.token_hash=pali_runtime.context()->>'tokenHash'))) LIMIT 1;
$$;

CREATE FUNCTION pali_runtime.login_staff(identifier text)
RETURNS TABLE(id uuid,employee_code varchar,first_name varchar,last_name varchar,email varchar,phone varchar,
  password_hash varchar,password_failed_attempts integer,password_locked_until timestamptz,is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT s.id,s.employee_code,s.first_name,s.last_name,s.email,s.phone,s.password_hash,
    s.password_failed_attempts,s.password_locked_until,s.is_active
  FROM public.staff s WHERE pali_runtime.context()->>'mode'='login'
    AND lower(identifier)=pali_runtime.context()->>'identifier'
    AND (lower(s.employee_code)=lower(identifier) OR lower(s.email)=lower(identifier) OR s.phone=identifier) LIMIT 1;
$$;

CREATE FUNCTION pali_runtime.password_matches(target uuid, candidate text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT EXISTS (SELECT FROM public.staff s WHERE s.id=target AND s.password_hash=candidate
    AND pali_runtime.context()->>'mode'='login_success' AND pali_runtime.context()->>'staffId'=target::text);
$$;

-- Shared-master approval needs the complete affected-outlet set, but no foreign
-- outlet prices, availability or other allocation fields are returned.
CREATE FUNCTION pali_runtime.catalog_outlets(item uuid) RETURNS TABLE(outlet_id varchar) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT a.outlet_id FROM public.outlet_menu_items a WHERE a.menu_item_id=item
    AND pali_runtime.context()->>'mode'='staff'
    AND (COALESCE((pali_runtime.context()->>'globalOutlets')::boolean,false)
      OR EXISTS (SELECT FROM public.outlet_menu_items own WHERE own.menu_item_id=item AND (pali_runtime.context()->'outlets') ? own.outlet_id));
$$;

CREATE FUNCTION pali_runtime.access(t text, action text, r jsonb) RETURNS boolean LANGUAGE plpgsql STABLE
SET search_path=pg_catalog AS $$
DECLARE c jsonb:=pali_runtime.context(); m text:=c->>'mode'; o text:=r->>'outlet_id'; session_id text:=r->>'dining_session_id';
  p jsonb:=COALESCE(c->'permissions','[]'::jsonb); needs text[]; public_otp boolean;
BEGIN
  IF m IS NULL OR m='none' THEN RETURN false; END IF;
  -- PostgreSQL row-lock SELECTs also apply UPDATE policies. Actual UPDATEs
  -- require the separate WRITE check in the BEFORE trigger below.
  IF action='UPDATE' THEN action:='SELECT'; ELSIF action='WRITE' THEN action:='UPDATE'; END IF;
  IF m IN ('login','login_success') THEN
    IF t='staff' THEN RETURN (lower(r->>'employee_code')=c->>'identifier' OR lower(r->>'email')=c->>'identifier' OR r->>'phone'=c->>'identifier') AND action IN ('SELECT','UPDATE'); END IF;
    IF t='staff_sessions' THEN RETURN m='login_success' AND r->>'staff_id'=c->>'staffId' AND action IN ('SELECT','INSERT'); END IF;
    IF action<>'SELECT' THEN RETURN false; END IF;
    IF t IN ('roles','permissions','role_permissions','outlets') THEN RETURN true; END IF;
    RETURN m='login_success' AND t IN ('staff_roles','staff_outlet_access','staff_module_access') AND r->>'staff_id'=c->>'staffId';
  END IF;
  IF m='authenticate' THEN
    IF action<>'SELECT' THEN RETURN false; END IF;
    IF t IN ('staff','staff_roles','staff_outlet_access','staff_module_access','staff_sessions') THEN
      RETURN COALESCE(r->>'staff_id',r->>'id')=c->>'staffId';
    END IF;
    -- Internal metadata discovery for resource-owned authorization, never an HTTP result.
    RETURN t IN ('roles','permissions','role_permissions','outlets','restaurant_tables','dining_sessions','orders','kots','kot_items','bills','payments','service_requests','menu_item_revisions');
  END IF;
  IF m='public' THEN
    public_otp:=c->>'path' IN ('/api/v1/guest/otp/request','/api/v1/guest/otp/verify');
    IF t='guest_session_tokens' THEN
      IF c->>'path'='/api/v1/guest/menu' THEN RETURN action='SELECT' AND r->>'token_hash'=c->>'tokenHash'; END IF;
      IF c->>'path'='/api/v1/guest/otp/verify' THEN RETURN r->>'id'=c->>'challenge' AND action IN ('SELECT','UPDATE'); END IF;
      IF c->>'path'='/api/v1/guest/otp/request' THEN
        RETURN action IN ('SELECT','INSERT') AND EXISTS (SELECT FROM public.dining_sessions d JOIN public.restaurant_tables rt ON rt.id=d.table_id
          WHERE d.id::text=r->>'dining_session_id' AND rt.qr_public_code=c->>'qr' AND d.status='ACTIVE');
      END IF;
      RETURN false;
    END IF;
    IF t='customers' THEN RETURN public_otp AND c->>'path'='/api/v1/guest/otp/request' AND r->>'phone'=c->>'phone' AND action IN ('SELECT','INSERT','UPDATE'); END IF;
    IF action='UPDATE' THEN RETURN public_otp AND t IN ('restaurant_tables','outlets'); END IF; -- row locks only; trigger forbids mutation
    IF action<>'SELECT' THEN RETURN false; END IF;
    IF t='dining_sessions' THEN RETURN (public_otp AND (c->>'path'='/api/v1/guest/otp/request' OR r->>'id'=pali_runtime.guest_session()::text))
      OR c->>'path'='/api/v1/guest/table/resolve' OR (c->>'path'='/api/v1/guest/menu' AND r->>'id'=pali_runtime.guest_session()::text); END IF;
    RETURN t IN ('outlets','properties','restaurant_tables','dining_zones','menu_categories','menu_items','outlet_menu_items');
  END IF;
  IF m IN ('guest','guest_auth') THEN
    IF t='guest_session_tokens' THEN RETURN r->>'token_hash'=c->>'tokenHash' AND (action='SELECT' OR (m='guest' AND action='UPDATE')); END IF;
    IF t='dining_sessions' THEN RETURN r->>'id'=pali_runtime.guest_session()::text AND action='SELECT'; END IF;
    IF t IN ('restaurant_tables','outlets') AND m='guest_auth' THEN RETURN action='SELECT'; END IF;
    IF m='guest_auth' THEN RETURN false; END IF;
    IF t='idempotency_keys' THEN RETURN o=c->>'outletId' AND r->>'actor_staff_id' IS NULL AND r->>'runtime_guest_session_id'=c->>'sessionId'; END IF;
    IF t='restaurant_tables' THEN RETURN r->>'id'=c->>'tableId' AND action='SELECT'; END IF;
    IF t IN ('order_items','order_status_history') THEN SELECT outlet_id,dining_session_id::text INTO o,session_id FROM public.orders WHERE id::text=r->>'order_id'; END IF;
    IF t IN ('kot_items','kot_status_history') THEN SELECT k.outlet_id,ord.dining_session_id::text INTO o,session_id FROM public.kots k JOIN public.orders ord ON ord.id=k.order_id WHERE k.id::text=r->>'kot_id'; END IF;
    IF t='kots' THEN SELECT dining_session_id::text INTO session_id FROM public.orders WHERE id::text=r->>'order_id'; END IF;
    IF t='bill_items' THEN
      SELECT outlet_id,dining_session_id::text INTO o,session_id FROM public.bills WHERE id::text=r->>'bill_id';
      RETURN action='SELECT' AND session_id=c->>'sessionId' AND o=c->>'outletId';
    END IF;
    IF t IN ('orders','order_items','order_status_history','kots','kot_items','kot_status_history','service_requests','bills') THEN
      RETURN session_id=c->>'sessionId' AND o=c->>'outletId' AND (action='SELECT' OR (action='INSERT' AND t<>'bills') OR (action='UPDATE' AND t='orders'));
    END IF;
    IF t='outlet_counters' THEN RETURN o=c->>'outletId' AND r->>'counter_type' IN ('DAILY_ORDER','DAILY_KOT') AND action IN ('SELECT','INSERT','UPDATE'); END IF;
    IF t='audit_logs' THEN RETURN o=c->>'outletId' AND r->>'actor_id'=c->>'sessionId' AND r->>'actor_type' IN ('SYSTEM','CUSTOMER') AND action IN ('SELECT','INSERT'); END IF;
    IF t='outlet_event_log' THEN RETURN o=c->>'outletId' AND action IN ('SELECT','INSERT') AND (
      EXISTS (SELECT FROM public.orders WHERE id::text=r->>'entity_id') OR
      EXISTS (SELECT FROM public.kots WHERE id::text=r->>'entity_id') OR
      EXISTS (SELECT FROM public.service_requests WHERE id::text=r->>'entity_id')); END IF;
    RETURN action='SELECT' AND (t IN ('properties','menu_categories','menu_items') OR (t IN ('outlets','outlet_menu_items','kitchen_stations','outlet_settings') AND COALESCE(o,r->>'id')=c->>'outletId'));
  END IF;
  IF m<>'staff' THEN RETURN false; END IF;
  IF t IN ('roles','permissions','role_permissions') THEN RETURN action='SELECT'; END IF;
  IF t='staff_sessions' THEN RETURN (r->>'staff_id'=c->>'staffId' OR COALESCE((c->>'superAdmin')::boolean,false)) AND action IN ('SELECT','UPDATE'); END IF;
  IF t IN ('staff','staff_roles','staff_module_access','staff_outlet_access') THEN
    IF action='SELECT' THEN RETURN pali_runtime.staff_visible(COALESCE(r->>'staff_id',r->>'id')::uuid); END IF;
    RETURN COALESCE((c->>'superAdmin')::boolean,false);
  END IF;
  IF t='properties' THEN RETURN action='SELECT' OR COALESCE((c->>'superAdmin')::boolean,false); END IF;
  IF t IN ('menu_categories','menu_items') THEN
    RETURN action='SELECT' OR (COALESCE((c->>'superAdmin')::boolean,false) OR p ?| ARRAY['menu:edit','menu:approve_revisions']);
  END IF;
  IF t IN ('order_items','order_status_history') THEN SELECT outlet_id INTO o FROM public.orders WHERE id::text=r->>'order_id'; END IF;
  IF t IN ('kot_items','kot_status_history') THEN SELECT outlet_id INTO o FROM public.kots WHERE id::text=r->>'kot_id'; END IF;
  IF t='bill_items' THEN SELECT outlet_id INTO o FROM public.bills WHERE id::text=r->>'bill_id'; END IF;
  IF t IN ('payment_allocations','refunds') THEN SELECT outlet_id INTO o FROM public.payments WHERE id::text=r->>'payment_id'; END IF;
  IF t='guest_session_tokens' THEN SELECT outlet_id INTO o FROM public.dining_sessions WHERE id::text=r->>'dining_session_id'; END IF;
  IF t='approval_actions' THEN SELECT outlet_id INTO o FROM public.approval_requests WHERE id::text=r->>'request_id'; END IF;
  IF t='menu_revision_approvals' THEN SELECT outlet_id INTO o FROM public.menu_item_revisions WHERE id::text=r->>'revision_id'; END IF;
  IF t='table_assignment_history' THEN SELECT outlet_id INTO o FROM public.restaurant_tables WHERE id::text=r->>'table_id'; END IF;
  IF t='outlets' THEN o:=r->>'id'; END IF;
  IF t IN ('order_items','order_status_history','kot_items','kot_status_history','bill_items','payment_allocations','refunds','approval_actions','table_assignment_history','guest_session_tokens') AND o IS NULL THEN RETURN false; END IF;
  IF t='customers' AND action='SELECT' THEN RETURN COALESCE((c->>'globalOutlets')::boolean,false) OR EXISTS (SELECT FROM public.dining_sessions ds WHERE ds.customer_id::text=r->>'id'); END IF;
  IF t='menu_item_revisions' AND o IS NULL AND NOT EXISTS (SELECT FROM pali_runtime.catalog_outlets((r->>'menu_item_id')::uuid)) THEN RETURN false; END IF;
  IF o IS NOT NULL AND NOT COALESCE((c->>'globalOutlets')::boolean,false) AND NOT (COALESCE(c->'outlets','[]'::jsonb) ? o) THEN RETURN false; END IF;
  IF o IS NOT NULL AND c->>'scope' IS NOT NULL AND o<>c->>'scope' THEN RETURN false; END IF;
  IF action='SELECT' THEN RETURN o IS NOT NULL OR t IN ('customers','menu_item_revisions','menu_revision_approvals','discount_reason_codes','audit_logs','idempotency_keys'); END IF;
  IF COALESCE((c->>'superAdmin')::boolean,false) THEN RETURN true; END IF;
  IF t IN ('outlets','outlet_settings') THEN RETURN false; END IF;
  IF t='payments' AND action='INSERT' OR t='payment_allocations' THEN needs:=ARRAY['payment:process','bill:settle'];
  ELSIF t='payments' THEN needs:=ARRAY['payment:process','bill:settle','payment:refund'];
  ELSIF t='refunds' THEN needs:=ARRAY['payment:refund'];
  ELSIF t='bills' AND action='INSERT' THEN needs:=ARRAY['bill:generate'];
  ELSIF t IN ('bills','bill_items') THEN needs:=ARRAY['bill:generate','bill:apply_discount','bill:void','bill:settle','payment:process','payment:refund'];
  ELSIF t='approval_requests' AND action='INSERT' THEN needs:=ARRAY['bill:apply_discount'];
  ELSIF t IN ('approval_requests','approval_actions','discount_reason_codes') THEN needs:=ARRAY['bill:approve_discount'];
  ELSIF t='menu_revision_approvals' OR t='menu_item_revisions' AND action='UPDATE' THEN needs:=ARRAY['menu:approve_revisions'];
  ELSIF t IN ('outlet_menu_items','menu_item_revisions') THEN needs:=ARRAY['menu:edit','menu:approve_revisions'];
  ELSIF t='restaurant_tables' AND action='INSERT' THEN needs:=ARRAY['table:manage'];
  ELSIF t IN ('restaurant_tables','dining_sessions','service_requests','guest_session_tokens') THEN needs:=ARRAY['table:manage','table:assign','bill:settle','payment:process','order:create','order:cancel'];
  ELSIF t='table_assignment_history' THEN needs:=ARRAY['table:manage','table:assign'];
  ELSIF t='outlet_counters' AND r->>'counter_type'='INVOICE' THEN needs:=ARRAY['bill:generate'];
  ELSIF t IN ('orders','order_items','kots','kot_items') AND action='INSERT' THEN needs:=ARRAY['order:create','order:counter_create','kds:update'];
  ELSIF t IN ('orders','order_items','order_status_history','kots','kot_items','kot_status_history','outlet_counters') THEN needs:=ARRAY['order:create','order:counter_create','order:update','order:serve','order:cancel','kds:update'];
  ELSIF t='customers' THEN needs:=ARRAY['table:manage','table:assign','order:create'];
  ELSIF t IN ('audit_logs','outlet_event_log','idempotency_keys') THEN RETURN true;
  ELSE RETURN false;
  END IF;
  RETURN p ?| needs;
END $$;

-- Prevent lock-only public capabilities from becoming actual table mutations;
-- constrain login counter changes and bind staff audit/idempotency actors.
CREATE FUNCTION pali_runtime.check_write() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c jsonb:=pali_runtime.context(); r jsonb:=to_jsonb(NEW); o text:=r->>'outlet_id'; parent text; foreign_id text;
BEGIN
  IF NOT pg_has_role(current_user,'pali_runtime','usage') OR
    EXISTS (SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NOT pali_runtime.access(TG_TABLE_NAME,'WRITE',r) THEN
    RAISE EXCEPTION 'Runtime mutation permission denied' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='menu_items' AND TG_OP='UPDATE' THEN
    IF (SELECT count(*) FROM pali_runtime.catalog_outlets((r->>'id')::uuid))>1 AND NOT EXISTS (
      SELECT FROM public.menu_item_revisions mr JOIN public.menu_revision_approvals ma ON ma.revision_id=mr.id
      WHERE mr.menu_item_id=NEW.id AND mr.outlet_id IS NULL AND mr.status='PENDING'
      AND ma.action='APPROVED' AND ma.reviewed_by_staff_id::text=c->>'staffId'
      AND mr.submitted_by_staff_id<>ma.reviewed_by_staff_id) THEN
    RAISE EXCEPTION 'Shared master requires independent pending approval' USING ERRCODE='42501';
    END IF;
  END IF;
  IF c->>'mode'='public' AND TG_TABLE_NAME NOT IN ('customers','guest_session_tokens') THEN RAISE EXCEPTION 'Public capability cannot mutate this table' USING ERRCODE='42501'; END IF;
  IF c->>'mode'='staff' AND TG_TABLE_NAME='staff_sessions' AND TG_OP='UPDATE' THEN
    IF r->>'revoked_at' IS NULL OR (to_jsonb(OLD)-'revoked_at') IS DISTINCT FROM (r-'revoked_at') THEN
      RAISE EXCEPTION 'Runtime may only revoke existing staff sessions' USING ERRCODE='42501';
    END IF;
  END IF;
  IF TG_TABLE_NAME='payments' AND TG_OP='UPDATE' AND
    (to_jsonb(OLD)-ARRAY['status','updated_at']) IS DISTINCT FROM (r-ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'Captured payment facts are immutable' USING ERRCODE='42501';
  END IF;
  IF c->>'mode'='guest' THEN
    IF TG_TABLE_NAME='orders' AND TG_OP='UPDATE' THEN
      IF to_jsonb(OLD)->>'status'<>'PLACED' OR r->>'status'<>'ACCEPTED' OR
        (to_jsonb(OLD)-ARRAY['status','updated_at']) IS DISTINCT FROM (r-ARRAY['status','updated_at']) THEN
        RAISE EXCEPTION 'Guest cannot change order lifecycle or contents' USING ERRCODE='42501';
      END IF;
    ELSIF TG_TABLE_NAME='guest_session_tokens' AND TG_OP='UPDATE' THEN
      IF r->>'is_revoked'<>'true' OR (to_jsonb(OLD)-'is_revoked') IS DISTINCT FROM (r-'is_revoked') THEN
        RAISE EXCEPTION 'Guest may only revoke its own token' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME='staff' AND c->>'mode' IN ('login','login_success') AND
    (to_jsonb(OLD)-ARRAY['password_failed_attempts','password_locked_until','updated_at']) IS DISTINCT FROM
    (r-ARRAY['password_failed_attempts','password_locked_until','updated_at']) THEN
    RAISE EXCEPTION 'Login may only update lockout counters' USING ERRCODE='42501';
  END IF;
  IF c->>'mode'='staff' AND ((TG_TABLE_NAME='audit_logs' AND (r->>'actor_type' IS DISTINCT FROM 'STAFF' OR r->>'actor_id' IS DISTINCT FROM c->>'staffId'))
    OR (TG_TABLE_NAME='idempotency_keys' AND r->>'actor_staff_id' IS DISTINCT FROM c->>'staffId')) THEN
    RAISE EXCEPTION 'Actor mismatch' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='payment_allocations' THEN
    SELECT p.outlet_id INTO o FROM public.payments p WHERE p.id::text=r->>'payment_id';
    SELECT b.outlet_id INTO parent FROM public.bills b WHERE b.id::text=r->>'bill_id';
    IF o IS NULL OR parent IS DISTINCT FROM o THEN RAISE EXCEPTION 'Cross-outlet allocation denied' USING ERRCODE='42501'; END IF;
    parent:=NULL;
  ELSIF TG_TABLE_NAME='bill_items' THEN
    SELECT b.outlet_id INTO o FROM public.bills b WHERE b.id::text=r->>'bill_id';
    SELECT ord.outlet_id INTO parent FROM public.order_items oi JOIN public.orders ord ON ord.id=oi.order_id WHERE oi.id::text=r->>'order_item_id';
    IF o IS NULL OR parent IS DISTINCT FROM o THEN RAISE EXCEPTION 'Cross-outlet invoice line denied' USING ERRCODE='42501'; END IF;
    parent:=NULL;
  ELSIF TG_TABLE_NAME='kot_items' THEN
    SELECT k.order_id::text INTO o FROM public.kots k WHERE k.id::text=r->>'kot_id';
    SELECT oi.order_id::text INTO parent FROM public.order_items oi WHERE oi.id::text=r->>'order_item_id';
    IF o IS NULL OR parent IS DISTINCT FROM o THEN RAISE EXCEPTION 'Cross-order kitchen line denied' USING ERRCODE='42501'; END IF;
    o:=r->>'outlet_id';parent:=NULL;
  END IF;
  IF TG_TABLE_NAME='restaurant_tables' AND r->>'active_dining_session_id' IS NOT NULL AND NOT EXISTS (
    SELECT FROM public.dining_sessions ds WHERE ds.id::text=r->>'active_dining_session_id'
      AND ds.outlet_id=r->>'outlet_id' AND ds.table_id::text=r->>'id') THEN
    RAISE EXCEPTION 'Cross-table sitting pointer denied' USING ERRCODE='42501';
  END IF;
  -- Foreign keys alone do not guarantee that the parent belongs to the same outlet.
  IF TG_TABLE_NAME='restaurant_tables' THEN parent:='dining_zones'; foreign_id:=r->>'zone_id';
  ELSIF TG_TABLE_NAME IN ('dining_sessions','service_requests') THEN parent:='restaurant_tables'; foreign_id:=r->>'table_id';
  ELSIF TG_TABLE_NAME='orders' THEN parent:='dining_sessions'; foreign_id:=r->>'dining_session_id';
  ELSIF TG_TABLE_NAME='kots' THEN parent:='orders'; foreign_id:=r->>'order_id';
  ELSIF TG_TABLE_NAME='payments' THEN parent:='bills'; foreign_id:=r->>'bill_id';
  ELSIF TG_TABLE_NAME='bills' THEN parent:='dining_sessions'; foreign_id:=r->>'dining_session_id';
  END IF;
  IF parent IS NOT NULL AND foreign_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT FROM jsonb_array_elements_text(COALESCE(c->'outlets','[]'::jsonb)) x WHERE x.value=o)
      AND c->>'mode'='staff' AND NOT COALESCE((c->>'globalOutlets')::boolean,false) THEN
      RAISE EXCEPTION 'Parent outlet denied' USING ERRCODE='42501';
    END IF;
    EXECUTE format('SELECT outlet_id FROM public.%I WHERE id::text=$1',parent) INTO parent USING foreign_id;
    IF parent IS DISTINCT FROM o THEN RAISE EXCEPTION 'Cross-outlet parent denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Only these application tables/commands are available. No ledger, auth.users,
-- later-phase hotel/inventory tables, schema DDL, TRUNCATE or owner membership.
DO $$ DECLARE t text; a text; actions text[]; BEGIN
  FOREACH t IN ARRAY ARRAY['properties','outlets','outlet_settings','outlet_counters','dining_zones','roles','permissions','role_permissions','staff','staff_roles','staff_outlet_access','staff_shifts','duty_roster','menu_categories','menu_items','outlet_menu_items','menu_item_revisions','menu_revision_approvals','kitchen_stations','restaurant_tables','table_assignment_history','customers','dining_sessions','guest_session_tokens','service_requests','orders','order_items','order_status_history','kots','kot_items','kot_status_history','bills','bill_items','payments','payment_allocations','refunds','discount_reason_codes','approval_requests','approval_actions','staff_sessions','staff_module_access','idempotency_keys','outlet_event_log','audit_logs'] LOOP
    actions:=ARRAY['SELECT'];
    IF t NOT IN ('properties','roles','permissions','role_permissions','staff_shifts','duty_roster') THEN
      actions:=actions || ARRAY['INSERT'];
      IF t NOT IN ('audit_logs','outlet_event_log','order_status_history','kot_status_history','approval_actions','menu_revision_approvals','refunds','payment_allocations') THEN actions:=actions || ARRAY['UPDATE']; END IF;
      IF t IN ('staff_roles','staff_outlet_access','staff_module_access','idempotency_keys') THEN actions:=actions || ARRAY['DELETE']; END IF;
    END IF;
    FOREACH a IN ARRAY actions LOOP
      IF NOT (t='staff' AND a='SELECT') THEN EXECUTE format('GRANT %s ON public.%I TO pali_runtime',a,t); END IF;
      IF a IN ('SELECT','DELETE') THEN
        EXECUTE format('CREATE POLICY runtime_%s ON public.%I FOR %s TO pali_runtime USING (pali_runtime.access(%L,%L,to_jsonb(%I)))',lower(a),t,a,t,a,t);
        EXECUTE format('CREATE POLICY runtime_guard_%s ON public.%I AS RESTRICTIVE FOR %s TO pali_runtime USING (pali_runtime.access(%L,%L,to_jsonb(%I)))',lower(a),t,a,t,a,t);
      ELSIF a='INSERT' THEN
        EXECUTE format('CREATE POLICY runtime_insert ON public.%I FOR INSERT TO pali_runtime WITH CHECK (pali_runtime.access(%L,%L,to_jsonb(%I)))',t,t,a,t);
        EXECUTE format('CREATE POLICY runtime_guard_insert ON public.%I AS RESTRICTIVE FOR INSERT TO pali_runtime WITH CHECK (pali_runtime.access(%L,%L,to_jsonb(%I)))',t,t,a,t);
      ELSE
        EXECUTE format('CREATE POLICY runtime_update ON public.%I FOR UPDATE TO pali_runtime USING (pali_runtime.access(%L,%L,to_jsonb(%I))) WITH CHECK (pali_runtime.access(%L,%L,to_jsonb(%I)))',t,t,a,t,t,a,t);
        EXECUTE format('CREATE POLICY runtime_guard_update ON public.%I AS RESTRICTIVE FOR UPDATE TO pali_runtime USING (pali_runtime.access(%L,%L,to_jsonb(%I))) WITH CHECK (pali_runtime.access(%L,%L,to_jsonb(%I)))',t,t,a,t,t,a,t);
      END IF;
    END LOOP;
    EXECUTE format('CREATE TRIGGER runtime_write_check BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION pali_runtime.check_write()',t);
  END LOOP;
END $$;
GRANT SELECT(id,auth_user_id,employee_code,first_name,last_name,email,phone,is_active,created_at,updated_at,password_failed_attempts,password_locked_until) ON public.staff TO pali_runtime;
GRANT USAGE,SELECT ON SEQUENCE public.outlet_event_log_sequence_number_seq TO pali_runtime;
-- Existing owner-rights views must not become a route around runtime RLS.
DO $$ DECLARE v text; definition text; BEGIN
  FOREACH v IN ARRAY ARRAY['restaurant_floor_view','public_outlet_menu'] LOOP
    SELECT pg_get_viewdef(format('public.%I',v)::regclass,true) INTO definition;
    EXECUTE format('CREATE VIEW pali_runtime.%I WITH (security_invoker=true) AS %s',v,definition);
    EXECUTE format('GRANT SELECT ON pali_runtime.%I TO pali_runtime',v);
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pali_runtime FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pali_runtime TO pali_runtime;
-- Transfer only the identity reader functions, not business access/write functions.
DO $$ DECLARE f text; BEGIN
  EXECUTE format('GRANT pali_context_guard TO %I',current_user);
  GRANT CREATE ON SCHEMA pali_runtime TO pali_context_guard;
  FOREACH f IN ARRAY ARRAY['context()','staff_visible(uuid)','guest_session()','login_staff(text)','password_matches(uuid,text)','catalog_outlets(uuid)'] LOOP
    EXECUTE 'ALTER FUNCTION pali_runtime.' || f || ' OWNER TO pali_context_guard';
  END LOOP;
  REVOKE CREATE ON SCHEMA pali_runtime FROM pali_context_guard;
  EXECUTE format('REVOKE pali_context_guard FROM %I',current_user);
END $$;
