import { Router } from 'express';
import { authenticateGuestSession } from '../../middleware/guestAuth.js';
import { validate } from '../../middleware/validate.js';
import {
  orderParamsSchema,
  createGuestOrderBodySchema,
  listOrdersQuerySchema
} from './orders.validation.js';
import {
  createGuestOrder,
  listGuestOrders,
  getGuestOrder
} from './guestOrders.controller.js';

export const guestOrdersRouter = Router();

// POST /api/v1/guest/orders
guestOrdersRouter.post(
  '/guest/orders',
  authenticateGuestSession,
  validate({ body: createGuestOrderBodySchema }),
  createGuestOrder
);

// GET /api/v1/guest/orders
guestOrdersRouter.get(
  '/guest/orders',
  authenticateGuestSession,
  validate({ query: listOrdersQuerySchema }),
  listGuestOrders
);

// GET /api/v1/guest/orders/:orderId
guestOrdersRouter.get(
  '/guest/orders/:orderId',
  authenticateGuestSession,
  validate({ params: orderParamsSchema }),
  getGuestOrder
);
