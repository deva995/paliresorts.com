BEGIN;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.restaurant_tables
    WHERE outlet_id = 'rest-1'
  ) <> 71 THEN
    RAISE EXCEPTION 'Expected exactly 71 restaurant tables';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.restaurant_tables t
    JOIN public.dining_zones z ON z.id = t.zone_id
    WHERE z.outlet_id = 'rest-1' AND z.code = 'MAIN'
  ) THEN
    RAISE EXCEPTION 'Main Dining has linked tables; cannot deactivate';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.restaurant_floor_view
WITH (security_invoker = true) AS
SELECT
  t.id AS table_id,
  t.outlet_id,
  t.zone_id AS dining_zone_id,
  z.name AS zone_name,
  z.code AS zone_code,
  t.table_number,
  t.capacity,
  t.status,
  CASE
    WHEN s.id IS NOT NULL
    THEN s.first_name::text || ' ' || s.last_name::text
    ELSE NULL::text
  END AS current_waiter_name,
  t.is_active
FROM public.restaurant_tables t
JOIN public.dining_zones z ON z.id = t.zone_id
LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id;

CREATE OR REPLACE VIEW pali_runtime.restaurant_floor_view
WITH (security_invoker = true) AS
SELECT
  t.id AS table_id,
  t.outlet_id,
  t.zone_id AS dining_zone_id,
  z.name AS zone_name,
  z.code AS zone_code,
  t.table_number,
  t.capacity,
  t.status,
  CASE
    WHEN s.id IS NOT NULL
    THEN s.first_name::text || ' ' || s.last_name::text
    ELSE NULL::text
  END AS current_waiter_name,
  t.is_active
FROM public.restaurant_tables t
JOIN public.dining_zones z ON z.id = t.zone_id
LEFT JOIN public.staff s ON s.id = t.current_waiter_staff_id;

UPDATE public.dining_zones
SET is_active = false
WHERE outlet_id = 'rest-1'
  AND code = 'MAIN'
  AND is_active = true;

INSERT INTO public._schema_migrations(name)
VALUES ('032_floor_visibility_and_zones.sql')
ON CONFLICT (name) DO NOTHING;

COMMIT;
