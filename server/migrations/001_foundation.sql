-- ============================================================================
-- MIGRATION 001: FOUNDATION LAYER
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROPERTIES (Domain A, Table 1)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  legal_entity_name VARCHAR(200) NOT NULL,
  gstin VARCHAR(15) NOT NULL,
  fssai_license_number VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_properties_gstin UNIQUE (gstin),
  CONSTRAINT ck_properties_currency CHECK (currency = 'INR')
);

CREATE INDEX IF NOT EXISTS idx_properties_gstin ON properties(gstin);

-- 3. OUTLETS (Domain A, Table 2)
CREATE TABLE IF NOT EXISTS outlets (
  id VARCHAR(32) PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  outlet_type VARCHAR(50) NOT NULL,
  invoice_series_prefix VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  operating_hours JSONB NOT NULL DEFAULT '{"opens": "07:00", "closes": "23:30"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_outlets_property_prefix UNIQUE (property_id, invoice_series_prefix),
  CONSTRAINT ck_outlets_type CHECK (outlet_type IN ('FINE_DINING', 'BAR_LOUNGE', 'POOL_DECK', 'ROOM_SERVICE', 'BANQUET'))
);

CREATE INDEX IF NOT EXISTS idx_outlets_property ON outlets(property_id);

-- 4. OUTLET SETTINGS (Domain A, Table 3)
CREATE TABLE IF NOT EXISTS outlet_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  default_gst_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  cgst_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 2.50,
  sgst_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 2.50,
  service_charge_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  max_auto_round_off_paise INTEGER NOT NULL DEFAULT 50,
  waiter_max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  waiter_max_discount_paise BIGINT NOT NULL DEFAULT 0,
  manager_max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  manager_max_discount_paise BIGINT NOT NULL DEFAULT 150000,
  approval_escalation_wait_minutes INTEGER NOT NULL DEFAULT 5,
  allow_customer_order_punch BOOLEAN NOT NULL DEFAULT true,
  discount_gst_treatment VARCHAR(30) NOT NULL DEFAULT 'PRE_TAX_DISCOUNT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_outlet_settings_outlet UNIQUE (outlet_id),
  CONSTRAINT ck_outlet_settings_gst_rates CHECK (
    default_gst_rate_percent >= 0 AND 
    cgst_rate_percent >= 0 AND 
    sgst_rate_percent >= 0
  ),
  CONSTRAINT ck_outlet_settings_service_charge CHECK (
    service_charge_percent >= 0 AND 
    service_charge_percent <= 30.00
  ),
  CONSTRAINT ck_outlet_settings_waiter_discount CHECK (
    waiter_max_discount_percent >= 0 AND 
    waiter_max_discount_percent <= 100.00 AND 
    waiter_max_discount_paise >= 0
  ),
  CONSTRAINT ck_outlet_settings_manager_discount CHECK (
    manager_max_discount_percent >= 0 AND 
    manager_max_discount_percent <= 100.00 AND 
    manager_max_discount_paise >= 0
  ),
  CONSTRAINT ck_outlet_settings_round_off CHECK (max_auto_round_off_paise >= 0),
  CONSTRAINT ck_outlet_settings_escalation CHECK (approval_escalation_wait_minutes > 0),
  CONSTRAINT ck_outlet_settings_discount_treatment CHECK (
    discount_gst_treatment IN ('PRE_TAX_DISCOUNT', 'POST_TAX_CREDIT')
  )
);

CREATE INDEX IF NOT EXISTS idx_outlet_settings_outlet ON outlet_settings(outlet_id);

-- 5. OUTLET COUNTERS (Domain A, Table 4)
CREATE TABLE IF NOT EXISTS outlet_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  counter_type VARCHAR(50) NOT NULL,
  partition_key VARCHAR(50) NOT NULL,
  current_val BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_outlet_counters_composite UNIQUE (outlet_id, counter_type, partition_key),
  CONSTRAINT ck_outlet_counters_type CHECK (counter_type IN ('DAILY_ORDER', 'DAILY_KOT', 'INVOICE')),
  CONSTRAINT ck_outlet_counters_val CHECK (current_val >= 0)
);

CREATE INDEX IF NOT EXISTS idx_counters_lookup ON outlet_counters(outlet_id, counter_type, partition_key);

-- 6. DINING ZONES (Domain A, Table 5)
CREATE TABLE IF NOT EXISTS dining_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dining_zones_outlet_code UNIQUE (outlet_id, code)
);

CREATE INDEX IF NOT EXISTS idx_dining_zones_outlet ON dining_zones(outlet_id);

-- ROW LEVEL SECURITY (Backstop: Direct Browser Mutations Blocked)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_zones ENABLE ROW LEVEL SECURITY;
