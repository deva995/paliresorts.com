import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

export const orderParamsSchema = z.object({
  orderId: uuidSchema
});

export const outletOrdersParamsSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required')
});

export const sessionOrdersParamsSchema = z.object({
  sessionId: uuidSchema
});

export const orderItemInputSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99 per item'),
  customizationNotes: z.string().trim().max(250, 'Customization notes cannot exceed 250 characters').optional(),
  notes: z.string().trim().max(250).optional(),
  portion: z.string().trim().max(50).optional(),
  selectedPortionLabel: z.string().trim().max(50).optional()
});

export const createStaffOrderBodySchema = z
  .object({
    outletId: z.string().trim().min(1, 'Outlet ID is required'),
    diningSessionId: uuidSchema.optional(),
    tableId: uuidSchema.optional(),
    guestCount: z.coerce.number().int().min(1).max(50).optional(),
    items: z
      .array(orderItemInputSchema, { required_error: 'Order items are required' })
      .min(1, 'Order must contain at least 1 item')
      .max(50, 'Order cannot exceed 50 distinct items'),
    specialInstructions: z.string().trim().max(500, 'Special instructions cannot exceed 500 characters').optional()
  })
  .refine((data) => Boolean(data.diningSessionId || data.tableId), {
    message: 'Either diningSessionId or tableId must be provided'
  });

export const createRoomServiceOrderBodySchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required'),
  hotelStayId: uuidSchema,
  roomId: uuidSchema,
  items: z
    .array(orderItemInputSchema, { required_error: 'Order items are required' })
    .min(1, 'Order must contain at least 1 item')
    .max(50, 'Order cannot exceed 50 distinct items'),
  specialInstructions: z.string().trim().max(500, 'Special instructions cannot exceed 500 characters').optional()
});

export const createGuestOrderBodySchema = z.object({
  items: z
    .array(orderItemInputSchema, { required_error: 'Order items are required' })
    .min(1, 'Order must contain at least 1 item')
    .max(50, 'Order cannot exceed 50 distinct items'),
  specialInstructions: z.string().trim().max(500, 'Special instructions cannot exceed 500 characters').optional()
});

export const updateOrderStatusBodySchema = z.object({
  status: z.enum(['PLACED', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'], {
    errorMap: () => ({ message: "Status must be one of: 'PLACED', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'" })
  }),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional()
});

export const cancelOrderBodySchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500).optional()
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(['PLACED', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const orderItemParamsSchema=z.object({orderId:uuidSchema,itemId:uuidSchema});
