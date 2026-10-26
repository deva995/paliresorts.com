-- ============================================================================
-- MIGRATION 011: HOUSEKEEPING & MAINTENANCE VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 3 DOMAIN K TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
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
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 3. VERIFY FOREIGN KEYS & DELETE BEHAVIORS
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
  AND tc.table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 5. AUDIT MONETARY & FLOATING-POINT TYPES (EXPECT ZERO FLOAT/REAL/DOUBLE IN DOMAIN K)
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
  AND data_type IN ('real', 'double precision', 'float')
ORDER BY table_name, column_name;

-- 6. VERIFY 100% FOREIGN KEY INDEX COVERAGE
WITH fk_columns AS (
  SELECT 
    tc.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN (
      'housekeeping_tasks', 
      'room_status_history', 
      'maintenance_issues'
    )
),
indexed_columns AS (
  SELECT 
    t.relname AS table_name,
    a.attname AS column_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
  WHERE n.nspname = 'public'
    AND t.relname IN (
      'housekeeping_tasks', 
      'room_status_history', 
      'maintenance_issues'
    )
)
SELECT 
  fk.table_name,
  fk.column_name,
  CASE 
    WHEN idx.column_name IS NOT NULL THEN 'COVERED'
    ELSE 'UNINDEXED'
  END AS index_status
FROM fk_columns fk
LEFT JOIN indexed_columns idx 
  ON fk.table_name = idx.table_name 
  AND fk.column_name = idx.column_name
ORDER BY fk.table_name, fk.column_name;

-- 7. AUDIT INSTALLED INDEXES ON DOMAIN K TABLES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tablename, indexname;

-- 8. VERIFY ROW-LEVEL SECURITY STATUS (ALL 3 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY relname;

-- 9. VERIFY INSTALLED RLS POLICIES
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
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN K TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
  AND qual = 'true';

-- 9B. ASSERT CAPABILITY & SCOPING ENFORCEMENT ACROSS ALL 3 POLICIES (EXPECT 3 ROWS)
-- Note: Room-linked entities enforce capability-based authorization (housekeeping:view, hotel:view)
-- under the current single-property architecture. Dedicated staff_property_access mapping is a
-- documented future requirement for multi-property deployments.
SELECT 
  tablename, 
  policyname,
  CASE 
    WHEN tablename = 'housekeeping_tasks' 
         AND qual LIKE '%housekeeping:view%' 
         AND qual LIKE '%hotel:view%' THEN 'PASS'
    WHEN tablename = 'room_status_history' 
         AND qual LIKE '%housekeeping:view%' 
         AND qual LIKE '%hotel:view%' THEN 'PASS'
    WHEN tablename = 'maintenance_issues' 
         AND qual LIKE '%housekeeping:view%' 
         AND qual LIKE '%has_outlet_access%'
         AND qual LIKE '%room_id IS NOT NULL%' THEN 'PASS'
    ELSE 'FAIL'
  END AS permission_enforcement
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
ORDER BY tablename;

-- 10. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon and public must have NO access to ANY Domain K table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 10A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 12 ROWS: 4 privileges across 3 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'housekeeping_tasks', 
    'room_status_history', 
    'maintenance_issues'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 11. ZERO ORPHAN INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan housekeeping tasks to rooms
SELECT ht.id FROM housekeeping_tasks ht LEFT JOIN hotel_rooms hr ON hr.id = ht.room_id WHERE hr.id IS NULL;
-- Orphan housekeeping tasks to assigned staff (when assigned)
SELECT ht.id FROM housekeeping_tasks ht LEFT JOIN staff s ON s.id = ht.assigned_staff_id WHERE ht.assigned_staff_id IS NOT NULL AND s.id IS NULL;
-- Orphan housekeeping tasks to inspecting staff (when inspected)
SELECT ht.id FROM housekeeping_tasks ht LEFT JOIN staff s ON s.id = ht.inspected_by_staff_id WHERE ht.inspected_by_staff_id IS NOT NULL AND s.id IS NULL;
-- Orphan room status history to rooms
SELECT rsh.id FROM room_status_history rsh LEFT JOIN hotel_rooms hr ON hr.id = rsh.room_id WHERE hr.id IS NULL;
-- Orphan room status history to staff
SELECT rsh.id FROM room_status_history rsh LEFT JOIN staff s ON s.id = rsh.changed_by_staff_id WHERE s.id IS NULL;
-- Orphan maintenance issues to rooms (when room linked)
SELECT mi.id FROM maintenance_issues mi LEFT JOIN hotel_rooms hr ON hr.id = mi.room_id WHERE mi.room_id IS NOT NULL AND hr.id IS NULL;
-- Orphan maintenance issues to outlets (when outlet linked)
SELECT mi.id FROM maintenance_issues mi LEFT JOIN outlets o ON o.id = mi.outlet_id WHERE mi.outlet_id IS NOT NULL AND o.id IS NULL;
-- Orphan maintenance issues to reporting staff
SELECT mi.id FROM maintenance_issues mi LEFT JOIN staff s ON s.id = mi.reported_by_staff_id WHERE s.id IS NULL;
-- Orphan maintenance issues to resolving staff (when resolved)
SELECT mi.id FROM maintenance_issues mi LEFT JOIN staff s ON s.id = mi.resolved_by_staff_id WHERE mi.resolved_by_staff_id IS NOT NULL AND s.id IS NULL;

-- 12. RECORD COUNTS SUMMARY (CLEAN BASELINE: 0 across all tables)
SELECT 'housekeeping_tasks' AS entity, COUNT(*) AS count FROM housekeeping_tasks
UNION ALL
SELECT 'room_status_history' AS entity, COUNT(*) AS count FROM room_status_history
UNION ALL
SELECT 'maintenance_issues' AS entity, COUNT(*) AS count FROM maintenance_issues;
