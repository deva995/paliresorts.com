-- ============================================================================
-- MIGRATION 002: STAFF & RBAC VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 8 STAFF/RBAC TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'roles', 
    'permissions', 
    'role_permissions', 
    'staff', 
    'staff_roles', 
    'staff_outlet_access', 
    'staff_shifts', 
    'duty_roster'
  )
ORDER BY table_name;

-- 2. VERIFY SAFE STAFF VIEWS EXIST & EXPOSE ONLY APPROVED COLUMNS
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('staff_public_profile', 'staff_self_profile')
ORDER BY table_name;

-- 2A. VERIFY COLUMNS IN SAFE VIEWS (NO PIN OR LOCKOUT METRICS)
SELECT table_name, column_name, ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('staff_public_profile', 'staff_self_profile')
ORDER BY table_name, ordinal_position;

-- 2B. ASSERT ZERO SENSITIVE PIN/LOCKOUT COLUMNS IN VIEWS (EXPECT 0 ROWS)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('staff_public_profile', 'staff_self_profile')
  AND column_name IN ('pin_hash', 'pin_failed_attempts', 'pin_locked_until');

-- 2C. VERIFY DIRECT SELECT ON BASE STAFF TABLE IS REVOKED (EXPECT 0 ROWS FOR authenticated/anon/public)
SELECT 
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'staff'
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
  AND tc.table_name IN (
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 4. VERIFY FOREIGN KEYS (INCLUDING auth.users TARGET)
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
    'role_permissions', 'staff', 'staff_roles', 
    'staff_outlet_access', 'staff_shifts', 'duty_roster'
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
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
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
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
  )
ORDER BY tc.table_name;

-- 7. VERIFY INDEXES (NON-REDUNDANT)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
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
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
  )
ORDER BY relname;

-- 9. VERIFY INSTALLED RLS POLICIES (FROM pg_policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'roles', 'permissions', 'role_permissions', 'staff', 
    'staff_roles', 'staff_outlet_access', 'staff_shifts', 'duty_roster'
  )
ORDER BY tablename, policyname;

-- 10. VERIFY HELPER FUNCTIONS & PRIVILEGES
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  provolatile,
  proconfig AS search_path_config
FROM pg_proc
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
WHERE nspname = 'public'
  AND proname IN ('current_staff_id', 'has_role', 'has_permission', 'has_outlet_access')
ORDER BY proname;

-- Verify PUBLIC execution revoked on helper functions
SELECT 
  routine_name, 
  grantee, 
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('current_staff_id', 'has_role', 'has_permission', 'has_outlet_access')
ORDER BY routine_name, grantee;

-- 11. VERIFY SEEDED ROLES (EXPECT EXACTLY 15)
SELECT id, display_name, is_system_role 
FROM roles 
ORDER BY id;

SELECT 
  COUNT(*) AS total_roles, 
  CASE WHEN COUNT(*) = 15 THEN 'PASS (15)' ELSE 'FAIL' END AS status
FROM roles;

-- 12. VERIFY SEEDED PERMISSIONS (EXPECT EXACTLY 31)
SELECT module, COUNT(*) AS permission_count 
FROM permissions 
GROUP BY module 
ORDER BY module;

SELECT 
  COUNT(*) AS total_permissions, 
  CASE WHEN COUNT(*) = 31 THEN 'PASS (31)' ELSE 'FAIL' END AS status
FROM permissions;

-- 13. VERIFY ROLE-PERMISSION MAPPINGS AND ORPHANS
-- Ensure no orphan role mappings exist
SELECT rp.role_id, rp.permission_id 
FROM role_permissions rp
LEFT JOIN roles r ON r.id = rp.role_id
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE r.id IS NULL OR p.id IS NULL;

-- 14. CONFIRM ZERO MOCK/FAKE STAFF SEEDED
SELECT 
  COUNT(*) AS staff_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS (0 mock staff)' ELSE 'FAIL (Contains unapproved staff)' END AS status
FROM staff;

-- 15. RECORD COUNTS SUMMARY
SELECT 'roles' AS entity, COUNT(*) AS count FROM roles
UNION ALL
SELECT 'permissions' AS entity, COUNT(*) AS count FROM permissions
UNION ALL
SELECT 'role_permissions' AS entity, COUNT(*) AS count FROM role_permissions
UNION ALL
SELECT 'staff' AS entity, COUNT(*) AS count FROM staff
UNION ALL
SELECT 'staff_roles' AS entity, COUNT(*) AS count FROM staff_roles
UNION ALL
SELECT 'staff_outlet_access' AS entity, COUNT(*) AS count FROM staff_outlet_access
UNION ALL
SELECT 'staff_shifts' AS entity, COUNT(*) AS count FROM staff_shifts
UNION ALL
SELECT 'duty_roster' AS entity, COUNT(*) AS count FROM duty_roster;
