-- ============================================================================
-- MIGRATION 001: FOUNDATION SEED DATA (SAFE DEVELOPMENT ENVIRONMENT)
-- Pali Resort & Club Operations Platform
-- ============================================================================

DO $$
DECLARE
  v_property_id UUID;
BEGIN
  -- ============================================================
  -- DEVELOPMENT PLACEHOLDER DATA
  -- The GSTIN, FSSAI licence, address, phone and email below are
  -- placeholder/demo values only.
  --
  -- They MUST be replaced with actual verified business information
  -- before production deployment.
  -- ============================================================

  -- 1. SEED MASTER PROPERTY
  -- Deterministic UUID for local/development repeatability
  v_property_id := '00000000-0000-0000-0000-000000000001'::UUID;

  INSERT INTO properties (
    id,
    name,
    legal_entity_name,
    gstin,
    fssai_license_number,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    phone,
    email,
    currency
  ) VALUES (
    v_property_id,
    'Pali Resort & Club',
    'Pali Resort & Hospitality Private Limited',
    '27AAAAA0000A1Z5',
    '11522000000001',
    'Plot 42, Pali-Khopoli Road, Off Mumbai-Goa Highway',
    'Near Sarasgad Fort Foothills',
    'Pali',
    'Maharashtra',
    '410205',
    '+91-9876543210',
    'operations@paliresort.com',
    'INR'
  )
  ON CONFLICT (gstin) DO UPDATE SET
    name = EXCLUDED.name,
    legal_entity_name = EXCLUDED.legal_entity_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_property_id;

  -- Fallback if conflict did not return
  IF v_property_id IS NULL THEN
    SELECT id INTO v_property_id FROM properties WHERE gstin = '27AAAAA0000A1Z5';
  END IF;

  -- 2. SEED OUTLETS
  -- Outlet 1: Main Heritage Dining Room
  INSERT INTO outlets (
    id,
    property_id,
    name,
    outlet_type,
    invoice_series_prefix,
    is_active,
    operating_hours
  ) VALUES (
    'rest-1',
    v_property_id,
    'Heritage Dining Room',
    'FINE_DINING',
    'HDR-',
    true,
    '{"opens": "07:00", "closes": "23:00"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    outlet_type = EXCLUDED.outlet_type,
    invoice_series_prefix = EXCLUDED.invoice_series_prefix,
    is_active = EXCLUDED.is_active,
    operating_hours = EXCLUDED.operating_hours,
    updated_at = CURRENT_TIMESTAMP;

  -- Outlet 2: Palm Deck & Bar
  INSERT INTO outlets (
    id,
    property_id,
    name,
    outlet_type,
    invoice_series_prefix,
    is_active,
    operating_hours
  ) VALUES (
    'rest-2',
    v_property_id,
    'Palm Deck & Bar',
    'BAR_LOUNGE',
    'PDB-',
    true,
    '{"opens": "11:00", "closes": "23:59"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    outlet_type = EXCLUDED.outlet_type,
    invoice_series_prefix = EXCLUDED.invoice_series_prefix,
    is_active = EXCLUDED.is_active,
    operating_hours = EXCLUDED.operating_hours,
    updated_at = CURRENT_TIMESTAMP;

  -- 3. SEED OUTLET SETTINGS
  -- Settings for rest-1 (Approved defaults)
  INSERT INTO outlet_settings (
    outlet_id,
    default_gst_rate_percent,
    cgst_rate_percent,
    sgst_rate_percent,
    service_charge_percent,
    max_auto_round_off_paise,
    waiter_max_discount_percent,
    waiter_max_discount_paise,
    manager_max_discount_percent,
    manager_max_discount_paise,
    approval_escalation_wait_minutes,
    allow_customer_order_punch,
    discount_gst_treatment
  ) VALUES (
    'rest-1',
    5.00,
    2.50,
    2.50,
    0.00, -- Voluntary policy (CCPA guidelines)
    50,
    0.00,
    0,
    15.00,
    150000, -- Rs. 1,500 max manager discount
    5,
    true,
    'PRE_TAX_DISCOUNT' -- Configurable legal open decision
  )
  ON CONFLICT (outlet_id) DO UPDATE SET
    default_gst_rate_percent = EXCLUDED.default_gst_rate_percent,
    cgst_rate_percent = EXCLUDED.cgst_rate_percent,
    sgst_rate_percent = EXCLUDED.sgst_rate_percent,
    service_charge_percent = EXCLUDED.service_charge_percent,
    manager_max_discount_percent = EXCLUDED.manager_max_discount_percent,
    manager_max_discount_paise = EXCLUDED.manager_max_discount_paise,
    updated_at = CURRENT_TIMESTAMP;

  -- Settings for rest-2 (Approved defaults)
  INSERT INTO outlet_settings (
    outlet_id,
    default_gst_rate_percent,
    cgst_rate_percent,
    sgst_rate_percent,
    service_charge_percent,
    max_auto_round_off_paise,
    waiter_max_discount_percent,
    waiter_max_discount_paise,
    manager_max_discount_percent,
    manager_max_discount_paise,
    approval_escalation_wait_minutes,
    allow_customer_order_punch,
    discount_gst_treatment
  ) VALUES (
    'rest-2',
    5.00,
    2.50,
    2.50,
    0.00,
    50,
    0.00,
    0,
    15.00,
    150000,
    5,
    true,
    'PRE_TAX_DISCOUNT'
  )
  ON CONFLICT (outlet_id) DO UPDATE SET
    default_gst_rate_percent = EXCLUDED.default_gst_rate_percent,
    cgst_rate_percent = EXCLUDED.cgst_rate_percent,
    sgst_rate_percent = EXCLUDED.sgst_rate_percent,
    service_charge_percent = EXCLUDED.service_charge_percent,
    manager_max_discount_percent = EXCLUDED.manager_max_discount_percent,
    manager_max_discount_paise = EXCLUDED.manager_max_discount_paise,
    updated_at = CURRENT_TIMESTAMP;

  -- 4. SEED DINING ZONES
  -- rest-1 zones
  INSERT INTO dining_zones (outlet_id, name, code, display_order, is_active)
  VALUES 
    ('rest-1', 'Heritage Courtyard (AC)', 'ZONE-AC', 1, true),
    ('rest-1', 'Verandah Garden', 'ZONE-VRN', 2, true)
  ON CONFLICT (outlet_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

  -- rest-2 zones
  INSERT INTO dining_zones (outlet_id, name, code, display_order, is_active)
  VALUES 
    ('rest-2', 'Poolside Deck', 'ZONE-DCK', 1, true),
    ('rest-2', 'Upper Sunset Lounge', 'ZONE-LNG', 2, true)
  ON CONFLICT (outlet_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

END $$;
