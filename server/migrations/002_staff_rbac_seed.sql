-- ============================================================================
-- MIGRATION 002: STAFF & RBAC SEED DATA (ROLES & PERMISSIONS)
-- Pali Resort & Club Operations Platform
--
-- EXACT COUNT: 15 Roles, 31 Canonical Permissions.
-- Note: NO fake Supabase Auth users or mock passwords are created here.
-- ============================================================================

DO $$
BEGIN

  -- 1. SEED 15 APPROVED ROLES
  INSERT INTO roles (id, display_name, description, is_system_role)
  VALUES
    ('SUPER_ADMIN', 'Super Administrator', 'Full platform and infrastructure administration', true),
    ('RESTAURANT_OWNER', 'Restaurant Owner', 'Full property executive authority, approvals, and reporting', true),
    ('WAITER_MANAGER', 'Waiter Floor Manager', 'Floor leadership, table supervisory allocations, and discount approvals', true),
    ('WAITER', 'Food & Beverage Steward', 'Floor table service, order punching, and guest assistance', true),
    ('KITCHEN_STAFF', 'Kitchen Staff', 'Food preparation and station production', true),
    ('KITCHEN_USER', 'Kitchen User', 'Kitchen station display operator', true),
    ('KITCHEN_COOKING', 'Line Cook / Chef de Partie', 'Hot kitchen line cooking and dish completion', true),
    ('KITCHEN_BAR', 'Bar Tender / Mixologist', 'Beverage and cocktail dispense station', true),
    ('BEVERAGES', 'Beverage Steward', 'Non-alcoholic and hot beverage station dispense', true),
    ('DRINKS', 'Drinks Runner', 'Bar and beverage order delivery to dining floors', true),
    ('KITCHEN_EXECUTIVE', 'Executive Chef / Kitchen Manager', 'Kitchen operational leadership, menu timing, and 86 item control', true),
    ('CASHIER', 'Billing Cashier', 'Bill generation, discount processing, and payment collection', true),
    ('RECEPTIONIST', 'Front Desk Receptionist', 'Hotel guest check-in, room stay management, and folio charges', true),
    ('HOUSEKEEPING', 'Housekeeping Staff', 'Room turnover cleaning, inspection, and defect reporting', true),
    ('ROOM_SERVICE', 'In-Room Dining Attendant', 'Room delivery orders, amenity setup, and folio posting', true)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

  -- 2. SEED EXACTLY 31 CANONICAL PERMISSIONS
  INSERT INTO permissions (id, module, description)
  VALUES
    -- Floor & Tables (3)
    ('table:view', 'FLOOR', 'View dining floor tables, zones, and current seating status'),
    ('table:assign', 'FLOOR', 'Self-assign or reassign floor tables to stewards'),
    ('table:manage', 'FLOOR', 'Configure dining tables, zones, capacities, and QR tokens'),

    -- Orders (4)
    ('order:view', 'ORDER', 'View dining orders, rounds, and items across outlets'),
    ('order:create', 'ORDER', 'Punch and submit dining or room service orders'),
    ('order:update', 'ORDER', 'Update order instructions or modify unconfirmed rounds'),
    ('order:cancel', 'ORDER', 'Cancel an unserved order item or ticket'),

    -- Kitchen / KDS (2)
    ('kds:view', 'KITCHEN', 'View live Kitchen Display System tickets for stations'),
    ('kds:update', 'KITCHEN', 'Acknowledge, prepare, and mark KOT items ready at pass'),

    -- Billing & Payments (7)
    ('bill:view', 'BILLING', 'View customer bills, invoices, and settlement statuses'),
    ('bill:generate', 'BILLING', 'Generate and print draft/final dining bills with GST'),
    ('bill:apply_discount', 'BILLING', 'Apply authorized discounts or submit discount approval requests'),
    ('bill:settle', 'BILLING', 'Record full settlement tenders and close dining sessions'),
    ('bill:void', 'BILLING', 'Void an unsettled or disputed bill (requires authorization)'),
    ('payment:process', 'BILLING', 'Initiate, collect, and verify Cash, UPI, Card, or Folio payments'),
    ('payment:refund', 'BILLING', 'Issue approved refunds against captured payments'),

    -- Menu Catalog (3)
    ('menu:view', 'MENU', 'View property master menu items, categories, and outlet prices'),
    ('menu:edit', 'MENU', 'Create or edit menu items, recipes, or submit price revisions'),
    ('menu:approve_revisions', 'MENU', 'Review and approve pending menu catalog or price revisions'),

    -- Staff & Roster (4)
    ('staff:view', 'STAFF', 'View employee profiles, duty assignments, and active shifts'),
    ('staff:manage', 'STAFF', 'Create or edit staff profiles, roles, and outlet access permissions'),
    ('roster:view', 'STAFF', 'View shift schedules and active duty roster assignments'),
    ('roster:edit', 'STAFF', 'Create, lock, or modify shift roster assignments'),

    -- Hotel PMS & Room Service (3)
    ('hotel:view', 'PMS', 'View hotel room occupancy, guest reservations, and active stays'),
    ('hotel:manage', 'PMS', 'Manage hotel room check-in, check-out, and reservations'),
    ('folio:charge', 'PMS', 'Post dining or amenity charges directly to an active hotel room folio'),

    -- Housekeeping (2)
    ('housekeeping:view', 'HOUSEKEEPING', 'View room cleanliness statuses and cleaning tasks'),
    ('housekeeping:update', 'HOUSEKEEPING', 'Update room cleaning status and report maintenance defects'),

    -- Inventory (2)
    ('inventory:view', 'INVENTORY', 'View on-hand ingredient stock balances across locations'),
    ('inventory:manage', 'INVENTORY', 'Record stock purchases, wastage, adjustments, and inter-outlet transfers'),

    -- Audit (1)
    ('audit:view', 'AUDIT', 'View system audit logs and security modification trails')
  ON CONFLICT (id) DO UPDATE SET
    module = EXCLUDED.module,
    description = EXCLUDED.description;

  -- 3. SEED ROLE-PERMISSION MAPPINGS (HARDENED FOR LEAST PRIVILEGE)

  -- SUPER_ADMIN: All 31 permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'SUPER_ADMIN', id FROM permissions
  ON CONFLICT DO NOTHING;

  -- RESTAURANT_OWNER: All 31 permissions (Principal executive authority)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'RESTAURANT_OWNER', id FROM permissions
  ON CONFLICT DO NOTHING;

  -- WAITER_MANAGER
  -- Note: table:manage and folio:charge removed for least privilege (delegated to Owner & Cashier)
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('WAITER_MANAGER', 'table:view'),
    ('WAITER_MANAGER', 'table:assign'),
    ('WAITER_MANAGER', 'order:view'),
    ('WAITER_MANAGER', 'order:create'),
    ('WAITER_MANAGER', 'order:update'),
    ('WAITER_MANAGER', 'order:cancel'),
    ('WAITER_MANAGER', 'kds:view'),
    ('WAITER_MANAGER', 'bill:view'),
    ('WAITER_MANAGER', 'bill:generate'),
    ('WAITER_MANAGER', 'bill:apply_discount'),
    ('WAITER_MANAGER', 'payment:process'),
    ('WAITER_MANAGER', 'menu:view'),
    ('WAITER_MANAGER', 'staff:view'),
    ('WAITER_MANAGER', 'roster:view'),
    ('WAITER_MANAGER', 'roster:edit')
  ON CONFLICT DO NOTHING;

  -- WAITER
  -- Note: folio:charge removed for least privilege (Cashier/Receptionist posts financial folio charges)
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('WAITER', 'table:view'),
    ('WAITER', 'table:assign'),
    ('WAITER', 'order:view'),
    ('WAITER', 'order:create'),
    ('WAITER', 'order:update'),
    ('WAITER', 'kds:view'),
    ('WAITER', 'bill:view'),
    ('WAITER', 'menu:view'),
    ('WAITER', 'roster:view')
  ON CONFLICT DO NOTHING;

  -- CASHIER
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('CASHIER', 'table:view'),
    ('CASHIER', 'order:view'),
    ('CASHIER', 'bill:view'),
    ('CASHIER', 'bill:generate'),
    ('CASHIER', 'bill:apply_discount'),
    ('CASHIER', 'bill:settle'),
    ('CASHIER', 'payment:process'),
    ('CASHIER', 'payment:refund'),
    ('CASHIER', 'menu:view'),
    ('CASHIER', 'roster:view'),
    ('CASHIER', 'folio:charge')
  ON CONFLICT DO NOTHING;

  -- KITCHEN_EXECUTIVE
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('KITCHEN_EXECUTIVE', 'order:view'),
    ('KITCHEN_EXECUTIVE', 'kds:view'),
    ('KITCHEN_EXECUTIVE', 'kds:update'),
    ('KITCHEN_EXECUTIVE', 'menu:view'),
    ('KITCHEN_EXECUTIVE', 'menu:edit'),
    ('KITCHEN_EXECUTIVE', 'inventory:view'),
    ('KITCHEN_EXECUTIVE', 'inventory:manage'),
    ('KITCHEN_EXECUTIVE', 'roster:view')
  ON CONFLICT DO NOTHING;

  -- KITCHEN_STAFF, KITCHEN_USER, KITCHEN_COOKING
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('KITCHEN_STAFF', 'order:view'),
    ('KITCHEN_STAFF', 'kds:view'),
    ('KITCHEN_STAFF', 'kds:update'),
    ('KITCHEN_STAFF', 'menu:view'),
    ('KITCHEN_USER', 'order:view'),
    ('KITCHEN_USER', 'kds:view'),
    ('KITCHEN_USER', 'kds:update'),
    ('KITCHEN_COOKING', 'order:view'),
    ('KITCHEN_COOKING', 'kds:view'),
    ('KITCHEN_COOKING', 'kds:update'),
    ('KITCHEN_COOKING', 'menu:view')
  ON CONFLICT DO NOTHING;

  -- KITCHEN_BAR, BEVERAGES, DRINKS
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('KITCHEN_BAR', 'order:view'),
    ('KITCHEN_BAR', 'kds:view'),
    ('KITCHEN_BAR', 'kds:update'),
    ('KITCHEN_BAR', 'menu:view'),
    ('KITCHEN_BAR', 'inventory:view'),
    ('BEVERAGES', 'order:view'),
    ('BEVERAGES', 'kds:view'),
    ('BEVERAGES', 'kds:update'),
    ('BEVERAGES', 'menu:view'),
    ('DRINKS', 'order:view'),
    ('DRINKS', 'kds:view'),
    ('DRINKS', 'kds:update')
  ON CONFLICT DO NOTHING;

  -- RECEPTIONIST
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('RECEPTIONIST', 'hotel:view'),
    ('RECEPTIONIST', 'hotel:manage'),
    ('RECEPTIONIST', 'folio:charge'),
    ('RECEPTIONIST', 'table:view'),
    ('RECEPTIONIST', 'bill:view'),
    ('RECEPTIONIST', 'payment:process'),
    ('RECEPTIONIST', 'roster:view')
  ON CONFLICT DO NOTHING;

  -- HOUSEKEEPING
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('HOUSEKEEPING', 'housekeeping:view'),
    ('HOUSEKEEPING', 'housekeeping:update'),
    ('HOUSEKEEPING', 'hotel:view'),
    ('HOUSEKEEPING', 'roster:view')
  ON CONFLICT DO NOTHING;

  -- ROOM_SERVICE
  INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('ROOM_SERVICE', 'order:view'),
    ('ROOM_SERVICE', 'order:create'),
    ('ROOM_SERVICE', 'order:update'),
    ('ROOM_SERVICE', 'kds:view'),
    ('ROOM_SERVICE', 'menu:view'),
    ('ROOM_SERVICE', 'hotel:view'),
    ('ROOM_SERVICE', 'folio:charge'),
    ('ROOM_SERVICE', 'roster:view')
  ON CONFLICT DO NOTHING;

END $$;
