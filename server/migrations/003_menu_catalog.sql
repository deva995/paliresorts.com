-- ============================================================================
-- MIGRATION 003: MENU CATALOG & REVISIONS
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain C)
-- ============================================================================

-- 1. MENU CATEGORIES (Domain C, Table 14)
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_menu_categories_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_property ON menu_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(is_active);

-- 2. MENU ITEMS (Domain C, Table 15)
-- Represents the property master catalog item. Stores the currently live approved version.
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  base_price_paise BIGINT NOT NULL,
  gst_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  is_vegan BOOLEAN NOT NULL DEFAULT false,
  is_spicy BOOLEAN NOT NULL DEFAULT false,
  preparation_time_minutes INTEGER NOT NULL DEFAULT 15,
  image_url TEXT NULL,
  target_kitchen_station_code VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_menu_items_base_price CHECK (base_price_paise >= 0),
  CONSTRAINT ck_menu_items_gst_rate CHECK (gst_rate_percent >= 0),
  CONSTRAINT ck_menu_items_prep_time CHECK (preparation_time_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_property ON menu_items(property_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(is_active);

-- 3. OUTLET MENU ITEMS (Domain C, Table 16)
-- Links master items to specific outlets (rest-1, rest-2) with localized price, availability, and sort overrides.
CREATE TABLE IF NOT EXISTS outlet_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  price_override_paise BIGINT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  kitchen_station_override_code VARCHAR(50) NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_outlet_menu_items UNIQUE (outlet_id, menu_item_id),
  CONSTRAINT ck_outlet_menu_price_override CHECK (
    price_override_paise IS NULL OR price_override_paise >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_outlet_menu_item_fk ON outlet_menu_items(menu_item_id);

-- 4. MENU ITEM REVISIONS (Domain C, Table 17)
-- Maker-checker workflow queue for price, item, and availability changes.
CREATE TABLE IF NOT EXISTS menu_item_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL,
  change_summary TEXT NOT NULL,
  proposed_data JSONB NOT NULL,
  previous_data JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  effective_from TIMESTAMPTZ NULL,
  submitted_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_menu_item_revisions_status CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  ),
  CONSTRAINT ck_menu_item_revisions_number CHECK (revision_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_revisions_item ON menu_item_revisions(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_revisions_outlet ON menu_item_revisions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_revisions_submitted_by ON menu_item_revisions(submitted_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_revisions_status ON menu_item_revisions(status);

-- 5. MENU REVISION APPROVALS (Domain C, Table 18)
-- Audit trail of review actions on revisions.
CREATE TABLE IF NOT EXISTS menu_revision_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES menu_item_revisions(id) ON DELETE RESTRICT,
  action VARCHAR(20) NOT NULL,
  reviewed_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  review_notes TEXT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_revision_approvals_action CHECK (action IN ('APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_approvals_rev ON menu_revision_approvals(revision_id);
CREATE INDEX IF NOT EXISTS idx_approvals_reviewed_by ON menu_revision_approvals(reviewed_by_staff_id);

-- ============================================================================
-- MAKER-CHECKER INTEGRITY TRIGGER
-- Prevents a staff member from reviewing or approving their own revision.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_menu_revision_maker_checker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submitted_by UUID;
BEGIN
  SELECT submitted_by_staff_id INTO v_submitted_by
  FROM public.menu_item_revisions
  WHERE id = NEW.revision_id;

  IF v_submitted_by = NEW.reviewed_by_staff_id THEN
    RAISE EXCEPTION 'Maker-Checker Violation: Staff member % cannot approve or reject a revision they submitted.', NEW.reviewed_by_staff_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke direct execution from PUBLIC; function is invoked solely by the database trigger
REVOKE ALL ON FUNCTION public.check_menu_revision_maker_checker() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_menu_revision_maker_checker ON menu_revision_approvals;
CREATE TRIGGER trg_menu_revision_maker_checker
BEFORE INSERT OR UPDATE ON menu_revision_approvals
FOR EACH ROW
EXECUTE FUNCTION public.check_menu_revision_maker_checker();

-- ============================================================================
-- SAFE PUBLIC MENU VIEW FOR FLOOR & FUTURE QR BROWSING
-- Uses security_invoker = true to enforce caller RLS and prevent bypassing security.
-- Resolves effective price: COALESCE(price_override_paise, base_price_paise)
-- Strips internal audit IDs, revision queues, and staff references.
-- ============================================================================

CREATE OR REPLACE VIEW public.public_outlet_menu
WITH (security_invoker = true)
AS
SELECT 
  omi.outlet_id,
  mc.id AS category_id,
  mc.name AS category_name,
  mc.code AS category_code,
  mc.display_order AS category_display_order,
  mi.id AS item_id,
  mi.name AS item_name,
  mi.description,
  COALESCE(omi.price_override_paise, mi.base_price_paise) AS effective_price_paise,
  mi.gst_rate_percent,
  mi.is_vegetarian,
  mi.is_vegan,
  mi.is_spicy,
  mi.preparation_time_minutes,
  mi.image_url,
  omi.is_available,
  COALESCE(omi.kitchen_station_override_code, mi.target_kitchen_station_code) AS kitchen_station_code,
  omi.display_order AS item_display_order
FROM public.outlet_menu_items omi
JOIN public.menu_items mi ON mi.id = omi.menu_item_id
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE mi.is_active = true 
  AND mi.archived_at IS NULL
  AND mc.is_active = true;

-- For Migration 003: Accessible ONLY by authenticated staff.
-- Anonymous QR access is explicitly revoked until guest QR session-token architecture is deployed.
REVOKE ALL ON public.public_outlet_menu FROM anon, public;
GRANT SELECT ON public.public_outlet_menu TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_revision_approvals ENABLE ROW LEVEL SECURITY;

-- 1. Categories & Items: Authenticated staff can view catalog items
CREATE POLICY menu_categories_select_auth ON menu_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY menu_items_select_auth ON menu_items
  FOR SELECT TO authenticated
  USING (is_active = true AND archived_at IS NULL);

CREATE POLICY outlet_menu_items_select_auth ON outlet_menu_items
  FOR SELECT TO authenticated
  USING (true);

-- 2. Revisions & Approvals: Authenticated staff with menu permissions can view
CREATE POLICY menu_revisions_select_auth ON menu_item_revisions
  FOR SELECT TO authenticated
  USING (
    public.has_permission('menu:view') 
    OR public.has_permission('menu:edit') 
    OR public.has_role('SUPER_ADMIN')
  );

CREATE POLICY menu_approvals_select_auth ON menu_revision_approvals
  FOR SELECT TO authenticated
  USING (
    public.has_permission('menu:approve_revisions') 
    OR public.has_role('SUPER_ADMIN')
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on menu tables are blocked for public/anon/authenticated.
-- All catalog updates, price modifications, and approvals must route through the trusted Express backend API via Service Role.
