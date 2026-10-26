import { UserRole, User, PermissionAction } from '../types';

export interface RoutePermission {
  pattern: RegExp;
  allowedRoles: UserRole[];
  moduleName: string;
}

export const ROLE_ROUTE_PERMISSIONS: RoutePermission[] = [
  // Super Admin administrative routes - Strict Super Admin Only
  { pattern: /^\/super-admin(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Super Admin Operations' },
  { pattern: /^\/admin(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Super Admin Operations' },
  { pattern: /^\/settings(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'System & SaaS Settings' },
  { pattern: /^\/users(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Staff & User Management' },
  { pattern: /^\/roles(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Roles & RBAC Architecture' },
  { pattern: /^\/permissions(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Permission Matrix' },
  { pattern: /^\/audit-logs(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Enterprise Security Audit' },
  { pattern: /^\/restaurants(\/.*)?$/, allowedRoles: ['SUPER_ADMIN'], moduleName: 'Resort & Restaurant Tenant Management' },

  // Restaurant & Dining routes
  // Authorized: SUPER_ADMIN, RESTAURANT_OWNER
  {
    pattern: /^\/restaurant(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER'],
    moduleName: 'Restaurant & Dining'
  },

  // Kitchen & KDS routes
  // Authorized: SUPER_ADMIN, RESTAURANT_OWNER, KITCHEN_USER, KITCHEN_STAFF, KITCHEN_COOKING, KITCHEN_BAR, KITCHEN_EXECUTIVE, BEVERAGES, DRINKS
  {
    pattern: /^\/kitchen(\/.*)?$/,
    allowedRoles: [
      'SUPER_ADMIN',
      'RESTAURANT_OWNER',
      'KITCHEN_USER',
      'KITCHEN_STAFF',
      'KITCHEN_COOKING',
      'KITCHEN_BAR',
      'KITCHEN_EXECUTIVE',
      'BEVERAGES',
      'DRINKS'
    ],
    moduleName: 'Kitchen & KDS'
  },

  // Waiter & Services routes
  // Authorized: SUPER_ADMIN, RESTAURANT_OWNER, WAITER, WAITER_MANAGER
  {
    pattern: /^\/waiter(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'WAITER', 'WAITER_MANAGER'],
    moduleName: 'Waiter & Services'
  },

  // Cashier & Billing routes
  {
    pattern: /^\/cashier(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'CASHIER'],
    moduleName: 'Billing & POS Cashier'
  },

  // Hotel & Front Desk routes - Excluded from Restaurant Owner
  {
    pattern: /^\/hotel(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'RECEPTIONIST'],
    moduleName: 'Hotel Rooms & Reservations'
  },
  {
    pattern: /^\/(reception|frontdesk)(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'RECEPTIONIST'],
    moduleName: 'Front Desk & Reception'
  },

  // Housekeeping routes
  {
    pattern: /^\/housekeeping(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'HOUSEKEEPING'],
    moduleName: 'Housekeeping Operations'
  },

  // In-Room Dining routes
  {
    pattern: /^\/room-service(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'ROOM_SERVICE'],
    moduleName: 'In-Room Dining'
  },

  // Inventory routes
  {
    pattern: /^\/inventory(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'CASHIER'],
    moduleName: 'Inventory & Procurement'
  },

  // Staff & HR routes
  {
    pattern: /^\/staff(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER'],
    moduleName: 'Staff & Human Resources'
  },

  // CRM routes
  {
    pattern: /^\/crm(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN'],
    moduleName: 'Guest Relations & CRM'
  },

  // Payments routes
  {
    pattern: /^\/payments(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN', 'CASHIER'],
    moduleName: 'Payments & Transactions'
  },

  // Reports routes
  {
    pattern: /^\/reports\/profit-loss$/,
    allowedRoles: ['SUPER_ADMIN'],
    moduleName: 'Executive Profit & Loss'
  },
  {
    pattern: /^\/reports\/gst$/,
    allowedRoles: ['SUPER_ADMIN', 'CASHIER'],
    moduleName: 'GST Compliance Reports'
  },
  {
    pattern: /^\/reports(\/.*)?$/,
    allowedRoles: ['SUPER_ADMIN'],
    moduleName: 'Executive Business Reports'
  },

  // Customer Guest Portal routes (Accessible to all for testing QR/Ordering preview)
  {
    pattern: /^\/customer(\/.*)?$/,
    allowedRoles: [
      'SUPER_ADMIN',
      'RESTAURANT_OWNER',
      'CUSTOMER',
      'WAITER',
      'CASHIER',
      'KITCHEN_USER',
      'KITCHEN_STAFF',
      'RECEPTIONIST',
      'HOUSEKEEPING',
      'ROOM_SERVICE'
    ],
    moduleName: 'Customer Digital Experience'
  }
];

export function getModuleForPath(routePath: string): string | null {
  if (routePath.startsWith('/restaurant/menu')) return 'menu';
  if (
    routePath.startsWith('/restaurant/tables') ||
    routePath.startsWith('/restaurant/dashboard') ||
    routePath.startsWith('/waiter/tables')
  ) {
    return 'floor';
  }
  if (
    routePath.startsWith('/restaurant/orders') ||
    routePath.startsWith('/waiter/orders') ||
    routePath.startsWith('/waiter/dashboard')
  ) {
    return 'orders';
  }
  if ((routePath === '/kitchen' || routePath.startsWith('/kitchen/'))) return 'kitchen';
  if (routePath.startsWith('/cashier') || routePath.startsWith('/waiter/bills')) return 'billing';
  if (routePath.startsWith('/inventory')) return 'inventory';
  if (routePath.startsWith('/reception') || routePath.startsWith('/hotel')) return 'hotel';
  if (routePath.startsWith('/housekeeping')) return 'housekeeping';
  if (
    routePath.startsWith('/staff') ||
    routePath.startsWith('/roles') ||
    routePath.startsWith('/waiter/roster')
  ) {
    return 'staff';
  }
  if (routePath.startsWith('/reports') || routePath.startsWith('/audit-logs')) return 'reports';
  if (routePath.startsWith('/crm')) return 'crm';
  if (routePath.startsWith('/settings') || routePath.startsWith('/users')) return 'settings';
  return null;
}

export function checkRouteAccess(
  routePath: string,
  role: UserRole,
  user?: User | null
): { allowed: boolean; matchedModule?: string; requiredRoles?: UserRole[] } {
  // Super Admin has unrestricted access
  if (role === 'SUPER_ADMIN') {
    return { allowed: true, matchedModule: 'Super Admin Master Access' };
  }

  routePath = routePath.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  // Public/login routes
  if (routePath === '/login' || routePath === '/') {
    return { allowed: true, matchedModule: 'Public / Login' };
  }

  // Check per-user module access override if available
  const mappedModule = getModuleForPath(routePath);
  if (mappedModule && user?.moduleAccess && user.moduleAccess[mappedModule] !== undefined) {
    const override = user.moduleAccess[mappedModule];
    if (override.canView === false) {
      return {
        allowed: false,
        matchedModule: `Module '${mappedModule}' access revoked`,
        requiredRoles: ['SUPER_ADMIN']
      };
    }
    // Grants never bypass the role boundary; backend permissions remain authoritative.
  }

  // Strict Role Isolations:
  // 1. RESTAURANT_OWNER: Access ONLY to Restaurant & Dining, Kitchen & KDS, Waiter & Services, and customer preview
  if (role === 'RESTAURANT_OWNER') {
    const isAllowed =
      (routePath === '/restaurant' || routePath.startsWith('/restaurant/')) ||
      (routePath === '/kitchen' || routePath.startsWith('/kitchen/')) ||
      (routePath === '/waiter' || routePath.startsWith('/waiter/')) ||
      (routePath === '/customer' || routePath.startsWith('/customer/')) ||
      (routePath === '/staff' || routePath.startsWith('/staff/'));

    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Restricted Executive Module',
        requiredRoles: ['SUPER_ADMIN']
      };
    }
    return { allowed: true, matchedModule: 'Restaurant Owner Operations' };
  }

  // 2. KITCHEN_COOKING: Strictly Cooking KDS ONLY (/kitchen/kds/cooking or /kitchen/cooking)
  if (role === 'KITCHEN_COOKING') {
    const isAllowed = routePath === '/kitchen/kds/cooking' || routePath === '/kitchen/cooking';
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Cooking KDS Restricted Area',
        requiredRoles: ['KITCHEN_COOKING', 'KITCHEN_EXECUTIVE', 'SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Kitchen Cooking KDS' };
  }

  // 3. KITCHEN_BAR: Strictly Bar/Beverages KDS ONLY (/kitchen/kds/bar or /kitchen/bar)
  if (role === 'KITCHEN_BAR') {
    const isAllowed = routePath === '/kitchen/kds/bar' || routePath === '/kitchen/bar';
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Bar KDS Restricted Area',
        requiredRoles: ['KITCHEN_BAR', 'KITCHEN_EXECUTIVE', 'SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Kitchen Bar KDS' };
  }

  // 4. BEVERAGES: Strictly Beverage preparation ONLY (/kitchen/beverages)
  if (role === 'BEVERAGES') {
    const isAllowed = routePath === '/kitchen/beverages';
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Beverages Preparation Restricted Area',
        requiredRoles: ['BEVERAGES', 'KITCHEN_EXECUTIVE', 'SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Beverages Station' };
  }

  // 5. DRINKS: Strictly Drinks preparation ONLY (/kitchen/drinks)
  if (role === 'DRINKS') {
    const isAllowed = routePath === '/kitchen/drinks';
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Drinks Preparation Restricted Area',
        requiredRoles: ['DRINKS', 'KITCHEN_EXECUTIVE', 'SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Drinks Station' };
  }

  // 6. KITCHEN_EXECUTIVE: Can access all permitted Kitchen operational views
  if (role === 'KITCHEN_EXECUTIVE') {
    const isAllowed =
      routePath === '/kitchen/executive' ||
      routePath.startsWith('/kitchen/kds') ||
      routePath === '/kitchen/beverages' ||
      routePath === '/kitchen/drinks' ||
      routePath.startsWith('/kitchen/active') ||
      routePath.startsWith('/kitchen/completed');
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Non-Kitchen Operational Area',
        requiredRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Kitchen Executive Operations' };
  }

  // 7. Legacy KITCHEN_USER / KITCHEN_STAFF / KITCHEN: Access ONLY to Kitchen & KDS
  if (role === 'KITCHEN_USER' || role === 'KITCHEN_STAFF' || (role as string) === 'KITCHEN') {
    const isAllowed = (routePath === '/kitchen' || routePath.startsWith('/kitchen/')) || (routePath === '/customer' || routePath.startsWith('/customer/'));
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Non-Kitchen Area',
        requiredRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Kitchen & KDS' };
  }

  // 3. WAITER: Access ONLY to Waiter Floor Operations
  if (role === 'WAITER') {
    const isAllowed = (routePath === '/waiter' || routePath.startsWith('/waiter/')) && !/^\/waiter\/roster(?:\/|$)/.test(routePath) || routePath === '/customer' || routePath.startsWith('/customer/');
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Non-Waiter Service Area',
        requiredRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'WAITER_MANAGER']
      };
    }
    return { allowed: true, matchedModule: 'Waiter Floor Operations' };
  }

  // 3b. WAITER_MANAGER: Access to Waiter Floor Operations & Supervisor Oversight
  if (role === 'WAITER_MANAGER') {
    const isAllowed = (routePath === '/waiter' || routePath.startsWith('/waiter/')) || (routePath === '/customer' || routePath.startsWith('/customer/'));
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Non-Waiter Service Area',
        requiredRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Waiter Management & Supervisor Oversight' };
  }

  // 4. CUSTOMER: Access ONLY to Customer Guest Portal (/customer, /qr)
  if (role === 'CUSTOMER') {
    const isAllowed = (routePath === '/customer' || routePath.startsWith('/customer/')) || routePath.startsWith('/qr') || routePath === '/' || routePath === '/login';
    if (!isAllowed) {
      return {
        allowed: false,
        matchedModule: 'Staff Operational Area',
        requiredRoles: ['SUPER_ADMIN', 'RESTAURANT_OWNER']
      };
    }
    return { allowed: true, matchedModule: 'Customer Digital Experience' };
  }

  // Generic matrix lookup for other roles
  for (const perm of ROLE_ROUTE_PERMISSIONS) {
    if (perm.pattern.test(routePath)) {
      const allowed = perm.allowedRoles.includes(role);
      return {
        allowed,
        matchedModule: perm.moduleName,
        requiredRoles: perm.allowedRoles
      };
    }
  }

  // Default block for unknown or unlisted routes
  return {
    allowed: false,
    matchedModule: 'Restricted Module',
    requiredRoles: ['SUPER_ADMIN']
  };
}

/**
 * Centralized fine-grained permission evaluation
 */
export function canAccess(
  user: User | null,
  module: 'RESTAURANT' | 'KITCHEN' | 'WAITER' | 'HOTEL' | 'BILLING' | 'INVENTORY' | 'STAFF' | 'SYSTEM' | 'REPORTS',
  action: PermissionAction = 'VIEW'
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  switch (user.role) {
    case 'RESTAURANT_OWNER':
      // Has full MANAGE rights on Restaurant, Kitchen, Waiter. Denied on everything else.
      if (module === 'RESTAURANT' || module === 'KITCHEN' || module === 'WAITER' || module === 'STAFF') {
        return true;
      }
      return false;

    case 'KITCHEN_USER':
    case 'KITCHEN_STAFF':
    case 'KITCHEN_COOKING':
    case 'KITCHEN_BAR':
    case 'KITCHEN_EXECUTIVE':
    case 'BEVERAGES':
    case 'DRINKS':
      if (module === 'KITCHEN') {
        return action === 'VIEW' || action === 'EDIT';
      }
      return false;

    case 'WAITER_MANAGER':
      if (module === 'WAITER') {
        return true; // Full supervisory & floor access
      }
      return false;

    case 'WAITER':
      if (module === 'WAITER') {
        return action === 'VIEW' || action === 'CREATE' || action === 'EDIT';
      }
      return false;

    case 'CASHIER':
      return module === 'BILLING';

    case 'RECEPTIONIST':
      return module === 'HOTEL';

    default:
      return false;
  }
}

export function getDefaultDashboardRoute(role?: UserRole | null): string {
  if (!role) {
    return '/login';
  }
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard';
    case 'RESTAURANT_OWNER':
      return '/restaurant/dashboard';
    case 'CASHIER':
      return '/cashier/pos';
    case 'KITCHEN_COOKING':
      return '/kitchen/kds/cooking';
    case 'KITCHEN_BAR':
      return '/kitchen/kds/bar';
    case 'KITCHEN_EXECUTIVE':
      return '/kitchen/executive';
    case 'BEVERAGES':
      return '/kitchen/beverages';
    case 'DRINKS':
      return '/kitchen/drinks';
    case 'KITCHEN_USER':
    case 'KITCHEN_STAFF':
    case 'KITCHEN' as any:
      return '/kitchen/kds';
    case 'WAITER':
    case 'WAITER_MANAGER':
      return '/waiter/dashboard';
    case 'RECEPTIONIST':
      return '/hotel/rooms';
    case 'HOUSEKEEPING':
      return '/housekeeping/dashboard';
    case 'ROOM_SERVICE':
      return '/room-service/dashboard';
    case 'CUSTOMER':
      return '/customer/qr-ordering';
    default:
      return '/login';
  }
}

/** Used for background loading: effective module access AND concrete API permission. */
export function canLoadStaffData(user: User | null, module: string, permissions: string[]): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.moduleAccess?.[module]?.canView === false) return false;
  return permissions.some(permission => user.permissions?.includes(permission));
}

export function selectPrimaryRole(roles: Array<{id: string}>): UserRole {
  const priority: UserRole[] = ['SUPER_ADMIN','RESTAURANT_OWNER','CASHIER','WAITER_MANAGER','KITCHEN_EXECUTIVE','KITCHEN_COOKING','KITCHEN_BAR','BEVERAGES','DRINKS','KITCHEN_STAFF','KITCHEN_USER','WAITER','RECEPTIONIST','HOUSEKEEPING','ROOM_SERVICE','CUSTOMER'];
  const role = priority.find(candidate => roles.some(assigned => assigned.id === candidate));
  if (!role) throw new Error('No supported staff role is assigned. Contact an administrator.');
  return role;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Partial<Record<UserRole,string>> = {
    SUPER_ADMIN: 'Super Admin', RESTAURANT_OWNER: 'Restaurant Owner', WAITER_MANAGER: 'Captain',
    WAITER: 'Waiter', CASHIER: 'Cashier', KITCHEN_COOKING: 'Kitchen Cook', KITCHEN_BAR: 'Bar',
    KITCHEN_EXECUTIVE: 'Executive Chef', BEVERAGES: 'Beverage Steward', DRINKS: 'Drinks Runner',
    KITCHEN_STAFF: 'Kitchen Staff', KITCHEN_USER: 'Kitchen User'
  };
  return labels[role] || role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
