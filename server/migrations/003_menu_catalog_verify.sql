-- ============================================================================
-- MIGRATION 003: MENU CATALOG VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 5 MENU CATALOG TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'menu_categories',
    'menu_items',
    'outlet_menu_items',
    'menu_item_revisions',
    'menu_revision_approvals'
  )
ORDER BY table_name;

-- 2. VERIFY SAFE PUBLIC MENU VIEW EXISTS
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'public_outlet_menu';

-- 2A. VERIFY COLUMNS IN SAFE MENU VIEW (ZERO STAFF OR REVISION IDS)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_outlet_menu'
ORDER BY ordinal_position;

-- 2B. ASSERT NO INTERNAL AUDIT / STAFF COLUMNS IN PUBLIC VIEW (EXPECT 0 ROWS)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'public_outlet_menu'
  AND column_name IN (
    'submitted_by_staff_id', 
    'reviewed_by_staff_id', 
    'revision_id', 
    'proposed_data', 
    'previous_data',
    'review_notes'
  );

-- 2C. VERIFY VIEW PERMISSIONS (anon MUST HAVE NO ACCESS; authenticated MUST HAVE SELECT)
SELECT 
  grantee, 
  table_name, 
  privilege_type,
  CASE 
    WHEN grantee = 'anon' THEN 'FAIL - anon must not have access yet'
    WHEN grantee = 'authenticated' AND privilege_type = 'SELECT' THEN 'PASS'
    ELSE 'OK'
  END AS status
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'public_outlet_menu';

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
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 4. VERIFY FOREIGN KEYS
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
  AND tc.table_name IN (
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
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
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
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
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
  )
ORDER BY tc.table_name;

-- 7. VERIFY INDEXES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
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
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
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
    'menu_categories', 'menu_items', 'outlet_menu_items',
    'menu_item_revisions', 'menu_revision_approvals'
  )
ORDER BY tablename, policyname;

-- 10. VERIFY MAKER-CHECKER TRIGGER ON menu_revision_approvals
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'menu_revision_approvals';

-- 10A. VERIFY TRIGGER FUNCTION PRIVILEGES (PUBLIC MUST NOT HAVE EXECUTE PRIVILEGE)
SELECT 
  routine_name, 
  grantee, 
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'check_menu_revision_maker_checker';

-- 11. VERIFY EFFECTIVE PRICE RESOLUTION ACROSS OUTLETS
-- rest-1 should use base prices; rest-2 should reflect overrides where set
SELECT 
  outlet_id,
  item_name,
  effective_price_paise,
  effective_price_paise / 100.0 AS effective_price_inr,
  kitchen_station_code
FROM public.public_outlet_menu
WHERE item_name IN ('Paneer Tikka Angaar', 'Virgin Mojito', 'Dal Makhani Heritage')
ORDER BY item_name, outlet_id;

-- 12. VERIFY ZERO ORPHAN RECORDS
-- No orphan outlet menu items
SELECT omi.outlet_id, omi.menu_item_id
FROM outlet_menu_items omi
LEFT JOIN menu_items mi ON mi.id = omi.menu_item_id
WHERE mi.id IS NULL;

-- No orphan revisions
SELECT r.id, r.menu_item_id
FROM menu_item_revisions r
LEFT JOIN menu_items mi ON mi.id = r.menu_item_id
WHERE mi.id IS NULL;

-- No orphan approvals
SELECT a.id, a.revision_id
FROM menu_revision_approvals a
LEFT JOIN menu_item_revisions r ON r.id = a.revision_id
WHERE r.id IS NULL;

-- 13. RECORD COUNTS SUMMARY
SELECT 'menu_categories' AS entity, COUNT(*) AS count FROM menu_categories
UNION ALL
SELECT 'menu_items' AS entity, COUNT(*) AS count FROM menu_items
UNION ALL
SELECT 'outlet_menu_items (rest-1)' AS entity, COUNT(*) AS count FROM outlet_menu_items WHERE outlet_id = 'rest-1'
UNION ALL
SELECT 'outlet_menu_items (rest-2)' AS entity, COUNT(*) AS count FROM outlet_menu_items WHERE outlet_id = 'rest-2'
UNION ALL
SELECT 'menu_item_revisions' AS entity, COUNT(*) AS count FROM menu_item_revisions
UNION ALL
SELECT 'menu_revision_approvals' AS entity, COUNT(*) AS count FROM menu_revision_approvals;
