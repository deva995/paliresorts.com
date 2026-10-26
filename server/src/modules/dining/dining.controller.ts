import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import { Request, Response, NextFunction } from 'express';
import { DiningService } from './dining.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { getDbPool } from '../../db/pool.js';
import { AuthenticatedStaffContext } from '../../middleware/auth.js';


/**
 * GET /api/v1/outlets/:outletId/tables
 */
export async function createStaffServiceRequest(req:Request,res:Response,next:NextFunction) {
  try {
    if(!req.staff) throw new UnauthorizedError('Staff authorization required');
    const table=await DiningService.getTableById(req.params.tableId);checkStaffOutletAccess(req.staff,table.outletId);
    const row=(await getDbPool().query(`SELECT t.active_dining_session_id,o.is_active AS outlet_active,t.is_active
      FROM restaurant_tables t JOIN outlets o ON o.id=t.outlet_id WHERE t.id=$1`,[table.id])).rows[0];
    if(!row?.is_active || !row.outlet_active || !row.active_dining_session_id) throw new ForbiddenError('Table has no active sitting.');
    const result=await DiningService.createServiceRequest(req.body.requestType,{diningSessionId:row.active_dining_session_id,tableId:table.id,outletId:table.outletId,tableNumber:table.tableNumber});
    res.status(201).json(result);
  }catch(error){next(error);}
}

export async function getOrderingQr(req:Request,res:Response,next:NextFunction) {
  try {
    if(!req.staff) throw new UnauthorizedError('Staff authorization required');
    const table = await DiningService.getTableById(req.params.tableId);
    checkStaffOutletAccess(req.staff,table.outletId);
    const result = await DiningService.getOrderingQr(table.id);
    res.set('Cache-Control','no-store, private');
    res.set('Pragma','no-cache');
    res.set('Referrer-Policy','no-referrer');
    res.json(result);
  } catch(error) { next(error); }
}

export async function issueOrderingQr(req:Request,res:Response,next:NextFunction) {
  try {
    if(!req.staff) throw new UnauthorizedError('Staff authorization required');
    const table=await DiningService.getTableById(req.params.tableId);checkStaffOutletAccess(req.staff,table.outletId);
    res.json(await DiningService.issueOrderingQr(table.id,req.staff.id,'qr-issuance'));
  }catch(error){next(error);}
}

export async function getOutletFloorStaff(req: Request,res: Response,next: NextFunction) {
  try { res.json({staff:await DiningService.getOutletFloorStaff(req.params.outletId)}); } catch(error) { next(error); }
}

export async function createOutletZone(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.staff) {
      throw new UnauthorizedError('Staff authorization required');
    }

    const { outletId } = req.params;
    checkStaffOutletAccess(req.staff, outletId);

    const requestId =
      (req.headers['x-request-id'] as string) || 'unknown';

    const zone = await DiningService.createOutletZone(
      outletId,
      req.body,
      req.staff.id,
      requestId
    );

    res.status(201).json(zone);
  } catch (error) {
    next(error);
  }
}

export async function getOutletZones(req: Request,res: Response,next: NextFunction) {
  try { res.json({zones:await DiningService.getOutletZones(req.params.outletId)}); } catch(error) { next(error); }
}

export async function getOutletTables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { outletId } = req.params;
    const tables = await DiningService.getOutletTables(outletId);
    res.status(200).json({ tables, items: tables, total: tables.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/tables/:tableId
 */
export async function getTableById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tableId } = req.params;
    const table = await DiningService.getTableById(tableId);

    if (req.staff) {
      checkStaffOutletAccess(req.staff, table.outletId);
    }

    res.status(200).json(table);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tables/:tableId/assign
 * Concurrency-safe table self-assignment or allocation.
 */
export async function assignTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { tableId } = req.params;
    const { staffId, unassign } = req.body || {};

    const targetStaffId = unassign ? null : (staffId || req.staff.id);

    // If assigning to another staff member, require table:manage
    if (targetStaffId && targetStaffId !== req.staff.id) {
      const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
      const canManage = isSuperAdmin || req.staff.permissions.includes('table:manage');
      if (!canManage) {
        throw new ForbiddenError('Staff lacks required permission: table:manage required to assign tables to other staff members');
      }
    }

    const result = await DiningService.assignTable(
      tableId,
      targetStaffId,
      req.staff.id,
      req.staff
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/outlets/:outletId/tables
 */
export async function createTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { outletId } = req.params;
    checkStaffOutletAccess(req.staff, outletId);

    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const table = await DiningService.createTable(outletId, req.body, req.staff.id, requestId);
    res.status(201).json(table);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/tables/:tableId
 */
export async function updateTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { tableId } = req.params;
    const existing = await DiningService.getTableById(tableId);
    checkStaffOutletAccess(req.staff, existing.outletId);

    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const updated = await DiningService.updateTable(tableId, req.body, req.staff.id, requestId);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/tables/:tableId
 */
export async function deleteTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { tableId } = req.params;
    const existing = await DiningService.getTableById(tableId);
    checkStaffOutletAccess(req.staff, existing.outletId);

    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const result = await DiningService.deleteTable(tableId, req.staff.id, requestId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/dining-sessions
 */
export async function createDiningSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'DINING_SESSION_CREATE',
        outletId: req.body.outletId,
        actorStaffId: req.staff.id,
        payload: req.body
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const session = await DiningService.createDiningSession(
      req.body,
      req.staff.id,
      requestId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        201,
        session,
        'dining_sessions',
        session.id
      );
    }

    res.status(201).json(session);
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
 * GET /api/v1/dining-sessions/:sessionId
 */
export async function getDiningSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    const session = await DiningService.getDiningSessionById(sessionId);

    if (req.staff) {
      checkStaffOutletAccess(req.staff, session.outletId);
    }

    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/dining-sessions/:sessionId/close
 */
export async function closeDiningSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'DINING_SESSION_CLOSE',
        outletId: null,
        actorStaffId: req.staff.id,
        payload: { sessionId, ...req.body }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await DiningService.closeDiningSession(
      sessionId,
      req.staff.id,
      requestId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'dining_sessions',
        sessionId
      );
    }

    res.status(200).json(result);
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
 * POST /api/v1/dining-sessions/:sessionId/cancel
 */
export async function cancelDiningSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { sessionId } = req.params;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'DINING_SESSION_CANCEL',
        outletId: null,
        actorStaffId: req.staff.id,
        payload: { sessionId, ...req.body }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await DiningService.cancelDiningSession(
      sessionId,
      req.staff.id,
      req.body?.reason,
      requestId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'dining_sessions',
        sessionId
      );
    }

    res.status(200).json(result);
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
 * GET /api/v1/outlets/:outletId/dining-sessions
 */
export async function listOutletDiningSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { outletId } = req.params;
    const status = req.query.status as string | undefined;
    const sessions = await DiningService.listOutletDiningSessions(outletId, status);
    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/service-requests/:requestId/acknowledge
 */
export async function acknowledgeServiceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { requestId } = req.params;
  const correlationId = (req.headers['x-request-id'] as string) || 'unknown';
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  let acquiredKeyId: string | null = null;

  try {
    const resource=(await getDbPool().query('SELECT outlet_id FROM public.service_requests WHERE id=$1',[requestId])).rows[0];
    if(resource) checkStaffOutletAccess(req.staff,resource.outlet_id);
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'SERVICE_REQUEST_ACKNOWLEDGE',
        outletId: null,
        actorStaffId: req.staff.id,
        payload: { requestId,staffId:req.staff.id }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await DiningService.acknowledgeServiceRequest(
      requestId,
      req.staff.id,
      correlationId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'service_requests',
        requestId
      );
    }

    res.status(200).json(result);
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
 * POST /api/v1/service-requests/:requestId/resolve
 */
export async function resolveServiceRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { requestId } = req.params;
  const correlationId = (req.headers['x-request-id'] as string) || 'unknown';
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  let acquiredKeyId: string | null = null;

  try {
    const resource=(await getDbPool().query('SELECT outlet_id FROM public.service_requests WHERE id=$1',[requestId])).rows[0];
    if(resource) checkStaffOutletAccess(req.staff,resource.outlet_id);
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'SERVICE_REQUEST_RESOLVE',
        outletId: null,
        actorStaffId: req.staff.id,
        payload: { requestId,staffId:req.staff.id }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await DiningService.resolveServiceRequest(
      requestId,
      req.staff.id,
      correlationId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'service_requests',
        requestId
      );
    }

    res.status(200).json(result);
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
 * GET /api/v1/outlets/:outletId/service-requests
 */
export async function listOutletServiceRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { outletId } = req.params;
  const { status, limit, cursor } = req.query as {
    status?: string[];
    limit?: number;
    cursor?: string;
  };

  try {
    const result = await DiningService.listOutletServiceRequests({
      outletId,
      status,
      limit,
      cursor
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

