-- ============================================================================
-- MIGRATION 012: INVENTORY & STOCK CONTROL SEED DATA
-- Pali Resort & Club Operations Platform
--
-- OPERATIONAL INTEGRITY RULE:
-- Zero fake inventory items, simulated stock balances, fake locations, or
-- synthetic recipes are seeded.
--
-- Canonical schema (docs/SCHEMA_DESIGN.md Domain M) defines master inventory
-- catalogs, locations, and movements that populate through verified F&B setup
-- and live operational goods receipts.
--
-- BASELINE STATE:
-- - inventory_items: 0
-- - inventory_locations: 0
-- - inventory_balances: 0
-- - inventory_movements: 0
-- - recipes: 0
-- - recipe_ingredients: 0
-- ============================================================================

DO $$
BEGIN
  -- Safe idempotent placeholder:
  -- Domain M tables initialize at a verified clean zero baseline.
  NULL;
END $$;
