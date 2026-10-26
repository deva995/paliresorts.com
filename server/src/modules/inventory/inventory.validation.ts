import { z } from 'zod';
import { parseQuantityToThousandths } from '../../utils/quantities.js';

const quantityRefinement = (val: number) => {
  try {
    parseQuantityToThousandths(val);
    return true;
  } catch {
    return false;
  }
};

const CATEGORIES = [
  'FOOD_GRAINS',
  'DAIRY',
  'MEAT',
  'LIQUOR',
  'BEVERAGES',
  'CLEANING',
  'LINEN',
  'OTHER'
] as const;

const MOVEMENT_TYPES = [
  'PURCHASE',
  'CONSUMPTION',
  'ADJUSTMENT',
  'WASTAGE',
  'RETURN',
  'TRANSFER_IN',
  'TRANSFER_OUT'
] as const;

export const itemIdParamsSchema = z.object({
  itemId: z.string().uuid('Invalid inventory item ID format')
});

export const locationIdParamsSchema = z.object({
  locationId: z.string().uuid('Invalid inventory location ID format')
});

export const movementIdParamsSchema = z.object({
  movementId: z.string().uuid('Invalid inventory movement ID format')
});

export const recipeIdParamsSchema = z.object({
  recipeId: z.string().uuid('Invalid recipe ID format')
});

export const menuItemIdParamsSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format')
});

export const ingredientParamsSchema = z.object({
  recipeId: z.string().uuid('Invalid recipe ID format'),
  ingredientId: z.string().uuid('Invalid recipe ingredient ID format')
});

export const listItemsQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  isActive: z.coerce.boolean().optional(),
  belowReorderLevel: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const createItemBodySchema = z.object({
  itemCode: z.string().min(1, 'Item code is required').max(50),
  name: z.string().min(1, 'Item name is required').max(150),
  category: z.enum(CATEGORIES),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  reorderLevel: z
    .number()
    .min(0, 'Reorder level cannot be negative')
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places')
    .default(10),
  unitCostPaise: z.number().int().min(0, 'Unit cost paise cannot be negative').default(0),
  isActive: z.boolean().default(true)
});

export const updateItemBodySchema = z.object({
  itemCode: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150).optional(),
  category: z.enum(CATEGORIES).optional(),
  unitOfMeasure: z.string().min(1).max(20).optional(),
  reorderLevel: z
    .number()
    .min(0)
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places')
    .optional(),
  unitCostPaise: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

export const listLocationsQuerySchema = z.object({
  outletId: z.string().min(1).max(32).optional(),
  isCentral: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional()
});

export const listBalancesQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  outletId: z.string().min(1).max(32).optional(),
  itemId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).optional(),
  belowReorderLevel: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const createMovementBodySchema = z.object({
  itemId: z.string().uuid('Invalid inventory item ID format'),
  locationId: z.string().uuid('Invalid inventory location ID format'),
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z
    .number()
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places')
    .refine((val) => val !== 0, 'Quantity cannot be zero'),
  referenceDocument: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
});

export const listMovementsQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  transferGroupId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const createTransferBodySchema = z.object({
  itemId: z.string().uuid('Invalid inventory item ID format'),
  sourceLocationId: z.string().uuid('Invalid source location ID format'),
  destinationLocationId: z.string().uuid('Invalid destination location ID format'),
  quantity: z
    .number()
    .positive('Transfer quantity must be greater than zero')
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places'),
  referenceDocument: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
});

export const createRecipeBodySchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format'),
  name: z.string().min(1, 'Recipe name is required').max(150),
  yieldServings: z.number().int().min(1, 'Yield servings must be at least 1').default(1),
  ingredients: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid('Invalid inventory item ID format'),
        quantityRequired: z
          .number()
          .positive('Quantity required must be greater than zero')
          .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places'),
        unitOfMeasure: z.string().min(1).max(20)
      })
    )
    .optional()
});

export const updateRecipeBodySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  yieldServings: z.number().int().min(1).optional()
});

export const listRecipesQuerySchema = z.object({
  menuItemId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const addRecipeIngredientBodySchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID format'),
  quantityRequired: z
    .number()
    .positive('Quantity required must be greater than zero')
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places'),
  unitOfMeasure: z.string().min(1).max(20)
});

export const updateRecipeIngredientBodySchema = z.object({
  quantityRequired: z
    .number()
    .positive('Quantity required must be greater than zero')
    .refine(quantityRefinement, 'Quantity precision exceeds maximum allowed 3 decimal places')
    .optional(),
  unitOfMeasure: z.string().min(1).max(20).optional()
});
