-- ============================================================================
-- MIGRATION 008: BILLING, PAYMENTS & REFUNDS VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 5 DOMAIN H TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
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
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
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
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY UNIQUE CONSTRAINTS (INVOICE NUMBER UNIQUENESS)
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
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 4A. CONFIRM NO ILLEGAL SINGLE-TENDER UNIQUE CONSTRAINTS ON PAYMENT ALLOCATIONS (EXPECT 0 ROWS)
-- Verifies that payment_allocations does not prematurely restrict bill_id to a single payment
SELECT tc.table_name, tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'payment_allocations'
  AND kcu.column_name = 'bill_id';

-- 5. VERIFY CHECK CONSTRAINTS (FINANCIAL & STATUS VALIDATION)
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 6. EXACT MONETARY TYPE AUDIT & VERIFICATION (EXPECTED VS ACTUAL)
-- Validates that every monetary paise column uses BIGINT (or INTEGER for rounding_paise per canonical schema)
SELECT 
  c.table_name,
  c.column_name,
  c.data_type AS actual_data_type,
  CASE 
    WHEN c.table_name = 'bills' AND c.column_name = 'rounding_paise' THEN 'integer'
    ELSE 'bigint'
  END AS expected_data_type,
  CASE 
    WHEN c.table_name = 'bills' AND c.column_name = 'rounding_paise' AND c.data_type = 'integer' THEN 'PASS'
    WHEN c.table_name != 'bills' AND c.data_type = 'bigint' THEN 'PASS'
    WHEN c.table_name = 'bills' AND c.column_name != 'rounding_paise' AND c.data_type = 'bigint' THEN 'PASS'
    ELSE 'FAIL'
  END AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND (
    c.column_name LIKE '%paise%' 
    OR c.column_name LIKE '%amount%' 
    OR c.column_name LIKE '%price%'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 6A. FLOATING-POINT SAFETY: ASSERT ZERO FLOATING POINT MONEY COLUMNS (EXPECT 0 ROWS)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND data_type IN ('real', 'double precision', 'float');

-- 6B. PERCENTAGE / RATE AUDIT: CONFIRM gst_rate_percent USES CANONICAL NUMERIC TYPE
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bill_items'
  AND column_name = 'gst_rate_percent';

-- 7. VERIFY INDEXES (COMPLETE FOREIGN KEY & HOT-PATH COVERAGE)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
ORDER BY tablename, indexname;

-- 8. VERIFY ROW-LEVEL SECURITY STATUS (ALL 5 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
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
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
ORDER BY tablename, policyname;

-- 9A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN H TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND qual = 'true';

-- 9B. ASSERT OUTLET ACCESS AND CAPABILITY PERMISSION ENFORCEMENT ACROSS ALL 5 POLICIES (EXPECT 5 ROWS)
SELECT 
  tablename, 
  policyname,
  CASE WHEN qual LIKE '%has_outlet_access%' THEN 'PASS' ELSE 'FAIL' END AS outlet_scoping,
  CASE 
    WHEN tablename = 'bills' AND qual LIKE '%bill:view%' THEN 'PASS'
    WHEN tablename = 'bill_items' AND qual LIKE '%bill:view%' THEN 'PASS'
    WHEN tablename = 'payments' AND qual LIKE '%bill:view%' AND qual LIKE '%payment:process%' THEN 'PASS'
    WHEN tablename = 'payment_allocations' AND qual LIKE '%bill:view%' AND qual LIKE '%payment:process%' THEN 'PASS'
    WHEN tablename = 'refunds' AND qual LIKE '%payment:refund%' AND qual LIKE '%bill:view%' THEN 'PASS'
    ELSE 'FAIL'
  END AS permission_enforcement
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bills', 'bill_items', 'payments', 'payment_allocations', 'refunds')
ORDER BY tablename;

-- 10. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon must have NO access to ANY Domain H table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ONLY SELECT privilege (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 10A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 20 ROWS: 4 privileges across 5 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'bills', 
    'bill_items', 
    'payments', 
    'payment_allocations', 
    'refunds'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 11. VERIFY CROSS-OUTLET INTEGRITY (EXPECT 0 ROWS)
-- Bill outlet must match dining session outlet (if session is linked)
SELECT b.id AS bill_id, b.outlet_id AS bill_outlet, ds.outlet_id AS session_outlet
FROM bills b
JOIN dining_sessions ds ON ds.id = b.dining_session_id
WHERE b.outlet_id != ds.outlet_id;

-- Payment outlet must match bill outlet
SELECT p.id AS payment_id, p.outlet_id AS payment_outlet, b.outlet_id AS bill_outlet
FROM payments p
JOIN bills b ON b.id = p.bill_id
WHERE p.outlet_id != b.outlet_id;

-- Payment allocation bill must match payment's referenced bill
SELECT pa.id AS allocation_id, pa.bill_id AS alloc_bill, p.bill_id AS payment_bill
FROM payment_allocations pa
JOIN payments p ON p.id = pa.payment_id
WHERE pa.bill_id != p.bill_id;

-- 12. VERIFY ZERO ORPHANS (EXPECT 0 ROWS)
-- Orphan bills to outlets
SELECT b.id FROM bills b LEFT JOIN outlets o ON o.id = b.outlet_id WHERE o.id IS NULL;
-- Orphan bills to dining sessions
SELECT b.id FROM bills b LEFT JOIN dining_sessions ds ON ds.id = b.dining_session_id WHERE b.dining_session_id IS NOT NULL AND ds.id IS NULL;
-- Orphan bills to staff
SELECT b.id FROM bills b LEFT JOIN staff s ON s.id = b.generated_by_staff_id WHERE s.id IS NULL;
-- Orphan bill items to bills
SELECT bi.id FROM bill_items bi LEFT JOIN bills b ON b.id = bi.bill_id WHERE b.id IS NULL;
-- Orphan bill items to order items
SELECT bi.id FROM bill_items bi LEFT JOIN order_items oi ON oi.id = bi.order_item_id WHERE oi.id IS NULL;
-- Orphan payments to bills
SELECT p.id FROM payments p LEFT JOIN bills b ON b.id = p.bill_id WHERE b.id IS NULL;
-- Orphan payments to outlets
SELECT p.id FROM payments p LEFT JOIN outlets o ON o.id = p.outlet_id WHERE o.id IS NULL;
-- Orphan payments to staff
SELECT p.id FROM payments p LEFT JOIN staff s ON s.id = p.processed_by_staff_id WHERE s.id IS NULL;
-- Orphan allocations to payments
SELECT pa.id FROM payment_allocations pa LEFT JOIN payments p ON p.id = pa.payment_id WHERE p.id IS NULL;
-- Orphan allocations to bills
SELECT pa.id FROM payment_allocations pa LEFT JOIN bills b ON b.id = pa.bill_id WHERE b.id IS NULL;
-- Orphan refunds to payments
SELECT r.id FROM refunds r LEFT JOIN payments p ON p.id = r.payment_id WHERE p.id IS NULL;
-- Orphan refunds to staff
SELECT r.id FROM refunds r LEFT JOIN staff s ON s.id = r.approved_by_staff_id WHERE s.id IS NULL;

-- 13. FINANCIAL INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- [DATABASE-ENFORCED CHECKS]
-- Negative amounts
SELECT id, 'Negative subtotal' AS issue FROM bills WHERE subtotal_paise < 0
UNION ALL
SELECT id, 'Negative discount' AS issue FROM bills WHERE discount_paise < 0
UNION ALL
SELECT id, 'Discount exceeds subtotal' AS issue FROM bills WHERE discount_paise > subtotal_paise
UNION ALL
SELECT id, 'Negative CGST' AS issue FROM bills WHERE cgst_paise < 0
UNION ALL
SELECT id, 'Negative SGST' AS issue FROM bills WHERE sgst_paise < 0
UNION ALL
SELECT id, 'Negative grand total' AS issue FROM bills WHERE grand_total_paise < 0
UNION ALL
SELECT id, 'Negative paid amount' AS issue FROM bills WHERE paid_paise < 0
UNION ALL
SELECT id, 'Negative balance' AS issue FROM bills WHERE balance_paise < 0
UNION ALL
SELECT id, 'Zero or negative payment amount' AS issue FROM payments WHERE amount_paise <= 0
UNION ALL
SELECT id, 'Zero or negative allocation amount' AS issue FROM payment_allocations WHERE allocated_amount_paise <= 0
UNION ALL
SELECT id, 'Zero or negative refund amount' AS issue FROM refunds WHERE amount_paise <= 0;

-- [EXPRESS-SERVICE-ENFORCED SETTLEMENT RECONCILIATION AUDIT]
-- Diagnostics verifying derived values and limits enforced by Express service layer:
-- 13A. Cumulative allocations exceeding payment amount (EXPECT 0 ROWS)
SELECT 
  p.id AS payment_id, 
  p.amount_paise AS payment_amount, 
  SUM(pa.allocated_amount_paise) AS total_allocated
FROM payments p
JOIN payment_allocations pa ON pa.payment_id = p.id
GROUP BY p.id, p.amount_paise
HAVING SUM(pa.allocated_amount_paise) > p.amount_paise;

-- 13B. Cumulative refunds exceeding captured payment amount (EXPECT 0 ROWS)
SELECT 
  p.id AS payment_id, 
  p.amount_paise AS payment_amount, 
  SUM(r.amount_paise) AS total_refunded
FROM payments p
JOIN refunds r ON r.payment_id = p.id
WHERE r.status = 'PROCESSED'
GROUP BY p.id, p.amount_paise
HAVING SUM(r.amount_paise) > p.amount_paise;

-- 13C. Paid and balance reconciliation against captured payments and refunds (EXPECT 0 ROWS)
SELECT 
  b.id AS bill_id,
  b.grand_total_paise,
  b.paid_paise AS recorded_paid,
  COALESCE(pay_summary.net_paid, 0) AS calculated_net_paid,
  b.balance_paise AS recorded_balance,
  (b.grand_total_paise - COALESCE(pay_summary.net_paid, 0)) AS calculated_balance
FROM bills b
LEFT JOIN (
  SELECT 
    pa.bill_id,
    SUM(pa.allocated_amount_paise) - COALESCE(ref_summary.total_refunded, 0) AS net_paid
  FROM payment_allocations pa
  JOIN payments p ON p.id = pa.payment_id AND p.status = 'CAPTURED'
  LEFT JOIN (
    SELECT payment_id, SUM(amount_paise) AS total_refunded
    FROM refunds
    WHERE status = 'PROCESSED'
    GROUP BY payment_id
  ) ref_summary ON ref_summary.payment_id = p.id
  GROUP BY pa.bill_id, ref_summary.total_refunded
) pay_summary ON pay_summary.bill_id = b.id
WHERE b.paid_paise != COALESCE(pay_summary.net_paid, 0)
   OR b.balance_paise != (b.grand_total_paise - COALESCE(pay_summary.net_paid, 0));

-- 14. RECORD COUNTS SUMMARY (CLEAN BASELINE VERIFICATION - ALL 0)
SELECT 'bills' AS entity, COUNT(*) AS count FROM bills
UNION ALL
SELECT 'bill_items' AS entity, COUNT(*) AS count FROM bill_items
UNION ALL
SELECT 'payments' AS entity, COUNT(*) AS count FROM payments
UNION ALL
SELECT 'payment_allocations' AS entity, COUNT(*) AS count FROM payment_allocations
UNION ALL
SELECT 'refunds' AS entity, COUNT(*) AS count FROM refunds;
