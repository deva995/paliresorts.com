-- ============================================================================
-- MIGRATION 006: ORDERS & ROUNDS VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 3 DOMAIN F TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('orders', 'order_items', 'order_status_history')
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
  AND tc.table_name IN ('orders', 'order_items', 'order_status_history')
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
  AND tc.table_name IN ('orders', 'order_items', 'order_status_history')
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY DELAYED HOTEL PMS COLUMNS EXIST WITHOUT FK TO UNBUILT TABLES
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('hotel_stay_id', 'room_id')
ORDER BY column_name;

-- Confirm no premature foreign keys exist on hotel_stay_id or room_id (EXPECT 0 ROWS)
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'orders'
  AND kcu.column_name IN ('hotel_stay_id', 'room_id');

-- 5. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('orders', 'order_items')
ORDER BY tc.table_name, tc.constraint_name;

-- 5A. CONFIRM order_status_history HAS NO CHECK CONSTRAINTS PER CANONICAL SCHEMA (EXPECT 0 ROWS)
SELECT tc.table_name, tc.constraint_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'order_status_history';

-- 6. VERIFY MONEY & HISTORICAL SNAPSHOT COLUMNS IN order_items
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items'
  AND column_name IN ('item_name_snapshot', 'unit_price_paise', 'gst_rate_snapshot', 'quantity')
ORDER BY ordinal_position;

-- 7. VERIFY INDEXES (INCLUDING PARTIAL UNIQUE ORDER ROUND INDEX)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items', 'order_status_history')
ORDER BY tablename, indexname;

-- 8. VERIFY ROW-LEVEL SECURITY STATUS
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('orders', 'order_items', 'order_status_history')
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
  AND tablename IN ('orders', 'order_items', 'order_status_history')
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN F TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items', 'order_status_history')
  AND qual = 'true';

-- 10. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon must have NO access to ANY Domain F table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_items', 'order_status_history')
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_items', 'order_status_history')
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 11. VERIFY CROSS-OUTLET INTEGRITY (EXPECT 0 ROWS)
-- Restaurant order outlet must match dining session outlet
SELECT o.id AS order_id, o.outlet_id AS order_outlet, ds.outlet_id AS session_outlet
FROM orders o
JOIN dining_sessions ds ON ds.id = o.dining_session_id
WHERE o.outlet_id != ds.outlet_id;

-- 12. VERIFY SOURCE INTEGRITY (EXPECT 0 ROWS)
-- Confirms that order_source respects dining_session_id vs hotel_stay_id/room_id mutual exclusion
SELECT id, order_source, dining_session_id, hotel_stay_id, room_id
FROM orders
WHERE NOT (
  (order_source IN ('CUSTOMER_QR', 'WAITER_POS') AND dining_session_id IS NOT NULL AND hotel_stay_id IS NULL AND room_id IS NULL)
  OR
  (order_source = 'ROOM_SERVICE' AND dining_session_id IS NULL AND hotel_stay_id IS NOT NULL AND room_id IS NOT NULL)
);

-- 13. VERIFY ZERO ORPHANS (EXPECT 0 ROWS)
-- Orphan orders to outlets
SELECT o.id FROM orders o LEFT JOIN outlets outl ON outl.id = o.outlet_id WHERE outl.id IS NULL;
-- Orphan order items to orders
SELECT oi.id FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL;
-- Orphan order items to menu items
SELECT oi.id FROM order_items oi LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE mi.id IS NULL;
-- Orphan status history to orders
SELECT osh.id FROM order_status_history osh LEFT JOIN orders o ON o.id = osh.order_id WHERE o.id IS NULL;

-- 14. RECORD COUNTS SUMMARY (CLEAN BASELINE VERIFICATION)
SELECT 'orders' AS entity, COUNT(*) AS count FROM orders
UNION ALL
SELECT 'order_items' AS entity, COUNT(*) AS count FROM order_items
UNION ALL
SELECT 'order_status_history' AS entity, COUNT(*) AS count FROM order_status_history;
