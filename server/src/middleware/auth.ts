import { hasGlobalOutletAccess, hasStaffOutletAccess } from '../utils/outletAccess.js';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDbPool } from '../db/pool.js';
import { setDatabaseContext } from '../db/runtimeContext.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';
import {
  ModuleAccessStatus,
  computeBaselineModuleAccess,
  computeEffectiveModuleAccess,
  syncPermissionsWithModuleAccess,
  ModuleOverrideRow
} from '../utils/moduleAccess.js';

export interface SafeStaffRole {
  id: string;
  displayName: string;
}

export interface SafeStaffOutletAccess {
  outletId: string;
  isPrimary: boolean;
}

export interface AuthenticatedStaffContext {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  authUserId: string | null;
  roles: SafeStaffRole[];
  permissions: string[];
  outlets: SafeStaffOutletAccess[];
  sessionId?: string;
  moduleAccess?: Record<string, ModuleAccessStatus>;
}

declare global {
  namespace Express {
    interface Request {
      staff?: AuthenticatedStaffContext;
      staffSessionToken?: string;
    }
  }
}

/**
 * Extracts Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/i);
  return match ? match[1] : null;
}

/** Resolve resource-owned scope before computing permissions; body/header hints cannot
 * override the actual outlet of a table/order/bill being addressed. Global endpoints
 * receive only global overrides. Session/profile responses use the primary outlet.
 */
async function authorizationOutlet(req: Request, pool: any): Promise<string | null | undefined> {
  if (req.path === '/auth/me' || req.path === '/me') {
    return typeof req.query.outletId === 'string' ? req.query.outletId : undefined;
  }
  if(req.path==='/guest/table/open' && typeof req.body?.tableId==='string') {
    return (await pool.query('SELECT outlet_id FROM public.restaurant_tables WHERE id::text=$1',[req.body.tableId])).rows[0]?.outlet_id || null;
  }
  const resources: Array<[string, string]> = [
    ['tableId', 'SELECT outlet_id FROM public.restaurant_tables WHERE id = $1'],
    ['sessionId', 'SELECT outlet_id FROM public.dining_sessions WHERE id = $1'],
    ['orderId', 'SELECT outlet_id FROM public.orders WHERE id = $1'],
    ['kotId', 'SELECT outlet_id FROM public.kots WHERE id = $1'],
    ['kotItemId', 'SELECT k.outlet_id FROM public.kot_items i JOIN public.kots k ON k.id=i.kot_id WHERE i.id=$1'],
    ['billId', 'SELECT outlet_id FROM public.bills WHERE id = $1'],
    ['paymentId', 'SELECT outlet_id FROM public.payments WHERE id = $1'],
    ['requestId', 'SELECT outlet_id FROM public.service_requests WHERE id = $1'],
    ['revisionId', 'SELECT outlet_id FROM public.menu_item_revisions WHERE id = $1']
  ];
  for (const [parameter, sql] of resources) {
    if (req.params[parameter]) {
      // Invalid identifiers are left to the existing route validator, without SQL casts.
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(req.params[parameter])) return null;
      return (await pool.query(sql, [req.params[parameter]])).rows[0]?.outlet_id || null;
    }
  }
  const scopedCreates = ['/orders', '/dining-sessions', '/menu/revisions'];
  if (req.path === '/dining-sessions' && typeof req.body?.tableId === 'string') {
    const actual = (await pool.query('SELECT outlet_id FROM public.restaurant_tables WHERE id::text=$1', [req.body.tableId])).rows[0]?.outlet_id;
    if (actual) return actual;
  }
  if (req.path === '/orders') {
    const sessionId = req.body?.diningSessionId;
    const tableId = req.body?.tableId;
    const actual = typeof sessionId === 'string'
      ? (await pool.query('SELECT outlet_id FROM public.dining_sessions WHERE id::text=$1', [sessionId])).rows[0]?.outlet_id
      : typeof tableId === 'string'
        ? (await pool.query('SELECT outlet_id FROM public.restaurant_tables WHERE id::text=$1', [tableId])).rows[0]?.outlet_id
        : null;
    if (actual) return actual;
  }
  const explicit = req.params.outletId || (scopedCreates.includes(req.path) ? req.body?.outletId : null);
  return typeof explicit === 'string' && explicit.trim() ? explicit.trim() : null;
}

/**
 * Authentication middleware:
 * 1. Receives session token from Authorization: Bearer <token>
 * 2. Checks test-token bypass only when NODE_ENV === 'test' and ALLOW_DEV_AUTH === true
 * 3. Hashes session token with SHA-256 and queries public.staff_sessions joined with public.staff
 * 4. Rejects revoked, expired, or inactive sessions
 * 5. Loads roles, permissions, and outlet access from database and attaches to req.staff
 */
export async function authenticateStaff(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // If staff context is already established (e.g. unit test fixture injection), proceed
  if (req.staff) {
    return next();
  }

  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError('Missing or malformed Authorization Bearer token');
    }

    const env = getEnv();
    const pool = getDbPool();
    setDatabaseContext({ mode: 'authenticate', tokenHash: crypto.createHash('sha256').update(token).digest('hex') });

    // Dev-token bypass: strictly active only when NODE_ENV === 'test' AND ALLOW_DEV_AUTH is true
    const isTestDevToken =
      process.env.NODE_ENV === 'test' &&
      env.ALLOW_DEV_AUTH &&
      (token.startsWith('test-token-') || token.startsWith('staff-token-') || token.startsWith('dev-token-'));

    if (token.startsWith('test-token-') || token.startsWith('staff-token-') || token.startsWith('dev-token-')) {
      if (!isTestDevToken) {
        throw new UnauthorizedError('Invalid or expired authentication token (Development tokens are disabled)');
      }

      const identifier = token.replace(/^(test-token-|staff-token-|dev-token-)/, '');
      const devStaffRes = await pool.query(`
        SELECT id, employee_code, first_name, last_name, email, phone, is_active, auth_user_id
        FROM public.staff
        WHERE auth_user_id::text = $1 OR id::text = $1 OR employee_code = $1 OR email = $1;
      `, [identifier]);

      if (devStaffRes.rows.length === 0) {
        throw new UnauthorizedError('Staff account not found for authenticated user');
      }

      const staffRow = devStaffRes.rows[0];
      if (!staffRow.is_active) {
        throw new ForbiddenError('Staff account is inactive or deactivated');
      }

      const { roles, permissions, outlets, moduleAccess } = await loadStaffAccess(pool, staffRow.id, await authorizationOutlet(req, pool));
      req.staff = {
        id: staffRow.id,
        employeeCode: staffRow.employee_code,
        firstName: staffRow.first_name,
        lastName: staffRow.last_name,
        email: staffRow.email,
        phone: staffRow.phone,
        authUserId: staffRow.auth_user_id,
        roles,
        permissions,
        outlets,
        moduleAccess
      };
      return next();
    }

    // Real server-side session token authentication
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const sessionRes = await pool.query(`
      SELECT 
        ss.id AS session_id,
        ss.staff_id,
        ss.expires_at,
        ss.revoked_at,
        s.id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.is_active,
        s.auth_user_id
      FROM public.staff_sessions ss
      JOIN public.staff s ON s.id = ss.staff_id
      WHERE ss.token_hash = $1;
    `, [tokenHash]);

    if (sessionRes.rows.length === 0) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const row = sessionRes.rows[0];

    if (row.revoked_at !== null) {
      throw new UnauthorizedError('Authentication session has been revoked');
    }

    if (new Date(row.expires_at) <= new Date()) {
      throw new UnauthorizedError('Authentication session has expired');
    }

    if (!row.is_active) {
      throw new ForbiddenError('Staff account is inactive or deactivated');
    }

    const outletScope = await authorizationOutlet(req, pool);
    const { roles, permissions, outlets, moduleAccess } = await loadStaffAccess(pool, row.id, outletScope);
    if (outletScope && !hasStaffOutletAccess({roles,outlets}, outletScope)) throw new ForbiddenError('No access to this resource outlet');
    setDatabaseContext({ mode: 'staff', staffId: row.id, tokenHash,
      outlets: outlets.map(outlet => outlet.outletId), permissions, moduleAccess,
      superAdmin: roles.some(role => role.id === 'SUPER_ADMIN'),
      globalOutlets: hasGlobalOutletAccess({roles}),
      scope: outletScope ?? null });

    req.staff = {
      id: row.id,
      employeeCode: row.employee_code,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      authUserId: row.auth_user_id,
      roles,
      permissions,
      outlets,
      sessionId: row.session_id,
      moduleAccess
    };
    req.staffSessionToken = token;

    next();
  } catch (err) {
    next(err);
  }
}

export async function loadStaffAccess(pool: any, staffId: string, outletScope?: string | null) {
  const rolesResult = await pool.query(`
    SELECT r.id, r.display_name
    FROM public.staff_roles sr
    JOIN public.roles r ON r.id = sr.role_id
    WHERE sr.staff_id = $1;
  `, [staffId]);
  const roles: SafeStaffRole[] = rolesResult.rows.map((r: any) => ({
    id: r.id,
    displayName: r.display_name
  }));

  const permResult = await pool.query(`
    SELECT DISTINCT p.id
    FROM public.staff_roles sr
    JOIN public.role_permissions rp ON rp.role_id = sr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE sr.staff_id = $1;
  `, [staffId]);
  const basePermissions: string[] = permResult.rows.map((r: any) => r.id);

  const outletsResult = await pool.query(`
    SELECT soa.outlet_id, soa.is_primary
    FROM public.staff_outlet_access soa
    JOIN public.outlets o ON o.id = soa.outlet_id
    WHERE soa.staff_id = $1 AND o.is_active = true
    ORDER BY soa.is_primary DESC, soa.outlet_id;
  `, [staffId]);
  const outlets: SafeStaffOutletAccess[] = outletsResult.rows.map((r: any) => ({
    outletId: r.outlet_id,
    isPrimary: r.is_primary
  }));

  // Fetch per-user module access overrides
  let overrides: ModuleOverrideRow[] = [];
  {
    const overridesRes = await pool.query(`
      SELECT module, outlet_id, can_view, can_edit
      FROM public.staff_module_access
      WHERE staff_id = $1;
    `, [staffId]);
    overrides = overridesRes.rows.map((r: any) => ({
      module: r.module,
      outlet_id: r.outlet_id,
      can_view: r.can_view,
      can_edit: r.can_edit
    }));
  }

  const scope = outletScope === undefined
    ? (outlets.find(outlet => outlet.isPrimary)?.outletId || outlets[0]?.outletId || null)
    : outletScope;
  // Global defaults first; an exact outlet override wins only within that outlet.
  overrides = overrides.filter(override => !override.outlet_id || (override.outlet_id === scope && override.module.toLowerCase() !== 'inventory'))
    .sort((a, b) => Number(Boolean(a.outlet_id)) - Number(Boolean(b.outlet_id)));

  const isSuperAdmin = roles.some((r) => r.id === 'SUPER_ADMIN');
  const baseline = computeBaselineModuleAccess(roles, basePermissions);
  const moduleAccess = computeEffectiveModuleAccess(baseline, overrides, isSuperAdmin);
  const permissions = syncPermissionsWithModuleAccess(basePermissions, moduleAccess, isSuperAdmin, overrides);

  return { roles, permissions, outlets, moduleAccess, baselineModuleAccess: baseline, moduleOverrides: overrides };
}

/**
 * Enforces that authentication has occurred and req.staff is populated.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }
  next();
}

/**
 * Enforces that authenticated staff holds a specific canonical permission code.
 * SUPER_ADMIN role automatically bypasses individual permission restrictions.
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const hasPerm = req.staff.permissions.includes(permissionCode);
    if (!hasPerm) {
      logger.warn('Permission denied', {
        staffId: req.staff.id,
        permissionCode,
        path: req.originalUrl
      });
      return next(new ForbiddenError(`Staff lacks required permission: '${permissionCode}'`));
    }

    next();
  };
}

/**
 * Enforces that authenticated staff holds at least one of the specified canonical permissions.
 * SUPER_ADMIN role automatically bypasses individual permission restrictions.
 */
export function requireAnyPermission(permissionCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const hasAny = permissionCodes.some((code) => req.staff?.permissions.includes(code));
    if (!hasAny) {
      logger.warn('Permissions denied', {
        staffId: req.staff.id,
        permissionCodes,
        path: req.originalUrl
      });
      return next(
        new ForbiddenError(
          `Staff lacks required permissions: at least one of [${permissionCodes.map((c) => `'${c}'`).join(', ')}] is required`
        )
      );
    }

    next();
  };
}

/**
 * Enforces that authenticated staff has authorized access to a target outlet.
 * Only SUPER_ADMIN has universal outlet access; all others need active membership.
 */
export function requireOutletAccess(paramName = 'outletId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (hasGlobalOutletAccess(req.staff)) {
      return next();
    }

    const targetOutletId =
      req.params[paramName] ||
      req.body?.[paramName] ||
      req.query?.[paramName] ||
      (req.headers['x-outlet-id'] as string);

    if (!targetOutletId || typeof targetOutletId !== 'string') {
      return next(new ForbiddenError('Target outlet identifier is missing or invalid'));
    }

    const hasAccess = req.staff.outlets.some((o) => o.outletId === targetOutletId.trim());
    if (!hasAccess) {
      logger.warn('Outlet access denied', {
        staffId: req.staff.id,
        outletId: targetOutletId,
        path: req.originalUrl
      });
      return next(
        new ForbiddenError(`Staff does not have authorized access to outlet '${targetOutletId}'`)
      );
    }

    next();
  };
}

/**
 * Enforces that authenticated staff holds the SUPER_ADMIN role.
 * Non-super-admins receive 403 Forbidden.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
  if (!isSuperAdmin) {
    logger.warn('Super Admin access denied: insufficient privilege', {
      staffId: req.staff.id,
      path: req.originalUrl
    });
    return next(new ForbiddenError('Only Super Administrators may perform this action'));
  }

  next();
}

/**
 * Enforces that authenticated staff has effective module access (view or edit) for a given module.
 * SUPER_ADMIN role automatically bypasses module access restrictions.
 */
export function requireModuleAccess(moduleName: string | string[], action: 'view' | 'edit' = 'view') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const moduleNames = Array.isArray(moduleName) ? moduleName : [moduleName];
    const baseline = !req.staff.moduleAccess
      ? computeBaselineModuleAccess(req.staff.roles || [], req.staff.permissions || [])
      : null;

    let hasAccess = false;
    for (const mod of moduleNames) {
      const modKey = mod.toLowerCase();
      const access = req.staff.moduleAccess?.[modKey] || baseline?.[modKey];
      if (access) {
        if (action === 'view' && access.canView) {
          hasAccess = true;
          break;
        }
        if (action === 'edit' && access.canEdit) {
          hasAccess = true;
          break;
        }
      }
    }

    if (!hasAccess) {
      const primaryMod = moduleNames[0];
      logger.warn(`Module ${action} access denied`, {
        staffId: req.staff.id,
        moduleName,
        action,
        path: req.originalUrl
      });
      return next(new ForbiddenError(`Staff lacks ${action} access for module: '${primaryMod}'`));
    }

    next();
  };
}
