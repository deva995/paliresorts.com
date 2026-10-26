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
  createServiceRequestBodySchema,
  outletTablesParamsSchema,
  tableParamsSchema,
  diningSessionParamsSchema,
  createDiningSessionBodySchema,
  closeDiningSessionBodySchema,
  cancelDiningSessionBodySchema,
  listDiningSessionsQuerySchema,
  serviceRequestParamsSchema,
  listServiceRequestsQuerySchema,
  createZoneBodySchema,
  createTableBodySchema,
  updateTableBodySchema,
  assignTableBodySchema
} from './dining.validation.js';
import {
  createStaffServiceRequest,
  getOutletTables,
  createOutletZone,
  getOutletZones,
  getOutletFloorStaff,
  issueOrderingQr, getOrderingQr,
  getTableById,
  createDiningSession,
  getDiningSession,
  closeDiningSession,
  cancelDiningSession,
  listOutletDiningSessions,
  acknowledgeServiceRequest,
  resolveServiceRequest,
  listOutletServiceRequests,
  assignTable,
  createTable,
  updateTable,
  deleteTable
} from './dining.controller.js';

export const diningRouter = Router();

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

// --------------------------------------------------------------------------
// 1. FLOOR & TABLES
// --------------------------------------------------------------------------

// GET /api/v1/outlets/:outletId/tables
diningRouter.get(
  '/outlets/:outletId/tables',
  authenticateStaff,
  requireAuth,
  requirePermission('table:view'),
  requireModuleAccess('floor', 'view'),
  requireOutletAccess('outletId'),
  validate({ params: outletTablesParamsSchema }),
  getOutletTables
);

diningRouter.get('/outlets/:outletId/floor-staff',authenticateStaff,requireAuth,requirePermission('table:view'),requireModuleAccess('floor','view'),requireOutletAccess('outletId'),validate({params:outletTablesParamsSchema}),getOutletFloorStaff);

diningRouter.post(
  '/outlets/:outletId/zones',
  authenticateStaff,
  requireAuth,
  requirePermission('table:manage'),
  requireModuleAccess('floor', 'edit'),
  requireOutletAccess('outletId'),
  validate({
    params: outletTablesParamsSchema,
    body: createZoneBodySchema
  }),
  createOutletZone
);

diningRouter.get('/outlets/:outletId/zones',authenticateStaff,requireAuth,requirePermission('table:view'),requireModuleAccess('floor','view'),requireOutletAccess('outletId'),validate({params:outletTablesParamsSchema}),getOutletZones);

// POST /api/v1/outlets/:outletId/tables
diningRouter.post(
  '/outlets/:outletId/tables',
  authenticateStaff,
  requireAuth,
  requirePermission('table:manage'),
  requireModuleAccess('floor', 'edit'),
  requireOutletAccess('outletId'),
  validate({ params: outletTablesParamsSchema, body: createTableBodySchema }),
  createTable
);

// GET /api/v1/tables/:tableId
diningRouter.get(
  '/tables/:tableId',
  authenticateStaff,
  requireAuth,
  requirePermission('table:view'),
  requireModuleAccess('floor', 'view'),
  validate({ params: tableParamsSchema }),
  getTableById
);

// PUT /api/v1/tables/:tableId
diningRouter.put(
  '/tables/:tableId',
  authenticateStaff,
  requireAuth,
  requirePermission('table:manage'),
  requireModuleAccess('floor', 'edit'),
  validate({ params: tableParamsSchema, body: updateTableBodySchema }),
  updateTable
);

// DELETE /api/v1/tables/:tableId
diningRouter.delete(
  '/tables/:tableId',
  authenticateStaff,
  requireAuth,
  requirePermission('table:manage'),
  requireModuleAccess('floor', 'edit'),
  validate({ params: tableParamsSchema }),
  deleteTable
);

diningRouter.get(
  '/tables/:tableId/ordering-qr',
  authenticateStaff,
  requireAuth,
  requirePermission('table:manage'),
  requireModuleAccess('floor', 'edit'),
  validate({ params: tableParamsSchema }),
  getOrderingQr
);

diningRouter.post('/tables/:tableId/ordering-qr',authenticateStaff,requireAuth,requirePermission('table:manage'),requireModuleAccess('floor','edit'),validate({params:tableParamsSchema}),issueOrderingQr);

// POST /api/v1/tables/:tableId/assign
diningRouter.post(
  '/tables/:tableId/assign',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:manage']),
  requireModuleAccess('floor', 'edit'),
  validate({ params: tableParamsSchema, body: assignTableBodySchema }),
  assignTable
);

// --------------------------------------------------------------------------
// 2. DINING SESSIONS LIFECYCLE
// --------------------------------------------------------------------------

// POST /api/v1/dining-sessions
diningRouter.post(
  '/dining-sessions',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:manage', 'order:create']),
  requireModuleAccess('floor', 'edit'),
  validate({ body: createDiningSessionBodySchema }),
  requireOutletAccess('outletId'),
  createDiningSession
);

// GET /api/v1/dining-sessions/:sessionId
diningRouter.get(
  '/dining-sessions/:sessionId',
  authenticateStaff,
  requireAuth,
  requirePermission('table:view'),
  requireModuleAccess('floor', 'view'),
  validate({ params: diningSessionParamsSchema }),
  getDiningSession
);

// POST /api/v1/dining-sessions/:sessionId/close
diningRouter.post(
  '/dining-sessions/:sessionId/close',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['bill:settle', 'table:assign', 'table:manage']),
  requireModuleAccess(['floor', 'billing'], 'edit'),
  validate({
    params: diningSessionParamsSchema,
    body: closeDiningSessionBodySchema
  }),
  closeDiningSession
);

// POST /api/v1/dining-sessions/:sessionId/cancel
diningRouter.post(
  '/dining-sessions/:sessionId/cancel',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:manage', 'order:cancel']),
  requireModuleAccess('floor', 'edit'),
  validate({
    params: diningSessionParamsSchema,
    body: cancelDiningSessionBodySchema
  }),
  cancelDiningSession
);

// GET /api/v1/outlets/:outletId/dining-sessions
diningRouter.get(
  '/outlets/:outletId/dining-sessions',
  authenticateStaff,
  requireAuth,
  requirePermission('table:view'),
  requireModuleAccess('floor', 'view'),
  requireOutletAccess('outletId'),
  validate({
    params: outletTablesParamsSchema,
    query: listDiningSessionsQuerySchema
  }),
  listOutletDiningSessions
);

// --------------------------------------------------------------------------
// 3. SERVICE REQUESTS MANAGEMENT (STAFF FLOOR CALL-BELL)
// --------------------------------------------------------------------------

// GET /api/v1/outlets/:outletId/service-requests
diningRouter.get(
  '/outlets/:outletId/service-requests',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:view']),
  requireModuleAccess('floor', 'view'),
  requireOutletAccess('outletId'),
  validate({
    params: outletTablesParamsSchema,
    query: listServiceRequestsQuerySchema
  }),
  listOutletServiceRequests
);

// POST /api/v1/service-requests/:requestId/acknowledge
diningRouter.post(
  '/service-requests/:requestId/acknowledge',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:view']),
  requireModuleAccess('floor', 'edit'),
  validate({ params: serviceRequestParamsSchema }),
  acknowledgeServiceRequest
);

// POST /api/v1/service-requests/:requestId/resolve
diningRouter.post(
  '/service-requests/:requestId/resolve',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['table:assign', 'table:view']),
  requireModuleAccess('floor', 'edit'),
  validate({ params: serviceRequestParamsSchema }),
  resolveServiceRequest
);

diningRouter.post('/tables/:tableId/service-requests',authenticateStaff,requireAnyPermission(['table:assign','table:manage']),requireModuleAccess('floor','edit'),validate({params:tableParamsSchema,body:createServiceRequestBodySchema}),createStaffServiceRequest);
