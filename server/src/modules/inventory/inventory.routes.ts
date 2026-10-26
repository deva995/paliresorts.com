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
  itemIdParamsSchema,
  locationIdParamsSchema,
  recipeIdParamsSchema,
  menuItemIdParamsSchema,
  ingredientParamsSchema,
  listItemsQuerySchema,
  createItemBodySchema,
  updateItemBodySchema,
  listLocationsQuerySchema,
  listBalancesQuerySchema,
  createMovementBodySchema,
  createTransferBodySchema,
  createRecipeBodySchema,
  updateRecipeBodySchema,
  listRecipesQuerySchema,
  addRecipeIngredientBodySchema,
  updateRecipeIngredientBodySchema
} from './inventory.validation.js';
import {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  listInventoryLocations,
  getInventoryLocation,
  listInventoryBalances,
  getItemBalances,
  createStockMovement,
  createStockTransfer,
  listRecipes,
  getRecipe,
  getRecipeByMenuItem,
  createRecipe,
  updateRecipe,
  addRecipeIngredient,
  updateRecipeIngredient,
  removeRecipeIngredient
} from './inventory.controller.js';

export const inventoryRouter = Router();

function requireAnyPermission(permissionCodes: string[]) {
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
// 1. INVENTORY ITEMS (MASTER CATALOG)
// ============================================================================

inventoryRouter.get(
  '/inventory/items',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage', 'menu:view']),
  requireModuleAccess('inventory', 'view'),
  validate({ query: listItemsQuerySchema }),
  listInventoryItems
);

inventoryRouter.get(
  '/inventory/items/:itemId',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage', 'menu:view']),
  requireModuleAccess('inventory', 'view'),
  validate({ params: itemIdParamsSchema }),
  getInventoryItem
);

inventoryRouter.post(
  '/inventory/items',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ body: createItemBodySchema }),
  createInventoryItem
);

inventoryRouter.patch(
  '/inventory/items/:itemId',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ params: itemIdParamsSchema, body: updateItemBodySchema }),
  updateInventoryItem
);

// ============================================================================
// 2. INVENTORY LOCATIONS
// ============================================================================

inventoryRouter.get(
  '/inventory/locations',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ query: listLocationsQuerySchema }),
  listInventoryLocations
);

inventoryRouter.get(
  '/inventory/locations/:locationId',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ params: locationIdParamsSchema }),
  getInventoryLocation
);

// ============================================================================
// 3. INVENTORY BALANCES
// ============================================================================

inventoryRouter.get(
  '/inventory/balances',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ query: listBalancesQuerySchema }),
  listInventoryBalances
);

inventoryRouter.get(
  '/inventory/items/:itemId/balances',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ params: itemIdParamsSchema }),
  getItemBalances
);

// ============================================================================
// 4. STOCK MOVEMENTS
// ============================================================================

inventoryRouter.post(
  '/inventory/movements',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ body: createMovementBodySchema }),
  createStockMovement
);

// ============================================================================
// 5. INTER-LOCATION STOCK TRANSFERS
// ============================================================================

inventoryRouter.post(
  '/inventory/transfers',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ body: createTransferBodySchema }),
  createStockTransfer
);

// ============================================================================
// 6. RECIPES / BILL-OF-MATERIALS (BOM)
// ============================================================================

inventoryRouter.get(
  '/recipes',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['menu:view', 'inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ query: listRecipesQuerySchema }),
  listRecipes
);

inventoryRouter.get(
  '/recipes/:recipeId',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['menu:view', 'inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ params: recipeIdParamsSchema }),
  getRecipe
);

inventoryRouter.get(
  '/menu-items/:menuItemId/recipe',
  authenticateStaff,
  requireAuth,
  requireAnyPermission(['menu:view', 'inventory:view', 'inventory:manage']),
  requireModuleAccess('inventory', 'view'),
  validate({ params: menuItemIdParamsSchema }),
  getRecipeByMenuItem
);

inventoryRouter.post(
  '/recipes',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ body: createRecipeBodySchema }),
  createRecipe
);

inventoryRouter.patch(
  '/recipes/:recipeId',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ params: recipeIdParamsSchema, body: updateRecipeBodySchema }),
  updateRecipe
);

inventoryRouter.post(
  '/recipes/:recipeId/ingredients',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ params: recipeIdParamsSchema, body: addRecipeIngredientBodySchema }),
  addRecipeIngredient
);

inventoryRouter.patch(
  '/recipes/:recipeId/ingredients/:ingredientId',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ params: ingredientParamsSchema, body: updateRecipeIngredientBodySchema }),
  updateRecipeIngredient
);

inventoryRouter.delete(
  '/recipes/:recipeId/ingredients/:ingredientId',
  authenticateStaff,
  requireAuth,
  requirePermission('inventory:manage'),
  requireModuleAccess('inventory', 'edit'),
  validate({ params: ingredientParamsSchema }),
  removeRecipeIngredient
);
