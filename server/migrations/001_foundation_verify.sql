-- ============================================================================
-- MIGRATION 001: FOUNDATION VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY REQUIRED EXTENSIONS
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pgcrypto';

-- 2. VERIFY FOUNDATION TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY table_name;

-- 3. VERIFY PRIMARY KEYS
SELECT 
  tc.table_name, 
  kc.column_name, 
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
  ON tc.constraint_name = kc.constraint_name 
  AND tc.table_schema = kc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY tc.table_name;

-- 4. VERIFY FOREIGN KEYS
SELECT
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY tc.table_name;

-- 5. VERIFY UNIQUE CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY tc.table_name;

-- 6. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY tc.table_name;

-- 7. VERIFY INDEXES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'outlets', 'outlet_settings', 'outlet_counters', 'dining_zones')
ORDER BY tablename, indexname;

-- 8. VERIFY SEED RECORDS
-- Seed Property
SELECT id, name, gstin, fssai_license_number, currency 
FROM properties;

-- Seed Outlets
SELECT id, property_id, name, outlet_type, invoice_series_prefix, is_active 
FROM outlets 
ORDER BY id;

-- Seed Settings
SELECT 
  outlet_id, 
  default_gst_rate_percent, 
  cgst_rate_percent, 
  sgst_rate_percent, 
  service_charge_percent, 
  manager_max_discount_paise,
  discount_gst_treatment
FROM outlet_settings 
ORDER BY outlet_id;

-- Seed Dining Zones
SELECT id, outlet_id, name, code, display_order, is_active 
FROM dining_zones 
ORDER BY outlet_id, display_order;

-- 9. RECORD COUNTS SUMMARY
SELECT 'properties' AS entity, COUNT(*) AS count FROM properties
UNION ALL
SELECT 'outlets' AS entity, COUNT(*) AS count FROM outlets
UNION ALL
SELECT 'outlet_settings' AS entity, COUNT(*) AS count FROM outlet_settings
UNION ALL
SELECT 'outlet_counters' AS entity, COUNT(*) AS count FROM outlet_counters
UNION ALL
SELECT 'dining_zones' AS entity, COUNT(*) AS count FROM dining_zones;
