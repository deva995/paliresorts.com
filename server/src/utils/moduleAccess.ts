/**
 * Canonical Module Access Definitions & Effective Permission Calculations
 * Pali Resort & Club Operations Platform
 */

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  viewPermissions: string[];
  editPermissions: string[];
  viewRoles?: string[];
  editRoles?: string[];
}

export interface ModuleAccessStatus {
  canView: boolean;
  canEdit: boolean;
}

export const CANONICAL_MODULES: ModuleDefinition[] = [
  {
    id: 'menu',
    name: 'Menu Catalog',
    description: 'Master menu catalog, categories, pricing, and revision workflows',
    viewPermissions: ['menu:view'],
    editPermissions: ['menu:edit', 'menu:approve_revisions']
  },
  {
    id: 'orders',
    name: 'Orders & Rounds',
    description: 'Dining orders, item punch, order status, and item cancellations',
    viewPermissions: ['order:view'],
    editPermissions: ['order:create', 'order:counter_create', 'order:update', 'order:serve', 'order:cancel']
  },
  {
    id: 'kitchen',
    name: 'Kitchen & KDS',
    description: 'Kitchen Display System station tickets, preparation timers, and dispatch pass',
    viewPermissions: ['kds:view'],
    editPermissions: ['kds:update']
  },
  {
    id: 'floor',
    name: 'Floor & Tables',
    description: 'Dining room layout, table occupancy, QR codes, and waiter allocations',
    viewPermissions: ['table:view'],
    editPermissions: ['table:manage', 'table:assign']
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    description: 'Bill generation, discounts, payments, settlements, and refunds',
    viewPermissions: ['bill:view'],
    editPermissions: ['bill:generate', 'bill:apply_discount', 'bill:approve_discount', 'bill:settle', 'payment:process', 'bill:void', 'payment:refund'],
    viewRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'CASHIER'],
    editRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'CASHIER']
  },
  {
    id: 'inventory',
    name: 'Inventory & Stock',
    description: 'Raw ingredients, stock balances, purchase orders, wastage, and transfers',
    viewPermissions: ['inventory:view'],
    editPermissions: ['inventory:manage']
  },
  {
    id: 'hotel',
    name: 'Hotel PMS & Front Desk',
    description: 'Hotel room stays, reservations, check-in, check-out, and folio postings',
    viewPermissions: ['hotel:view'],
    editPermissions: ['hotel:manage', 'folio:charge']
  },
  {
    id: 'housekeeping',
    name: 'Housekeeping & Maintenance',
    description: 'Room turnover cleaning tasks, status inspections, and maintenance requests',
    viewPermissions: ['housekeeping:view'],
    editPermissions: ['housekeeping:update']
  },
  {
    id: 'staff',
    name: 'Staff & Duty Roster',
    description: 'Staff member profiles, shift assignments, and weekly duty roster',
    viewPermissions: ['staff:view', 'roster:view', 'table:assign'],
    editPermissions: ['staff:manage', 'roster:edit'],
    viewRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'SENIOR_CAPTAIN', 'WAITER_MANAGER', 'WAITER'],
    editRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'SENIOR_CAPTAIN', 'WAITER_MANAGER']
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    description: 'Executive revenue reports, audit trail inspection, and occupancy metrics',
    viewPermissions: ['audit:view'],
    editPermissions: [],
    viewRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER'],
    editRoles: ['SUPER_ADMIN']
  },
  {
    id: 'crm',
    name: 'Guest Experience & CRM',
    description: 'Customer profiles, feedback reviews, guest complaints, and VIP preferences',
    viewPermissions: [],
    editPermissions: [],
    viewRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER'],
    editRoles: ['SUPER_ADMIN']
  },
  {
    id: 'settings',
    name: 'System & Enterprise Settings',
    description: 'Resort multi-outlet configuration, tax rates, and platform infrastructure',
    viewPermissions: [],
    editPermissions: [],
    viewRoles: ['SUPER_ADMIN'],
    editRoles: ['SUPER_ADMIN']
  }
];

export interface StaffRoleBrief {
  id: string;
  displayName?: string;
}

/**
 * Computes baseline module access from role membership and assigned canonical permissions.
 */
export function computeBaselineModuleAccess(
  roles: StaffRoleBrief[],
  permissions: string[]
): Record<string, ModuleAccessStatus> {
  const isSuperAdmin = roles.some((r) => r.id === 'SUPER_ADMIN');
  const roleIds = new Set(roles.map((r) => r.id));
  const permSet = new Set(permissions);
  const baseline: Record<string, ModuleAccessStatus> = {};

  for (const mod of CANONICAL_MODULES) {
    if (isSuperAdmin) {
      baseline[mod.id] = { canView: true, canEdit: true };
      continue;
    }

    const hasEditPerm = mod.editPermissions.some((p) => permSet.has(p));
    const hasEditRole = mod.editRoles ? mod.editRoles.some((r) => roleIds.has(r)) : false;
    const canEdit = hasEditPerm || hasEditRole;

    const hasViewPerm = mod.viewPermissions.some((p) => permSet.has(p));
    const hasViewRole = mod.viewRoles ? mod.viewRoles.some((r) => roleIds.has(r)) : false;
    const canView = hasViewPerm || hasViewRole || canEdit;

    baseline[mod.id] = { canView, canEdit };
  }

  return baseline;
}

export interface ModuleOverrideRow {
  module: string;
  outlet_id?: string | null;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Computes effective module access by overlaying per-user overrides on top of baseline access.
 * Effective access = role permissions plus per-user overrides.
 */
export function computeEffectiveModuleAccess(
  baseline: Record<string, ModuleAccessStatus>,
  overrides: ModuleOverrideRow[],
  isSuperAdmin = false
): Record<string, ModuleAccessStatus> {
  const effective: Record<string, ModuleAccessStatus> = {};

  // Initialize with baseline
  for (const mod of CANONICAL_MODULES) {
    effective[mod.id] = { ...baseline[mod.id] };
  }

  // Apply per-user overrides
  for (const ov of overrides) {
    const modId = ov.module.toLowerCase();
    if (effective[modId]) {
      const canView = Boolean(ov.can_view);
      // Editing requires view access
      const canEdit = canView ? Boolean(ov.can_edit) : false;
      effective[modId] = { canView, canEdit };
    }
  }

  if (isSuperAdmin) {
    // Super Admin by default has master access
    for (const mod of CANONICAL_MODULES) {
      if (!overrides.some((o) => o.module.toLowerCase() === mod.id)) {
        effective[mod.id] = { canView: true, canEdit: true };
      }
    }
  }

  return effective;
}

/**
 * Synchronizes the canonical permissions array with effective module access, ensuring
 * that negative overrides remove permission codes and positive overrides grant necessary codes.
 * If no override exists for a module, the role's base permissions are strictly preserved.
 */
export function syncPermissionsWithModuleAccess(
  basePermissions: string[],
  effective: Record<string, ModuleAccessStatus>,
  isSuperAdmin = false,
  overrides: ModuleOverrideRow[] = []
): string[] {
  if (isSuperAdmin || overrides.length === 0) {
    return basePermissions;
  }

  const result = new Set<string>(basePermissions);
  const overrideMap = new Map<string, ModuleOverrideRow>();
  for (const o of overrides) {
    overrideMap.set(o.module.toLowerCase(), o);
  }

  for (const mod of CANONICAL_MODULES) {
    const ov = overrideMap.get(mod.id);
    if (!ov) {
      continue;
    }

    const access = effective[mod.id];
    if (!access) continue;

    // If view is granted by positive override, add primary view permission
    if (access.canView && mod.viewPermissions.length > 0) {
      for (const p of mod.viewPermissions) {
        result.add(p);
      }
    }

    // If edit is granted by positive override, add primary edit permission
    if (access.canEdit && mod.editPermissions.length > 0) {
      for (const p of mod.editPermissions) {
        result.add(p);
      }
    }
  }

  return Array.from(result);
}
