import { Request, Response, NextFunction } from 'express';
import { MenuService } from './menu.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError } from '../../utils/errors.js';

async function menuMutation(req: Request, operationType: string, statusCode: number, action: () => Promise<any>) {
  const key = req.headers['idempotency-key'] as string | undefined;
  let acquiredId: string | null = null;
  if (key) {
    const result = await IdempotencyService.acquireOrCheck({ idempotencyKey: key, operationType,
      outletId: req.params.outletId, actorStaffId: req.staff!.id,
      payload: { actorStaffId: req.staff!.id, outletId: req.params.outletId, itemId: req.params.itemId || null, body: req.body } });
    if (result.status === 'REPLAY') return { statusCode: result.statusCode, body: result.body };
    acquiredId = result.keyId;
  }
  try {
    const body = await action();
    if (acquiredId) await IdempotencyService.complete(acquiredId, statusCode, body, 'menu_items', body.id);
    return { statusCode, body };
  } catch (error) {
    if (acquiredId) await IdempotencyService.fail(acquiredId);
    throw error;
  }
}

export async function getOutletMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { outletId } = req.params;
    const menu = await MenuService.getOutletMenu(outletId);
    res.status(200).json(menu);
  } catch (err) {
    next(err);
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await MenuService.getCategories();
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function getMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { itemId } = req.params;
    const item = await MenuService.getMenuItemById(itemId, req.staff);
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
}

export async function createRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    await MenuService.authorizeRevision(req.staff, { outlet_id: req.body.outletId || null, menu_item_id: req.body.menuItemId });
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'MENU_REVISION_CREATE',
        outletId: req.body.outletId || null,
        actorStaffId: req.staff.id,
        payload: { actorStaffId: req.staff.id, body: req.body }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const revision = await MenuService.createMenuRevision(
      req.body,
      req.staff.id,
      requestId,
      req.ip
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        201,
        revision,
        'menu_item_revisions',
        revision.id
      );
    }

    res.status(201).json(revision);
  } catch (err) {
    if (acquiredKeyId) {
      try {
        await IdempotencyService.fail(acquiredKeyId);
      } catch {}
    }
    next(err);
  }
}

export async function listRevisions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, menuItemId, outletId, limit, offset } = req.query as any;
    const result = await MenuService.listMenuRevisions({
      status,
      menuItemId,
      outletId,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    }, req.staff);

    res.status(200).json({
      total: result.total,
      revisions: result.revisions,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
  } catch (err) {
    next(err);
  }
}

export async function getRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { revisionId } = req.params;
    const revision = await MenuService.getMenuRevisionById(revisionId, req.staff);
    res.status(200).json(revision);
  } catch (err) {
    next(err);
  }
}

export async function approveRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { revisionId } = req.params;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    await MenuService.authorizeRevisionById(revisionId, req.staff, Boolean(idempotencyKey));
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'MENU_REVISION_APPROVE',
        actorStaffId: req.staff.id,
        payload: { actorStaffId: req.staff.id, revisionId, body: req.body }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await MenuService.approveMenuRevision(
      revisionId,
      req.staff.id,
      req.body?.reviewNotes,
      requestId,
      req.ip,
      req.staff
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'menu_item_revisions',
        revisionId
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

export async function rejectRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { revisionId } = req.params;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    await MenuService.authorizeRevisionById(revisionId, req.staff, Boolean(idempotencyKey));
    if (idempotencyKey) {
      const acquireResult = await IdempotencyService.acquireOrCheck({
        idempotencyKey,
        operationType: 'MENU_REVISION_REJECT',
        actorStaffId: req.staff.id,
        payload: { actorStaffId: req.staff.id, revisionId, body: req.body }
      });

      if (acquireResult.status === 'REPLAY') {
        res.status(acquireResult.statusCode).json(acquireResult.body);
        return;
      }

      acquiredKeyId = acquireResult.keyId;
    }

    const result = await MenuService.rejectMenuRevision(
      revisionId,
      req.staff.id,
      req.body?.reviewNotes,
      requestId,
      req.ip,
      req.staff
    );

    if (acquiredKeyId) {
      await IdempotencyService.complete(
        acquiredKeyId,
        200,
        result,
        'menu_item_revisions',
        revisionId
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

export async function createMenuItemController(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }
  try {
    const { outletId } = req.params;
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const result = await menuMutation(req, 'MENU_ITEM_CREATE', 201, () => MenuService.createMenuItem(
      outletId,
      req.body,
      req.staff!.id,
      requestId,
      req.ip
    ));
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
}

export async function updateMenuItemController(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }
  try {
    const { outletId, itemId } = req.params;
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const result = await menuMutation(req, 'MENU_ITEM_UPDATE', 200, () => MenuService.updateMenuItem(
      outletId,
      itemId,
      req.body,
      req.staff!.id,
      requestId,
      req.ip
    ));
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    next(err);
  }
}

export async function toggleAvailabilityController(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }
  try {
    const { outletId, itemId } = req.params;
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const result = await MenuService.toggleMenuItemAvailability(
      outletId,
      itemId,
      req.body?.isAvailable,
      req.staff.id,
      requestId,
      req.ip
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

