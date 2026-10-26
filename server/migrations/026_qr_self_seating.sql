-- Migration 026: scoped, QR-proof self-seating; no generalized public writes.
ALTER TABLE public.guest_session_tokens
  ADD COLUMN IF NOT EXISTS auth_method VARCHAR(8) NOT NULL DEFAULT 'OTP';
ALTER TABLE public.guest_session_tokens
  ADD CONSTRAINT guest_token_auth_method_ck CHECK (auth_method IN ('OTP','QR'));

-- Preserve all existing verifier checks, but recognize independently QR-authenticated tokens.
DO $$ BEGIN EXECUTE format('GRANT pali_context_guard TO %I',current_user); GRANT CREATE ON SCHEMA pali_runtime TO pali_context_guard; END $$;
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
      AND (g.verified_at IS NOT NULL OR g.auth_method='QR') AND g.otp_hash IS NULL
      AND (c->>'mode'='guest_auth' OR (d.status IN ('ACTIVE','BILLED') AND t.is_active AND o.is_active AND t.active_dining_session_id=d.id))
      AND (c->>'mode'='guest_auth' OR (c->>'sessionId'=d.id::text AND c->>'tableId'=t.id::text AND c->>'outletId'=d.outlet_id)))
      THEN RETURN '{}'::jsonb; END IF;
  END IF;
  RETURN c;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN '{}'::jsonb;
END $$;

ALTER FUNCTION pali_runtime.context() OWNER TO pali_context_guard;
DO $$ BEGIN REVOKE CREATE ON SCHEMA pali_runtime FROM pali_context_guard; EXECUTE format('REVOKE pali_context_guard FROM %I',current_user); END $$;

-- SECURITY DEFINER is mandatory here: regular public RLS disallows seating.
-- Its caller receives no general table write capability.
CREATE FUNCTION pali_runtime.qr_self_seat(
  code text, secret text, bearer_hash text, guests integer
) RETURNS TABLE(session_id uuid, table_id uuid, outlet_id varchar, table_number varchar, opened_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE t record; sitting uuid; opened timestamptz; c jsonb;
BEGIN
  c := pali_runtime.context();
  IF c->>'mode' IS DISTINCT FROM 'public' OR c->>'path' IS DISTINCT FROM '/api/v1/guest/table/self-seat'
    OR code IS NULL OR length(code) NOT BETWEEN 1 AND 32
    OR secret IS NULL OR length(secret) NOT BETWEEN 1 AND 128
    OR bearer_hash IS NULL OR bearer_hash !~ '^[0-9a-f]{64}$'
    OR guests IS NULL OR guests NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Self-seating request rejected' USING ERRCODE='42501';
  END IF;
  SELECT rt.id, rt.outlet_id, rt.table_number, rt.capacity, rt.status,
         rt.active_dining_session_id, rt.qr_secret_token_hash,
         rt.is_active, o.is_active AS outlet_active
  INTO t
  FROM public.restaurant_tables rt JOIN public.outlets o ON o.id=rt.outlet_id
  WHERE rt.qr_public_code=code FOR UPDATE OF rt;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid table QR credential' USING ERRCODE='42501';
  END IF;
  IF NOT t.is_active OR NOT t.outlet_active OR
     length(t.qr_secret_token_hash)<>64 OR
     public.digest(secret,'sha256') <> decode(t.qr_secret_token_hash,'hex') THEN
    RAISE EXCEPTION 'Invalid table QR credential' USING ERRCODE='42501';
  END IF;
  IF guests > t.capacity OR t.status <> 'AVAILABLE' OR t.active_dining_session_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.dining_sessions d WHERE d.table_id=t.id AND d.status IN ('ACTIVE','BILLED')) THEN
    RAISE EXCEPTION 'Table unavailable for new seating' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.dining_sessions(outlet_id,table_id,guest_count,status)
  VALUES(t.outlet_id,t.id,guests,'ACTIVE') RETURNING dining_sessions.id,dining_sessions.opened_at INTO sitting,opened;
  UPDATE public.restaurant_tables SET active_dining_session_id=sitting,status='OCCUPIED',updated_at=now() WHERE id=t.id;
  INSERT INTO public.guest_session_tokens(dining_session_id,token_hash,otp_hash,otp_expires_at,
    otp_attempts,is_revoked,expires_at,auth_method)
  VALUES(sitting,bearer_hash,NULL,NULL,0,false,now()+interval '6 hours','QR');
  RETURN QUERY SELECT sitting,t.id,t.outlet_id::varchar,t.table_number::varchar,opened;
END $$;
REVOKE ALL ON FUNCTION pali_runtime.qr_self_seat(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pali_runtime.qr_self_seat(text,text,text,integer) TO pali_runtime;
