-- ============================================================================
-- MIGRATION 007: KITCHEN DISPLAY SYSTEM (KDS) VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 4 DOMAIN G TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY table_name;

-- 2. VERIFY PRIMARY KEYS
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
  AND tc.table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 3. VERIFY FOREIGN KEYS & RESTRICTIVE DELETE BEHAVIORS
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
  AND tc.table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY CANONICAL UNIQUE CONSTRAINTS (ONLY uq_kitchen_stations_outlet_code)
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
  AND tc.table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 4A. VERIFY KOT NUMBER ARCHITECTURE:
-- Assert no premature UNIQUE constraint on kots(kot_number) or kots(outlet_id, kot_number)
-- because daily KOT numbers repeat daily across dates and are partitioned via outlet_counters (EXPECT 0 ROWS)
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'kots'
  AND kcu.column_name = 'kot_number';

-- 4B. VERIFY DUPLICATE KOT-ITEM PROTECTION ARCHITECTURE:
-- Assert no premature UNIQUE constraint on kot_items(order_item_id) or kot_items(kot_id, order_item_id)
-- per canonical Table 30 design where culinary re-fires / splits are permitted (EXPECT 0 ROWS)
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'kot_items'
  AND kcu.column_name = 'order_item_id';

-- 5. VERIFY CHECK CONSTRAINTS (EXACT KOT AND KOT-ITEM STATUS CHECKS)
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('kots', 'kot_items')
ORDER BY tc.table_name, tc.constraint_name;

-- 5A. CONFIRM kot_status_history AND kitchen_stations HAVE NO CHECK CONSTRAINTS PER CANONICAL SCHEMA (EXPECT 0 ROWS)
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('kitchen_stations', 'kot_status_history');

-- 6. VERIFY INDEXES (CONFIRM idx_kots_station_status EXISTS AND REDUNDANT idx_kots_outlet IS ABSENT)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY tablename, indexname;

-- 6A. ASSERT REDUNDANT idx_kots_outlet IS ABSENT (EXPECT 0 ROWS)
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'kots' 
  AND indexname = 'idx_kots_outlet';

-- 7. VERIFY ROW-LEVEL SECURITY STATUS (ALL 4 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY relname;

-- 8. VERIFY INSTALLED RLS POLICIES (FROM pg_policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
ORDER BY tablename, policyname;

-- 8A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN G TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
  AND qual = 'true';

-- 8B. ASSERT kds:view PERMISSION IS ENFORCED IN POLICIES FOR kots, kot_items, kot_status_history (EXPECT 3 ROWS)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('kots', 'kot_items', 'kot_status_history')
  AND qual LIKE '%kds:view%';

-- 9. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon must have NO access to ANY Domain G table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'kitchen_stations', 
    'kots', 
    'kot_items', 
    'kot_status_history'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 10. VERIFY CROSS-OUTLET INTEGRITY (EXPECT 0 ROWS)
-- KOT outlet must match parent order outlet
SELECT k.id AS kot_id, k.outlet_id AS kot_outlet, o.outlet_id AS order_outlet
FROM kots k
JOIN orders o ON o.id = k.order_id
WHERE k.outlet_id != o.outlet_id;

-- KOT outlet must match kitchen station outlet
SELECT k.id AS kot_id, k.outlet_id AS kot_outlet, ks.outlet_id AS station_outlet
FROM kots k
JOIN kitchen_stations ks ON ks.id = k.station_id
WHERE k.outlet_id != ks.outlet_id;

-- KOT item order must match parent KOT order
SELECT ki.id AS kot_item_id, k.order_id AS kot_order, oi.order_id AS item_order
FROM kot_items ki
JOIN kots k ON k.id = ki.kot_id
JOIN order_items oi ON oi.id = ki.order_item_id
WHERE k.order_id != oi.order_id;

-- 11. VERIFY ZERO ORPHANS (EXPECT 0 ROWS)
-- Orphan stations to outlets
SELECT ks.id FROM kitchen_stations ks LEFT JOIN outlets o ON o.id = ks.outlet_id WHERE o.id IS NULL;
-- Orphan KOTs to orders
SELECT k.id FROM kots k LEFT JOIN orders o ON o.id = k.order_id WHERE o.id IS NULL;
-- Orphan KOTs to stations
SELECT k.id FROM kots k LEFT JOIN kitchen_stations ks ON ks.id = k.station_id WHERE ks.id IS NULL;
-- Orphan KOT items to KOTs
SELECT ki.id FROM kot_items ki LEFT JOIN kots k ON k.id = ki.kot_id WHERE k.id IS NULL;
-- Orphan KOT items to order items
SELECT ki.id FROM kot_items ki LEFT JOIN order_items oi ON oi.id = ki.order_item_id WHERE oi.id IS NULL;
-- Orphan status history to KOTs
SELECT ksh.id FROM kot_status_history ksh LEFT JOIN kots k ON k.id = ksh.kot_id WHERE k.id IS NULL;

-- 12. VERIFY KITCHEN STATIONS SEED COUNTS BY OUTLET
SELECT outlet_id, COUNT(*) AS station_count
FROM kitchen_stations
GROUP BY outlet_id
ORDER BY outlet_id;

-- 13. RECORD COUNTS SUMMARY (CLEAN BASELINE VERIFICATION)
SELECT 'kitchen_stations' AS entity, COUNT(*) AS count FROM kitchen_stations
UNION ALL
SELECT 'kitchen_stations (rest-1)' AS entity, COUNT(*) AS count FROM kitchen_stations WHERE outlet_id = 'rest-1'
UNION ALL
SELECT 'kitchen_stations (rest-2)' AS entity, COUNT(*) AS count FROM kitchen_stations WHERE outlet_id = 'rest-2'
UNION ALL
SELECT 'kots' AS entity, COUNT(*) AS count FROM kots
UNION ALL
SELECT 'kot_items' AS entity, COUNT(*) AS count FROM kot_items
UNION ALL
SELECT 'kot_status_history' AS entity, COUNT(*) AS count FROM kot_status_history;
