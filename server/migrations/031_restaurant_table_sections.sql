-- Migration 031: Pali Village restaurant floor sections
-- Staging only. Preserve existing table IDs and QR credentials.
BEGIN;

DO $$
DECLARE
  n integer;
  section_code text;
  target_zone uuid;
  existing_record record;
BEGIN
  -- Prevent concurrent changes to the target outlet's tables.
  LOCK TABLE public.restaurant_tables IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.dining_zones IN SHARE ROW EXCLUSIVE MODE;

  -- Stop if existing tables outside the approved numbering scheme exist.
  IF EXISTS (
    SELECT 1
    FROM public.restaurant_tables
    WHERE outlet_id = 'rest-1'
      AND (
        table_number !~ '^T-[0-9]{2}$'
        OR substring(table_number from 3)::integer NOT BETWEEN 1 AND 71
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected table numbering; manual review required';
  END IF;

  -- Prevent relocating tables with operational activity.
  IF EXISTS (
    SELECT 1
    FROM public.restaurant_tables
    WHERE outlet_id = 'rest-1'
      AND table_number IN (
        SELECT 'T-' || lpad(series.table_no::text, 2, '0')
        FROM generate_series(1, 71) AS series(table_no)
      )
      AND (
        status <> 'AVAILABLE'
        OR active_dining_session_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Table in use; migration stopped';
  END IF;

  INSERT INTO public.dining_zones (
    outlet_id, name, code, display_order, is_active
  )
  VALUES
    ('rest-1', 'AC Section', 'AC', 1, true),
    ('rest-1', 'Garden Section', 'GARDEN', 2, true),
    ('rest-1', 'Machan A', 'MACHAN_A', 3, true),
    ('rest-1', 'Machan B', 'MACHAN_B', 4, true),
    ('rest-1', 'Village Section', 'VILLAGE', 5, true)
  ON CONFLICT (outlet_id, code) DO NOTHING;

  FOR n IN 1..71 LOOP
    section_code := CASE
      WHEN n <= 10 THEN 'AC'
      WHEN n <= 30 THEN 'GARDEN'
      WHEN n <= 39 THEN 'MACHAN_A'
      WHEN n <= 49 THEN 'MACHAN_B'
      ELSE 'VILLAGE'
    END;

    SELECT id INTO target_zone
    FROM public.dining_zones
    WHERE outlet_id = 'rest-1' AND code = section_code;

    IF target_zone IS NULL THEN
      RAISE EXCEPTION 'Required zone missing: %', section_code;
    END IF;

    UPDATE public.restaurant_tables
    SET zone_id = target_zone,
        updated_at = CURRENT_TIMESTAMP
    WHERE outlet_id = 'rest-1'
      AND table_number = 'T-' || lpad(n::text, 2, '0')
      AND zone_id IS DISTINCT FROM target_zone;

    IF NOT FOUND AND NOT EXISTS (
      SELECT 1 FROM public.restaurant_tables
      WHERE outlet_id = 'rest-1'
        AND table_number = 'T-' || lpad(n::text, 2, '0')
    ) THEN
      INSERT INTO public.restaurant_tables (
        outlet_id, zone_id, table_number, capacity,
        status, is_active, qr_public_code, qr_secret_token_hash
      )
      VALUES (
        'rest-1',
        target_zone,
        'T-' || lpad(n::text, 2, '0'),
        4,
        'OUT_OF_SERVICE',
        false,
        'PALI-R1-UNISSUED-' || n::text,
        encode(gen_random_bytes(32), 'hex')
      );
    END IF;
  END LOOP;

  IF (
    SELECT count(*) FROM public.restaurant_tables
    WHERE outlet_id = 'rest-1'
  ) <> 71 THEN
    RAISE EXCEPTION 'Expected exactly 71 tables';
  END IF;
END $$;

INSERT INTO public._schema_migrations(name)
VALUES ('031_restaurant_table_sections.sql')
ON CONFLICT (name) DO NOTHING;

COMMIT;
