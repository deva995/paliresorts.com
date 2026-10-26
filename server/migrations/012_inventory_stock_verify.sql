-- ============================================================================
-- MIGRATION 012: INVENTORY & STOCK CONTROL VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 6 DOMAIN M TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
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
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
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
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
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
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
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
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 6. AUDIT MONETARY, QUANTITY PRECISION & FLOATING-POINT TYPES
SELECT 
  table_name,
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
  AND (
    column_name LIKE '%paise%' 
    OR column_name LIKE '%quantity%' 
    OR column_name LIKE '%level%'
    OR data_type IN ('real', 'double precision', 'float')
  )
ORDER BY table_name, column_name;

-- 7. VERIFY 100% FOREIGN KEY INDEX COVERAGE (INCLUDING UNIQUE LEADING COLUMN COVERAGE)
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
      'inventory_items', 
      'inventory_locations', 
      'inventory_balances', 
      'inventory_movements',
      'recipes',
      'recipe_ingredients'
    )
),
indexed_columns AS (
  -- Dedicated or leading column of index
  SELECT 
    t.relname AS table_name,
    a.attname AS column_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
  WHERE n.nspname = 'public'
    AND t.relname IN (
      'inventory_items', 
      'inventory_locations', 
      'inventory_balances', 
      'inventory_movements',
      'recipes',
      'recipe_ingredients'
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

-- 8. AUDIT INSTALLED INDEXES ON DOMAIN M TABLES
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY tablename, indexname;

-- 9. VERIFY ROW-LEVEL SECURITY STATUS (ALL 6 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY relname;

-- 10. VERIFY INSTALLED RLS POLICIES
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
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY tablename, policyname;

-- 10A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN M TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
  AND qual = 'true';

-- 10B. ASSERT CAPABILITY ENFORCEMENT ACROSS ALL 6 POLICIES (EXPECT 6 ROWS)
SELECT 
  tablename, 
  policyname,
  CASE 
    WHEN tablename IN ('inventory_items', 'inventory_locations', 'inventory_balances', 'inventory_movements') 
         AND qual LIKE '%inventory:view%' THEN 'PASS'
    WHEN tablename IN ('recipes', 'recipe_ingredients') 
         AND qual LIKE '%menu:view%' THEN 'PASS'
    ELSE 'FAIL'
  END AS capability_enforcement
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY tablename;

-- 11. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon and public must have NO access to ANY Domain M table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 11A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 24 ROWS: 4 privileges across 6 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'inventory_items', 
    'inventory_locations', 
    'inventory_balances', 
    'inventory_movements',
    'recipes',
    'recipe_ingredients'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 12. ZERO ORPHAN INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan items to properties
SELECT ii.id FROM inventory_items ii LEFT JOIN properties p ON p.id = ii.property_id WHERE p.id IS NULL;
-- Orphan locations to outlets (when outlet linked)
SELECT il.id FROM inventory_locations il LEFT JOIN outlets o ON o.id = il.outlet_id WHERE il.outlet_id IS NOT NULL AND o.id IS NULL;
-- Orphan balances to items
SELECT ib.id FROM inventory_balances ib LEFT JOIN inventory_items ii ON ii.id = ib.item_id WHERE ii.id IS NULL;
-- Orphan balances to locations
SELECT ib.id FROM inventory_balances ib LEFT JOIN inventory_locations il ON il.id = ib.location_id WHERE il.id IS NULL;
-- Orphan movements to items
SELECT im.id FROM inventory_movements im LEFT JOIN inventory_items ii ON ii.id = im.item_id WHERE ii.id IS NULL;
-- Orphan movements to locations
SELECT im.id FROM inventory_movements im LEFT JOIN inventory_locations il ON il.id = im.location_id WHERE il.id IS NULL;
-- Orphan movements to staff
SELECT im.id FROM inventory_movements im LEFT JOIN staff s ON s.id = im.authorized_by_staff_id WHERE s.id IS NULL;
-- Orphan paired movements
SELECT im.id FROM inventory_movements im LEFT JOIN inventory_movements p ON p.id = im.paired_movement_id WHERE im.paired_movement_id IS NOT NULL AND p.id IS NULL;
-- Orphan recipes to menu items
SELECT r.id FROM recipes r LEFT JOIN menu_items mi ON mi.id = r.menu_item_id WHERE mi.id IS NULL;
-- Orphan recipe ingredients to recipes
SELECT ri.id FROM recipe_ingredients ri LEFT JOIN recipes r ON r.id = ri.recipe_id WHERE r.id IS NULL;
-- Orphan recipe ingredients to items
SELECT ri.id FROM recipe_ingredients ri LEFT JOIN inventory_items ii ON ii.id = ri.inventory_item_id WHERE ii.id IS NULL;

-- 13. RECORD COUNTS SUMMARY (CLEAN BASELINE: 0 across all tables)
SELECT 'inventory_items' AS entity, COUNT(*) AS count FROM inventory_items
UNION ALL
SELECT 'inventory_locations' AS entity, COUNT(*) AS count FROM inventory_locations
UNION ALL
SELECT 'inventory_balances' AS entity, COUNT(*) AS count FROM inventory_balances
UNION ALL
SELECT 'inventory_movements' AS entity, COUNT(*) AS count FROM inventory_movements
UNION ALL
SELECT 'recipes' AS entity, COUNT(*) AS count FROM recipes
UNION ALL
SELECT 'recipe_ingredients' AS entity, COUNT(*) AS count FROM recipe_ingredients;
