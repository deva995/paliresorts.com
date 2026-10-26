import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

const TASK_TYPES = ['CHECKOUT_CLEANING', 'STAYOVER_CLEANING', 'DEEP_CLEANING'] as const;
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED'] as const;

const ROOM_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'OCCUPIED',
  'DIRTY',
  'CLEANING',
  'INSPECTED',
  'MAINTENANCE',
  'OUT_OF_SERVICE'
] as const;

const MAINTENANCE_CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'OTHER'] as const;
const MAINTENANCE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const MAINTENANCE_STATUSES = ['REPORTED', 'IN_REPAIR', 'RESOLVED'] as const;

// 1. Params Schemas
export const taskIdParamsSchema = z.object({
  taskId: uuidSchema
});

export const issueIdParamsSchema = z.object({
  issueId: uuidSchema
});

export const roomIdParamsSchema = z.object({
  roomId: uuidSchema
});

// 2. Housekeeping Task Schemas
export const listTasksQuerySchema = z.object({
  roomId: uuidSchema.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  assignedStaffId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const createTaskBodySchema = z.object({
  roomId: uuidSchema,
  taskType: z.enum(TASK_TYPES).default('CHECKOUT_CLEANING'),
  assignedStaffId: uuidSchema.optional().nullable(),
  notes: z.string().max(500).optional()
});

export const assignTaskBodySchema = z.object({
  assignedStaffId: uuidSchema
});

export const completeTaskBodySchema = z.object({
  notes: z.string().max(500).optional()
});

export const inspectTaskBodySchema = z.object({
  passed: z.boolean({ required_error: 'Inspection outcome (passed: boolean) is required' }),
  notes: z.string().max(500).optional()
});

// 3. Room Turnover Schemas
export const transitionRoomStatusBodySchema = z.object({
  status: z.enum(ROOM_STATUSES),
  notes: z.string().max(500).optional()
});

export const listRoomHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

// 4. Maintenance Issue Schemas
export const reportIssueBodySchema = z.object({
  roomId: uuidSchema.optional().nullable(),
  outletId: z.string().trim().max(32).optional().nullable(),
  category: z.enum(MAINTENANCE_CATEGORIES),
  severity: z.enum(MAINTENANCE_SEVERITIES),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(1000)
}).refine((data) => data.roomId || data.outletId || true, {
  message: 'Issue can be associated with a room, outlet, or general facility'
});

export const listIssuesQuerySchema = z.object({
  roomId: uuidSchema.optional(),
  outletId: z.string().trim().max(32).optional(),
  category: z.enum(MAINTENANCE_CATEGORIES).optional(),
  severity: z.enum(MAINTENANCE_SEVERITIES).optional(),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const resolveIssueBodySchema = z.object({
  notes: z.string().max(500).optional()
});
