-- ============================================================================
-- MIGRATION 004: RESTAURANT FLOOR SEED DATA
-- Pali Resort & Club Operations Platform
--
-- Maps verified floor layout from existing resort data (mockData.ts).
-- - rest-1 (Main Dining): 8 tables (4 in Heritage Courtyard AC, 4 in Verandah Garden)
-- - rest-2 (Palm Deck & Bar): 6 tables (4 in Poolside Deck, 2 in Upper Lounge)
--
-- QR SECURITY GUARANTEE:
-- - qr_secret_token_hash stores only 64-char SHA-256 hex hashes.
-- - Plaintext QR secrets are NEVER stored in the database.
-- - Idempotent: Can be safely re-run without duplicate conflicts.
-- ============================================================================

DO $$
DECLARE
  -- rest-1 zones
  v_zone_ac UUID;
  v_zone_vrn UUID;

  -- rest-2 zones
  v_zone_dck UUID;
  v_zone_lng UUID;

BEGIN

  -- 1. RESOLVE DINING ZONE IDS
  SELECT id INTO v_zone_ac FROM public.dining_zones WHERE outlet_id = 'rest-1' AND code = 'ZONE-AC';
  SELECT id INTO v_zone_vrn FROM public.dining_zones WHERE outlet_id = 'rest-1' AND code = 'ZONE-VRN';
  SELECT id INTO v_zone_dck FROM public.dining_zones WHERE outlet_id = 'rest-2' AND code = 'ZONE-DCK';
  SELECT id INTO v_zone_lng FROM public.dining_zones WHERE outlet_id = 'rest-2' AND code = 'ZONE-LNG';

  IF v_zone_ac IS NULL OR v_zone_vrn IS NULL OR v_zone_dck IS NULL OR v_zone_lng IS NULL THEN
    RAISE EXCEPTION 'Seed Aborted: Required dining zones not found. Ensure Migration 001 seed has been run.';
  END IF;

  -- 2. SEED TABLES FOR rest-1: HERITAGE COURTYARD (AC) (T-01 through T-10)
  INSERT INTO public.restaurant_tables (
    outlet_id, zone_id, table_number, capacity, status,
    qr_public_code, qr_secret_token_hash, is_active
  ) VALUES
    ('rest-1', v_zone_ac, 'T-01', 2, 'AVAILABLE', 'PALI-R1-T01', encode(digest('DEV_SEED_QR_SECRET_R1_T01', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-02', 4, 'AVAILABLE', 'PALI-R1-T02', encode(digest('DEV_SEED_QR_SECRET_R1_T02', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-03', 4, 'AVAILABLE', 'PALI-R1-T03', encode(digest('DEV_SEED_QR_SECRET_R1_T03', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-04', 6, 'AVAILABLE', 'PALI-R1-T04', encode(digest('DEV_SEED_QR_SECRET_R1_T04', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-05', 2, 'AVAILABLE', 'PALI-R1-T05', encode(digest('DEV_SEED_QR_SECRET_R1_T05', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-06', 4, 'AVAILABLE', 'PALI-R1-T06', encode(digest('DEV_SEED_QR_SECRET_R1_T06', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-07', 4, 'AVAILABLE', 'PALI-R1-T07', encode(digest('DEV_SEED_QR_SECRET_R1_T07', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-08', 8, 'AVAILABLE', 'PALI-R1-T08', encode(digest('DEV_SEED_QR_SECRET_R1_T08', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-09', 6, 'AVAILABLE', 'PALI-R1-T09', encode(digest('DEV_SEED_QR_SECRET_R1_T09', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_ac, 'T-10', 4, 'AVAILABLE', 'PALI-R1-T10', encode(digest('DEV_SEED_QR_SECRET_R1_T10', 'sha256'), 'hex'), true)
  ON CONFLICT (outlet_id, table_number) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    zone_id = EXCLUDED.zone_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- 3. SEED TABLES FOR rest-1: VERANDAH GARDEN (T-11 through T-20)
  INSERT INTO public.restaurant_tables (
    outlet_id, zone_id, table_number, capacity, status,
    qr_public_code, qr_secret_token_hash, is_active
  ) VALUES
    ('rest-1', v_zone_vrn, 'T-11', 2, 'AVAILABLE', 'PALI-R1-T11', encode(digest('DEV_SEED_QR_SECRET_R1_T11', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-12', 4, 'AVAILABLE', 'PALI-R1-T12', encode(digest('DEV_SEED_QR_SECRET_R1_T12', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-13', 4, 'AVAILABLE', 'PALI-R1-T13', encode(digest('DEV_SEED_QR_SECRET_R1_T13', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-14', 6, 'AVAILABLE', 'PALI-R1-T14', encode(digest('DEV_SEED_QR_SECRET_R1_T14', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-15', 4, 'AVAILABLE', 'PALI-R1-T15', encode(digest('DEV_SEED_QR_SECRET_R1_T15', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-16', 4, 'AVAILABLE', 'PALI-R1-T16', encode(digest('DEV_SEED_QR_SECRET_R1_T16', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-17', 4, 'AVAILABLE', 'PALI-R1-T17', encode(digest('DEV_SEED_QR_SECRET_R1_T17', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-18', 8, 'AVAILABLE', 'PALI-R1-T18', encode(digest('DEV_SEED_QR_SECRET_R1_T18', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-19', 4, 'AVAILABLE', 'PALI-R1-T19', encode(digest('DEV_SEED_QR_SECRET_R1_T19', 'sha256'), 'hex'), true),
    ('rest-1', v_zone_vrn, 'T-20', 6, 'AVAILABLE', 'PALI-R1-T20', encode(digest('DEV_SEED_QR_SECRET_R1_T20', 'sha256'), 'hex'), true)
  ON CONFLICT (outlet_id, table_number) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    zone_id = EXCLUDED.zone_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- 4. SEED TABLES FOR rest-2: POOLSIDE DECK
  INSERT INTO public.restaurant_tables (
    outlet_id, zone_id, table_number, capacity, status,
    qr_public_code, qr_secret_token_hash, is_active
  ) VALUES
    ('rest-2', v_zone_dck, 'OB-01', 2, 'AVAILABLE', 'PALI-R2-OB01', encode(digest('DEV_SEED_QR_SECRET_R2_OB01', 'sha256'), 'hex'), true),
    ('rest-2', v_zone_dck, 'OB-02', 4, 'AVAILABLE', 'PALI-R2-OB02', encode(digest('DEV_SEED_QR_SECRET_R2_OB02', 'sha256'), 'hex'), true),
    ('rest-2', v_zone_dck, 'OB-03', 4, 'AVAILABLE', 'PALI-R2-OB03', encode(digest('DEV_SEED_QR_SECRET_R2_OB03', 'sha256'), 'hex'), true),
    ('rest-2', v_zone_dck, 'OB-04', 6, 'AVAILABLE', 'PALI-R2-OB04', encode(digest('DEV_SEED_QR_SECRET_R2_OB04', 'sha256'), 'hex'), true)
  ON CONFLICT (outlet_id, table_number) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    zone_id = EXCLUDED.zone_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- 5. SEED TABLES FOR rest-2: UPPER SUNSET LOUNGE
  INSERT INTO public.restaurant_tables (
    outlet_id, zone_id, table_number, capacity, status,
    qr_public_code, qr_secret_token_hash, is_active
  ) VALUES
    ('rest-2', v_zone_lng, 'OB-05', 8, 'AVAILABLE', 'PALI-R2-OB05', encode(digest('DEV_SEED_QR_SECRET_R2_OB05', 'sha256'), 'hex'), true),
    ('rest-2', v_zone_lng, 'OB-06', 4, 'AVAILABLE', 'PALI-R2-OB06', encode(digest('DEV_SEED_QR_SECRET_R2_OB06', 'sha256'), 'hex'), true)
  ON CONFLICT (outlet_id, table_number) DO UPDATE SET
    capacity = EXCLUDED.capacity,
    zone_id = EXCLUDED.zone_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- Note: table_assignment_history is an event audit trail; no synthetic history is pre-seeded.

END $$;
