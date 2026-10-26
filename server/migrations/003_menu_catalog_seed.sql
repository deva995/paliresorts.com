-- ============================================================================
-- MIGRATION 003: MENU CATALOG SEED DATA (CANONICAL SINGLE SOURCE OF TRUTH)
-- Pali Resort & Club Operations Platform
--
-- Canonical catalog mapped from resort menu data.
-- Monetary amounts are strictly integer paise (1 INR = 100 paise).
-- Kitchen stations:
--   - curries, dal, biryani -> CURRY
--   - starters and breads -> TANDOOR
--   - soups and Crispy Corn -> CHINESE_CONTINENTAL
--   - drinks -> BAR
--   - desserts -> PANTRY
-- Idempotent: Can be safely re-run without creating duplicates.
-- ============================================================================

DO $$
DECLARE
  v_property_id UUID;

  -- Category UUIDs
  v_cat_soups UUID := '10000000-0000-0000-0000-000000000001'::UUID;
  v_cat_veg_starters UUID := '10000000-0000-0000-0000-000000000002'::UUID;
  v_cat_nonveg_starters UUID := '10000000-0000-0000-0000-000000000003'::UUID;
  v_cat_veg_mains UUID := '10000000-0000-0000-0000-000000000004'::UUID;
  v_cat_nonveg_mains UUID := '10000000-0000-0000-0000-000000000005'::UUID;
  v_cat_biryani UUID := '10000000-0000-0000-0000-000000000008'::UUID;
  v_cat_breads UUID := '10000000-0000-0000-0000-000000000009'::UUID;
  v_cat_desserts UUID := '10000000-0000-0000-0000-000000000006'::UUID;
  v_cat_beverages UUID := '10000000-0000-0000-0000-000000000007'::UUID;

  -- Menu Item UUIDs (11 existing IDs kept strictly unchanged)
  v_item_tomato_soup UUID := '20000000-0000-0000-0000-000000000001'::UUID;
  v_item_palak_soup UUID := '20000000-0000-0000-0000-000000000002'::UUID;
  v_item_paneer_tikka UUID := '20000000-0000-0000-0000-000000000003'::UUID;
  v_item_hara_bhara UUID := '20000000-0000-0000-0000-000000000004'::UUID;
  v_item_murgh_malai UUID := '20000000-0000-0000-0000-000000000005'::UUID;
  v_item_dal_makhani UUID := '20000000-0000-0000-0000-000000000006'::UUID;
  v_item_paneer_butter UUID := '20000000-0000-0000-0000-000000000007'::UUID;
  v_item_butter_chicken UUID := '20000000-0000-0000-0000-000000000008'::UUID;
  v_item_gulab_jamun UUID := '20000000-0000-0000-0000-000000000009'::UUID;
  v_item_mojito UUID := '20000000-0000-0000-0000-000000000010'::UUID;
  v_item_mango_cooler UUID := '20000000-0000-0000-0000-000000000011'::UUID;

  -- Additional canonical items for complete menu coverage
  v_item_crispy_corn UUID := '20000000-0000-0000-0000-000000000012'::UUID;
  v_item_murgh_biryani UUID := '20000000-0000-0000-0000-000000000013'::UUID;
  v_item_veg_biryani UUID := '20000000-0000-0000-0000-000000000014'::UUID;
  v_item_butter_naan UUID := '20000000-0000-0000-0000-000000000015'::UUID;
  v_item_tandoori_roti UUID := '20000000-0000-0000-0000-000000000016'::UUID;


  -- Bar & Beverage Categories (6)
  v_cat_scotch_whisky UUID := '10000000-0000-0000-0000-000000000010'::UUID;
  v_cat_beers UUID := '10000000-0000-0000-0000-000000000011'::UUID;
  v_cat_wines UUID := '10000000-0000-0000-0000-000000000012'::UUID;
  v_cat_cocktails UUID := '10000000-0000-0000-0000-000000000013'::UUID;
  v_cat_mocktails UUID := '10000000-0000-0000-0000-000000000014'::UUID;
  v_cat_refreshers UUID := '10000000-0000-0000-0000-000000000015'::UUID;

  -- Bar & Beverage Items (28)
  v_bev_1 UUID := '30000000-0000-0000-0000-000000000001'::UUID;
  v_bev_2 UUID := '30000000-0000-0000-0000-000000000002'::UUID;
  v_bev_3 UUID := '30000000-0000-0000-0000-000000000003'::UUID;
  v_bev_4 UUID := '30000000-0000-0000-0000-000000000004'::UUID;
  v_bev_5 UUID := '30000000-0000-0000-0000-000000000005'::UUID;
  v_bev_6 UUID := '30000000-0000-0000-0000-000000000006'::UUID;
  v_bev_7 UUID := '30000000-0000-0000-0000-000000000007'::UUID;
  v_bev_8 UUID := '30000000-0000-0000-0000-000000000008'::UUID;
  v_bev_9 UUID := '30000000-0000-0000-0000-000000000009'::UUID;
  v_bev_10 UUID := '30000000-0000-0000-0000-000000000010'::UUID;
  v_bev_11 UUID := '30000000-0000-0000-0000-000000000011'::UUID;
  v_bev_12 UUID := '30000000-0000-0000-0000-000000000012'::UUID;
  v_bev_13 UUID := '30000000-0000-0000-0000-000000000013'::UUID;
  v_bev_14 UUID := '30000000-0000-0000-0000-000000000014'::UUID;
  v_bev_15 UUID := '30000000-0000-0000-0000-000000000015'::UUID;
  v_bev_16 UUID := '30000000-0000-0000-0000-000000000016'::UUID;
  v_bev_17 UUID := '30000000-0000-0000-0000-000000000017'::UUID;
  v_bev_18 UUID := '30000000-0000-0000-0000-000000000018'::UUID;
  v_bev_19 UUID := '30000000-0000-0000-0000-000000000019'::UUID;
  v_bev_20 UUID := '30000000-0000-0000-0000-000000000020'::UUID;
  v_bev_21 UUID := '30000000-0000-0000-0000-000000000021'::UUID;
  v_bev_22 UUID := '30000000-0000-0000-0000-000000000022'::UUID;
  v_bev_23 UUID := '30000000-0000-0000-0000-000000000023'::UUID;
  v_bev_24 UUID := '30000000-0000-0000-0000-000000000024'::UUID;
  v_bev_25 UUID := '30000000-0000-0000-0000-000000000025'::UUID;
  v_bev_26 UUID := '30000000-0000-0000-0000-000000000026'::UUID;
  v_bev_27 UUID := '30000000-0000-0000-0000-000000000027'::UUID;
  v_bev_28 UUID := '30000000-0000-0000-0000-000000000028'::UUID;

BEGIN

  -- 1. RESOLVE ROOT PROPERTY ID
  SELECT id INTO v_property_id FROM public.properties LIMIT 1;
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Seed Aborted: No property found in properties table. Run Migration 001 seed first.';
  END IF;

  -- 2. SEED CANONICAL MENU CATEGORIES
  INSERT INTO public.menu_categories (id, property_id, name, code, display_order, is_active)
  VALUES
    (v_cat_soups, v_property_id, 'Soups & Shurba', 'CAT-SOUPS', 1, true),
    (v_cat_veg_starters, v_property_id, 'Veg Starters', 'CAT-VEG-STARTERS', 2, true),
    (v_cat_nonveg_starters, v_property_id, 'Non-Veg Starters', 'CAT-NONVEG-STARTERS', 3, true),
    (v_cat_veg_mains, v_property_id, 'Royal Veg Main Course', 'CAT-VEG-MAINS', 4, true),
    (v_cat_nonveg_mains, v_property_id, 'Royal Non-Veg Main Course', 'CAT-NONVEG-MAINS', 5, true),
    (v_cat_biryani, v_property_id, 'Royal Dum Biryani', 'CAT-BIRYANI', 6, true),
    (v_cat_breads, v_property_id, 'Tandoori Breads', 'CAT-BREADS', 7, true),
    (v_cat_desserts, v_property_id, 'Artisanal Desserts', 'CAT-DESSERTS', 8, true),
    (v_cat_beverages, v_property_id, 'Signature Beverages', 'CAT-BEVERAGES', 9, true),
    (v_cat_scotch_whisky, v_property_id, 'Scotch & Whiskies', 'CAT-SCOTCH-WHISKY', 10, true),
    (v_cat_beers, v_property_id, 'Beers & Draft Brews', 'CAT-BEERS', 11, true),
    (v_cat_wines, v_property_id, 'Fine Wines & Sparkles', 'CAT-WINES', 12, true),
    (v_cat_cocktails, v_property_id, 'Handcrafted Cocktails', 'CAT-COCKTAILS', 13, true),
    (v_cat_mocktails, v_property_id, 'Signature Mocktails & Coolers', 'CAT-MOCKTAILS', 14, true),
    (v_cat_refreshers, v_property_id, 'Traditional Beverages', 'CAT-REFRESHERS', 15, true)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- 3. SEED MASTER MENU ITEMS
  INSERT INTO public.menu_items (
    id, property_id, category_id, name, description,
    base_price_paise, gst_rate_percent, is_vegetarian, is_vegan, is_spicy,
    preparation_time_minutes, image_url, target_kitchen_station_code, is_active
  ) VALUES
    -- Soups (CHINESE_CONTINENTAL)
    (
      v_item_tomato_soup, v_property_id, v_cat_soups,
      'Cream of Tomato Soup', 'Slow-simmered ripe plum tomatoes finished with fresh clotted cream and herb croutons.',
      25000, 5.00, true, false, false, 12,
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80',
      'CHINESE_CONTINENTAL', true
    ),
    (
      v_item_palak_soup, v_property_id, v_cat_soups,
      'Cream of Palak Soup', 'Velvety farm-fresh spinach puree infused with roasted garlic and light cream.',
      25000, 5.00, true, false, false, 12,
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80',
      'CHINESE_CONTINENTAL', true
    ),

    -- Starters (TANDOOR & CHINESE_CONTINENTAL)
    (
      v_item_paneer_tikka, v_property_id, v_cat_veg_starters,
      'Paneer Tikka Angaar', 'Fresh malai paneer cubes marinated in Kashmiri red chillies and mustard oil, roasted in clay tandoor.',
      38000, 5.00, true, false, true, 18,
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80',
      'TANDOOR', true
    ),
    (
      v_item_hara_bhara, v_property_id, v_cat_veg_starters,
      'Hara Bhara Kebab', 'Pan-seared spinach, green peas, and fresh cottage cheese patties spiked with roasted cumin.',
      32000, 5.00, true, false, false, 15,
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80',
      'TANDOOR', true
    ),
    (
      v_item_murgh_malai, v_property_id, v_cat_nonveg_starters,
      'Murgh Malai Kebab', 'Tender boneless chicken morsels steeped in cheese, cardamom, and fresh cream, charred over charcoal.',
      46000, 5.00, false, false, false, 20,
      'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
      'TANDOOR', true
    ),
    (
      v_item_crispy_corn, v_property_id, v_cat_veg_starters,
      'Crispy Corn & Water Chestnut', 'Wok tossed sweet corn and water chestnuts seasoned with pepper and sesame.',
      29000, 5.00, true, true, true, 12,
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
      'CHINESE_CONTINENTAL', true
    ),

    -- Main Course Curries & Dal (CURRY)
    (
      v_item_dal_makhani, v_property_id, v_cat_veg_mains,
      'Dal Makhani Heritage', 'Black lentils slow-cooked for 18 hours on smoldering charcoal with fresh butter and vine-ripened tomatoes.',
      38000, 5.00, true, false, false, 15,
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
      'CURRY', true
    ),
    (
      v_item_paneer_butter, v_property_id, v_cat_veg_mains,
      'Paneer Butter Masala', 'Soft cottage cheese simmered in a velvety makhani gravy flavoured with dried fenugreek.',
      42000, 5.00, true, false, false, 18,
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
      'CURRY', true
    ),
    (
      v_item_butter_chicken, v_property_id, v_cat_nonveg_mains,
      'Butter Chicken Old Delhi', 'Succulent clay-oven tandoori chicken simmered in a rich tomato, butter, and cashew gravy.',
      52000, 5.00, false, false, false, 22,
      'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
      'CURRY', true
    ),

    -- Dum Biryani (CURRY)
    (
      v_item_murgh_biryani, v_property_id, v_cat_biryani,
      'Murgh Dum Biryani', 'Fragrant aged basmati rice layered with spiced tender chicken morsels, brown onions and saffron.',
      45000, 5.00, false, false, true, 25,
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
      'CURRY', true
    ),
    (
      v_item_veg_biryani, v_property_id, v_cat_biryani,
      'Dum Biryani Subz', 'Aged basmati rice layered with seasonal farm vegetables, brown onions and fragrant whole spices.',
      36000, 5.00, true, false, true, 20,
      'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=80',
      'CURRY', true
    ),

    -- Breads (TANDOOR)
    (
      v_item_butter_naan, v_property_id, v_cat_breads,
      'Butter Naan', 'Traditional leavened flatbread brushed with rich churned dairy butter, baked in clay tandoor oven.',
      9000, 5.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
      'TANDOOR', true
    ),
    (
      v_item_tandoori_roti, v_property_id, v_cat_breads,
      'Tandoori Roti', 'Whole wheat flatbread blistered to perfection against earthen walls of charcoal tandoor.',
      6000, 5.00, true, true, false, 5,
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
      'TANDOOR', true
    ),

    -- Desserts (PANTRY)
    (
      v_item_gulab_jamun, v_property_id, v_cat_desserts,
      'Gulab Jamun with Rabri', 'Golden fried khoya dumplings soaked in saffron syrup, served alongside thickened reduced rabri.',
      22000, 5.00, true, false, false, 8,
      'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80',
      'PANTRY', true
    ),

    -- Beverages (BAR)
    (
      v_item_mojito, v_property_id, v_cat_beverages,
      'Virgin Mojito', 'Crushed garden mint, lime wedges, Demerara sugar, and sparkling soda over crushed ice.',
      22000, 5.00, true, true, false, 5,
      'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_item_mango_cooler, v_property_id, v_cat_beverages,
      'Mango Basil Cooler', 'Alphonso mango pulp shaken with sweet basil leaves, lemon juice, and cold sparkling water.',
      24000, 5.00, true, true, false, 5,
      'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),

    -- Bar & Beverages (28 items)
    (
      v_bev_1, v_property_id, v_cat_scotch_whisky,
      'Chivas Regal (12 Year)', 'A radiant warm amber blend of the finest malt and grain Scotch whiskies matured for at least 12 years.<!--portions:[{"label":"30ml Peg","price":450},{"label":"60ml Peg","price":850}]-->',
      45000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_2, v_property_id, v_cat_scotch_whisky,
      'Johnnie Walker Black Label', 'Iconic rich, smooth blend of whiskies matured for 12 years from the four corners of Scotland with subtle peat smoke.<!--portions:[{"label":"30ml Peg","price":450},{"label":"60ml Peg","price":850}]-->',
      45000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_3, v_property_id, v_cat_scotch_whisky,
      'Jack Daniel''s Old No. 7', 'Charcoal mellowed drop by drop through 10 feet of sugar maple charcoal, matured in handcrafted white oak barrels.<!--portions:[{"label":"30ml Peg","price":410},{"label":"60ml Peg","price":820}]-->',
      41000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_4, v_property_id, v_cat_scotch_whisky,
      'Jameson Irish Whiskey', 'Triple distilled pot still and fine grain whiskey, offering notes of vanilla, spice and roasted oak.<!--portions:[{"label":"30ml Peg","price":310},{"label":"60ml Peg","price":560}]-->',
      31000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_5, v_property_id, v_cat_scotch_whisky,
      'Black Dog Triple Gold Reserve', 'Triple reserve blended scotch expertly crafted and rested in Oloroso sherry butts for exceptional depth.<!--portions:[{"label":"30ml Peg","price":310},{"label":"60ml Peg","price":590}]-->',
      31000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_6, v_property_id, v_cat_scotch_whisky,
      'Blenders Pride Reserve', 'Rich blend of imported scotch malts and selected Indian grain spirits with smoky oak and honey undertones.<!--portions:[{"label":"30ml Peg","price":190},{"label":"60ml Peg","price":290}]-->',
      19000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_7, v_property_id, v_cat_beers,
      'Bira 91 White Pitcher', 'Low bitterness wheat beer with a hint of spicy citrus and coriander, served ice cold in 1500ml sharing pitcher.',
      80000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_8, v_property_id, v_cat_beers,
      'Budweiser Magnum (650ml)', 'Crisp, clean and refreshing beechwood aged lager brewed for maximum smoothness.<!--portions:[{"label":"Mild (650ml)","price":360},{"label":"Magnum Strong (650ml)","price":370}]-->',
      36000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_9, v_property_id, v_cat_beers,
      'Corona Extra (330ml)', 'Golden Mexican lager served traditionally with a fresh slice of lime wedged in the neck.',
      38000, 10.00, true, false, false, 4,
      'https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_10, v_property_id, v_cat_beers,
      'Hoegaarden Belgian Wheat', 'Authentic Belgian witbier naturally cloudy with orange peel and coriander aromatics.',
      38000, 10.00, true, false, false, 4,
      'https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_11, v_property_id, v_cat_wines,
      'Sula Cabernet Shiraz', 'Medium-bodied ruby red wine boasting aromas of dark cherries, blackberry and warm peppery oak.<!--portions:[{"label":"By Glass","price":270},{"label":"Pint (375ml)","price":790},{"label":"Bottle (750ml)","price":1450}]-->',
      27000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_12, v_property_id, v_cat_wines,
      'Sula Chenin Blanc', 'Delightful semi-dry white wine loaded with tropical pineapple, green apple and pear bouquets.<!--portions:[{"label":"By Glass","price":280},{"label":"Pint (375ml)","price":790},{"label":"Bottle (750ml)","price":1440}]-->',
      28000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_13, v_property_id, v_cat_wines,
      'Sula Brut Tropical Champagne', 'Fine sparkling wine with persistent effervescent beads, passion fruit and white floral highlights.',
      225000, 10.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_14, v_property_id, v_cat_cocktails,
      'Long Island Iced Tea (LIIT)', 'Potent blend of 5 white spirits (Vodka, Gin, Tequila, White Rum, Triple Sec) with fresh lime juice and a dash of cola.',
      53000, 10.00, true, false, false, 7,
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_15, v_property_id, v_cat_cocktails,
      'Blue Lagoon', 'Premium vodka, vibrant Blue Curaçao, freshly squeezed lime juice and crisp lemon-lime soda over crushed ice.',
      41000, 10.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_16, v_property_id, v_cat_cocktails,
      'Piña Colada', 'Smooth Caribbean white rum, farm fresh pineapple juice, rich coconut cream and vanilla bean gelato.',
      33000, 10.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_17, v_property_id, v_cat_cocktails,
      'Bull Frog', '5 white spirits, blue curaçao, cubed ice, fresh lime and topped with an ice cold can of Red Bull energy.',
      58000, 10.00, true, false, false, 8,
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_18, v_property_id, v_cat_cocktails,
      'Tequila Sunrise', 'Silver tequila and vodka poured over chilled Florida orange juice with a ruby layer of grenadine syrup.',
      49000, 10.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_19, v_property_id, v_cat_cocktails,
      'Classic Margarita', 'Mexican agave tequila, triple sec, fresh lime sour, shaken hard and served in a salted rim glass.',
      47000, 10.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_20, v_property_id, v_cat_mocktails,
      'Delight of Pali Village', 'Alphonso mango, Valencia orange & pineapple juice blended with mango vanilla ice-cream, peach-apricot crush topped with exotic litchi.',
      28000, 5.00, true, false, false, 7,
      'https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_21, v_property_id, v_cat_mocktails,
      'Madhu Milan', 'Golden pineapple & mango nectar, pure forest honey, clotted vanilla bean cream and diced seasonal fruits.',
      23000, 5.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_22, v_property_id, v_cat_mocktails,
      'Fruit Punch', 'Orange, pineapple and mango juice shaken with strawberry puree and topped with a scoop of vanilla ice-cream.',
      23000, 5.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_23, v_property_id, v_cat_mocktails,
      'Cupid''s Mischief', 'Pressed crisp apple juice infused with vanilla ice-cream and topped with whole lychee fruit.',
      23000, 5.00, true, false, false, 6,
      'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_24, v_property_id, v_cat_mocktails,
      'Spicy Guava Cooler', 'Ripe pink guava nectar seasoned with lime juice, black rock salt, cracked pepper and red chili spiced rim.',
      22000, 5.00, true, false, true, 5,
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_25, v_property_id, v_cat_mocktails,
      'Cinderella', 'Sparkling combination of orange juice, ruby grenadine syrup and bubbly iced club soda with mint leaves.',
      21000, 5.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_26, v_property_id, v_cat_refreshers,
      'Matka Chaas', 'Churned probiotic curd tempered with roasted cumin seeds, ginger, rock salt and fresh coriander served in clay matka.<!--portions:[{"label":"Glass","price":60},{"label":"Earthen Matka","price":310}]-->',
      6000, 5.00, true, false, false, 4,
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_27, v_property_id, v_cat_refreshers,
      'Punjabi Malai Lassi', 'Thick sweet yogurt churned velvety smooth, crowned with clotted malai and crushed cardamom.<!--portions:[{"label":"Glass","price":110},{"label":"Earthen Matka","price":390}]-->',
      11000, 5.00, true, false, false, 5,
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    ),
    (
      v_bev_28, v_property_id, v_cat_refreshers,
      'Fresh Lime Soda / Water', 'Freshly squeezed lime juice with your choice of chilled club soda or mountain spring water, sweet or salted.<!--portions:[{"label":"Sweet","price":60},{"label":"Salted","price":60},{"label":"Mixed (Sweet & Salt)","price":60}]-->',
      6000, 5.00, true, false, false, 4,
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
      'BAR', true
    )
  ON CONFLICT (id) DO NOTHING;

  -- 4. SEED OUTLET MENU MAPPINGS FOR rest-1 (Heritage Dining Room)
  INSERT INTO public.outlet_menu_items (
    outlet_id, menu_item_id, price_override_paise, is_available, display_order
  ) VALUES
    ('rest-1', v_item_tomato_soup, NULL, true, 1),
    ('rest-1', v_item_palak_soup, NULL, true, 2),
    ('rest-1', v_item_paneer_tikka, NULL, true, 3),
    ('rest-1', v_item_hara_bhara, NULL, true, 4),
    ('rest-1', v_item_murgh_malai, NULL, true, 5),
    ('rest-1', v_item_crispy_corn, NULL, true, 6),
    ('rest-1', v_item_dal_makhani, NULL, true, 7),
    ('rest-1', v_item_paneer_butter, NULL, true, 8),
    ('rest-1', v_item_butter_chicken, NULL, true, 9),
    ('rest-1', v_item_murgh_biryani, NULL, true, 10),
    ('rest-1', v_item_veg_biryani, NULL, true, 11),
    ('rest-1', v_item_butter_naan, NULL, true, 12),
    ('rest-1', v_item_tandoori_roti, NULL, true, 13),
    ('rest-1', v_item_gulab_jamun, NULL, true, 14),
    ('rest-1', v_item_mojito, NULL, true, 15),
    ('rest-1', v_item_mango_cooler, NULL, true, 16),
    ('rest-1', v_bev_1, NULL, true, 101),
    ('rest-1', v_bev_2, NULL, true, 102),
    ('rest-1', v_bev_3, NULL, true, 103),
    ('rest-1', v_bev_4, NULL, true, 104),
    ('rest-1', v_bev_5, NULL, true, 105),
    ('rest-1', v_bev_6, NULL, true, 106),
    ('rest-1', v_bev_7, NULL, true, 107),
    ('rest-1', v_bev_8, NULL, true, 108),
    ('rest-1', v_bev_9, NULL, true, 109),
    ('rest-1', v_bev_10, NULL, true, 110),
    ('rest-1', v_bev_11, NULL, true, 111),
    ('rest-1', v_bev_12, NULL, true, 112),
    ('rest-1', v_bev_13, NULL, true, 113),
    ('rest-1', v_bev_14, NULL, true, 114),
    ('rest-1', v_bev_15, NULL, true, 115),
    ('rest-1', v_bev_16, NULL, true, 116),
    ('rest-1', v_bev_17, NULL, true, 117),
    ('rest-1', v_bev_18, NULL, true, 118),
    ('rest-1', v_bev_19, NULL, true, 119),
    ('rest-1', v_bev_20, NULL, true, 120),
    ('rest-1', v_bev_21, NULL, true, 121),
    ('rest-1', v_bev_22, NULL, true, 122),
    ('rest-1', v_bev_23, NULL, true, 123),
    ('rest-1', v_bev_24, NULL, true, 124),
    ('rest-1', v_bev_25, NULL, true, 125),
    ('rest-1', v_bev_26, NULL, true, 126),
    ('rest-1', v_bev_27, NULL, true, 127),
    ('rest-1', v_bev_28, NULL, true, 128)
  ON CONFLICT (outlet_id, menu_item_id) DO NOTHING;

  -- 5. SEED OUTLET MENU MAPPINGS FOR rest-2 (Palm Deck & Bar)
  INSERT INTO public.outlet_menu_items (
    outlet_id, menu_item_id, price_override_paise, is_available, display_order
  ) VALUES
    ('rest-2', v_item_tomato_soup, NULL, true, 1),
    ('rest-2', v_item_palak_soup, NULL, true, 2),
    ('rest-2', v_item_paneer_tikka, 40000, true, 3),
    ('rest-2', v_item_hara_bhara, NULL, true, 4),
    ('rest-2', v_item_murgh_malai, 48000, true, 5),
    ('rest-2', v_item_crispy_corn, NULL, true, 6),
    ('rest-2', v_item_dal_makhani, NULL, true, 7),
    ('rest-2', v_item_paneer_butter, NULL, true, 8),
    ('rest-2', v_item_butter_chicken, NULL, true, 9),
    ('rest-2', v_item_murgh_biryani, 48000, true, 10),
    ('rest-2', v_item_veg_biryani, NULL, true, 11),
    ('rest-2', v_item_butter_naan, NULL, true, 12),
    ('rest-2', v_item_tandoori_roti, NULL, true, 13),
    ('rest-2', v_item_gulab_jamun, NULL, true, 14),
    ('rest-2', v_item_mojito, 25000, true, 15),
    ('rest-2', v_item_mango_cooler, 26000, true, 16)
  ON CONFLICT (outlet_id, menu_item_id) DO NOTHING;

END $$;
