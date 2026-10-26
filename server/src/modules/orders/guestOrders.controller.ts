import { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service.js';
import { KitchenService } from '../kitchen/kitchen.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * POST /api/v1/guest/orders
 * Guest punches an order round at their active dining table.
 */
export async function createGuestOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.guestSession) {
    return next(new UnauthorizedError('Guest session authorization required'));
  }

  const { diningSessionId, outletId } = req.guestSession;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `guest_gen_${req.guestSession.tokenId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'ORDER_CREATE',
      outletId,
      actorStaffId: null,
      payload: {
        diningSessionId,
        items: req.body.items,
        specialInstructions: req.body.specialInstructions || null
      }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }

    acquiredKeyId = acquireResult.keyId;

    const mappedItems = (req.body.items || []).map((it: any) => {
      const portionText = it.portion || it.selectedPortionLabel;
      const noteText = it.customizationNotes || it.notes;
      const customizationNotes = portionText && portionText !== 'Standard'
        ? (noteText ? `${portionText} • ${noteText}` : portionText)
        : (noteText || undefined);

      return {
        menuItemId: it.menuItemId,
        quantity: it.quantity,
        portion: portionText || undefined,
        customizationNotes
      };
    });

    const order = await OrdersService.createOrder({
      outletId,
      diningSessionId,
      orderSource: 'CUSTOMER_QR',
      items: mappedItems,
      specialInstructions: req.body.specialInstructions,
      idempotencyKey,
      staffId: null,
      reqCorrelationId,
      ipAddress: req.ip
    });

    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      order,
      'orders',
      order.id
    );

    res.status(201).json(order);
  } catch (err) {
    if (acquiredKeyId) {
      try {
        await IdempotencyService.fail(acquiredKeyId);
      } catch {}
    }
    next(err);
  }
}

/**
 * GET /api/v1/guest/orders
 * Returns list of orders belonging strictly to the guest's authenticated dining session.
 */
export async function listGuestOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.guestSession) {
      return next(new UnauthorizedError('Guest session authorization required'));
    }

    const { diningSessionId } = req.guestSession;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await OrdersService.listOrders({
      diningSessionId,
      status,
      limit,
      offset
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/guest/orders/:orderId
 * Returns a single order if and only if it belongs to the guest's session.
 */
export async function getGuestOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.guestSession) {
      return next(new UnauthorizedError('Guest session authorization required'));
    }

    const { orderId } = req.params;
    const order = await OrdersService.getOrderById(orderId);

    // Strict guest ownership enforcement: prohibit accessing another table/session's order
    if (order.diningSessionId !== req.guestSession.diningSessionId) {
      throw new NotFoundError(`Order '${orderId}'`);
    }

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}
