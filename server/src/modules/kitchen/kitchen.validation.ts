import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

export const kotParamsSchema = z.object({
  kotId: uuidSchema
});

export const orderParamsSchema = z.object({
  orderId: uuidSchema
});

export const outletParamsSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required')
});

export const kotItemParamsSchema = z.object({
  kotItemId: uuidSchema
});

export const cancelKotBodySchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500)
});

export const updateKotItemStatusBodySchema = z.object({
  status: z.enum(['PREPARING', 'READY', 'SERVED', 'CANCELLED'], {
    errorMap: () => ({ message: "Item status must be one of: 'PREPARING', 'READY', 'SERVED', 'CANCELLED'" })
  }),
  reason: z.string().trim().min(3).max(500).optional()
}).superRefine((body, ctx) => {
  if (body.status === 'CANCELLED' && !body.reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Cancellation reason is required' });
});

export const listKotsQuerySchema = z.object({
  stationId: uuidSchema.optional(),
  stationCode: z.string().trim().optional(),
  status: z.enum(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).optional(),
  activeOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  orderId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
