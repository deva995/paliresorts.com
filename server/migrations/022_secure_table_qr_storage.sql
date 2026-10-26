-- Restricted encrypted storage for reusable table QR credentials.
-- The encryption key remains outside PostgreSQL.
-- Existing restaurant_tables hashes and RLS policies are unchanged.

-- Allow a composite foreign key to verify table/outlet ownership.
ALTER TABLE public.restaurant_tables
  ADD CONSTRAINT restaurant_tables_id_outlet_unique
  UNIQUE (id, outlet_id);

CREATE TABLE public.table_qr_credentials (
  table_id UUID PRIMARY KEY
    REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  outlet_id VARCHAR(64) NOT NULL,
  encrypted_secret TEXT NOT NULL,
  CONSTRAINT table_qr_credentials_table_outlet_fk
    FOREIGN KEY (table_id, outlet_id)
    REFERENCES public.restaurant_tables(id, outlet_id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX table_qr_credentials_outlet_idx
  ON public.table_qr_credentials(outlet_id);

ALTER TABLE public.table_qr_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_qr_credentials FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.table_qr_credentials FROM PUBLIC;
REVOKE ALL ON public.table_qr_credentials FROM pali_context_guard;

GRANT SELECT, INSERT, UPDATE
  ON public.table_qr_credentials TO pali_runtime;

CREATE POLICY table_qr_credentials_staff_select
ON public.table_qr_credentials
FOR SELECT TO pali_runtime
USING (
  pali_runtime.context()->>'mode' = 'staff'
  AND (pali_runtime.context()->'permissions') ? 'table:manage'
  AND (pali_runtime.context()->'outlets') ? outlet_id
);

CREATE POLICY table_qr_credentials_staff_insert
ON public.table_qr_credentials
FOR INSERT TO pali_runtime
WITH CHECK (
  pali_runtime.context()->>'mode' = 'staff'
  AND (pali_runtime.context()->'permissions') ? 'table:manage'
  AND (pali_runtime.context()->'outlets') ? outlet_id
);

CREATE POLICY table_qr_credentials_staff_update
ON public.table_qr_credentials
FOR UPDATE TO pali_runtime
USING (
  pali_runtime.context()->>'mode' = 'staff'
  AND (pali_runtime.context()->'permissions') ? 'table:manage'
  AND (pali_runtime.context()->'outlets') ? outlet_id
)
WITH CHECK (
  pali_runtime.context()->>'mode' = 'staff'
  AND (pali_runtime.context()->'permissions') ? 'table:manage'
  AND (pali_runtime.context()->'outlets') ? outlet_id
);


CREATE FUNCTION public.prevent_table_qr_ownership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.table_id IS DISTINCT FROM OLD.table_id
     OR NEW.outlet_id IS DISTINCT FROM OLD.outlet_id THEN
    RAISE EXCEPTION 'QR credential ownership cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_table_qr_ownership_change()
FROM PUBLIC;

CREATE TRIGGER prevent_table_qr_ownership_change
BEFORE UPDATE ON public.table_qr_credentials
FOR EACH ROW
EXECUTE FUNCTION public.prevent_table_qr_ownership_change();
