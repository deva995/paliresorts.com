-- ============================================================================
-- MIGRATION 013: AUDIT, REALTIME & IDEMPOTENCY VERIFICATION (READ-ONLY)
-- FINAL SCHEMA VERIFICATION: 57 OF 57 CANONICAL TABLES
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 3 DOMAIN N TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY table_name;

-- 2. VERIFY PRIMARY KEYS & DATA TYPES (INSPECTING BIGSERIAL EXCEPTION)
SELECT 
  tc.table_name, 
  kc.column_name, 
  c.data_type,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
  ON tc.constraint_name = kc.constraint_name 
  AND tc.table_schema = kc.table_schema
JOIN information_schema.columns c
  ON c.table_name = tc.table_name
  AND c.column_name = kc.column_name
  AND c.table_schema = tc.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY tc.table_name;

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
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY UNIQUE CONSTRAINTS
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
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 5. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY tc.table_name, tc.constraint_name;

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
      'idempotency_keys', 
      'outlet_event_log', 
      'audit_logs'
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
      'idempotency_keys', 
      'outlet_event_log', 
      'audit_logs'
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

-- 7. AUDIT INSTALLED INDEXES ON DOMAIN N TABLES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
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
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY relname;

-- 9. VERIFY INSTALLED RLS POLICIES & BACKEND-ONLY POLICY COUNTS
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
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN N TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
  AND qual = 'true';

-- 9B. ASSERT OUTLET SCOPE ENFORCEMENT ON REALTIME EVENT STREAM (EXPECT 1 ROW)
SELECT 
  tablename, 
  policyname,
  CASE 
    WHEN qual LIKE '%has_outlet_access%' THEN 'PASS'
    ELSE 'FAIL'
  END AS outlet_scoping
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'outlet_event_log';

-- 10. VERIFY CLIENT PRIVILEGE ISOLATION (anon, public, authenticated)
-- anon and public must have NO access to ANY Domain N table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ZERO privileges on backend-only tables (idempotency_keys, audit_logs) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('idempotency_keys', 'audit_logs')
  AND grantee = 'authenticated';

-- authenticated must have ONLY SELECT privilege on outlet_event_log (EXPECT 0 ROWS for mutations)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'outlet_event_log'
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 10A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 12 ROWS: 4 privileges across 3 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'idempotency_keys', 
    'outlet_event_log', 
    'audit_logs'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 11. ZERO ORPHAN INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan idempotency keys to outlets
SELECT ik.id FROM idempotency_keys ik LEFT JOIN outlets o ON o.id = ik.outlet_id WHERE ik.outlet_id IS NOT NULL AND o.id IS NULL;
-- Orphan idempotency keys to staff
SELECT ik.id FROM idempotency_keys ik LEFT JOIN staff s ON s.id = ik.actor_staff_id WHERE ik.actor_staff_id IS NOT NULL AND s.id IS NULL;
-- Orphan event logs to outlets
SELECT el.sequence_number FROM outlet_event_log el LEFT JOIN outlets o ON o.id = el.outlet_id WHERE o.id IS NULL;
-- Orphan audit logs to outlets
SELECT al.id FROM audit_logs al LEFT JOIN outlets o ON o.id = al.outlet_id WHERE al.outlet_id IS NOT NULL AND o.id IS NULL;

-- ============================================================================
-- 12. FULL 57-TABLE CANONICAL COMPLETION AUDIT (READ-ONLY)
-- ============================================================================
WITH canonical_57_tables(table_name) AS (
  VALUES
    -- Domain A (1-5)
    ('properties'), ('outlets'), ('outlet_settings'), ('outlet_counters'), ('dining_zones'),
    -- Domain B (6-13)
    ('staff'), ('roles'), ('permissions'), ('role_permissions'), ('staff_roles'),
    ('staff_outlet_access'), ('staff_shifts'), ('duty_roster'),
    -- Domain C (14-18)
    ('menu_categories'), ('menu_items'), ('outlet_menu_items'), ('menu_item_revisions'),
    ('menu_revision_approvals'),
    -- Domain D (19-20)
    ('restaurant_tables'), ('table_assignment_history'),
    -- Domain E (21-24)
    ('customers'), ('dining_sessions'), ('guest_session_tokens'), ('service_requests'),
    -- Domain F (25-27)
    ('orders'), ('order_items'), ('order_status_history'),
    -- Domain G (28-31)
    ('kitchen_stations'), ('kots'), ('kot_items'), ('kot_status_history'),
    -- Domain H (32-36)
    ('bills'), ('bill_items'), ('payments'), ('payment_allocations'), ('refunds'),
    -- Domain I (37-39)
    ('discount_reason_codes'), ('approval_requests'), ('approval_actions'),
    -- Domain J (40-45)
    ('hotel_rooms'), ('hotel_guests'), ('hotel_reservations'), ('hotel_stays'),
    ('room_folios'), ('folio_charges'),
    -- Domain K (46-48)
    ('housekeeping_tasks'), ('room_status_history'), ('maintenance_issues'),
    -- Domain M (49-54)
    ('inventory_items'), ('inventory_locations'), ('inventory_balances'),
    ('inventory_movements'), ('recipes'), ('recipe_ingredients'),
    -- Domain N (55-57)
    ('idempotency_keys'), ('outlet_event_log'), ('audit_logs')
),
actual_tables AS (
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
)
SELECT 
  COUNT(c.table_name) AS total_canonical_expected,
  COUNT(a.table_name) AS total_canonical_found,
  CASE 
    WHEN COUNT(c.table_name) = COUNT(a.table_name) AND COUNT(c.table_name) = 57 THEN 'COMPLETE (57/57)'
    ELSE 'INCOMPLETE'
  END AS platform_status
FROM canonical_57_tables c
LEFT JOIN actual_tables a ON a.table_name = c.table_name;

-- 12A. REPORT ANY MISSING CANONICAL TABLES (EXPECT 0 ROWS)
WITH canonical_57_tables(table_name) AS (
  VALUES
    ('properties'), ('outlets'), ('outlet_settings'), ('outlet_counters'), ('dining_zones'),
    ('staff'), ('roles'), ('permissions'), ('role_permissions'), ('staff_roles'),
    ('staff_outlet_access'), ('staff_shifts'), ('duty_roster'),
    ('menu_categories'), ('menu_items'), ('outlet_menu_items'), ('menu_item_revisions'),
    ('menu_revision_approvals'),
    ('restaurant_tables'), ('table_assignment_history'),
    ('customers'), ('dining_sessions'), ('guest_session_tokens'), ('service_requests'),
    ('orders'), ('order_items'), ('order_status_history'),
    ('kitchen_stations'), ('kots'), ('kot_items'), ('kot_status_history'),
    ('bills'), ('bill_items'), ('payments'), ('payment_allocations'), ('refunds'),
    ('discount_reason_codes'), ('approval_requests'), ('approval_actions'),
    ('hotel_rooms'), ('hotel_guests'), ('hotel_reservations'), ('hotel_stays'),
    ('room_folios'), ('folio_charges'),
    ('housekeeping_tasks'), ('room_status_history'), ('maintenance_issues'),
    ('inventory_items'), ('inventory_locations'), ('inventory_balances'),
    ('inventory_movements'), ('recipes'), ('recipe_ingredients'),
    ('idempotency_keys'), ('outlet_event_log'), ('audit_logs')
)
SELECT c.table_name AS missing_canonical_table
FROM canonical_57_tables c
LEFT JOIN information_schema.tables t 
  ON t.table_schema = 'public' AND t.table_name = c.table_name
WHERE t.table_name IS NULL;

-- 13. FULL RLS COMPLETION CHECK (ALL 57 CANONICAL TABLES MUST HAVE RLS ENABLED)
WITH canonical_57_tables(table_name) AS (
  VALUES
    ('properties'), ('outlets'), ('outlet_settings'), ('outlet_counters'), ('dining_zones'),
    ('staff'), ('roles'), ('permissions'), ('role_permissions'), ('staff_roles'),
    ('staff_outlet_access'), ('staff_shifts'), ('duty_roster'),
    ('menu_categories'), ('menu_items'), ('outlet_menu_items'), ('menu_item_revisions'),
    ('menu_revision_approvals'),
    ('restaurant_tables'), ('table_assignment_history'),
    ('customers'), ('dining_sessions'), ('guest_session_tokens'), ('service_requests'),
    ('orders'), ('order_items'), ('order_status_history'),
    ('kitchen_stations'), ('kots'), ('kot_items'), ('kot_status_history'),
    ('bills'), ('bill_items'), ('payments'), ('payment_allocations'), ('refunds'),
    ('discount_reason_codes'), ('approval_requests'), ('approval_actions'),
    ('hotel_rooms'), ('hotel_guests'), ('hotel_reservations'), ('hotel_stays'),
    ('room_folios'), ('folio_charges'),
    ('housekeeping_tasks'), ('room_status_history'), ('maintenance_issues'),
    ('inventory_items'), ('inventory_locations'), ('inventory_balances'),
    ('inventory_movements'), ('recipes'), ('recipe_ingredients'),
    ('idempotency_keys'), ('outlet_event_log'), ('audit_logs')
)
SELECT 
  c.table_name,
  COALESCE(cl.relrowsecurity, false) AS rls_enabled
FROM canonical_57_tables c
LEFT JOIN pg_class cl 
  ON cl.relname = c.table_name AND cl.relnamespace = 'public'::regnamespace
WHERE COALESCE(cl.relrowsecurity, false) = false;

-- 14. GLOBAL SENSITIVE-TABLE CLIENT PRIVILEGE AUDIT (EXPECT 0 ROWS)
-- Confirms sensitive and backend-only tables have ZERO client mutation or illicit SELECT access
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'staff', 
    'customers', 
    'guest_session_tokens', 
    'payments', 
    'refunds', 
    'hotel_guests', 
    'inventory_movements', 
    'idempotency_keys', 
    'audit_logs'
  )
  AND (
    (grantee IN ('anon', 'public'))
    OR (table_name IN ('hotel_guests', 'guest_session_tokens', 'idempotency_keys', 'audit_logs') AND grantee = 'authenticated')
    OR (grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
  );

-- 15. RECORD COUNTS SUMMARY (CLEAN BASELINE: 0 across all 3 tables)
SELECT 'idempotency_keys' AS entity, COUNT(*) AS count FROM idempotency_keys
UNION ALL
SELECT 'outlet_event_log' AS entity, COUNT(*) AS count FROM outlet_event_log
UNION ALL
SELECT 'audit_logs' AS entity, COUNT(*) AS count FROM audit_logs;
