import { Request, Response, NextFunction } from 'express';
import { HousekeepingService } from './housekeeping.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError } from '../../utils/errors.js';
import {
  TaskType,
  TaskStatus,
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceStatus
} from './housekeeping.types.js';

function isHousekeepingOrSuperAdmin(staff: NonNullable<Request['staff']>): boolean {
  return (
    staff.roles.some((r) => r.id === 'SUPER_ADMIN' || r.id === 'GENERAL_MANAGER' || r.id === 'OPERATIONS_MANAGER') ||
    staff.permissions.includes('housekeeping:view') ||
    staff.permissions.includes('housekeeping:update')
  );
}

// ============================================================================
// 1. HOUSEKEEPING TASKS CONTROLLERS
// ============================================================================

export async function listTasks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId, status, taskType, assignedStaffId, limit, offset } = req.query as any;
    const result = await HousekeepingService.listTasks({
      roomId: roomId as string | undefined,
      status: status as TaskStatus | undefined,
      taskType: taskType as TaskType | undefined,
      assignedStaffId: assignedStaffId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { taskId } = req.params;
    const task = await HousekeepingService.getTaskById(taskId);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { roomId, taskType, assignedStaffId, notes } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const task = await HousekeepingService.createTask({
      roomId,
      taskType,
      assignedStaffId,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function assignTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { taskId } = req.params;
    const { assignedStaffId } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const task = await HousekeepingService.assignTask({
      taskId,
      assignedStaffId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export async function startTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { taskId } = req.params;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const task = await HousekeepingService.startTask({
      taskId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export async function completeTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { taskId } = req.params;
    const { notes } = req.body || {};
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const task = await HousekeepingService.completeTask({
      taskId,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export async function inspectTask(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { taskId } = req.params;
    const { passed, notes } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const task = await HousekeepingService.inspectTask({
      taskId,
      passed,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. ROOM STATUS HISTORY CONTROLLER
// ============================================================================

export async function getRoomHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;
    const { limit, offset } = req.query as any;
    const result = await HousekeepingService.getRoomStatusHistory({
      roomId,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. MAINTENANCE ISSUES CONTROLLERS
// ============================================================================

export async function reportIssue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { roomId, outletId, category, severity, description } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `issue_${req.staff.id}_${roomId || outletId || 'gen'}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'MAINTENANCE_ISSUE_REPORT',
      outletId: outletId || null,
      actorStaffId: req.staff.id,
      payload: { roomId: roomId || null, outletId: outletId || null, category, severity, description }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const issue = await HousekeepingService.reportMaintenanceIssue({
      roomId,
      outletId,
      category: category as MaintenanceCategory,
      severity: severity as MaintenanceSeverity,
      description,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, issue);
    }

    res.status(201).json(issue);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

export async function listIssues(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { roomId, outletId, category, severity, status, limit, offset } = req.query as any;
    const staffOutletIds = req.staff.outlets?.map((o) => o.outletId) || [];
    const isHousekeeping = isHousekeepingOrSuperAdmin(req.staff);

    const result = await HousekeepingService.listMaintenanceIssues({
      roomId: roomId as string | undefined,
      outletId: outletId as string | undefined,
      category: category as MaintenanceCategory | undefined,
      severity: severity as MaintenanceSeverity | undefined,
      status: status as MaintenanceStatus | undefined,
      staffId: req.staff.id,
      staffOutletIds,
      isHousekeepingOrSuperAdmin: isHousekeeping,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getIssue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { issueId } = req.params;
    const issue = await HousekeepingService.getMaintenanceIssueById(issueId);
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
}

export async function startRepair(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { issueId } = req.params;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const issue = await HousekeepingService.startRepair({
      issueId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
}

export async function resolveIssue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { issueId } = req.params;
    const { notes } = req.body || {};
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const issue = await HousekeepingService.resolveMaintenanceIssue({
      issueId,
      notes,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
}
