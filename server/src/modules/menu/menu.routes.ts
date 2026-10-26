import { hasGlobalOutletAccess } from '../../utils/outletAccess.js';
import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requirePermission,
  requireOutletAccess,
  requireModuleAccess
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import {
  outletMenuParamsSchema,
  menuItemParamsSchema,
  menuItemWithOutletParamsSchema,
  createMenuItemBodySchema,
  updateMenuItemBodySchema,
  toggleAvailabilityBodySchema,
  menuRevisionParamsSchema,
  listMenuRevisionsQuerySchema,
  createMenuRevisionBodySchema,
  approveMenuRevisionBodySchema,
  rejectMenuRevisionBodySchema
} from './menu.validation.js';
import {
  getOutletMenu,
  getCategories,
  getMenuItem,
  createRevision,
  listRevisions,
  getRevision,
  approveRevision,
  rejectRevision,
  createMenuItemController,
  updateMenuItemController,
  toggleAvailabilityController
} from './menu.controller.js';

export const menuRouter = Router();

/**
 * Middleware: Enforces that staff has at least one of the specified canonical permissions.
 * SUPER_ADMIN role automatically bypasses individual permission restrictions.
 */
function requireAnyPermission(permissionCodes: string[]) {
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
      return next(
        new ForbiddenError(
          `Staff lacks required permission: at least one of [${permissionCodes.join(', ')}] required`
        )
      );
    }

    next();
  };
}

/**
 * Middleware: If request body contains an outletId, verifies the caller is authorized for that outlet.
 */
function requireOptionalOutletAccessInBody(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body?.outletId) {
    return next();
  }

  if (req.staff && hasGlobalOutletAccess(req.staff)) {
    return next();
  }

  const hasAccess = req.staff?.outlets.some((o) => o.outletId === req.body.outletId.trim());
  if (!hasAccess) {
    return next(
      new ForbiddenError(`Staff does not have authorized access to outlet '${req.body.outletId}'`)
    );
  }

  next();
}

// --------------------------------------------------------------------------
// 1. OUTLET EFFECTIVE MENU
// --------------------------------------------------------------------------
// GET /api/v1/outlets/:outletId/menu
menuRouter.get(
  '/outlets/:outletId/menu',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:view'),
  requireModuleAccess('menu', 'view'),
  requireOutletAccess('outletId'),
  validate({ params: outletMenuParamsSchema }),
  getOutletMenu
);

// POST /api/v1/outlets/:outletId/menu/items
menuRouter.post(
  '/outlets/:outletId/menu/items',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:edit'),
  requireModuleAccess('menu', 'edit'),
  requireOutletAccess('outletId'),
  validate({ params: outletMenuParamsSchema, body: createMenuItemBodySchema }),
  createMenuItemController
);

// PUT /api/v1/outlets/:outletId/menu/items/:itemId
menuRouter.put(
  '/outlets/:outletId/menu/items/:itemId',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:edit'),
  requireModuleAccess('menu', 'edit'),
  requireOutletAccess('outletId'),
  validate({ params: menuItemWithOutletParamsSchema, body: updateMenuItemBodySchema }),
  updateMenuItemController
);

// PATCH /api/v1/outlets/:outletId/menu/items/:itemId/availability
menuRouter.patch(
  '/outlets/:outletId/menu/items/:itemId/availability',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:edit'),
  requireModuleAccess('menu', 'edit'),
  requireOutletAccess('outletId'),
  validate({ params: menuItemWithOutletParamsSchema, body: toggleAvailabilityBodySchema }),
  toggleAvailabilityController
);

// --------------------------------------------------------------------------
// 2. MASTER MENU CATEGORIES & ITEMS
// --------------------------------------------------------------------------
// GET /api/v1/menu/categories
menuRouter.get(
  '/menu/categories',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:view'),
  requireModuleAccess('menu', 'view'),
  getCategories
);

// GET /api/v1/menu/items/:itemId
menuRouter.get(
  '/menu/items/:itemId',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:view'),
  requireModuleAccess('menu', 'view'),
  validate({ params: menuItemParamsSchema }),
  getMenuItem
);

// --------------------------------------------------------------------------
// 3. MENU REVISION PROPOSALS (MAKER-CHECKER WORKFLOW)
// --------------------------------------------------------------------------
// POST /api/v1/menu/revisions
menuRouter.post(
  '/menu/revisions',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:edit'),
  requireModuleAccess('menu', 'edit'),
  validate({ body: createMenuRevisionBodySchema }),
  requireOptionalOutletAccessInBody,
  createRevision
);

// GET /api/v1/menu/revisions
menuRouter.get(
  '/menu/revisions',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['menu:view', 'menu:edit', 'menu:approve_revisions']),
  requireModuleAccess('menu', 'view'),
  validate({ query: listMenuRevisionsQuerySchema }),
  listRevisions
);

// GET /api/v1/menu/revisions/:revisionId
menuRouter.get(
  '/menu/revisions/:revisionId',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['menu:view', 'menu:edit', 'menu:approve_revisions']),
  requireModuleAccess('menu', 'view'),
  validate({ params: menuRevisionParamsSchema }),
  getRevision
);

// POST /api/v1/menu/revisions/:revisionId/approve
menuRouter.post(
  '/menu/revisions/:revisionId/approve',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:approve_revisions'),
  requireModuleAccess('menu', 'edit'),
  validate({
    params: menuRevisionParamsSchema,
    body: approveMenuRevisionBodySchema
  }),
  approveRevision
);

// POST /api/v1/menu/revisions/:revisionId/reject
menuRouter.post(
  '/menu/revisions/:revisionId/reject',
  authenticateStaff,
  requireAuth,
  requirePermission('menu:approve_revisions'),
  requireModuleAccess('menu', 'edit'),
  validate({
    params: menuRevisionParamsSchema,
    body: rejectMenuRevisionBodySchema
  }),
  rejectRevision
);
