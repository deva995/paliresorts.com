-- ============================================================================
-- MIGRATION 004: RESTAURANT FLOOR VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY FLOOR TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('restaurant_tables', 'table_assignment_history')
ORDER BY table_name;

-- 2. VERIFY SAFE FLOOR VIEW EXISTS
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'restaurant_floor_view';

-- 2A. VERIFY COLUMNS IN SAFE FLOOR VIEW
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'restaurant_floor_view'
ORDER BY ordinal_position;

-- 2B. ASSERT ZERO QR SECRETS OR TOKEN HASHES IN FLOOR VIEW (EXPECT 0 ROWS)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'restaurant_floor_view'
  AND column_name IN ('qr_secret_token_hash', 'qr_secret', 'secret', 'token');

-- 2C. ASSERT NO PLAINTEXT QR SECRET COLUMN EXISTS IN BASE TABLES (EXPECT 0 ROWS)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'restaurant_tables'
  AND column_name IN ('qr_secret', 'secret_token', 'plaintext_secret');

-- 2D. VERIFY VIEW PERMISSIONS (anon MUST HAVE ZERO ACCESS; authenticated MUST HAVE SELECT)
SELECT 
  grantee, 
  table_name, 
  privilege_type,
  CASE 
    WHEN grantee = 'anon' THEN 'FAIL - anon must not have access'
    WHEN grantee = 'authenticated' AND privilege_type = 'SELECT' THEN 'PASS'
    ELSE 'OK'
  END AS status
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'restaurant_floor_view';

-- 2E. VERIFY authenticated CANNOT SELECT qr_secret_token_hash OR qr_public_code DIRECTLY (EXPECT 0 ROWS)
SELECT 
  grantee, 
  table_name, 
  column_name, 
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'restaurant_tables'
  AND column_name IN ('qr_secret_token_hash', 'qr_public_code')
  AND grantee IN ('authenticated', 'anon', 'public');

-- 2F. VERIFY DIRECT ACCESS TO table_assignment_history IS REVOKED (EXPECT 0 ROWS FOR authenticated/anon/public)
SELECT 
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'table_assignment_history'
  AND grantee IN ('authenticated', 'anon', 'public');

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
  AND tc.table_name IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tc.table_name, kc.ordinal_position;

-- 4. VERIFY FOREIGN KEYS & DELETE BEHAVIORS
SELECT
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_schema AS target_schema,
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
  AND tc.table_name IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tc.table_name, kcu.column_name;

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
  AND tc.table_name IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tc.table_name, tc.constraint_name;

-- 6. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tc.table_name;

-- 7. VERIFY INDEXES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tablename, indexname;

-- 8. VERIFY ROW-LEVEL SECURITY STATUS
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('restaurant_tables', 'table_assignment_history')
ORDER BY relname;

-- 9. VERIFY INSTALLED RLS POLICIES (FROM pg_policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_tables', 'table_assignment_history')
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICY REMAINS ON MIGRATION 004 TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_tables', 'table_assignment_history')
  AND qual = 'true';

-- 10. VERIFY CROSS-OUTLET & ZONE INTEGRITY (EXPECT 0 ROWS)
-- Table must belong to the exact same outlet as its dining zone
SELECT 
  t.id AS table_id,
  t.table_number,
  t.outlet_id AS table_outlet,
  z.outlet_id AS zone_outlet
FROM restaurant_tables t
JOIN dining_zones z ON z.id = t.zone_id
WHERE t.outlet_id != z.outlet_id;

-- 11. VERIFY ZERO ORPHAN RECORDS (EXPECT 0 ROWS)
-- Orphan tables to outlets
SELECT t.id, t.outlet_id FROM restaurant_tables t
LEFT JOIN outlets o ON o.id = t.outlet_id
WHERE o.id IS NULL;

-- Orphan tables to zones
SELECT t.id, t.zone_id FROM restaurant_tables t
LEFT JOIN dining_zones z ON z.id = t.zone_id
WHERE z.id IS NULL;

-- Orphan assignments to tables
SELECT h.id, h.table_id FROM table_assignment_history h
LEFT JOIN restaurant_tables t ON t.id = h.table_id
WHERE t.id IS NULL;

-- Orphan assignments to waiters
SELECT h.id, h.waiter_staff_id FROM table_assignment_history h
LEFT JOIN staff s ON s.id = h.waiter_staff_id
WHERE s.id IS NULL;

-- 12. VERIFY SEED COUNTS BY OUTLET
SELECT outlet_id, COUNT(*) AS table_count 
FROM restaurant_tables 
GROUP BY outlet_id 
ORDER BY outlet_id;

-- 13. VERIFY SEED COUNTS BY DINING ZONE
SELECT 
  t.outlet_id,
  z.code AS zone_code,
  z.name AS zone_name,
  COUNT(t.id) AS table_count
FROM restaurant_tables t
JOIN dining_zones z ON z.id = t.zone_id
GROUP BY t.outlet_id, z.code, z.name
ORDER BY t.outlet_id, z.code;

-- 14. RECORD COUNTS SUMMARY
SELECT 'restaurant_tables' AS entity, COUNT(*) AS count FROM restaurant_tables
UNION ALL
SELECT 'restaurant_tables (rest-1)' AS entity, COUNT(*) AS count FROM restaurant_tables WHERE outlet_id = 'rest-1'
UNION ALL
SELECT 'restaurant_tables (rest-2)' AS entity, COUNT(*) AS count FROM restaurant_tables WHERE outlet_id = 'rest-2'
UNION ALL
SELECT 'table_assignment_history' AS entity, COUNT(*) AS count FROM table_assignment_history;
