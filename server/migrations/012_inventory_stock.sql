-- ============================================================================
-- MIGRATION 012: INVENTORY & STOCK CONTROL
-- Pali Resort & Club Operations Platform
-- Source of Truth: docs/SCHEMA_DESIGN.md (Domain M, Tables 49–54)
-- ============================================================================

-- 1. INVENTORY ITEMS (Domain M, Table 49)
-- Property master SKUs, raw ingredients, and beverage/linen inventory catalog.
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  item_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 10.000,
  unit_cost_paise BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_inventory_items_code UNIQUE (item_code),
  CONSTRAINT ck_inventory_items_cost CHECK (unit_cost_paise >= 0),
  CONSTRAINT ck_inventory_items_reorder CHECK (reorder_level >= 0),
  CONSTRAINT ck_inventory_items_category CHECK (
    category IN ('FOOD_GRAINS', 'DAIRY', 'MEAT', 'LIQUOR', 'BEVERAGES', 'CLEANING', 'LINEN', 'OTHER')
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_property ON inventory_items(property_id);

-- 2. INVENTORY LOCATIONS (Domain M, Table 50)
-- Physical storerooms, cellars, central warehouses, and outlet pantries.
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id VARCHAR(32) NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_inventory_locations_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_outlet ON inventory_locations(outlet_id);

-- 3. INVENTORY BALANCES (Domain M, Table 51)
-- Current on-hand quantity per item and location.
CREATE TABLE IF NOT EXISTS inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  quantity_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  last_counted_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_inventory_balances_item_loc UNIQUE (item_id, location_id)
);

-- Note: item_id is covered by leading column of uq_inventory_balances_item_loc UNIQUE B-tree index.
CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON inventory_balances(location_id);

-- 4. INVENTORY MOVEMENTS (Domain M, Table 52)
-- Append-only transactional ledger for all inventory receipts, issues, transfers, and wastage.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  movement_type VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  transfer_group_id UUID NULL,
  paired_movement_id UUID NULL REFERENCES inventory_movements(id) ON DELETE RESTRICT,
  reference_document VARCHAR(100) NULL,
  notes TEXT NULL,
  authorized_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_inventory_movements_type CHECK (
    movement_type IN ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTAGE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT')
  ),
  CONSTRAINT ck_inventory_movements_qty CHECK (quantity != 0)
);

CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_location ON inventory_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_transfer_group ON inventory_movements(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_movements_paired ON inventory_movements(paired_movement_id);
CREATE INDEX IF NOT EXISTS idx_movements_staff ON inventory_movements(authorized_by_staff_id);

-- 5. RECIPES (Domain M, Table 53)
-- Bill-of-Materials (BOM) linking a menu item to ingredient consumption.
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  yield_servings INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_recipes_yield CHECK (yield_servings > 0)
);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(menu_item_id);

-- 6. RECIPE INGREDIENTS (Domain M, Table 54)
-- Ingredient quantities required per recipe serving.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_required NUMERIC(12,3) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_recipe_ingredients UNIQUE (recipe_id, inventory_item_id),
  CONSTRAINT ck_recipe_ingredients_qty CHECK (quantity_required > 0)
);

-- Note: recipe_id is covered by leading column of uq_recipe_ingredients UNIQUE B-tree index.
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON recipe_ingredients(inventory_item_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGE HARDENING
-- ============================================================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- 1. Base Table Privilege Isolation:
-- Revoke all direct privileges from public and anon
REVOKE ALL ON TABLE public.inventory_items FROM anon, public;
REVOKE ALL ON TABLE public.inventory_locations FROM anon, public;
REVOKE ALL ON TABLE public.inventory_balances FROM anon, public;
REVOKE ALL ON TABLE public.inventory_movements FROM anon, public;
REVOKE ALL ON TABLE public.recipes FROM anon, public;
REVOKE ALL ON TABLE public.recipe_ingredients FROM anon, public;

-- Grant selective read to authenticated staff:
GRANT SELECT ON TABLE public.inventory_items TO authenticated;
GRANT SELECT ON TABLE public.inventory_locations TO authenticated;
GRANT SELECT ON TABLE public.inventory_balances TO authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;
GRANT SELECT ON TABLE public.recipes TO authenticated;
GRANT SELECT ON TABLE public.recipe_ingredients TO authenticated;

-- Full CRUD granted strictly to backend service_role across all 6 tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_balances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_movements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipe_ingredients TO service_role;

-- 2. Hardened RLS Policies (Capability & Scoped Access Control):

-- Inventory Items: Active items visible to staff with inventory or menu capabilities
CREATE POLICY inventory_items_select_auth ON inventory_items
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      public.has_permission('inventory:view')
      OR public.has_permission('inventory:manage')
      OR public.has_permission('menu:view')
    )
  );

-- Inventory Locations: Active locations visible to inventory staff or assigned outlet staff
CREATE POLICY inventory_locations_select_auth ON inventory_locations
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      public.has_permission('inventory:view')
      OR public.has_permission('inventory:manage')
      OR (outlet_id IS NOT NULL AND public.has_outlet_access(outlet_id))
    )
  );

-- Inventory Balances: Visible to inventory staff or staff authorized for the location's outlet
CREATE POLICY inventory_balances_select_auth ON inventory_balances
  FOR SELECT TO authenticated
  USING (
    public.has_permission('inventory:view')
    OR public.has_permission('inventory:manage')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations il
      WHERE il.id = inventory_balances.location_id
        AND il.outlet_id IS NOT NULL
        AND public.has_outlet_access(il.outlet_id)
    )
  );

-- Inventory Movements: Visible to authorizer, inventory staff, or authorized outlet staff
CREATE POLICY inventory_movements_select_auth ON inventory_movements
  FOR SELECT TO authenticated
  USING (
    authorized_by_staff_id = public.current_staff_id()
    OR public.has_permission('inventory:view')
    OR public.has_permission('inventory:manage')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations il
      WHERE il.id = inventory_movements.location_id
        AND il.outlet_id IS NOT NULL
        AND public.has_outlet_access(il.outlet_id)
    )
  );

-- Recipes: Visible to kitchen, menu, or inventory management staff
CREATE POLICY recipes_select_auth ON recipes
  FOR SELECT TO authenticated
  USING (
    public.has_permission('menu:view')
    OR public.has_permission('inventory:view')
    OR public.has_permission('inventory:manage')
  );

-- Recipe Ingredients: Visible to kitchen, menu, or inventory management staff
CREATE POLICY recipe_ingredients_select_auth ON recipe_ingredients
  FOR SELECT TO authenticated
  USING (
    public.has_permission('menu:view')
    OR public.has_permission('inventory:view')
    OR public.has_permission('inventory:manage')
  );

-- Direct client mutations (INSERT/UPDATE/DELETE) on all 6 tables are blocked.
-- All stock receipts, consumption posts, transfers, wastage adjustments, and recipe updates
-- must route through the trusted Express backend API via Service Role.
