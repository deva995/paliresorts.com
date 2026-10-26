-- ============================================================================
-- MIGRATION 010: DISCOUNTS & APPROVALS VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 3 DOMAIN I TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
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
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 3. VERIFY FOREIGN KEYS & RESTRICTIVE DELETE BEHAVIORS (INCLUDING DELAYED FK)
SELECT
  tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column,
  rc.delete_rule,
  tc.constraint_name
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
  AND (
    tc.table_name IN (
      'discount_reason_codes', 
      'approval_requests', 
      'approval_actions'
    )
    OR tc.constraint_name = 'fk_bills_discount_reason'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. DELAYED FK VERIFICATION: bills.discount_reason_id -> discount_reason_codes(id) (EXPECT 1 ROW)
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
  AND tc.constraint_name = 'fk_bills_discount_reason';

-- 4A. VERIFY EXISTING COVERING INDEX ON bills(discount_reason_id) (EXPECT 1 ROW)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'bills'
  AND indexname = 'idx_bills_reason';

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
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
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
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 7. EXACT MONETARY & PERCENTAGE TYPE AUDIT (EXPECTED VS ACTUAL)
SELECT 
  c.table_name,
  c.column_name,
  c.data_type AS actual_data_type,
  CASE 
    WHEN c.column_name = 'discount_percent' THEN 'numeric'
    ELSE 'bigint'
  END AS expected_data_type,
  CASE 
    WHEN c.column_name = 'discount_percent' AND c.data_type = 'numeric' THEN 'PASS'
    WHEN c.column_name != 'discount_percent' AND c.data_type = 'bigint' THEN 'PASS'
    ELSE 'FAIL'
  END AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND (
    c.column_name LIKE '%paise%' 
    OR c.column_name LIKE '%percent%' 
    OR c.column_name LIKE '%amount%'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 7A. FLOATING-POINT SAFETY: ASSERT ZERO FLOATING POINT COLUMNS (EXPECT 0 ROWS)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND data_type IN ('real', 'double precision', 'float');

-- 8. VERIFY INDEXES (COMPLETE FOREIGN KEY & HOT-PATH COVERAGE)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY tablename, indexname;

-- 9. VERIFY ROW-LEVEL SECURITY STATUS (ALL 3 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY relname;

-- 10. VERIFY INSTALLED RLS POLICIES (FROM pg_policies)
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
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY tablename, policyname;

-- 10A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN I TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND qual = 'true';

-- 10B. ASSERT PERMISSION ENFORCEMENT ACROSS ALL 3 POLICIES (EXPECT 3 ROWS)
SELECT 
  tablename, 
  policyname,
  CASE 
    WHEN tablename = 'discount_reason_codes' 
         AND qual LIKE '%is_active%' 
         AND qual LIKE '%has_permission%'
         AND qual LIKE '%bill:view%'
         AND qual LIKE '%bill:apply_discount%' THEN 'PASS'
    WHEN tablename IN ('approval_requests', 'approval_actions') 
         AND qual LIKE '%has_outlet_access%' 
         AND qual LIKE '%bill:view%' 
         AND qual LIKE '%bill:apply_discount%' THEN 'PASS'
    ELSE 'FAIL'
  END AS permission_enforcement
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
ORDER BY tablename;

-- 11. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon and public must have NO access to ANY Domain I table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 11A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 12 ROWS: 4 privileges across 3 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'discount_reason_codes', 
    'approval_requests', 
    'approval_actions'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 12. ZERO ORPHAN INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan discount reasons to properties
SELECT drc.id FROM discount_reason_codes drc LEFT JOIN properties p ON p.id = drc.property_id WHERE p.id IS NULL;
-- Orphan approval requests to outlets
SELECT ar.id FROM approval_requests ar LEFT JOIN outlets o ON o.id = ar.outlet_id WHERE o.id IS NULL;
-- Orphan approval requests to bills (when linked)
SELECT ar.id FROM approval_requests ar LEFT JOIN bills b ON b.id = ar.bill_id WHERE ar.bill_id IS NOT NULL AND b.id IS NULL;
-- Orphan approval requests to orders (when linked)
SELECT ar.id FROM approval_requests ar LEFT JOIN orders o ON o.id = ar.order_id WHERE ar.order_id IS NOT NULL AND o.id IS NULL;
-- Orphan approval requests to reasons
SELECT ar.id FROM approval_requests ar LEFT JOIN discount_reason_codes drc ON drc.id = ar.reason_code_id WHERE drc.id IS NULL;
-- Orphan approval requests to requesting staff
SELECT ar.id FROM approval_requests ar LEFT JOIN staff s ON s.id = ar.requested_by_staff_id WHERE s.id IS NULL;
-- Orphan approval actions to requests
SELECT aa.id FROM approval_actions aa LEFT JOIN approval_requests ar ON ar.id = aa.request_id WHERE ar.id IS NULL;
-- Orphan approval actions to actor staff
SELECT aa.id FROM approval_actions aa LEFT JOIN staff s ON s.id = aa.actor_staff_id WHERE s.id IS NULL;
-- Orphan bills to discount reason codes (when linked)
SELECT b.id FROM bills b LEFT JOIN discount_reason_codes drc ON drc.id = b.discount_reason_id WHERE b.discount_reason_id IS NOT NULL AND drc.id IS NULL;

-- 13. CROSS-OUTLET INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Approval request outlet must match bill outlet (when bill linked)
SELECT ar.id AS request_id, ar.outlet_id AS request_outlet, b.outlet_id AS bill_outlet
FROM approval_requests ar
JOIN bills b ON b.id = ar.bill_id
WHERE ar.outlet_id != b.outlet_id;

-- Approval request outlet must match order outlet (when order linked)
SELECT ar.id AS request_id, ar.outlet_id AS request_outlet, o.outlet_id AS order_outlet
FROM approval_requests ar
JOIN orders o ON o.id = ar.order_id
WHERE ar.outlet_id != o.outlet_id;

-- 14. RECORD COUNTS SUMMARY (CLEAN BASELINE: 0 across all tables)
SELECT 'discount_reason_codes' AS entity, COUNT(*) AS count FROM discount_reason_codes
UNION ALL
SELECT 'approval_requests' AS entity, COUNT(*) AS count FROM approval_requests
UNION ALL
SELECT 'approval_actions' AS entity, COUNT(*) AS count FROM approval_actions;
