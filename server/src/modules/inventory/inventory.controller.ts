import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { InventoryCategory, StockMovementType } from './inventory.types.js';

function isStaffSuperAdminOrManager(staff: NonNullable<Request['staff']>): boolean {
  return staff.roles.some(
    (r) =>
      r.id === 'SUPER_ADMIN' ||
      r.id === 'GENERAL_MANAGER' ||
      r.id === 'OPERATIONS_MANAGER'
  );
}

// ============================================================================
// 1. INVENTORY ITEMS CONTROLLERS
// ============================================================================

export async function listInventoryItems(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, isActive, belowReorderLevel, search, limit, offset } = req.query as any;
    const result = await InventoryService.listItems({
      category: category as InventoryCategory | undefined,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
      belowReorderLevel:
        belowReorderLevel !== undefined
          ? belowReorderLevel === 'true' || belowReorderLevel === true
          : undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getInventoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { itemId } = req.params;
    const item = await InventoryService.getItemById(itemId);
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
}

export async function createInventoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const {
      itemCode,
      name,
      category,
      unitOfMeasure,
      reorderLevel,
      unitCostPaise,
      isActive
    } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const item = await InventoryService.createItem({
      itemCode,
      name,
      category,
      unitOfMeasure,
      reorderLevel,
      unitCostPaise,
      isActive,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { itemId } = req.params;
    const {
      itemCode,
      name,
      category,
      unitOfMeasure,
      reorderLevel,
      unitCostPaise,
      isActive
    } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const item = await InventoryService.updateItem({
      itemId,
      itemCode,
      name,
      category,
      unitOfMeasure,
      reorderLevel,
      unitCostPaise,
      isActive,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. INVENTORY LOCATIONS CONTROLLERS
// ============================================================================

export async function listInventoryLocations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { outletId, isCentral, isActive } = req.query as any;
    const staffOutletIds = req.staff?.outlets?.map((o) => o.outletId) || [];
    const isSuperAdminOrManager = req.staff ? isStaffSuperAdminOrManager(req.staff) : false;

    const locations = await InventoryService.listLocations({
      outletId: outletId as string | undefined,
      isCentral:
        isCentral !== undefined ? isCentral === 'true' || isCentral === true : undefined,
      isActive:
        isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
      staffOutletIds,
      isSuperAdminOrManager
    });
    res.status(200).json(locations);
  } catch (err) {
    next(err);
  }
}

export async function getInventoryLocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { locationId } = req.params;
    const location = await InventoryService.getLocationById(locationId);
    res.status(200).json(location);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. INVENTORY BALANCES CONTROLLERS
// ============================================================================

export async function listInventoryBalances(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { locationId, outletId, itemId, category, belowReorderLevel, limit, offset } =
      req.query as any;
    const staffOutletIds = req.staff?.outlets?.map((o) => o.outletId) || [];
    const isSuperAdminOrManager = req.staff ? isStaffSuperAdminOrManager(req.staff) : false;

    const result = await InventoryService.listBalances({
      locationId: locationId as string | undefined,
      outletId: outletId as string | undefined,
      itemId: itemId as string | undefined,
      category: category as InventoryCategory | undefined,
      belowReorderLevel:
        belowReorderLevel !== undefined
          ? belowReorderLevel === 'true' || belowReorderLevel === true
          : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      staffOutletIds,
      isSuperAdminOrManager
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getItemBalances(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { itemId } = req.params;
    const staffOutletIds = req.staff?.outlets?.map((o) => o.outletId) || [];
    const isSuperAdminOrManager = req.staff ? isStaffSuperAdminOrManager(req.staff) : false;

    const balances = await InventoryService.getItemBalances(
      itemId,
      staffOutletIds,
      isSuperAdminOrManager
    );
    res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 4. STOCK MOVEMENTS (IDEMPOTENT & AUDITED)
// ============================================================================

export async function createStockMovement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { itemId, locationId, movementType, quantity, referenceDocument, notes } = req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `mov_${req.staff.id}_${itemId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    // Acquire idempotency key
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'STOCK_MOVEMENT',
      outletId: null,
      actorStaffId: req.staff.id,
      payload: { itemId, locationId, movementType, quantity, referenceDocument: referenceDocument || null }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const staffOutletIds = req.staff.outlets?.map((o) => o.outletId) || [];
    const isSuperAdminOrManager = isStaffSuperAdminOrManager(req.staff);

    const movement = await InventoryService.recordMovement({
      itemId,
      locationId,
      movementType: movementType as StockMovementType,
      quantity,
      referenceDocument,
      notes,
      staffId: req.staff.id,
      staffOutletIds,
      isSuperAdminOrManager,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, movement);
    }

    res.status(201).json(movement);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

// ============================================================================
// 5. INTER-LOCATION TRANSFERS (IDEMPOTENT ATOMIC PAIRS)
// ============================================================================

export async function createStockTransfer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const { itemId, sourceLocationId, destinationLocationId, quantity, referenceDocument, notes } =
    req.body;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    `trf_${req.staff.id}_${itemId}_${Date.now()}`;
  const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';
  let acquiredKeyId: string | null = null;

  try {
    const acquireResult = await IdempotencyService.acquireOrCheck({
      idempotencyKey,
      operationType: 'STOCK_TRANSFER',
      outletId: null,
      actorStaffId: req.staff.id,
      payload: {
        itemId,
        sourceLocationId,
        destinationLocationId,
        quantity,
        referenceDocument: referenceDocument || null
      }
    });

    if (acquireResult.status === 'REPLAY') {
      res.status(acquireResult.statusCode).json(acquireResult.body);
      return;
    }
    acquiredKeyId = acquireResult.keyId;

    const staffOutletIds = req.staff.outlets?.map((o) => o.outletId) || [];
    const isSuperAdminOrManager = isStaffSuperAdminOrManager(req.staff);

    const transfer = await InventoryService.recordTransfer({
      itemId,
      sourceLocationId,
      destinationLocationId,
      quantity,
      referenceDocument,
      notes,
      staffId: req.staff.id,
      staffOutletIds,
      isSuperAdminOrManager,
      reqCorrelationId,
      ipAddress: req.ip || null
    });

    if (acquiredKeyId) {
      await IdempotencyService.complete(acquiredKeyId, 201, transfer);
    }

    res.status(201).json(transfer);
  } catch (err) {
    if (acquiredKeyId) {
      await IdempotencyService.fail(acquiredKeyId).catch(() => {});
    }
    next(err);
  }
}

// ============================================================================
// 6. RECIPES / BOM CONTROLLERS
// ============================================================================

export async function listRecipes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { menuItemId, search, limit, offset } = req.query as any;
    const result = await InventoryService.listRecipes({
      menuItemId: menuItemId as string | undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRecipe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { recipeId } = req.params;
    const recipe = await InventoryService.getRecipeById(recipeId);
    res.status(200).json(recipe);
  } catch (err) {
    next(err);
  }
}

export async function getRecipeByMenuItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { menuItemId } = req.params;
    const recipe = await InventoryService.getRecipeByMenuItemId(menuItemId);
    res.status(200).json(recipe);
  } catch (err) {
    next(err);
  }
}

export async function createRecipe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { menuItemId, name, yieldServings, ingredients } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const recipe = await InventoryService.createRecipe({
      menuItemId,
      name,
      yieldServings,
      ingredients,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(201).json(recipe);
  } catch (err) {
    next(err);
  }
}

export async function updateRecipe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { recipeId } = req.params;
    const { name, yieldServings } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const recipe = await InventoryService.updateRecipe({
      recipeId,
      name,
      yieldServings,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(recipe);
  } catch (err) {
    next(err);
  }
}

export async function addRecipeIngredient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { recipeId } = req.params;
    const { inventoryItemId, quantityRequired, unitOfMeasure } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const ingredient = await InventoryService.addRecipeIngredient({
      recipeId,
      inventoryItemId,
      quantityRequired,
      unitOfMeasure,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(201).json(ingredient);
  } catch (err) {
    next(err);
  }
}

export async function updateRecipeIngredient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { recipeId, ingredientId } = req.params;
    const { quantityRequired, unitOfMeasure } = req.body;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    const ingredient = await InventoryService.updateRecipeIngredient({
      recipeId,
      ingredientId,
      quantityRequired,
      unitOfMeasure,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(200).json(ingredient);
  } catch (err) {
    next(err);
  }
}

export async function removeRecipeIngredient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.staff) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const { recipeId, ingredientId } = req.params;
    const reqCorrelationId = (req.headers['x-request-id'] as string) || 'unknown';

    await InventoryService.removeRecipeIngredient({
      recipeId,
      ingredientId,
      staffId: req.staff.id,
      reqCorrelationId,
      ipAddress: req.ip || null
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
