-- ============================================================================
-- MIGRATION 005: CUSTOMERS & DINING SESSIONS VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 4 DOMAIN E TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
ORDER BY table_name;

-- 2. VERIFY CIRCULAR DELAYED FK ON restaurant_tables EXISTS
SELECT
  tc.constraint_name,
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
  AND tc.constraint_name = 'fk_tables_active_session';

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
  AND tc.table_name IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 4. VERIFY FOREIGN KEYS & RESTRICTIVE DELETE BEHAVIORS
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
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
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
  AND tc.table_name IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
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
  AND tc.table_name IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
ORDER BY tc.table_name;

-- 7. VERIFY INDEXES (INCLUDING PARTIAL UNIQUE ACTIVE SESSION INDEX)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
ORDER BY tablename, indexname;

-- 8. VERIFY ROW-LEVEL SECURITY STATUS
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
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
  AND tablename IN (
    'customers', 
    'dining_sessions', 
    'guest_session_tokens', 
    'service_requests'
  )
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN E TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'dining_sessions', 'guest_session_tokens', 'service_requests')
  AND qual = 'true';

-- 9B. ASSERT NO RLS POLICY EXISTS ON BACKEND-ONLY TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'guest_session_tokens');

-- 10. VERIFY CLIENT PRIVILEGE ISOLATION (ZERO DIRECT ACCESS ON SENSITIVE TABLES)
-- customers and guest_session_tokens must have NO access for authenticated, anon, or public (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'guest_session_tokens')
  AND grantee IN ('authenticated', 'anon', 'public');

-- anon and public must have NO access to ANY Domain E table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'dining_sessions', 'guest_session_tokens', 'service_requests')
  AND grantee IN ('anon', 'public');

-- 11. VERIFY NO PLAINTEXT CREDENTIALS/OTPS IN SCHEMA (EXPECT 0 ROWS)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'dining_sessions', 'guest_session_tokens', 'service_requests')
  AND column_name IN ('otp', 'raw_otp', 'plaintext_otp', 'token', 'raw_token', 'password', 'pin');

-- 12. VERIFY TOKEN SECURITY FIELDS EXIST
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guest_session_tokens'
  AND column_name IN ('token_hash', 'otp_hash', 'otp_expires_at', 'otp_attempts', 'is_revoked', 'expires_at')
ORDER BY ordinal_position;

-- 13. VERIFY CROSS-OUTLET INTEGRITY (EXPECT 0 ROWS)
-- Dining session outlet must match physical table outlet
SELECT ds.id AS session_id, ds.outlet_id AS session_outlet, rt.outlet_id AS table_outlet
FROM dining_sessions ds
JOIN restaurant_tables rt ON rt.id = ds.table_id
WHERE ds.outlet_id != rt.outlet_id;

-- Service request outlet must match physical table outlet
SELECT sr.id AS request_id, sr.outlet_id AS request_outlet, rt.outlet_id AS table_outlet
FROM service_requests sr
JOIN restaurant_tables rt ON rt.id = sr.table_id
WHERE sr.outlet_id != rt.outlet_id;

-- Service request table must match dining session table (EXPECT 0 ROWS)
SELECT sr.id AS request_id, sr.table_id AS request_table, ds.table_id AS session_table
FROM service_requests sr
JOIN dining_sessions ds ON ds.id = sr.dining_session_id
WHERE sr.table_id != ds.table_id;

-- 14. VERIFY ZERO ORPHANS (EXPECT 0 ROWS)
-- Orphan sessions to outlets
SELECT ds.id FROM dining_sessions ds LEFT JOIN outlets o ON o.id = ds.outlet_id WHERE o.id IS NULL;
-- Orphan sessions to tables
SELECT ds.id FROM dining_sessions ds LEFT JOIN restaurant_tables rt ON rt.id = ds.table_id WHERE rt.id IS NULL;
-- Orphan tokens to sessions
SELECT gst.id FROM guest_session_tokens gst LEFT JOIN dining_sessions ds ON ds.id = gst.dining_session_id WHERE ds.id IS NULL;
-- Orphan requests to sessions
SELECT sr.id FROM service_requests sr LEFT JOIN dining_sessions ds ON ds.id = sr.dining_session_id WHERE ds.id IS NULL;

-- 15. RECORD COUNTS SUMMARY (CLEAN STATE VERIFICATION)
SELECT 'customers' AS entity, COUNT(*) AS count FROM customers
UNION ALL
SELECT 'dining_sessions' AS entity, COUNT(*) AS count FROM dining_sessions
UNION ALL
SELECT 'guest_session_tokens' AS entity, COUNT(*) AS count FROM guest_session_tokens
UNION ALL
SELECT 'service_requests' AS entity, COUNT(*) AS count FROM service_requests;
