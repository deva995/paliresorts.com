import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

// Match standard 10-digit Indian phone or with +91/0, allowing spaces or hyphens between digits
const phoneRegex = /^(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}$/;

export const outletTablesParamsSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required')
});

export const tableParamsSchema = z.object({
  tableId: uuidSchema
});

export const diningSessionParamsSchema = z.object({
  sessionId: uuidSchema
});

export const serviceRequestParamsSchema = z.object({
  requestId: uuidSchema
});

export const listDiningSessionsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'BILLED', 'CLOSED', 'CANCELLED']).optional()
});

export const createDiningSessionBodySchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required'),
  tableId: uuidSchema,
  guestCount: z.number().int('Guest count must be an integer').positive('Guest count must be at least 1').max(50),
  customer: z
    .object({
      phone: z.string().trim().regex(phoneRegex, 'Phone number must be a valid 10-digit Indian mobile number'),
      name: z.string().trim().max(150).optional(),
      email: z.string().trim().email('Invalid email address').max(150).optional()
    })
    .optional()
});

export const closeDiningSessionBodySchema = z.object({
  notes: z.string().max(500).optional()
});

export const cancelDiningSessionBodySchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500).optional()
});

export const resolveQrBodySchema = z
  .object({
    qrPublicCode: z.string().trim().max(32).optional(),
    qrSecretToken: z.string().trim().max(128).optional(),
    table: z.string().trim().min(1).max(64).optional(),
    tableNumber: z.string().trim().min(1).max(64).optional(),
    restaurant: z.string().trim().min(1).max(64).optional(),
    restaurantId: z.string().trim().min(1).max(64).optional(),
    outletId: z.string().trim().min(1).max(64).optional()
  })
  .refine(
    (data) =>
      Boolean(
        data.qrPublicCode ||
        ((data.table || data.tableNumber) && (data.restaurant || data.restaurantId || data.outletId))
      ),
    {
      message: 'Either qrPublicCode or table and restaurant must be provided'
    }
  );

export const selfSeatQrBodySchema = z.object({
  qrPublicCode: z.string().trim().min(1).max(32),
  qrSecretToken: z.string().trim().min(1).max(128),
  guestCount: z.number().int().min(1).max(50).default(1)
}).strict();

export const requestGuestOtpBodySchema = z.object({
  qrPublicCode: z.string().trim().min(1, 'QR public code is required').max(32),
  phone: z.string().trim().regex(phoneRegex, 'Phone number must be a valid 10-digit Indian mobile number'),
  name: z.string().trim().max(150).optional(),
  qrSecretToken: z.string().trim().min(1, 'Table secret token is required').max(128)
});

export const verifyGuestOtpBodySchema = z.object({
  sessionTokenId: uuidSchema,
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be an exact 6-digit numeric code')
});

export const createServiceRequestBodySchema = z.object({
  requestType: z.enum(['CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEANING'], {
    errorMap: () => ({ message: "Request type must be one of: 'CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEANING'" })
  })
});

export const listServiceRequestsQuerySchema = z.object({
  status: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const raw = Array.isArray(val) ? val : val.split(',');
      return raw.map((s) => s.trim().toUpperCase()).filter(Boolean);
    }),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(200, 'Limit cannot exceed 200').default(50),
  cursor: z.string().optional()
});

export const createZoneBodySchema = z.object({
  name: z.string().trim().min(2, 'Area name must contain at least 2 characters').max(100),
  code: z.string().trim().min(2).max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens or underscores')
    .transform(value => value.toUpperCase()),
  displayOrder: z.number().int().min(0).max(10000).default(0)
});

export const createTableBodySchema = z.object({
  tableNumber: z.string().trim().min(1, 'Table number is required').max(20),
  capacity: z.number().int().positive('Capacity must be at least 1').max(100).default(4),
  zoneId: uuidSchema.optional(),
  zoneName: z.string().trim().optional(),
  status: z.enum(['AVAILABLE','RESERVED','OCCUPIED','BILLED','CLEANING','OUT_OF_SERVICE']).optional(),
  isActive: z.boolean().default(true)
});

export const updateTableBodySchema = z.object({
  tableNumber: z.string().trim().min(1).max(20).optional(),
  capacity: z.number().int().positive().max(100).optional(),
  zoneId: uuidSchema.optional(),
  zoneName: z.string().trim().optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'BILLED', 'CLEANING', 'OUT_OF_SERVICE']).optional(),
  isActive: z.boolean().optional()
});



export const assignTableBodySchema = z.object({staffId: uuidSchema.optional(),unassign:z.boolean().optional()}).refine(data => !(data.unassign && data.staffId), {message:'Choose assignment or release'});
