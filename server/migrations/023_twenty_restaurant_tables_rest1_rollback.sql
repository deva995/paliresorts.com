-- ============================================================================
-- ROLLBACK 023: ENSURE 20 RESTAURANT TABLES FOR REST-1
-- ============================================================================

UPDATE public.restaurant_tables
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE outlet_id = 'rest-1' AND table_number IN (
  'T-09', 'T-10', 'T-11', 'T-12', 'T-13', 'T-14', 'T-15', 'T-16', 'T-17', 'T-18', 'T-19', 'T-20'
);
