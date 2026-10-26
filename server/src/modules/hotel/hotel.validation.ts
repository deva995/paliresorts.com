import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

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

const ID_PROOF_TYPES = ['AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID'] as const;

const RESERVATION_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'] as const;

const CHARGE_TYPES = ['ROOM_TARIFF', 'RESTAURANT_DINING', 'LAUNDRY', 'SPA', 'MINIBAR'] as const;

// 1. Params Schemas
export const roomIdParamsSchema = z.object({
  roomId: uuidSchema
});

export const guestIdParamsSchema = z.object({
  guestId: uuidSchema
});

export const reservationIdParamsSchema = z.object({
  reservationId: uuidSchema
});

export const stayIdParamsSchema = z.object({
  stayId: uuidSchema
});

export const folioIdParamsSchema = z.object({
  folioId: uuidSchema
});

// 2. Room Schemas
export const listRoomsQuerySchema = z.object({
  status: z.enum(ROOM_STATUSES).optional(),
  roomType: z.string().max(50).optional(),
  floor: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const updateRoomStatusBodySchema = z.object({
  status: z.enum(ROOM_STATUSES, { required_error: 'Room status is required' }),
  notes: z.string().max(500).optional()
});

// 3. Guest Schemas
export const createGuestBodySchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').max(20),
  email: z.string().trim().email('Invalid email format').max(150).optional().nullable(),
  idProofType: z.enum(ID_PROOF_TYPES, { required_error: 'ID proof type is required' }),
  idProofNumber: z.string().trim().min(4, 'ID proof number is required').max(100),
  nationality: z.string().trim().max(50).default('Indian')
});

export const updateGuestBodySchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(150).optional().nullable(),
  nationality: z.string().trim().max(50).optional()
});

export const listGuestsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

// 4. Reservation Schemas
export const createReservationBodySchema = z.object({
  guestId: uuidSchema,
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-in date must be YYYY-MM-DD'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Check-out date must be YYYY-MM-DD')
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'Check-out date must be strictly after check-in date',
  path: ['checkOutDate']
});

export const listReservationsQuerySchema = z.object({
  status: z.enum(RESERVATION_STATUSES).optional(),
  guestId: uuidSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

// 5. Check-In Schemas
export const checkInBodySchema = z.object({
  roomId: uuidSchema,
  guestId: uuidSchema,
  reservationId: uuidSchema.optional().nullable(),
  expectedCheckOutAt: z.string().datetime({ message: 'Expected check out must be an ISO 8601 datetime' }),
  initialTariffPaise: z.number().int().min(0, 'Initial tariff paise cannot be negative').optional()
});

// 6. Stay Schemas
export const listStaysQuerySchema = z.object({
  status: z.enum(['CHECKED_IN', 'CHECKED_OUT']).optional(),
  roomId: uuidSchema.optional(),
  guestId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

// 7. Folio Schemas
export const postFolioChargeBodySchema = z.object({
  chargeType: z.enum(CHARGE_TYPES, { required_error: 'Charge type is required' }),
  amountPaise: z.number().int().positive('Charge amount must be positive integer paise'),
  description: z.string().trim().min(1, 'Description is required').max(500),
  outletId: z.string().trim().max(32).optional().nullable(),
  billId: uuidSchema.optional().nullable()
});

// 8. Checkout Schema
export const checkOutBodySchema = z.object({
  notes: z.string().trim().max(500).optional()
});
