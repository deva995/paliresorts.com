import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidSchema = z.string().regex(uuidRegex, 'Must be a valid UUID');

const integerPaiseSchema = z
  .number({
    invalid_type_error: 'Price in paise must be a valid number'
  })
  .int('Price in paise must be an exact integer (no decimals or fractions)')
  .min(0, 'Price in paise cannot be negative')
  .max(Number.MAX_SAFE_INTEGER, 'Price in paise exceeds maximum safe integer');

export const outletMenuParamsSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required')
});

export const menuItemParamsSchema = z.object({
  itemId: uuidSchema
});

export const menuItemWithOutletParamsSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet ID is required'),
  itemId: uuidSchema
});

export const menuRevisionParamsSchema = z.object({
  revisionId: uuidSchema
});

export const listMenuRevisionsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  menuItemId: uuidSchema.optional(),
  outletId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
});

export const proposedDataSchema = z
  .object({
    // Master item fields
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().max(2000).nullable().optional(),
    basePricePaise: integerPaiseSchema.optional(),
    gstRatePercent: z.number().min(0, 'GST rate cannot be negative').max(100, 'GST rate cannot exceed 100%').optional(),
    isVegetarian: z.boolean().optional(),
    isVegan: z.boolean().optional(),
    isSpicy: z.boolean().optional(),
    preparationTimeMinutes: z.number().int().positive('Preparation time must be greater than 0').max(360).optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
    targetKitchenStationCode: z.string().trim().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
    categoryId: uuidSchema.optional(),

    // Outlet-specific fields
    priceOverridePaise: integerPaiseSchema.nullable().optional(),
    isAvailable: z.boolean().optional(),
    kitchenStationOverrideCode: z.string().trim().min(1).max(50).nullable().optional(),
    displayOrder: z.number().int().nonnegative().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Proposed data must include at least one valid menu property to update'
  });

export const createMenuRevisionBodySchema = z.object({
  menuItemId: uuidSchema,
  outletId: z.string().trim().min(1).nullable().optional(),
  changeSummary: z.string().trim().min(3, 'Change summary must be at least 3 characters').max(500),
  effectiveFrom: z.string().datetime().nullable().optional(),
  proposedData: proposedDataSchema
});

export const approveMenuRevisionBodySchema = z.object({
  reviewNotes: z.string().trim().max(1000).optional()
});

export const rejectMenuRevisionBodySchema = z.object({
  reviewNotes: z.string().trim().max(1000).optional()
});

export const imageValidator = z.string().nullable().optional().refine((val) => {
  if (!val) return true;
  if (val.startsWith('data:')) {
    const match = val.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
    if (!match) return false;
    const mime = match[1].toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMimes.includes(mime)) return false;
    const base64Data = match[2];
    const byteLength = (base64Data.length * 3) / 4;
    return byteLength <= 1048576; // Max 1 MB
  }
  return /^https?:\/\/|^\//i.test(val);
}, {
  message: 'Image must be a valid image type (JPEG, PNG, WebP, GIF) and at most 1 MB in size'
});

export const createMenuItemBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  priceRupees: z.number().nonnegative('Price cannot be negative').optional(),
  basePricePaise: integerPaiseSchema.optional(),
  gstRatePercent: z.number().min(0).max(100).default(5),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  preparationTimeMinutes: z.number().int().positive().default(15),
  imageUrl: imageValidator,
  targetKitchenStationCode: z.string().trim().min(1).default('CURRY'),
  displayOrder: z.number().int().nonnegative().default(0)
}).refine(data => data.priceRupees !== undefined || data.basePricePaise !== undefined, {
  message: 'Either priceRupees or basePricePaise must be provided'
});

export const updateMenuItemBodySchema = z.object({
  isAvailable: z.boolean().optional(),
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().min(1).optional(),
  priceRupees: z.number().nonnegative().optional(),
  basePricePaise: integerPaiseSchema.optional(),
  gstRatePercent: z.number().min(0).max(100).optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isSpicy: z.boolean().optional(),
  preparationTimeMinutes: z.number().int().positive().optional(),
  imageUrl: imageValidator,
  targetKitchenStationCode: z.string().trim().min(1).optional(),
  displayOrder: z.number().int().nonnegative().optional()
});

export const toggleAvailabilityBodySchema = z.object({
  isAvailable: z.boolean().optional()
});

