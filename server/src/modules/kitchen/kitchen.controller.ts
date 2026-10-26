import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import { Request, Response, NextFunction } from 'express';
import { KitchenService } from './kitchen.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';
import { KotStatus, KotItemStatus } from './kitchen.types.js';
import { getDbPool } from '../../db/pool.js';


function checkStaffStationAccess(staff: AuthenticatedStaffContext, stationCode: string): void {
  const isSuperOrExecutive = staff.roles.some(
    (r) =>
      r.id === 'SUPER_ADMIN' ||
      r.id === 'RESTAURANT_OWNER' ||
      r.id === 'KITCHEN_EXECUTIVE' ||
      r.id === 'RESTAURANT_MANAGER' ||
      r.id === 'KITCHEN_STAFF' ||
      r.id === 'KITCHEN_USER'
  );
  if (isSuperOrExecutive) return;

  const isKitchenCooking = staff.roles.some((r) => r.id === 'KITCHEN_COOKING');
  const isKitchenBar = staff.roles.some((r) => r.id === 'KITCHEN_BAR' || r.id === 'BEVERAGES' || r.id === 'DRINKS');

  if (isKitchenCooking && !['TANDOOR', 'CURRY', 'CHINESE'].includes(stationCode)) {
    throw new ForbiddenError(
      'Line cooks (KITCHEN_COOKING) can only access hot kitchen stations (Tandoor, Curry, Chinese)'
    );
  }
  if (isKitchenBar && stationCode !== 'BAR') {
    throw new ForbiddenError(
      'Bar staff (KITCHEN_BAR) can only access beverage tickets (Bar)'
    );
  }
}

/**
 * GET /api/v1/outlets/:outletId/kitchen/stations
 */
export async function getKitchenStations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId } = req.params;

  try {
    checkStaffOutletAccess(req.staff, outletId);
    const stations = await KitchenService.listStations(outletId);
    res.status(200).json(stations);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/outlets/:outletId/kots
 */
export async function listOutletKots(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { outletId } = req.params;
  const { stationId, stationCode, status, activeOnly, orderId, limit, offset } = req.query as any;

  try {
    checkStaffOutletAccess(req.staff, outletId);

    // Apply role-based station filtering:
    // KITCHEN_COOKING sees hot stations (TANDOOR, CURRY, CHINESE)
    // KITCHEN_BAR sees beverage tickets (BAR)
    let roleStationCodes: string[] | undefined;
    const isSuperOrExecutive = req.staff.roles.some(
      (r) =>
        r.id === 'SUPER_ADMIN' ||
        r.id === 'RESTAURANT_OWNER' ||
        r.id === 'KITCHEN_EXECUTIVE' ||
        r.id === 'RESTAURANT_MANAGER' ||
        r.id === 'KITCHEN_STAFF' ||
        r.id === 'KITCHEN_USER'
    );
    const isKitchenCooking = req.staff.roles.some((r) => r.id === 'KITCHEN_COOKING');
    const isKitchenBar = req.staff.roles.some(
      (r) => r.id === 'KITCHEN_BAR' || r.id === 'BEVERAGES' || r.id === 'DRINKS'
    );

    if (!isSuperOrExecutive) {
      if (isKitchenCooking) {
        roleStationCodes = ['TANDOOR', 'CURRY', 'CHINESE'];
      } else if (isKitchenBar) {
        roleStationCodes = ['BAR'];
      }
    }

    const result = await KitchenService.listKots({
      outletId,
      stationId,
      stationCode: stationCode as string,
      stationCodes: roleStationCodes,
      status: status as KotStatus,
      activeOnly,
      orderId,
      limit,
      offset
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/kots/:kotId
 */
export async function getKotById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;

  try {
    const kot = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, kot.outletId);
    checkStaffStationAccess(req.staff, kot.stationCode);
    res.status(200).json(kot);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:orderId/kots
 * Generates station KOTs for an order with idempotency protection.
 */
export async function generateOrderKots(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { orderId } = req.params;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `kot_gen_${req.staff.id}_${orderId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    // 1. Fetch order outlet to verify staff outlet access
    const pool = getDbPool();
    const orderRes = await pool.query(
      'SELECT outlet_id FROM public.orders WHERE id = $1;',
      [orderId]
    );

    if (orderRes.rows.length > 0) {
      checkStaffOutletAccess(req.staff, orderRes.rows[0].outlet_id);
    }

    // 2. Check or acquire idempotency lock
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'KOT_GENERATE',
      outletId: orderRes.rows[0]?.outlet_id || null,
      actorStaffId: req.staff.id,
      payload: { orderId }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }

    acquiredKeyId = acquireResult.keyId;

    // 3. Generate KOTs in atomic transaction
    const result = await KitchenService.generateKotsForOrder({
      orderId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip
    });

    // 4. Complete idempotency record
    await IdempotencyService.complete(
      acquiredKeyId,
      201,
      result,
      'orders',
      orderId
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kots/:kotId/accept
 */
export async function acceptKot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, existing.outletId);
    checkStaffStationAccess(req.staff, existing.stationCode);

    const updated = await KitchenService.transitionKotStatus(
      kotId,
      'ACCEPTED',
      req.staff.id,
      undefined,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kots/:kotId/start
 */
export async function startKot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, existing.outletId);
    checkStaffStationAccess(req.staff, existing.stationCode);

    const updated = await KitchenService.transitionKotStatus(
      kotId,
      'PREPARING',
      req.staff.id,
      undefined,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kots/:kotId/ready
 */
export async function readyKot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, existing.outletId);
    checkStaffStationAccess(req.staff, existing.stationCode);

    const updated = await KitchenService.transitionKotStatus(
      kotId,
      'READY',
      req.staff.id,
      undefined,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kots/:kotId/served
 */
export async function servedKot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, existing.outletId);
    checkStaffStationAccess(req.staff, existing.stationCode);

    const updated = await KitchenService.transitionKotStatus(
      kotId,
      'SERVED',
      req.staff.id,
      undefined,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kots/:kotId/cancel
 */
export async function cancelKot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotId } = req.params;
  const { reason } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const existing = await KitchenService.getKotById(kotId);
    checkStaffOutletAccess(req.staff, existing.outletId);
    checkStaffStationAccess(req.staff, existing.stationCode);

    const updated = await KitchenService.transitionKotStatus(
      kotId,
      'CANCELLED',
      req.staff.id,
      reason,
      reqCorrelationId,
      req.ip
    );

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/kot-items/:kotItemId/status
 */
export async function updateKotItemStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { kotItemId } = req.params;
  const { status, reason } = req.body;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

  try {
    const pool = getDbPool();
    const itemRes = await pool.query(
      `SELECT k.outlet_id, s.code AS station_code 
       FROM public.kot_items ki 
       JOIN public.kots k ON k.id = ki.kot_id 
       JOIN public.kitchen_stations s ON s.id = k.station_id
       WHERE ki.id = $1;`,
      [kotItemId]
    );

    if (itemRes.rows.length > 0) {
      checkStaffOutletAccess(req.staff, itemRes.rows[0].outlet_id);
      checkStaffStationAccess(req.staff, itemRes.rows[0].station_code);
    }

    const result = await KitchenService.updateKotItemStatus(
      kotItemId,
      status as KotItemStatus,
      req.staff.id,
      reqCorrelationId,
      req.ip,
      reason
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
