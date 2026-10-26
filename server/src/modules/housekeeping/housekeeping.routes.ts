import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateStaff,
  requireAuth,
  requirePermission,
  requireModuleAccess
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import {
  taskIdParamsSchema,
  issueIdParamsSchema,
  roomIdParamsSchema,
  listTasksQuerySchema,
  createTaskBodySchema,
  assignTaskBodySchema,
  completeTaskBodySchema,
  inspectTaskBodySchema,
  listRoomHistoryQuerySchema,
  reportIssueBodySchema,
  listIssuesQuerySchema,
  resolveIssueBodySchema
} from './housekeeping.validation.js';
import {
  listTasks,
  getTask,
  createTask,
  assignTask,
  startTask,
  completeTask,
  inspectTask,
  getRoomHistory,
  reportIssue,
  listIssues,
  getIssue,
  startRepair,
  resolveIssue
} from './housekeeping.controller.js';

export const housekeepingRouter = Router();

function requireAnyHousekeepingPermission(permissionCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const isSuperAdmin = req.staff.roles.some((r) => r.id === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    const hasAny = permissionCodes.some((code) => req.staff!.permissions.includes(code));
    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Staff lacks required permissions: at least one of [${permissionCodes.map((c) => `'${c}'`).join(', ')}] is required`
        )
      );
    }

    next();
  };
}

// ============================================================================
// 1. HOUSEKEEPING TASKS
// ============================================================================

housekeepingRouter.get(
  '/housekeeping/tasks',
  authenticateStaff,
  requireAuth,
  requireAnyHousekeepingPermission(['housekeeping:view', 'housekeeping:update', 'hotel:view']),
  requireModuleAccess('housekeeping', 'view'),
  validate({ query: listTasksQuerySchema }),
  listTasks
);

housekeepingRouter.get(
  '/housekeeping/tasks/:taskId',
  authenticateStaff,
  requireAuth,
  requireAnyHousekeepingPermission(['housekeeping:view', 'housekeeping:update', 'hotel:view']),
  requireModuleAccess('housekeeping', 'view'),
  validate({ params: taskIdParamsSchema }),
  getTask
);

housekeepingRouter.post(
  '/housekeeping/tasks',
  authenticateStaff,
  requireAuth,
  requirePermission('housekeeping:update'),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ body: createTaskBodySchema }),
  createTask
);

housekeepingRouter.post(
  '/housekeeping/tasks/:taskId/assign',
  authenticateStaff,
  requireAuth,
  requirePermission('housekeeping:update'),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: taskIdParamsSchema, body: assignTaskBodySchema }),
  assignTask
);

housekeepingRouter.post(
  '/housekeeping/tasks/:taskId/start',
  authenticateStaff,
  requireAuth,
  requirePermission('housekeeping:update'),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: taskIdParamsSchema }),
  startTask
);

housekeepingRouter.post(
  '/housekeeping/tasks/:taskId/complete',
  authenticateStaff,
  requireAuth,
  requirePermission('housekeeping:update'),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: taskIdParamsSchema, body: completeTaskBodySchema }),
  completeTask
);

housekeepingRouter.post(
  '/housekeeping/tasks/:taskId/inspect',
  authenticateStaff,
  requireAuth,
  requirePermission('housekeeping:update'),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: taskIdParamsSchema, body: inspectTaskBodySchema }),
  inspectTask
);

// ============================================================================
// 2. ROOM STATUS HISTORY
// ============================================================================

housekeepingRouter.get(
  '/hotel/rooms/:roomId/history',
  authenticateStaff,
  requireAuth,
  requireAnyHousekeepingPermission(['housekeeping:view', 'housekeeping:update', 'hotel:view']),
  requireModuleAccess(['housekeeping', 'hotel'], 'view'),
  validate({ params: roomIdParamsSchema, query: listRoomHistoryQuerySchema }),
  getRoomHistory
);

// ============================================================================
// 3. MAINTENANCE ISSUES
// ============================================================================

housekeepingRouter.get(
  '/maintenance/issues',
  authenticateStaff,
  requireAuth,
  requireModuleAccess('housekeeping', 'view'),
  validate({ query: listIssuesQuerySchema }),
  listIssues
);

housekeepingRouter.get(
  '/maintenance/issues/:issueId',
  authenticateStaff,
  requireAuth,
  requireModuleAccess('housekeeping', 'view'),
  validate({ params: issueIdParamsSchema }),
  getIssue
);

housekeepingRouter.post(
  '/maintenance/issues',
  authenticateStaff,
  requireAuth,
  requireModuleAccess('housekeeping', 'edit'),
  validate({ body: reportIssueBodySchema }),
  reportIssue
);

housekeepingRouter.post(
  '/maintenance/issues/:issueId/start-repair',
  authenticateStaff,
  requireAuth,
  requireAnyHousekeepingPermission(['housekeeping:update', 'hotel:manage']),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: issueIdParamsSchema }),
  startRepair
);

housekeepingRouter.post(
  '/maintenance/issues/:issueId/resolve',
  authenticateStaff,
  requireAuth,
  requireAnyHousekeepingPermission(['housekeeping:update', 'hotel:manage']),
  requireModuleAccess('housekeeping', 'edit'),
  validate({ params: issueIdParamsSchema, body: resolveIssueBodySchema }),
  resolveIssue
);
