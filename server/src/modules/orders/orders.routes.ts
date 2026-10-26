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
  orderItemParamsSchema,
  orderParamsSchema,
  outletOrdersParamsSchema,
  sessionOrdersParamsSchema,
  createStaffOrderBodySchema,
  createRoomServiceOrderBodySchema,
  updateOrderStatusBodySchema,
  cancelOrderBodySchema,
  listOrdersQuerySchema
} from './orders.validation.js';
import {
  cancelOrderItem,
  createStaffOrder,
  createRoomServiceOrder,
  getOrder,
  listOutletOrders,
  listSessionOrders,
  updateOrderStatus,
  cancelOrder
} from './orders.controller.js';

export const ordersRouter = Router();

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

// POST /api/v1/orders
ordersRouter.post(
  '/orders',
  authenticateStaff,
  requireAuth,
  requirePermission('order:create'),
  requireModuleAccess('orders', 'edit'),
  validate({ body: createStaffOrderBodySchema }),
  requireOutletAccess('outletId'),
  createStaffOrder
);

// POST /api/v1/orders/room-service
ordersRouter.post(
  '/orders/room-service',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['order:create', 'hotel:manage']),
  requireModuleAccess(['orders', 'hotel'], 'edit'),
  validate({ body: createRoomServiceOrderBodySchema }),
  requireOutletAccess('outletId'),
  createRoomServiceOrder
);

// GET /api/v1/orders/:orderId
ordersRouter.get(
  '/orders/:orderId',
  authenticateStaff,
  requireAuth,
  requirePermission('order:view'),
  requireModuleAccess('orders', 'view'),
  validate({ params: orderParamsSchema }),
  getOrder
);

// GET /api/v1/outlets/:outletId/orders
ordersRouter.get(
  '/outlets/:outletId/orders',
  authenticateStaff,
  requireAuth,
  requirePermission('order:view'),
  requireModuleAccess('orders', 'view'),
  requireOutletAccess('outletId'),
  validate({
    params: outletOrdersParamsSchema,
    query: listOrdersQuerySchema
  }),
  listOutletOrders
);

// GET /api/v1/dining-sessions/:sessionId/orders
ordersRouter.get(
  '/dining-sessions/:sessionId/orders',
  authenticateStaff,
  requireAuth,
  requirePermission('order:view'),
  requireModuleAccess('orders', 'view'),
  validate({
    params: sessionOrdersParamsSchema,
    query: listOrdersQuerySchema
  }),
  listSessionOrders
);

// POST /api/v1/orders/:orderId/status
ordersRouter.post(
  '/orders/:orderId/status',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['order:update', 'order:serve', 'order:cancel', 'kds:update']),
  requireModuleAccess('orders', 'edit'),
  validate({
    params: orderParamsSchema,
    body: updateOrderStatusBodySchema
  }),
  updateOrderStatus
);

// POST /api/v1/orders/:orderId/cancel
ordersRouter.post(
  '/orders/:orderId/cancel',
  authenticateStaff,
  requireAuth,
  requirePermission('order:cancel'),
  requireModuleAccess('orders', 'edit'),
  validate({
    params: orderParamsSchema,
    body: cancelOrderBodySchema
  }),
  cancelOrder
);

ordersRouter.post('/orders/:orderId/items/:itemId/cancel',authenticateStaff,requirePermission('order:cancel'),requireModuleAccess('orders','edit'),validate({params:orderItemParamsSchema,body:cancelOrderBodySchema}),cancelOrderItem);
