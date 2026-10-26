-- ============================================================================
-- MIGRATION 015: CORRECT MENU ITEM KITCHEN STATIONS (EXACT ID TARGETING)
-- Pali Resort & Club Operations Platform
--
-- Harmonizes canonical menu items with kitchen stations by exact UUID:
--   - CHINESE_CONTINENTAL: Cream of Tomato Soup, Cream of Palak Soup, Crispy Corn & Water Chestnut
--   - TANDOOR: Starters (Paneer Tikka Angaar, Hara Bhara, Murgh Malai) and Breads (Butter Naan, Tandoori Roti)
--   - CURRY: Dal Makhani Heritage, Paneer Butter Masala, Butter Chicken Old Delhi, Murgh Dum Biryani, Dum Biryani Subz
--   - PANTRY: Desserts (Gulab Jamun with Rabri)
--   - BAR: Beverages (Virgin Mojito, Mango Basil Cooler)
-- Safe to run twice (Idempotent UPDATEs).
-- ============================================================================

DO $$
BEGIN

  -- 1. CHINESE_CONTINENTAL (Soups & Crispy Corn)
  UPDATE public.menu_items
  SET target_kitchen_station_code = 'CHINESE_CONTINENTAL'
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001'::UUID, -- Cream of Tomato Soup
    '20000000-0000-0000-0000-000000000002'::UUID, -- Cream of Palak Soup
    '20000000-0000-0000-0000-000000000012'::UUID  -- Crispy Corn & Water Chestnut
  );

  -- 2. TANDOOR (Starters & Breads)
  UPDATE public.menu_items
  SET target_kitchen_station_code = 'TANDOOR'
  WHERE id IN (
    '20000000-0000-0000-0000-000000000003'::UUID, -- Paneer Tikka Angaar
    '20000000-0000-0000-0000-000000000004'::UUID, -- Hara Bhara Kebab
    '20000000-0000-0000-0000-000000000005'::UUID, -- Murgh Malai Kebab
    '20000000-0000-0000-0000-000000000015'::UUID, -- Butter Naan
    '20000000-0000-0000-0000-000000000016'::UUID  -- Tandoori Roti
  );

  -- 3. CURRY (Dal, Curries & Dum Biryani)
  UPDATE public.menu_items
  SET target_kitchen_station_code = 'CURRY'
  WHERE id IN (
    '20000000-0000-0000-0000-000000000006'::UUID, -- Dal Makhani Heritage
    '20000000-0000-0000-0000-000000000007'::UUID, -- Paneer Butter Masala
    '20000000-0000-0000-0000-000000000008'::UUID, -- Butter Chicken Old Delhi
    '20000000-0000-0000-0000-000000000013'::UUID, -- Murgh Dum Biryani
    '20000000-0000-0000-0000-000000000014'::UUID  -- Dum Biryani Subz
  );

  -- 4. PANTRY (Desserts)
  UPDATE public.menu_items
  SET target_kitchen_station_code = 'PANTRY'
  WHERE id IN (
    '20000000-0000-0000-0000-000000000009'::UUID  -- Gulab Jamun with Rabri
  );

  -- 5. BAR (Beverages)
  UPDATE public.menu_items
  SET target_kitchen_station_code = 'BAR'
  WHERE id IN (
    '20000000-0000-0000-0000-000000000010'::UUID, -- Virgin Mojito
    '20000000-0000-0000-0000-000000000011'::UUID  -- Mango Basil Cooler
  );

  -- 6. Clear conflicting station overrides on outlet_menu_items so master target station governs
  UPDATE public.outlet_menu_items omi
  SET kitchen_station_override_code = NULL
  WHERE kitchen_station_override_code IS NOT NULL;

END $$;
