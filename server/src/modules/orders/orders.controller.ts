import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service.js';
import { KitchenService } from '../kitchen/kitchen.service.js';
import { DiningService } from '../dining/dining.service.js';
import { getDbPool, withTransaction } from '../../db/pool.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError, ForbiddenError, BadRequestError, NotFoundError } from '../../utils/errors.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';


/**
 * POST /api/v1/orders
 * Waiter punches an order round at a dining table.
 */
export async function createStaffOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    (req.body?.idempotencyKey as string | undefined) ||
    `waiter_gen_${req.staff.id}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const result=await withTransaction(async client=>{
    const { outletId, items, specialInstructions, guestCount } = req.body;
    let targetSessionId = req.body.diningSessionId;

    checkStaffOutletAccess(req.staff!, outletId);

    const pool = client;
    const outletCheck = await pool.query('SELECT id, is_active FROM public.outlets WHERE id = $1', [outletId]);
    if (outletCheck.rows.length > 0 && outletCheck.rows[0].is_active === false) {
      throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
    }

    // Resolve dining session from tableId if not directly provided
    if (!targetSessionId && req.body.tableId) {
      const tableRes = await pool.query(
        'SELECT id, outlet_id, table_number, active_dining_session_id FROM public.restaurant_tables WHERE id = $1 FOR UPDATE',
        [req.body.tableId]
      );
      if (tableRes.rows.length === 0) {
        throw new NotFoundError(`Restaurant table '${req.body.tableId}'`);
      }
      const table = tableRes.rows[0];
      if (table.outlet_id !== outletId) {
        throw new BadRequestError(`Table '${table.table_number}' belongs to outlet '${table.outlet_id}', not '${outletId}'`);
      }

      if (table.active_dining_session_id) {
        targetSessionId = table.active_dining_session_id;
      } else {
        // Open active dining session for the table
        const session = await DiningService.createDiningSession(
          {
            outletId,
            tableId: table.id,
            guestCount: guestCount || 2
          },
          req.staff!.id,
          reqCorrelationId,
          req.ip,client
        );
        targetSessionId = session.id;
      }
    }

    if (!targetSessionId) {
      throw new BadRequestError('Either diningSessionId or tableId must resolve to an active dining session');
    }

    // Map items to format expected by OrdersService, preserving portion and notes
    const mappedItems = items.map((it: any) => {
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

    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'ORDER_CREATE',
      outletId,
      actorStaffId: req.staff!.id,
      payload: {
        outletId,
        tableId:req.body.tableId || null,
        diningSessionId: targetSessionId,
        staffId:req.staff!.id,
        items: mappedItems,
        specialInstructions: specialInstructions || null
      }
    },client);

    if (acquireResult.status === 'REPLAY') {
      return {status:acquireResult.statusCode,body:acquireResult.body};
    }

    acquiredKeyId = acquireResult.keyId;

    const order = await OrdersService.createOrder({
      outletId,
      diningSessionId: targetSessionId,
      expectedTableId:req.body.tableId,
      orderSource: 'WAITER_POS',
      items: mappedItems,
      specialInstructions,
      idempotencyKey,
      staffId: req.staff!.id,
      reqCorrelationId,
      ipAddress: req.ip
    },client);

    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      order,
      'orders',
      order.id,client
    );

    return {status:201,body:order};
    });
    res.status(result.status).json(result.body);
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
 * GET /api/v1/orders/:orderId
 */
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId } = req.params;
    const order = await OrdersService.getOrderById(orderId);

    if (req.staff) {
      checkStaffOutletAccess(req.staff, order.outletId);
    }

    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/outlets/:outletId/orders
 */
export async function listOutletOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { outletId } = req.params;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await OrdersService.listOrders({
      outletId,
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
 * GET /api/v1/dining-sessions/:sessionId/orders
 */
export async function listSessionOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await OrdersService.listOrders({
      diningSessionId: sessionId,
      status,
      limit,
      offset
    });

    if (result.orders.length > 0 && req.staff) {
      checkStaffOutletAccess(req.staff, result.orders[0].outletId);
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:orderId/status
 */
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { orderId } = req.params;
  const { status, notes } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await OrdersService.getOrderById(orderId);
    checkStaffOutletAccess(req.staff, existing.outletId);

    const required=status==='CANCELLED' ? 'order:cancel' : ['ACCEPTED','PREPARING','READY'].includes(status) ? 'kds:update' : 'order:update';
    if(!req.staff.roles.some(r=>r.id==='SUPER_ADMIN') && !req.staff.permissions.includes(required) && !(status==='SERVED' && req.staff.permissions.includes('order:serve'))) throw new ForbiddenError('Permission required for this transition.');
    if(status==='CANCELLED') {res.status(200).json(await OrdersService.cancelOrder(orderId,req.staff.id,notes,reqCorrelationId,req.ip));return;}
    const updated = await OrdersService.updateOrderStatus(
      orderId,
      status,
      req.staff.id,
      notes,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:orderId/cancel
 */
export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { orderId } = req.params;
  const { reason } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await OrdersService.getOrderById(orderId);
    checkStaffOutletAccess(req.staff, existing.outletId);

    const cancelled = await OrdersService.cancelOrder(
      orderId,
      req.staff.id,
      reason,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(cancelled);
  } catch (err) {
    next(err);
  }
}

export async function createRoomServiceOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId, hotelStayId, roomId, items, specialInstructions } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `rs_order_${req.staff.id}_${hotelStayId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    checkStaffOutletAccess(req.staff, outletId);

    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'ROOM_SERVICE_ORDER',
      outletId,
      actorStaffId: req.staff.id,
      payload: { outletId, hotelStayId, roomId, items, specialInstructions: specialInstructions || null }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const order = await OrdersService.createRoomServiceOrder({
      outletId,
      hotelStayId,
      roomId,
      items,
      specialInstructions,
      idempotencyKey,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, order);
    }

    res.status(201).json(order);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

export async function cancelOrderItem(req:Request,res:Response,next:NextFunction) {
  try {
    if(!req.staff) throw new UnauthorizedError('Staff authorization required.');
    const order=await OrdersService.getOrderById(req.params.orderId);checkStaffOutletAccess(req.staff,order.outletId);
    const line=(await getDbPool().query(`SELECT ki.id FROM public.kot_items ki JOIN public.order_items oi ON oi.id=ki.order_item_id
      WHERE oi.id=$1 AND oi.order_id=$2`,[req.params.itemId,order.id])).rows[0];
    if(!line) throw new NotFoundError('Order item');
    const result=await KitchenService.updateKotItemStatus(line.id,'CANCELLED',req.staff.id,req.headers['x-request-id'] as string || 'unknown',req.ip,req.body.reason);
    res.status(200).json(result);
  }catch(error){next(error);}
}
