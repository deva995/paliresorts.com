-- ============================================================================
-- MIGRATION 023: ENSURE 20 RESTAURANT TABLES FOR REST-1
-- Pali Resort & Club Operations Platform
--
-- Ensures target outlet 'rest-1' has exactly 20 active tables (T-01 through T-20).
-- Idempotent: Does NOT overwrite existing table IDs, credentials, assignments,
-- or historical orders.
-- ============================================================================

DO $$
DECLARE
  v_zone_ac UUID;
  v_zone_vrn UUID;
  v_num TEXT;
  v_table_num TEXT;
  v_capacity INT;
  v_target_zone UUID;
  v_qr_public TEXT;
  v_qr_hash TEXT;
  i INT;
BEGIN
  -- 1. Resolve dining zones for rest-1
  SELECT id INTO v_zone_ac FROM public.dining_zones WHERE outlet_id = 'rest-1' AND code = 'ZONE-AC';
  SELECT id INTO v_zone_vrn FROM public.dining_zones WHERE outlet_id = 'rest-1' AND code = 'ZONE-VRN';

  IF v_zone_ac IS NULL OR v_zone_vrn IS NULL THEN
    -- Fallback: find any active zone for rest-1
    SELECT id INTO v_zone_ac FROM public.dining_zones WHERE outlet_id = 'rest-1' ORDER BY display_order ASC LIMIT 1;
    v_zone_vrn := v_zone_ac;
  END IF;

  IF v_zone_ac IS NULL THEN
    RAISE NOTICE 'Zone not found for rest-1, skipping table insertion';
    RETURN;
  END IF;

  -- 2. Ensure tables T-01 through T-20 exist idempotently
  FOR i IN 1..20 LOOP
    v_num := lpad(i::text, 2, '0');
    v_table_num := 'T-' || v_num;
    v_qr_public := 'PALI-R1-T' || v_num;
    v_qr_hash := encode(gen_random_bytes(32), 'hex');

    -- Assign first 10 tables to AC Courtyard, next 10 to Verandah Garden
    IF i <= 10 THEN
      v_target_zone := v_zone_ac;
    ELSE
      v_target_zone := v_zone_vrn;
    END IF;

    -- Standard capacities: 2, 4, 6, 8 pax
    IF i IN (1, 5, 11) THEN
      v_capacity := 2;
    ELSIF i IN (4, 9, 14, 20) THEN
      v_capacity := 6;
    ELSIF i IN (8, 18) THEN
      v_capacity := 8;
    ELSE
      v_capacity := 4;
    END IF;

    INSERT INTO public.restaurant_tables (
      outlet_id, zone_id, table_number, capacity, status,
      qr_public_code, qr_secret_token_hash, is_active
    ) VALUES (
      'rest-1', v_target_zone, v_table_num, v_capacity, 'AVAILABLE',
      v_qr_public, v_qr_hash, true
    )
    ON CONFLICT (outlet_id, table_number) DO UPDATE SET
      is_active = true,
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;

END $$;
