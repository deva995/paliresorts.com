-- ============================================================================
-- MIGRATION 009: HOTEL PROPERTY MANAGEMENT SYSTEM (PMS) VERIFICATION (READ-ONLY)
-- Pali Resort & Club Operations Platform
-- ============================================================================

-- 1. VERIFY ALL 6 DOMAIN J TABLES EXIST
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
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
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY tc.table_name, kc.ordinal_position;

-- 3. VERIFY FOREIGN KEYS & RESTRICTIVE DELETE BEHAVIORS (INCLUDING DELAYED FKS)
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
      'hotel_rooms', 
      'hotel_guests', 
      'hotel_reservations', 
      'hotel_stays', 
      'room_folios', 
      'folio_charges'
    )
    OR tc.constraint_name IN (
      'fk_dining_sessions_hotel_stay',
      'fk_orders_hotel_stay',
      'fk_orders_room'
    )
  )
ORDER BY tc.table_name, kcu.column_name;

-- 4. VERIFY THE THREE DELAYED FKS INSTALLED ON EARLIER TABLES (EXPECT 3 ROWS)
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
  AND tc.constraint_name IN (
    'fk_dining_sessions_hotel_stay',
    'fk_orders_hotel_stay',
    'fk_orders_room'
  )
ORDER BY tc.constraint_name;

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
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 6. VERIFY PARTIAL UNIQUE INDEXES (ACTIVE STAY & OPEN FOLIO INVARIANTS)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_unique_active_room_stay',
    'idx_unique_open_room_folio'
  )
ORDER BY indexname;

-- 7. VERIFY CHECK CONSTRAINTS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 8. EXACT MONETARY TYPE AUDIT (EXPECTED VS ACTUAL)
SELECT 
  c.table_name,
  c.column_name,
  c.data_type AS actual_data_type,
  'bigint' AS expected_data_type,
  CASE WHEN c.data_type = 'bigint' THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND (
    c.column_name LIKE '%paise%' 
    OR c.column_name LIKE '%tariff%' 
    OR c.column_name LIKE '%amount%'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 8A. FLOATING-POINT SAFETY: ASSERT ZERO FLOATING POINT MONEY COLUMNS (EXPECT 0 ROWS)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND data_type IN ('real', 'double precision', 'float');

-- 8B. PRIVACY AUDIT: VERIFY GUEST IDENTITY HASH STORAGE (SHA-256 VARCHAR(64))
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hotel_guests'
  AND column_name = 'id_proof_number_hash';

-- 8C. PRIVACY AUDIT: ASSERT NO PLAINTEXT IDENTITY COLUMNS EXIST (EXPECT 0 ROWS)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hotel_guests'
  AND (
    column_name LIKE '%number%' AND column_name NOT LIKE '%hash%'
    OR column_name LIKE '%aadhaar%'
    OR column_name LIKE '%passport%'
  );

-- 9. VERIFY INDEXES (COMPLETE FOREIGN KEY & HOT-PATH COVERAGE)
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename IN (
      'hotel_rooms', 
      'hotel_guests', 
      'hotel_reservations', 
      'hotel_stays', 
      'room_folios', 
      'folio_charges'
    )
    OR indexname IN (
      'idx_dining_sessions_hotel_stay',
      'idx_orders_hotel_stay',
      'idx_orders_room'
    )
  )
ORDER BY tablename, indexname;

-- 9A. ASSERT REDUNDANT idx_hotel_guests_phone IS ABSENT (EXPECT 0 ROWS)
-- uq_hotel_guests_phone unique constraint already provides B-tree index coverage
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'hotel_guests' 
  AND indexname = 'idx_hotel_guests_phone';

-- 10. VERIFY ROW-LEVEL SECURITY STATUS (ALL 6 TABLES ENABLED)
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY relname;

-- 11. VERIFY INSTALLED RLS POLICIES (FROM pg_policies)
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
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY tablename, policyname;

-- 11A. ASSERT NO USING (true) POLICIES EXIST ON DOMAIN J TABLES (EXPECT 0 ROWS)
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND qual = 'true';

-- 11B. ASSERT PERMISSION ENFORCEMENT ACROSS THE 5 CLIENT-EXPOSED POLICIES (EXPECT 5 ROWS)
SELECT 
  tablename, 
  policyname,
  CASE 
    WHEN tablename IN ('hotel_rooms', 'hotel_reservations', 'hotel_stays') 
         AND qual LIKE '%hotel:view%' THEN 'PASS'
    WHEN tablename IN ('room_folios', 'folio_charges') 
         AND qual LIKE '%hotel:view%' 
         AND qual LIKE '%folio:charge%' 
         AND qual LIKE '%bill:view%' THEN 'PASS'
    ELSE 'FAIL'
  END AS permission_enforcement
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'hotel_rooms', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
ORDER BY tablename;

-- 11C. ASSERT hotel_guests HAS ZERO CLIENT POLICIES (BACKEND-ONLY PII MODEL) (EXPECT 0 ROWS)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'hotel_guests';

-- 12. VERIFY CLIENT PRIVILEGE ISOLATION
-- anon and public must have NO access to ANY Domain J table (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND grantee IN ('anon', 'public');

-- authenticated must have ZERO access to hotel_guests (strictly backend-only) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'hotel_guests'
  AND grantee = 'authenticated';

-- authenticated must have ONLY SELECT privilege on other 5 tables (no INSERT, UPDATE, DELETE) (EXPECT 0 ROWS)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'hotel_rooms', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 12A. VERIFY SERVICE_ROLE BACKEND PRIVILEGES (EXPECT 24 ROWS: 4 privileges across 6 tables)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'hotel_rooms', 
    'hotel_guests', 
    'hotel_reservations', 
    'hotel_stays', 
    'room_folios', 
    'folio_charges'
  )
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- 13. ZERO ORPHAN INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan rooms to property
SELECT hr.id FROM hotel_rooms hr LEFT JOIN properties p ON p.id = hr.property_id WHERE p.id IS NULL;
-- Orphan reservations to property
SELECT hres.id FROM hotel_reservations hres LEFT JOIN properties p ON p.id = hres.property_id WHERE p.id IS NULL;
-- Orphan reservations to guest
SELECT hres.id FROM hotel_reservations hres LEFT JOIN hotel_guests hg ON hg.id = hres.guest_id WHERE hg.id IS NULL;
-- Orphan stays to room
SELECT hs.id FROM hotel_stays hs LEFT JOIN hotel_rooms hr ON hr.id = hs.room_id WHERE hr.id IS NULL;
-- Orphan stays to guest
SELECT hs.id FROM hotel_stays hs LEFT JOIN hotel_guests hg ON hg.id = hs.guest_id WHERE hg.id IS NULL;
-- Orphan stays to reservation (when linked)
SELECT hs.id FROM hotel_stays hs LEFT JOIN hotel_reservations hres ON hres.id = hs.reservation_id WHERE hs.reservation_id IS NOT NULL AND hres.id IS NULL;
-- Orphan folios to stay
SELECT rf.id FROM room_folios rf LEFT JOIN hotel_stays hs ON hs.id = rf.stay_id WHERE hs.id IS NULL;
-- Orphan folio charges to folio
SELECT fc.id FROM folio_charges fc LEFT JOIN room_folios rf ON rf.id = fc.folio_id WHERE rf.id IS NULL;
-- Orphan folio charges to outlet (when linked)
SELECT fc.id FROM folio_charges fc LEFT JOIN outlets o ON o.id = fc.outlet_id WHERE fc.outlet_id IS NOT NULL AND o.id IS NULL;
-- Orphan folio charges to bill (when linked)
SELECT fc.id FROM folio_charges fc LEFT JOIN bills b ON b.id = fc.bill_id WHERE fc.bill_id IS NOT NULL AND b.id IS NULL;
-- Orphan folio charges to staff
SELECT fc.id FROM folio_charges fc LEFT JOIN staff s ON s.id = fc.posted_by_staff_id WHERE s.id IS NULL;

-- 14. DELAYED FK CROSS-ENTITY INTEGRITY DIAGNOSTICS (EXPECT 0 ROWS)
-- Orphan dining sessions to hotel stays (when linked)
SELECT ds.id FROM dining_sessions ds LEFT JOIN hotel_stays hs ON hs.id = ds.hotel_stay_id WHERE ds.hotel_stay_id IS NOT NULL AND hs.id IS NULL;
-- Orphan orders to hotel stays (when linked)
SELECT o.id FROM orders o LEFT JOIN hotel_stays hs ON hs.id = o.hotel_stay_id WHERE o.hotel_stay_id IS NOT NULL AND hs.id IS NULL;
-- Orphan orders to rooms (when linked)
SELECT o.id FROM orders o LEFT JOIN hotel_rooms hr ON hr.id = o.room_id WHERE o.room_id IS NOT NULL AND hr.id IS NULL;
-- Room service order stay-room mismatch (orders.room_id must match hotel_stays.room_id)
SELECT o.id AS order_id, o.room_id AS order_room, hs.room_id AS stay_room
FROM orders o
JOIN hotel_stays hs ON hs.id = o.hotel_stay_id
WHERE o.order_source = 'ROOM_SERVICE'
  AND o.room_id != hs.room_id;

-- 15. RECORD COUNTS SUMMARY (BASELINE VALIDATION: 10 rooms, 0 transactional records)
SELECT 'hotel_rooms' AS entity, COUNT(*) AS count FROM hotel_rooms
UNION ALL
SELECT 'hotel_guests' AS entity, COUNT(*) AS count FROM hotel_guests
UNION ALL
SELECT 'hotel_reservations' AS entity, COUNT(*) AS count FROM hotel_reservations
UNION ALL
SELECT 'hotel_stays' AS entity, COUNT(*) AS count FROM hotel_stays
UNION ALL
SELECT 'room_folios' AS entity, COUNT(*) AS count FROM room_folios
UNION ALL
SELECT 'folio_charges' AS entity, COUNT(*) AS count FROM folio_charges;
