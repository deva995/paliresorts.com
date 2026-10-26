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
  kotParamsSchema,
  orderParamsSchema,
  outletParamsSchema,
  kotItemParamsSchema,
  cancelKotBodySchema,
  updateKotItemStatusBodySchema,
  listKotsQuerySchema
} from './kitchen.validation.js';
import {
  getKitchenStations,
  listOutletKots,
  getKotById,
  generateOrderKots,
  acceptKot,
  startKot,
  readyKot,
  servedKot,
  cancelKot,
  updateKotItemStatus
} from './kitchen.controller.js';

export const kitchenRouter = Router();

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

    const hasAny = permissionCodes.some((code) => req.staff!.permissions.includes(code));
    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Staff lacks required permissions: at least one of [${permissionCodes.map((c) => `'${c}'`).join(', ')}] is required`
        )
      );
    }

    next();
  };
}

// ----------------------------------------------------------------------------
// Kitchen Stations & KDS Queue
// ----------------------------------------------------------------------------

kitchenRouter.get(
  '/outlets/:outletId/kitchen/stations',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['kds:view', 'order:view']),
  requireModuleAccess('kitchen', 'view'),
  validate({ params: outletParamsSchema }),
  requireOutletAccess('outletId'),
  getKitchenStations
);

kitchenRouter.get(
  '/outlets/:outletId/kots',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:view'),
  requireModuleAccess('kitchen', 'view'),
  validate({ params: outletParamsSchema, query: listKotsQuerySchema }),
  requireOutletAccess('outletId'),
  listOutletKots
);

kitchenRouter.get(
  '/kots/:kotId',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:view'),
  requireModuleAccess('kitchen', 'view'),
  validate({ params: kotParamsSchema }),
  getKotById
);

// ----------------------------------------------------------------------------
// KOT Generation & Lifecycle Transitions
// ----------------------------------------------------------------------------

kitchenRouter.post(
  '/orders/:orderId/kots',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['order:create', 'order:update', 'kds:update']),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: orderParamsSchema }),
  generateOrderKots
);

kitchenRouter.post(
  '/kots/:kotId/accept',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:update'),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotParamsSchema }),
  acceptKot
);

kitchenRouter.post(
  '/kots/:kotId/start',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:update'),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotParamsSchema }),
  startKot
);

kitchenRouter.post(
  '/kots/:kotId/ready',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:update'),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotParamsSchema }),
  readyKot
);

kitchenRouter.post(
  '/kots/:kotId/served',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:update'),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotParamsSchema }),
  servedKot
);

kitchenRouter.post(
  '/kots/:kotId/cancel',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['order:cancel', 'kds:update']),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotParamsSchema, body: cancelKotBodySchema }),
  cancelKot
);

kitchenRouter.post(
  '/kot-items/:kotItemId/status',
  authenticateStaff,
  requireAuth,
  requirePermission('kds:update'),
  requireModuleAccess('kitchen', 'edit'),
  validate({ params: kotItemParamsSchema, body: updateKotItemStatusBodySchema }),
  updateKotItemStatus
);
