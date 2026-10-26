-- ============================================================================
-- MIGRATION 007: KITCHEN DISPLAY SYSTEM (KDS) SEED DATA
-- Pali Resort & Club Operations Platform
--
-- MASTER CONFIGURATION SEED:
-- - Kitchen stations represent physical preparation infrastructure mapped from
--   verified resort catalog and culinary routing data (mockData.ts & 003 seed).
-- - rest-1 (Heritage Dining Room): 5 stations (Tandoor, Curry, Chinese/Continental, Pantry, Bar).
-- - rest-2 (Palm Deck & Bar): 4 stations (Tandoor/Grill, Deck Curries, Deck Pantry, Poolside Bar).
--
-- TRANSACTIONAL KOT DATA:
-- - Zero fake KOTs, KOT items, or kitchen history records are seeded.
-- - Idempotent execution via ON CONFLICT (outlet_id, code).
-- ============================================================================

DO $$
BEGIN

  -- 1. SEED KITCHEN STATIONS FOR rest-1 (Heritage Dining Room)
  INSERT INTO public.kitchen_stations (
    outlet_id, code, name, display_order, is_active
  ) VALUES
    ('rest-1', 'TANDOOR', 'Clay Oven & Tandoor Station', 1, true),
    ('rest-1', 'CURRY', 'Curry & Gravy Line', 2, true),
    ('rest-1', 'CHINESE_CONTINENTAL', 'Wok & Continental Station', 3, true),
    ('rest-1', 'PANTRY', 'Cold Pantry & Desserts', 4, true),
    ('rest-1', 'BAR', 'Beverages & Mocktails Bar', 5, true)
  ON CONFLICT (outlet_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

  -- 2. SEED KITCHEN STATIONS FOR rest-2 (Palm Deck & Bar)
  INSERT INTO public.kitchen_stations (
    outlet_id, code, name, display_order, is_active
  ) VALUES
    ('rest-2', 'TANDOOR', 'Deck Tandoor & Grill', 1, true),
    ('rest-2', 'CURRY', 'Deck Curries', 2, true),
    ('rest-2', 'PANTRY', 'Deck Pantry & Shakes', 3, true),
    ('rest-2', 'BAR', 'Main Poolside Bar & Mixology', 4, true)
  ON CONFLICT (outlet_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

  -- Transactional tables remain clean at baseline:
  -- kots = 0
  -- kot_items = 0
  -- kot_status_history = 0

END $$;
