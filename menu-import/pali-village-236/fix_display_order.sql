BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
IF current_database() <> 'pali_resort_staging' THEN
RAISE EXCEPTION 'Wrong database';
END IF;
END $$;

UPDATE public.outlet_menu_items omi
SET display_order = 1
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Cream of Palak Soup'
  AND mi.section_name = 'Indian Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 2
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Cream of Tomato'
  AND mi.section_name = 'Indian Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 3
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Paya Shorba (2 Pieces)'
  AND mi.section_name = 'Indian Non Veg Soup';


UPDATE public.outlet_menu_items omi
SET display_order = 4
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Mulligatawny Soup Dal Soup'
  AND mi.section_name = 'Indian Non Veg Soup';


UPDATE public.outlet_menu_items omi
SET display_order = 5
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Cream of Chicken Soup'
  AND mi.section_name = 'Indian Non Veg Soup';


UPDATE public.outlet_menu_items omi
SET display_order = 6
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Islamabadi Yakhni Soup'
  AND mi.section_name = 'Indian Non Veg Soup';


UPDATE public.outlet_menu_items omi
SET display_order = 7
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Manchow Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 8
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Sweet Corn Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 9
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Clear Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 10
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Talumein Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 11
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Hot & Sour Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 12
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Veg Burnt Garlic Soup'
  AND mi.section_name = 'Chinese Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 13
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Manchow Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 14
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Sweet Corn Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 15
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Clear Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 16
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Talumein Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 17
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Hot & Sour Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 18
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Chicken Burnt Garlic Soup'
  AND mi.section_name = 'Chinese Non Veg Soups';


UPDATE public.outlet_menu_items omi
SET display_order = 19
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Green Salad'
  AND mi.section_name = 'Salads';


UPDATE public.outlet_menu_items omi
SET display_order = 20
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Russian Salad Veg'
  AND mi.section_name = 'Salads';


UPDATE public.outlet_menu_items omi
SET display_order = 21
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-01'
  AND mi.name = 'Russian Salad Chicken'
  AND mi.section_name = 'Salads';


UPDATE public.outlet_menu_items omi
SET display_order = 22
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Stuffed Mushroom Tandoori'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 23
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Pahadi'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 24
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Veg Makhmali Tikka'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 25
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Baby Corn Mushroom Tandoori'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 26
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Broccoli Banjara Tikka'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 27
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Pall Top'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 28
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Tiranga Tikka'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 29
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Malai'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 30
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cauliflower Tiranga'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 31
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Banjara'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 32
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Tandoori ki Bahar'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 33
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Baby Aloo Tikka'
  AND mi.section_name = 'Veg Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 34
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Masala Omelette'
  AND mi.section_name = 'Non Veg Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 35
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Masala Bhurji'
  AND mi.section_name = 'Non Veg Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 36
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Kalimiri Chicken Fry'
  AND mi.section_name = 'Non Veg Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 37
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Mutton Chaap Masala Dry'
  AND mi.section_name = 'Non Veg Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 38
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Koliwada'
  AND mi.section_name = 'Non Veg Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 39
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Pomfret Tandoori'
  AND mi.section_name = 'Seafood Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 40
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Surmai Tawa Fry'
  AND mi.section_name = 'Seafood Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 41
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'King Prawns Kolkata'
  AND mi.section_name = 'Seafood Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 42
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Bombil Fry'
  AND mi.section_name = 'Seafood Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 43
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Stuffed Bombe Dry'
  AND mi.section_name = 'Seafood Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 44
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Tandoori Chicken'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 45
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Jungle Chicken Tikka'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 46
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Tikka'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 47
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Achari Tikka'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 48
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Tiranga Kabab'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 49
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Malai Tikka'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 50
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Reshmi'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 51
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Angara Tikka'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 52
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Malaysian Kebab'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 53
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Moong Mumtaz Tangdi (4 Pieces)'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 54
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Chicken Banjara'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 55
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Tandoori Chicken Afghani'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 56
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Tandoori Chaap'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 57
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Mutton Seekh Kabab'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 58
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Raan E Sikandari'
  AND mi.section_name = 'Chicken Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 59
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Prawns Tandoori'
  AND mi.section_name = 'Seafood Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 60
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Rawas Tikka'
  AND mi.section_name = 'Seafood Tandoori Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 61
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Bhindi Kurkure'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 62
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Corn Aloo Tikki'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 63
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cheese Balls'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 64
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cheese Corn Balls'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 65
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Hara Bhara Kabab'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 66
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cashew Nut Koliwada'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 67
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cashew Nut Fry'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 68
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Veg Cashew Nut Roll'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 69
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Veg Bruschetta'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 70
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Garlic Toast'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 71
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Cheese Chilli Toast'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 72
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Koliwada'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 73
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-02'
  AND mi.name = 'Paneer Pakoda'
  AND mi.section_name = 'Veg Tawa Starters';


UPDATE public.outlet_menu_items omi
SET display_order = 74
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Makhani'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 75
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Banjara Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 76
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Tikka Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 77
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Rara Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 78
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Punjabi Dahi Kadi Pakoda'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 79
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Dal Tadka'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 80
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Kolhapuri'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 81
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Sigdi'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 82
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Tawa Sabji'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 83
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Kadai'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 84
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Navratan Korma'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 85
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Makhani'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 86
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chana Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 87
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Palak Paneer'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 88
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Dal Fry'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 89
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Dal Makhanwala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 90
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Butter Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 91
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Lajawab'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 92
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Pasanda'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 93
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Paneer Lazeez'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 94
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Kofta'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 95
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Nargisi Kofta Curry'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 96
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Seekh Kebab Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 97
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Methi Matar Malai'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 98
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Cheese Butter Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 99
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Bhutta Shimla Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 100
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Mughlai'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 101
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Handi'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 102
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Patiala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 103
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Veg Koliwada Masala'
  AND mi.section_name = 'Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 104
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Butter Chicken'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 105
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Rara Masala'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 106
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Tikka Masala'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 107
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Egg Masala'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 108
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Murgh Mussalam'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 109
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Matki Murgh'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 110
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Sigdi'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 111
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Egg Curry'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 112
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Murg Mughalai'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 113
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Handi'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 114
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Badami Chicken'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 115
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Kasoori Methi Chicken'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 116
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Tawa Chicken'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 117
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Pasanda'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 118
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Nimbu'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 119
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Nargisi Kofta Chicken Curry'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 120
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Kolhapuri'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 121
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Chicken Banjara Masala'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 122
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Murgh Matki'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 123
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Dhaniya Chicken'
  AND mi.section_name = 'Non Veg Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 124
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Rogan Josh'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 125
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Chaap Masala'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 126
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Bhuna Gosht'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 127
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Keema Matar'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 128
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Handi'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 129
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Curry'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 130
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Dhuwa Masala'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 131
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-03'
  AND mi.name = 'Mutton Malwani Curry'
  AND mi.section_name = 'Raan Special';


UPDATE public.outlet_menu_items omi
SET display_order = 132
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Wheat Roti'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 133
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Wheat Paratha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 134
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Laccha Naan'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 135
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Missi Roti'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 136
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Makai Roti'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 137
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Khasta Roti'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 138
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Dhaniya Paratha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 139
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Pudhina Paratha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 140
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Methi Paratha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 141
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Kulcha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 142
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Stuffed Kulcha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 143
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Kheema Naan'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 144
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Kheema Kulcha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 145
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Paneer Kulcha'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 146
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Cheese Garlic Naan'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 147
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-04'
  AND mi.name = 'Roti Ki Tokri'
  AND mi.section_name = 'Breads';


UPDATE public.outlet_menu_items omi
SET display_order = 148
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Dal Khichdi'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 149
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Jeera Rice'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 150
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Palak Khichdi'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 151
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Sabji Pulao'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 152
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Biryani Rice'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 153
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Curd Rice'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 154
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Steam Rice'
  AND mi.section_name = 'Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 155
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Chicken Dum Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 156
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Veg Dum Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 157
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Chicken Tawa Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 158
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Mutton Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 159
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'Veg Tawa Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 160
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-05'
  AND mi.name = 'King Prawns Tikka Biryani'
  AND mi.section_name = 'Biryani';


UPDATE public.outlet_menu_items omi
SET display_order = 161
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'Rawas Fish Sichuan'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 162
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'Rawas Fish Chilli'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 163
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'King Prawns Chilli'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 164
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'Rawas Steak Hot Black Garlic'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 165
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'King Prawns Hot Black Garlic'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 166
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-06'
  AND mi.name = 'King Prawns Golden Fry'
  AND mi.section_name = 'Seafood Appetizers';


UPDATE public.outlet_menu_items omi
SET display_order = 167
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Chicken Chilly Gravy'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 168
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Paneer In Choice Of Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 169
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Assorted Veg With Cashewnut Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 170
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Assorted Veg In Choice Of Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 171
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Chicken In Choice Of Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 172
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Chicken with Cashewnuts'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 173
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Chicken Black Bean Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 174
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'Rawas Fish In Choice Of Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 175
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-07'
  AND mi.name = 'King Prawns In Choice Of Sauce'
  AND mi.section_name = 'Chinese Main Course';


UPDATE public.outlet_menu_items omi
SET display_order = 176
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Triple Sichuan Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 177
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 178
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Triple Sichuan Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 179
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Egg Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 180
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Sichuan Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 181
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 182
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Combination Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 183
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Burnt Garlic Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 184
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Singapore Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 185
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Hongkong Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 186
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Sichuan Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 187
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Burnt Garlic Veg Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 188
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Singapore Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 189
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Hongkong Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 190
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Combination Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 191
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 192
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Singapore Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 193
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Hongkong Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 194
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Triple Schezwan Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 195
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Combination Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 196
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Burnt Garlic Fried Rice'
  AND mi.section_name = 'Fried Rice';


UPDATE public.outlet_menu_items omi
SET display_order = 197
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 198
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Sichuan Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 199
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 200
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg Chowmein'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 201
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Veg American Chopsuey'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 202
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Sichuan Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 203
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken Chowmein'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 204
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Chicken American Chopsuey'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 205
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Sea Food Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 206
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-08'
  AND mi.name = 'Seafood Schezwan Hakka Noodles'
  AND mi.section_name = 'Noodles';


UPDATE public.outlet_menu_items omi
SET display_order = 207
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-09'
  AND mi.name = 'Veg Grilled Cheese Sandwich'
  AND mi.section_name = 'Sandwiches';


UPDATE public.outlet_menu_items omi
SET display_order = 208
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-09'
  AND mi.name = 'Chicken Club Sandwich'
  AND mi.section_name = 'Sandwiches';


UPDATE public.outlet_menu_items omi
SET display_order = 209
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'French Fries'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 210
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Chana Garlic Fry'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 211
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Chinese Bhel'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 212
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Onion Rings'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 213
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Babycorn Mushroom in Choice of Sauce'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 214
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Veg Spring Roll'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 215
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Veg Finger Sichuan'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 216
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Stir Fry Vegetables'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 217
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Boiled Eggs (2 Eggs)'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 218
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Chicken Spring Roll'
  AND mi.section_name = 'Snacks';


UPDATE public.outlet_menu_items omi
SET display_order = 219
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Chana Chat'
  AND mi.section_name = 'Chaats';


UPDATE public.outlet_menu_items omi
SET display_order = 220
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Aloo Chat'
  AND mi.section_name = 'Chaats';


UPDATE public.outlet_menu_items omi
SET display_order = 221
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-10'
  AND mi.name = 'Peanut Chat'
  AND mi.section_name = 'Chaats';


UPDATE public.outlet_menu_items omi
SET display_order = 222
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-11'
  AND mi.name = 'Roasted Papad'
  AND mi.section_name = 'Accompaniments';


UPDATE public.outlet_menu_items omi
SET display_order = 223
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-11'
  AND mi.name = 'Masala Papad'
  AND mi.section_name = 'Accompaniments';


UPDATE public.outlet_menu_items omi
SET display_order = 224
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-11'
  AND mi.name = 'Khicha Papad'
  AND mi.section_name = 'Accompaniments';


UPDATE public.outlet_menu_items omi
SET display_order = 225
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-12'
  AND mi.name = 'Rabdi'
  AND mi.section_name = 'Desserts';


UPDATE public.outlet_menu_items omi
SET display_order = 226
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-12'
  AND mi.name = 'Caramel Custard'
  AND mi.section_name = 'Desserts';


UPDATE public.outlet_menu_items omi
SET display_order = 227
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-12'
  AND mi.name = 'Malai Kulfi'
  AND mi.section_name = 'Desserts';


UPDATE public.outlet_menu_items omi
SET display_order = 228
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-12'
  AND mi.name = 'Gulab Jamun (2 Pieces)'
  AND mi.section_name = 'Desserts';


UPDATE public.outlet_menu_items omi
SET display_order = 229
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Matka Chass'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 230
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Fresh Lime'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 231
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Jal Jeera'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 232
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Lemon Ice Tea'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 233
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Peach Ice Tea'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 234
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Matka Lassi'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 235
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Lassi Glass'
  AND mi.section_name = 'Drinks';


UPDATE public.outlet_menu_items omi
SET display_order = 236
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.menu_item_id = mi.id
  AND omi.outlet_id = 'rest-1'
  AND mc.code = 'PV236-CAT-13'
  AND mi.name = 'Chass Glass'
  AND mi.section_name = 'Drinks';

DO $$ BEGIN
IF (SELECT COUNT(DISTINCT omi.display_order)
FROM public.outlet_menu_items omi
JOIN public.menu_items mi ON mi.id = omi.menu_item_id
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE omi.outlet_id = 'rest-1'
AND mc.code LIKE 'PV236-CAT-%') <> 236 THEN
RAISE EXCEPTION 'Display order validation failed';
END IF;
END $$;
COMMIT;
