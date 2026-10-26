import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requireOutletAccess,
  requireModuleAccess
} from '../../middleware/auth.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { getOutletReportsSummary } from './reports.controller.js';

export const reportsRouter = Router();

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

// GET /api/v1/outlets/:outletId/reports/summary
reportsRouter.get(
  '/outlets/:outletId/reports/summary',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['audit:view']),
  requireModuleAccess('reports', 'view'),
  requireOutletAccess('outletId'),
  getOutletReportsSummary
);
