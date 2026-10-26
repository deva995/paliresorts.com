import { z } from 'zod';

export const createSuperAdminUserBodySchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required').max(30).trim(),
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  email: z.string().email('Valid email is required').max(150).trim(),
  phone: z.string().min(5, 'Valid phone number is required').max(20).trim(),
  roleId: z.string().min(1, 'Role is required').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  outletId: z.string().max(32).optional()
});

export const updateSuperAdminUserBodySchema = z.object({
  employeeCode: z.string().min(1).max(30).trim().optional(),
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().max(150).trim().optional(),
  phone: z.string().min(5).max(20).trim().optional(),
  roleId: z.string().min(1).trim().optional(),
  outletId: z.string().max(32).optional()
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Valid user UUID required')
});

export const resetPasswordBodySchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

export const listUsersQuerySchema = z.object({
  role: z.string().optional(),
  isActive: z.enum(['true', 'false', 'all']).optional(),
  search: z.string().optional()
});

// Phase 3: Super Admin Outlet Management Schemas
export const outletTypeEnum = z.enum([
  'FINE_DINING',
  'FINE_DINING_BAR_LOUNGE',
  'BAR_LOUNGE',
  'POOL_DECK',
  'ROOM_SERVICE',
  'BANQUET',
  'Resort Dining',
  'Fine Dining',
  'Lounge Bar',
  'Boutique Cafe'
]);

export const createSuperAdminOutletBodySchema = z.object({
  id: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Outlet ID must only contain letters, numbers, hyphens, and underscores').optional(),
  name: z.string().min(2, 'Outlet name must be at least 2 characters').max(150).trim(),
  outletType: outletTypeEnum,
  invoiceSeriesPrefix: z.string().min(1, 'Invoice series prefix is required').max(10).trim(),
  operatingHours: z.object({
    opens: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Opens time must be HH:MM format').default('07:00'),
    closes: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Closes time must be HH:MM format').default('23:00')
  }).optional()
});

export const updateSuperAdminOutletBodySchema = z.object({
  name: z.string().min(2).max(150).trim().optional(),
  outletType: outletTypeEnum.optional(),
  invoiceSeriesPrefix: z.string().min(1).max(10).trim().optional(),
  operatingHours: z.object({
    opens: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    closes: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  }).optional()
});

export const outletIdParamSchema = z.object({
  id: z.string().min(1, 'Outlet ID is required').max(32).trim()
});

export const listOutletsQuerySchema = z.object({
  isActive: z.enum(['true', 'false', 'all']).optional(),
  search: z.string().optional()
});

