import pg from 'pg';
import crypto from 'node:crypto';
import { getDbPool, withTransaction } from '../../db/pool.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  UnprocessableEntityError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { publishOutletEvent } from '../../services/outletEvent.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import {
  parseQuantityToThousandths,
  formatThousandthsToQuantity,
  formatThousandthsToNumber
} from '../../utils/quantities.js';
import {
  InventoryCategory,
  StockMovementType,
  InventoryItemResponse,
  InventoryLocationResponse,
  InventoryBalanceResponse,
  StockMovementResponse,
  TransferResponse,
  RecipeResponse,
  RecipeIngredientResponse
} from './inventory.types.js';

function formatDate(val: any): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function mapItemRow(row: any, totalOnHandThousandths?: bigint): InventoryItemResponse {
  const reorderThousandths = parseQuantityToThousandths(row.reorder_level);
  const onHand =
    totalOnHandThousandths !== undefined
      ? totalOnHandThousandths
      : row.total_on_hand !== undefined && row.total_on_hand !== null
        ? parseQuantityToThousandths(row.total_on_hand)
        : undefined;

  return {
    id: row.id,
    propertyId: row.property_id,
    itemCode: row.item_code,
    name: row.name,
    category: row.category as InventoryCategory,
    unitOfMeasure: row.unit_of_measure,
    reorderLevel: formatThousandthsToNumber(reorderThousandths),
    unitCostPaise: parseInt(row.unit_cost_paise, 10),
    isActive: row.is_active,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    totalOnHandQuantity: onHand !== undefined ? formatThousandthsToNumber(onHand) : undefined,
    isBelowReorderLevel: onHand !== undefined ? onHand < reorderThousandths : undefined
  };
}

function mapLocationRow(row: any): InventoryLocationResponse {
  return {
    id: row.id,
    outletId: row.outlet_id || null,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    outletName: row.outlet_name || null
  };
}

function mapBalanceRow(row: any): InventoryBalanceResponse {
  const onHandThousandths = parseQuantityToThousandths(row.quantity_on_hand);
  let itemInfo: InventoryBalanceResponse['item'] | undefined;

  if (row.item_name || row.item_code) {
    const reorderThousandths = parseQuantityToThousandths(row.reorder_level || '0');
    itemInfo = {
      id: row.item_id,
      itemCode: row.item_code,
      name: row.item_name,
      category: row.category as InventoryCategory,
      unitOfMeasure: row.unit_of_measure,
      reorderLevel: formatThousandthsToNumber(reorderThousandths),
      unitCostPaise: parseInt(row.unit_cost_paise || '0', 10),
      isBelowReorderLevel: onHandThousandths < reorderThousandths
    };
  }

  let locationInfo: InventoryBalanceResponse['location'] | undefined;
  if (row.location_name || row.location_code) {
    locationInfo = {
      id: row.location_id,
      code: row.location_code,
      name: row.location_name,
      outletId: row.outlet_id || null
    };
  }

  return {
    id: row.id,
    itemId: row.item_id,
    locationId: row.location_id,
    quantityOnHand: formatThousandthsToNumber(onHandThousandths),
    lastCountedAt: formatDate(row.last_counted_at),
    updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
    item: itemInfo,
    location: locationInfo
  };
}

function mapMovementRow(row: any): StockMovementResponse {
  const qtyThousandths = parseQuantityToThousandths(row.quantity);
  return {
    id: row.id,
    itemId: row.item_id,
    locationId: row.location_id,
    movementType: row.movement_type as StockMovementType,
    quantity: formatThousandthsToNumber(qtyThousandths),
    transferGroupId: row.transfer_group_id || null,
    pairedMovementId: row.paired_movement_id || null,
    referenceDocument: row.reference_document || null,
    notes: row.notes || null,
    authorizedByStaffId: row.authorized_by_staff_id,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    itemName: row.item_name,
    itemCode: row.item_code,
    locationName: row.location_name,
    locationCode: row.location_code,
    outletId: row.outlet_id || null
  };
}

function mapRecipeRow(row: any, ingredients: RecipeIngredientResponse[] = []): RecipeResponse {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    yieldServings: parseInt(row.yield_servings, 10),
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    menuItemName: row.menu_item_name,
    ingredients
  };
}

function mapIngredientRow(row: any): RecipeIngredientResponse {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    inventoryItemId: row.inventory_item_id,
    quantityRequired: formatThousandthsToNumber(parseQuantityToThousandths(row.quantity_required)),
    unitOfMeasure: row.unit_of_measure,
    createdAt: formatDate(row.created_at) || new Date().toISOString(),
    inventoryItemName: row.item_name,
    inventoryItemCode: row.item_code
  };
}

export class InventoryService {
  /**
   * Resolves the primary resort property ID.
   */
  private static async getPropertyId(client?: pg.PoolClient): Promise<string> {
    const runner = client || getDbPool();
    const res = await runner.query('SELECT id FROM public.properties LIMIT 1;');
    if (res.rows.length === 0) {
      throw new NotFoundError('Resort property not configured');
    }
    return res.rows[0].id;
  }

  // ==========================================================================
  // 1. INVENTORY ITEMS
  // ==========================================================================

  static async listItems(params: {
    category?: InventoryCategory;
    isActive?: boolean;
    belowReorderLevel?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryItemResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.category) {
      conditions.push(`ii.category = $${idx++}`);
      values.push(params.category);
    }
    if (params.isActive !== undefined) {
      conditions.push(`ii.is_active = $${idx++}`);
      values.push(params.isActive);
    }
    if (params.search) {
      conditions.push(`(ii.name ILIKE $${idx} OR ii.item_code ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(DISTINCT ii.id) AS total
      FROM public.inventory_items ii
      ${whereClause};
    `;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const query = `
      SELECT 
        ii.*,
        COALESCE(SUM(ib.quantity_on_hand), 0) AS total_on_hand
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_balances ib ON ii.id = ib.item_id
      ${whereClause}
      GROUP BY ii.id
      ${params.belowReorderLevel ? 'HAVING COALESCE(SUM(ib.quantity_on_hand), 0) < ii.reorder_level' : ''}
      ORDER BY ii.name ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(params.limit || 50, params.offset || 0);

    const res = await pool.query(query, values);
    const items = res.rows.map((r) => mapItemRow(r));
    return { items, total };
  }

  static async getItemById(itemId: string): Promise<InventoryItemResponse> {
    const pool = getDbPool();
    const query = `
      SELECT 
        ii.*,
        COALESCE(SUM(ib.quantity_on_hand), 0) AS total_on_hand
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_balances ib ON ii.id = ib.item_id
      WHERE ii.id = $1
      GROUP BY ii.id;
    `;
    const res = await pool.query(query, [itemId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Inventory item '${itemId}'`);
    }
    return mapItemRow(res.rows[0]);
  }

  static async createItem(params: {
    itemCode: string;
    name: string;
    category: InventoryCategory;
    unitOfMeasure: string;
    reorderLevel?: number;
    unitCostPaise?: number;
    isActive?: boolean;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<InventoryItemResponse> {
    const {
      itemCode,
      name,
      category,
      unitOfMeasure,
      reorderLevel = 10,
      unitCostPaise = 0,
      isActive = true,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    const reorderLevelStr = formatThousandthsToQuantity(parseQuantityToThousandths(reorderLevel));

    return await withTransaction(async (client) => {
      const propertyId = await InventoryService.getPropertyId(client);

      // Check unique item_code
      const existing = await client.query(
        'SELECT id FROM public.inventory_items WHERE item_code = $1;',
        [itemCode.trim()]
      );
      if (existing.rows.length > 0) {
        throw new ConflictError(`Inventory item code '${itemCode}' already exists`);
      }

      const insertQuery = `
        INSERT INTO public.inventory_items (
          property_id, item_code, name, category, unit_of_measure,
          reorder_level, unit_cost_paise, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const res = await client.query(insertQuery, [
        propertyId,
        itemCode.trim(),
        name.trim(),
        category,
        unitOfMeasure.trim().toUpperCase(),
        reorderLevelStr,
        unitCostPaise,
        isActive
      ]);
      const createdItem = res.rows[0];

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'INVENTORY_ITEM_CREATED',
          entityType: 'inventory_items',
          entityId: createdItem.id,
          outletId: null,
          oldState: null,
          newState: {
            itemCode: createdItem.item_code,
            name: createdItem.name,
            category: createdItem.category,
            reorderLevel: createdItem.reorder_level,
            unitCostPaise: createdItem.unit_cost_paise
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapItemRow(createdItem, 0n);
    });
  }

  static async updateItem(params: {
    itemId: string;
    itemCode?: string;
    name?: string;
    category?: InventoryCategory;
    unitOfMeasure?: string;
    reorderLevel?: number;
    unitCostPaise?: number;
    isActive?: boolean;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<InventoryItemResponse> {
    const { itemId, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const currentRes = await client.query(
        'SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE;',
        [itemId]
      );
      if (currentRes.rows.length === 0) {
        throw new NotFoundError(`Inventory item '${itemId}'`);
      }
      const current = currentRes.rows[0];

      if (params.itemCode && params.itemCode.trim() !== current.item_code) {
        const dupRes = await client.query(
          'SELECT id FROM public.inventory_items WHERE item_code = $1 AND id != $2;',
          [params.itemCode.trim(), itemId]
        );
        if (dupRes.rows.length > 0) {
          throw new ConflictError(`Inventory item code '${params.itemCode}' already exists`);
        }
      }

      const newItemCode = params.itemCode !== undefined ? params.itemCode.trim() : current.item_code;
      const newName = params.name !== undefined ? params.name.trim() : current.name;
      const newCategory = params.category !== undefined ? params.category : current.category;
      const newUom =
        params.unitOfMeasure !== undefined
          ? params.unitOfMeasure.trim().toUpperCase()
          : current.unit_of_measure;
      const newReorder =
        params.reorderLevel !== undefined
          ? formatThousandthsToQuantity(parseQuantityToThousandths(params.reorderLevel))
          : current.reorder_level;
      const newCost =
        params.unitCostPaise !== undefined ? params.unitCostPaise : current.unit_cost_paise;
      const newActive = params.isActive !== undefined ? params.isActive : current.is_active;

      const updateQuery = `
        UPDATE public.inventory_items
        SET item_code = $1,
            name = $2,
            category = $3,
            unit_of_measure = $4,
            reorder_level = $5,
            unit_cost_paise = $6,
            is_active = $7
        WHERE id = $8
        RETURNING *;
      `;
      const updateRes = await client.query(updateQuery, [
        newItemCode,
        newName,
        newCategory,
        newUom,
        newReorder,
        newCost,
        newActive,
        itemId
      ]);
      const updated = updateRes.rows[0];

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'INVENTORY_ITEM_UPDATED',
          entityType: 'inventory_items',
          entityId: itemId,
          outletId: null,
          oldState: {
            itemCode: current.item_code,
            name: current.name,
            category: current.category,
            reorderLevel: current.reorder_level,
            unitCostPaise: current.unit_cost_paise,
            isActive: current.is_active
          },
          newState: {
            itemCode: updated.item_code,
            name: updated.name,
            category: updated.category,
            reorderLevel: updated.reorder_level,
            unitCostPaise: updated.unit_cost_paise,
            isActive: updated.is_active
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapItemRow(updated);
    });
  }

  // ==========================================================================
  // 2. INVENTORY LOCATIONS
  // ==========================================================================

  static async listLocations(params: {
    outletId?: string;
    isCentral?: boolean;
    isActive?: boolean;
    staffOutletIds?: string[];
    isSuperAdminOrManager?: boolean;
  }): Promise<InventoryLocationResponse[]> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.outletId) {
      conditions.push(`il.outlet_id = $${idx++}`);
      values.push(params.outletId);
    }
    if (params.isCentral === true) {
      conditions.push('il.outlet_id IS NULL');
    } else if (params.isCentral === false) {
      conditions.push('il.outlet_id IS NOT NULL');
    }
    if (params.isActive !== undefined) {
      conditions.push(`il.is_active = $${idx++}`);
      values.push(params.isActive);
    }

    // Outlet isolation: if staff is not superadmin/manager, restrict outlet locations
    if (!params.isSuperAdminOrManager && params.staffOutletIds) {
      conditions.push(
        `(il.outlet_id IS NULL OR il.outlet_id = ANY($${idx++}::varchar[]))`
      );
      values.push(params.staffOutletIds);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT 
        il.*,
        o.name AS outlet_name
      FROM public.inventory_locations il
      LEFT JOIN public.outlets o ON il.outlet_id = o.id
      ${whereClause}
      ORDER BY il.outlet_id NULLS FIRST, il.name ASC;
    `;
    const res = await pool.query(query, values);
    return res.rows.map((r) => mapLocationRow(r));
  }

  static async getLocationById(
    locationId: string,
    client?: pg.PoolClient
  ): Promise<InventoryLocationResponse> {
    const runner = client || getDbPool();
    const query = `
      SELECT 
        il.*,
        o.name AS outlet_name
      FROM public.inventory_locations il
      LEFT JOIN public.outlets o ON il.outlet_id = o.id
      WHERE il.id = $1;
    `;
    const res = await runner.query(query, [locationId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Inventory location '${locationId}'`);
    }
    return mapLocationRow(res.rows[0]);
  }

  // ==========================================================================
  // 3. INVENTORY BALANCES
  // ==========================================================================

  static async listBalances(params: {
    locationId?: string;
    outletId?: string;
    itemId?: string;
    category?: InventoryCategory;
    belowReorderLevel?: boolean;
    limit?: number;
    offset?: number;
    staffOutletIds?: string[];
    isSuperAdminOrManager?: boolean;
  }): Promise<{ balances: InventoryBalanceResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.locationId) {
      conditions.push(`ib.location_id = $${idx++}`);
      values.push(params.locationId);
    }
    if (params.outletId) {
      conditions.push(`il.outlet_id = $${idx++}`);
      values.push(params.outletId);
    }
    if (params.itemId) {
      conditions.push(`ib.item_id = $${idx++}`);
      values.push(params.itemId);
    }
    if (params.category) {
      conditions.push(`ii.category = $${idx++}`);
      values.push(params.category);
    }
    if (params.belowReorderLevel) {
      conditions.push('ib.quantity_on_hand < ii.reorder_level');
    }

    if (!params.isSuperAdminOrManager && params.staffOutletIds) {
      conditions.push(
        `(il.outlet_id IS NULL OR il.outlet_id = ANY($${idx++}::varchar[]))`
      );
      values.push(params.staffOutletIds);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM public.inventory_balances ib
      JOIN public.inventory_items ii ON ib.item_id = ii.id
      JOIN public.inventory_locations il ON ib.location_id = il.id
      ${whereClause};
    `;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const query = `
      SELECT 
        ib.*,
        ii.item_code,
        ii.name AS item_name,
        ii.category,
        ii.unit_of_measure,
        ii.reorder_level,
        ii.unit_cost_paise,
        il.code AS location_code,
        il.name AS location_name,
        il.outlet_id
      FROM public.inventory_balances ib
      JOIN public.inventory_items ii ON ib.item_id = ii.id
      JOIN public.inventory_locations il ON ib.location_id = il.id
      ${whereClause}
      ORDER BY ii.name ASC, il.name ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(params.limit || 50, params.offset || 0);

    const res = await pool.query(query, values);
    const balances = res.rows.map((r) => mapBalanceRow(r));
    return { balances, total };
  }

  static async getItemBalances(
    itemId: string,
    staffOutletIds?: string[],
    isSuperAdminOrManager?: boolean
  ): Promise<InventoryBalanceResponse[]> {
    const pool = getDbPool();
    const conditions: string[] = ['ib.item_id = $1'];
    const values: any[] = [itemId];
    let idx = 2;

    if (!isSuperAdminOrManager && staffOutletIds) {
      conditions.push(
        `(il.outlet_id IS NULL OR il.outlet_id = ANY($${idx++}::varchar[]))`
      );
      values.push(staffOutletIds);
    }

    const query = `
      SELECT 
        ib.*,
        ii.item_code,
        ii.name AS item_name,
        ii.category,
        ii.unit_of_measure,
        ii.reorder_level,
        ii.unit_cost_paise,
        il.code AS location_code,
        il.name AS location_name,
        il.outlet_id
      FROM public.inventory_balances ib
      JOIN public.inventory_items ii ON ib.item_id = ii.id
      JOIN public.inventory_locations il ON ib.location_id = il.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY il.outlet_id NULLS FIRST, il.name ASC;
    `;
    const res = await pool.query(query, values);
    return res.rows.map((r) => mapBalanceRow(r));
  }

  // ==========================================================================
  // 4. STOCK MOVEMENTS (ACID TRANSACTIONS)
  // ==========================================================================

  /**
   * Helper to atomically lock or create a balance row for (itemId, locationId).
   */
  private static async lockOrCreateBalanceRow(
    client: pg.PoolClient,
    itemId: string,
    locationId: string
  ): Promise<any> {
    // Attempt to lock existing row
    const lockRes = await client.query(
      'SELECT * FROM public.inventory_balances WHERE item_id = $1 AND location_id = $2 FOR UPDATE;',
      [itemId, locationId]
    );
    if (lockRes.rows.length > 0) {
      return lockRes.rows[0];
    }

    // Safely insert zero-balance row on conflict do nothing
    await client.query(
      `INSERT INTO public.inventory_balances (item_id, location_id, quantity_on_hand)
       VALUES ($1, $2, '0.000')
       ON CONFLICT (item_id, location_id) DO NOTHING;`,
      [itemId, locationId]
    );

    // Re-lock
    const reLockRes = await client.query(
      'SELECT * FROM public.inventory_balances WHERE item_id = $1 AND location_id = $2 FOR UPDATE;',
      [itemId, locationId]
    );
    return reLockRes.rows[0];
  }

  static async recordMovement(params: {
    itemId: string;
    locationId: string;
    movementType: StockMovementType;
    quantity: number;
    referenceDocument?: string;
    notes?: string;
    staffId: string;
    staffOutletIds?: string[];
    isSuperAdminOrManager?: boolean;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<StockMovementResponse> {
    const {
      itemId,
      locationId,
      movementType,
      quantity,
      referenceDocument,
      notes,
      staffId,
      staffOutletIds,
      isSuperAdminOrManager,
      reqCorrelationId,
      ipAddress
    } = params;

    const qtyThousandthsInput = parseQuantityToThousandths(quantity);
    if (qtyThousandthsInput === 0n) {
      throw new BadRequestError('Stock movement quantity cannot be zero');
    }

    // Determine signed thousandths based on canonical movement type
    let signedThousandths: bigint;
    const absThousandths = qtyThousandthsInput > 0n ? qtyThousandthsInput : -qtyThousandthsInput;

    switch (movementType) {
      case 'PURCHASE':
      case 'TRANSFER_IN':
        signedThousandths = absThousandths;
        break;
      case 'CONSUMPTION':
      case 'WASTAGE':
      case 'TRANSFER_OUT':
        signedThousandths = -absThousandths;
        break;
      case 'RETURN':
        // Default vendor return is negative (stock reduction) unless explicitly positive
        signedThousandths = qtyThousandthsInput < 0n ? qtyThousandthsInput : -qtyThousandthsInput;
        break;
      case 'ADJUSTMENT':
        // Adjustments preserve caller sign (+ for inventory count surplus, - for deficit)
        signedThousandths = qtyThousandthsInput;
        break;
      default:
        throw new BadRequestError(`Unsupported stock movement type '${movementType}'`);
    }

    const movementQuantityStr = formatThousandthsToQuantity(signedThousandths);

    return await withTransaction(async (client) => {
      // 1. Validate item
      const itemRes = await client.query(
        'SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE;',
        [itemId]
      );
      if (itemRes.rows.length === 0) {
        throw new NotFoundError(`Inventory item '${itemId}'`);
      }
      const item = itemRes.rows[0];
      if (!item.is_active) {
        throw new UnprocessableEntityError(`Inventory item '${item.name}' is inactive`);
      }

      // 2. Validate location & outlet authorization
      const locRes = await client.query(
        'SELECT * FROM public.inventory_locations WHERE id = $1;',
        [locationId]
      );
      if (locRes.rows.length === 0) {
        throw new NotFoundError(`Inventory location '${locationId}'`);
      }
      const location = locRes.rows[0];
      if (!location.is_active) {
        throw new UnprocessableEntityError(`Inventory location '${location.name}' is inactive`);
      }

      if (location.outlet_id && !isSuperAdminOrManager && staffOutletIds) {
        if (!staffOutletIds.includes(location.outlet_id)) {
          throw new ForbiddenError(
            `Staff lacks authorized access to location's outlet '${location.outlet_id}'`
          );
        }
      }

      // 3. Atomically lock or create balance row
      const balanceRow = await InventoryService.lockOrCreateBalanceRow(
        client,
        itemId,
        locationId
      );
      const currentThousandths = parseQuantityToThousandths(balanceRow.quantity_on_hand);
      const newThousandths = currentThousandths + signedThousandths;
      const newQuantityStr = formatThousandthsToQuantity(newThousandths);

      // 4. Insert append-only movement ledger row
      const insertMovementQuery = `
        INSERT INTO public.inventory_movements (
          item_id, location_id, movement_type, quantity,
          reference_document, notes, authorized_by_staff_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const movRes = await client.query(insertMovementQuery, [
        itemId,
        locationId,
        movementType,
        movementQuantityStr,
        referenceDocument || null,
        notes || null,
        staffId
      ]);
      const movRow = movRes.rows[0];

      // 5. Update inventory_balances
      await client.query(
        `UPDATE public.inventory_balances
         SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [newQuantityStr, balanceRow.id]
      );

      // 6. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'INVENTORY_MOVEMENT_CREATED',
          entityType: 'inventory_movements',
          entityId: movRow.id,
          outletId: location.outlet_id,
          oldState: {
            quantityOnHand: balanceRow.quantity_on_hand
          },
          newState: {
            movementType,
            quantity: movementQuantityStr,
            newQuantityOnHand: newQuantityStr,
            referenceDocument: referenceDocument || null
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 7. Publish outlet event if outlet-scoped
      if (location.outlet_id) {
        await publishOutletEvent(
          {
            outletId: location.outlet_id,
            channel: 'inventory',
            eventType: 'INVENTORY_BALANCE_CHANGED',
            entityId: balanceRow.id,
            payload: {
              balanceId: balanceRow.id,
              itemId,
              locationId,
              movementType,
              quantity: formatThousandthsToNumber(signedThousandths),
              newQuantityOnHand: formatThousandthsToNumber(newThousandths)
            }
          },
          client
        );

        // Check if now below reorder level
        const reorderThousandths = parseQuantityToThousandths(item.reorder_level);
        if (newThousandths < reorderThousandths) {
          await publishOutletEvent(
            {
              outletId: location.outlet_id,
              channel: 'inventory',
              eventType: 'INVENTORY_LOW_STOCK',
              entityId: itemId,
              payload: {
                itemId,
                itemCode: item.item_code,
                itemName: item.name,
                locationId,
                locationName: location.name,
                quantityOnHand: formatThousandthsToNumber(newThousandths),
                reorderLevel: formatThousandthsToNumber(reorderThousandths)
              }
            },
            client
          );
        }
      }

      const resObj = mapMovementRow(movRow);
      resObj.itemName = item.name;
      resObj.itemCode = item.item_code;
      resObj.locationName = location.name;
      resObj.locationCode = location.code;
      resObj.outletId = location.outlet_id;
      resObj.newBalanceOnHand = formatThousandthsToNumber(newThousandths);
      return resObj;
    });
  }

  // ==========================================================================
  // 5. INTER-LOCATION TRANSFERS (ATOMIC CORRELATED PAIRS)
  // ==========================================================================

  static async recordTransfer(params: {
    itemId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    referenceDocument?: string;
    notes?: string;
    staffId: string;
    staffOutletIds?: string[];
    isSuperAdminOrManager?: boolean;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<TransferResponse> {
    const {
      itemId,
      sourceLocationId,
      destinationLocationId,
      quantity,
      referenceDocument,
      notes,
      staffId,
      staffOutletIds,
      isSuperAdminOrManager,
      reqCorrelationId,
      ipAddress
    } = params;

    if (sourceLocationId === destinationLocationId) {
      throw new BadRequestError('Source and destination locations cannot be identical');
    }

    const transferThousandths = parseQuantityToThousandths(quantity);
    if (transferThousandths <= 0n) {
      throw new BadRequestError('Transfer quantity must be strictly greater than zero');
    }

    const transferQtyStr = formatThousandthsToQuantity(transferThousandths);
    const negativeQtyStr = formatThousandthsToQuantity(-transferThousandths);

    return await withTransaction(async (client) => {
      // 1. Validate item
      const itemRes = await client.query(
        'SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE;',
        [itemId]
      );
      if (itemRes.rows.length === 0) {
        throw new NotFoundError(`Inventory item '${itemId}'`);
      }
      const item = itemRes.rows[0];
      if (!item.is_active) {
        throw new UnprocessableEntityError(`Inventory item '${item.name}' is inactive`);
      }

      // 2. Validate source & destination locations
      const locRes = await client.query(
        'SELECT * FROM public.inventory_locations WHERE id IN ($1, $2);',
        [sourceLocationId, destinationLocationId]
      );
      if (locRes.rows.length < 2) {
        throw new NotFoundError('One or both inventory locations not found');
      }

      const sourceLoc = locRes.rows.find((l) => l.id === sourceLocationId);
      const destLoc = locRes.rows.find((l) => l.id === destinationLocationId);

      if (!sourceLoc.is_active) {
        throw new UnprocessableEntityError(
          `Source location '${sourceLoc.name}' is inactive`
        );
      }
      if (!destLoc.is_active) {
        throw new UnprocessableEntityError(
          `Destination location '${destLoc.name}' is inactive`
        );
      }

      // Authorization check for outlet locations
      if (!isSuperAdminOrManager && staffOutletIds) {
        if (sourceLoc.outlet_id && !staffOutletIds.includes(sourceLoc.outlet_id)) {
          throw new ForbiddenError(
            `Staff lacks authorized access to source outlet '${sourceLoc.outlet_id}'`
          );
        }
        if (destLoc.outlet_id && !staffOutletIds.includes(destLoc.outlet_id)) {
          throw new ForbiddenError(
            `Staff lacks authorized access to destination outlet '${destLoc.outlet_id}'`
          );
        }
      }

      // 3. Acquire balance locks in deterministic order (sorted by location UUID) to prevent deadlocks
      const [firstLocId, secondLocId] =
        sourceLocationId < destinationLocationId
          ? [sourceLocationId, destinationLocationId]
          : [destinationLocationId, sourceLocationId];

      const firstBalance = await InventoryService.lockOrCreateBalanceRow(
        client,
        itemId,
        firstLocId
      );
      const secondBalance = await InventoryService.lockOrCreateBalanceRow(
        client,
        itemId,
        secondLocId
      );

      const sourceBalance = firstLocId === sourceLocationId ? firstBalance : secondBalance;
      const destBalance = firstLocId === destinationLocationId ? firstBalance : secondBalance;

      const sourceCurrentThousandths = parseQuantityToThousandths(sourceBalance.quantity_on_hand);
      const destCurrentThousandths = parseQuantityToThousandths(destBalance.quantity_on_hand);

      const newSourceThousandths = sourceCurrentThousandths - transferThousandths;
      const newDestThousandths = destCurrentThousandths + transferThousandths;

      const newSourceQtyStr = formatThousandthsToQuantity(newSourceThousandths);
      const newDestQtyStr = formatThousandthsToQuantity(newDestThousandths);

      // 4. Generate transfer_group_id
      const transferGroupId = crypto.randomUUID();

      // 5. Insert Source Movement (TRANSFER_OUT)
      const insertOutQuery = `
        INSERT INTO public.inventory_movements (
          item_id, location_id, movement_type, quantity,
          transfer_group_id, reference_document, notes, authorized_by_staff_id
        ) VALUES ($1, $2, 'TRANSFER_OUT', $3, $4, $5, $6, $7)
        RETURNING id;
      `;
      const outRes = await client.query(insertOutQuery, [
        itemId,
        sourceLocationId,
        negativeQtyStr,
        transferGroupId,
        referenceDocument || null,
        notes || null,
        staffId
      ]);
      const sourceMovementId = outRes.rows[0].id;

      // 6. Insert Destination Movement (TRANSFER_IN) referencing sourceMovementId as paired_movement_id
      const insertInQuery = `
        INSERT INTO public.inventory_movements (
          item_id, location_id, movement_type, quantity,
          transfer_group_id, paired_movement_id, reference_document, notes, authorized_by_staff_id
        ) VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `;
      const inRes = await client.query(insertInQuery, [
        itemId,
        destinationLocationId,
        transferQtyStr,
        transferGroupId,
        sourceMovementId,
        referenceDocument || null,
        notes || null,
        staffId
      ]);
      const destMovementId = inRes.rows[0].id;

      // 7. Cross-reference source movement's paired_movement_id to destination
      await client.query(
        'UPDATE public.inventory_movements SET paired_movement_id = $1 WHERE id = $2;',
        [destMovementId, sourceMovementId]
      );

      // 8. Update both balance rows
      await client.query(
        `UPDATE public.inventory_balances
         SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [newSourceQtyStr, sourceBalance.id]
      );
      await client.query(
        `UPDATE public.inventory_balances
         SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [newDestQtyStr, destBalance.id]
      );

      // 9. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'INVENTORY_TRANSFERRED',
          entityType: 'inventory_movements',
          entityId: transferGroupId,
          outletId: sourceLoc.outlet_id || destLoc.outlet_id || null,
          oldState: {
            sourceOnHand: sourceBalance.quantity_on_hand,
            destOnHand: destBalance.quantity_on_hand
          },
          newState: {
            transferGroupId,
            itemId,
            quantity: transferQtyStr,
            sourceMovementId,
            destMovementId,
            newSourceOnHand: newSourceQtyStr,
            newDestOnHand: newDestQtyStr
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 10. Publish outlet events
      if (sourceLoc.outlet_id) {
        await publishOutletEvent(
          {
            outletId: sourceLoc.outlet_id,
            channel: 'inventory',
            eventType: 'INVENTORY_TRANSFERRED',
            entityId: transferGroupId,
            payload: {
              transferGroupId,
              direction: 'OUT',
              itemId,
              sourceLocationId,
              destinationLocationId,
              quantity: formatThousandthsToNumber(transferThousandths),
              newOnHand: formatThousandthsToNumber(newSourceThousandths)
            }
          },
          client
        );
      }
      if (destLoc.outlet_id) {
        await publishOutletEvent(
          {
            outletId: destLoc.outlet_id,
            channel: 'inventory',
            eventType: 'INVENTORY_TRANSFERRED',
            entityId: transferGroupId,
            payload: {
              transferGroupId,
              direction: 'IN',
              itemId,
              sourceLocationId,
              destinationLocationId,
              quantity: formatThousandthsToNumber(transferThousandths),
              newOnHand: formatThousandthsToNumber(newDestThousandths)
            }
          },
          client
        );
      }

      return {
        transferGroupId,
        itemId,
        sourceLocationId,
        destinationLocationId,
        quantity: formatThousandthsToNumber(transferThousandths),
        sourceMovementId,
        destinationMovementId: destMovementId,
        sourceNewBalanceOnHand: formatThousandthsToNumber(newSourceThousandths),
        destinationNewBalanceOnHand: formatThousandthsToNumber(newDestThousandths),
        referenceDocument: referenceDocument || null,
        notes: notes || null,
        createdAt: new Date().toISOString()
      };
    });
  }

  // ==========================================================================
  // 6. RECIPES / BILL-OF-MATERIALS (BOM)
  // ==========================================================================

  static async listRecipes(params: {
    menuItemId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ recipes: RecipeResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.menuItemId) {
      conditions.push(`r.menu_item_id = $${idx++}`);
      values.push(params.menuItemId);
    }
    if (params.search) {
      conditions.push(`(r.name ILIKE $${idx} OR mi.name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM public.recipes r
       JOIN public.menu_items mi ON r.menu_item_id = mi.id
       ${whereClause};`,
      values
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const query = `
      SELECT 
        r.*,
        mi.name AS menu_item_name
      FROM public.recipes r
      JOIN public.menu_items mi ON r.menu_item_id = mi.id
      ${whereClause}
      ORDER BY r.name ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(params.limit || 50, params.offset || 0);

    const res = await pool.query(query, values);
    const recipes: RecipeResponse[] = [];

    for (const row of res.rows) {
      const ingRes = await pool.query(
        `SELECT ri.*, ii.name AS item_name, ii.item_code
         FROM public.recipe_ingredients ri
         JOIN public.inventory_items ii ON ri.inventory_item_id = ii.id
         WHERE ri.recipe_id = $1
         ORDER BY ii.name ASC;`,
        [row.id]
      );
      const ingredients = ingRes.rows.map((r) => mapIngredientRow(r));
      recipes.push(mapRecipeRow(row, ingredients));
    }

    return { recipes, total };
  }

  static async getRecipeById(recipeId: string): Promise<RecipeResponse> {
    const pool = getDbPool();
    const query = `
      SELECT 
        r.*,
        mi.name AS menu_item_name
      FROM public.recipes r
      JOIN public.menu_items mi ON r.menu_item_id = mi.id
      WHERE r.id = $1;
    `;
    const res = await pool.query(query, [recipeId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Recipe '${recipeId}'`);
    }

    const ingRes = await pool.query(
      `SELECT ri.*, ii.name AS item_name, ii.item_code
       FROM public.recipe_ingredients ri
       JOIN public.inventory_items ii ON ri.inventory_item_id = ii.id
       WHERE ri.recipe_id = $1
       ORDER BY ii.name ASC;`,
      [recipeId]
    );
    const ingredients = ingRes.rows.map((r) => mapIngredientRow(r));
    return mapRecipeRow(res.rows[0], ingredients);
  }

  static async getRecipeByMenuItemId(menuItemId: string): Promise<RecipeResponse> {
    const pool = getDbPool();
    const query = `
      SELECT 
        r.*,
        mi.name AS menu_item_name
      FROM public.recipes r
      JOIN public.menu_items mi ON r.menu_item_id = mi.id
      WHERE r.menu_item_id = $1
      ORDER BY r.created_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [menuItemId]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`No recipe found for menu item '${menuItemId}'`);
    }

    const recipe = res.rows[0];
    const ingRes = await pool.query(
      `SELECT ri.*, ii.name AS item_name, ii.item_code
       FROM public.recipe_ingredients ri
       JOIN public.inventory_items ii ON ri.inventory_item_id = ii.id
       WHERE ri.recipe_id = $1
       ORDER BY ii.name ASC;`,
      [recipe.id]
    );
    const ingredients = ingRes.rows.map((r) => mapIngredientRow(r));
    return mapRecipeRow(recipe, ingredients);
  }

  static async createRecipe(params: {
    menuItemId: string;
    name: string;
    yieldServings?: number;
    ingredients?: Array<{
      inventoryItemId: string;
      quantityRequired: number;
      unitOfMeasure: string;
    }>;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<RecipeResponse> {
    const {
      menuItemId,
      name,
      yieldServings = 1,
      ingredients = [],
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    return await withTransaction(async (client) => {
      // Validate menu item exists
      const miRes = await client.query(
        'SELECT id, name FROM public.menu_items WHERE id = $1;',
        [menuItemId]
      );
      if (miRes.rows.length === 0) {
        throw new NotFoundError(`Menu item '${menuItemId}'`);
      }

      const insertRecipeQuery = `
        INSERT INTO public.recipes (menu_item_id, name, yield_servings)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const recipeRes = await client.query(insertRecipeQuery, [
        menuItemId,
        name.trim(),
        yieldServings
      ]);
      const recipeRow = recipeRes.rows[0];

      // Validate & insert ingredients preventing duplicates
      const insertedIngredients: RecipeIngredientResponse[] = [];
      const seenItemIds = new Set<string>();

      for (const ing of ingredients) {
        if (seenItemIds.has(ing.inventoryItemId)) {
          throw new ConflictError(
            `Duplicate ingredient '${ing.inventoryItemId}' in recipe definition`
          );
        }
        seenItemIds.add(ing.inventoryItemId);

        // Verify inventory item exists
        const itemRes = await client.query(
          'SELECT id, name, item_code FROM public.inventory_items WHERE id = $1;',
          [ing.inventoryItemId]
        );
        if (itemRes.rows.length === 0) {
          throw new NotFoundError(`Inventory item '${ing.inventoryItemId}'`);
        }

        const qtyStr = formatThousandthsToQuantity(
          parseQuantityToThousandths(ing.quantityRequired)
        );
        const insertIngQuery = `
          INSERT INTO public.recipe_ingredients (
            recipe_id, inventory_item_id, quantity_required, unit_of_measure
          ) VALUES ($1, $2, $3, $4)
          RETURNING *;
        `;
        const ingRes = await client.query(insertIngQuery, [
          recipeRow.id,
          ing.inventoryItemId,
          qtyStr,
          ing.unitOfMeasure.trim().toUpperCase()
        ]);
        const ingRow = ingRes.rows[0];
        ingRow.item_name = itemRes.rows[0].name;
        ingRow.item_code = itemRes.rows[0].item_code;
        insertedIngredients.push(mapIngredientRow(ingRow));
      }

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'RECIPE_CREATED',
          entityType: 'recipes',
          entityId: recipeRow.id,
          outletId: null,
          oldState: null,
          newState: {
            menuItemId,
            name: recipeRow.name,
            yieldServings: recipeRow.yield_servings,
            ingredientCount: insertedIngredients.length
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      recipeRow.menu_item_name = miRes.rows[0].name;
      return mapRecipeRow(recipeRow, insertedIngredients);
    });
  }

  static async updateRecipe(params: {
    recipeId: string;
    name?: string;
    yieldServings?: number;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<RecipeResponse> {
    const { recipeId, staffId, reqCorrelationId, ipAddress } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.recipes WHERE id = $1 FOR UPDATE;',
        [recipeId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(`Recipe '${recipeId}'`);
      }
      const cur = curRes.rows[0];

      const newName = params.name !== undefined ? params.name.trim() : cur.name;
      const newYield = params.yieldServings !== undefined ? params.yieldServings : cur.yield_servings;

      const updateRes = await client.query(
        `UPDATE public.recipes
         SET name = $1, yield_servings = $2
         WHERE id = $3
         RETURNING *;`,
        [newName, newYield, recipeId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'RECIPE_UPDATED',
          entityType: 'recipes',
          entityId: recipeId,
          outletId: null,
          oldState: { name: cur.name, yieldServings: cur.yield_servings },
          newState: { name: newName, yieldServings: newYield },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return await InventoryService.getRecipeById(recipeId);
    });
  }

  static async addRecipeIngredient(params: {
    recipeId: string;
    inventoryItemId: string;
    quantityRequired: number;
    unitOfMeasure: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<RecipeIngredientResponse> {
    const {
      recipeId,
      inventoryItemId,
      quantityRequired,
      unitOfMeasure,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    return await withTransaction(async (client) => {
      // Validate recipe exists
      const recRes = await client.query(
        'SELECT id FROM public.recipes WHERE id = $1 FOR UPDATE;',
        [recipeId]
      );
      if (recRes.rows.length === 0) {
        throw new NotFoundError(`Recipe '${recipeId}'`);
      }

      // Validate inventory item exists
      const itemRes = await client.query(
        'SELECT id, name, item_code FROM public.inventory_items WHERE id = $1;',
        [inventoryItemId]
      );
      if (itemRes.rows.length === 0) {
        throw new NotFoundError(`Inventory item '${inventoryItemId}'`);
      }

      // Check unique (recipe_id, inventory_item_id)
      const existing = await client.query(
        'SELECT id FROM public.recipe_ingredients WHERE recipe_id = $1 AND inventory_item_id = $2;',
        [recipeId, inventoryItemId]
      );
      if (existing.rows.length > 0) {
        throw new ConflictError(
          'Ingredient already exists in recipe. Use PATCH to update quantity.'
        );
      }

      const qtyStr = formatThousandthsToQuantity(parseQuantityToThousandths(quantityRequired));
      const insertQuery = `
        INSERT INTO public.recipe_ingredients (
          recipe_id, inventory_item_id, quantity_required, unit_of_measure
        ) VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const res = await client.query(insertQuery, [
        recipeId,
        inventoryItemId,
        qtyStr,
        unitOfMeasure.trim().toUpperCase()
      ]);
      const row = res.rows[0];
      row.item_name = itemRes.rows[0].name;
      row.item_code = itemRes.rows[0].item_code;

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'RECIPE_INGREDIENT_ADDED',
          entityType: 'recipe_ingredients',
          entityId: row.id,
          outletId: null,
          oldState: null,
          newState: {
            recipeId,
            inventoryItemId,
            quantityRequired: qtyStr,
            unitOfMeasure: row.unit_of_measure
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapIngredientRow(row);
    });
  }

  static async updateRecipeIngredient(params: {
    recipeId: string;
    ingredientId: string;
    quantityRequired?: number;
    unitOfMeasure?: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<RecipeIngredientResponse> {
    const {
      recipeId,
      ingredientId,
      quantityRequired,
      unitOfMeasure,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    return await withTransaction(async (client) => {
      const curRes = await client.query(
        `SELECT ri.*, ii.name AS item_name, ii.item_code
         FROM public.recipe_ingredients ri
         JOIN public.inventory_items ii ON ri.inventory_item_id = ii.id
         WHERE ri.id = $1 AND ri.recipe_id = $2
         FOR UPDATE;`,
        [ingredientId, recipeId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(
          `Recipe ingredient '${ingredientId}' not found for recipe '${recipeId}'`
        );
      }
      const cur = curRes.rows[0];

      const newQty =
        quantityRequired !== undefined
          ? formatThousandthsToQuantity(parseQuantityToThousandths(quantityRequired))
          : cur.quantity_required;
      const newUom =
        unitOfMeasure !== undefined
          ? unitOfMeasure.trim().toUpperCase()
          : cur.unit_of_measure;

      const updateRes = await client.query(
        `UPDATE public.recipe_ingredients
         SET quantity_required = $1, unit_of_measure = $2
         WHERE id = $3
         RETURNING *;`,
        [newQty, newUom, ingredientId]
      );
      const updated = updateRes.rows[0];
      updated.item_name = cur.item_name;
      updated.item_code = cur.item_code;

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'RECIPE_INGREDIENT_UPDATED',
          entityType: 'recipe_ingredients',
          entityId: ingredientId,
          outletId: null,
          oldState: {
            quantityRequired: cur.quantity_required,
            unitOfMeasure: cur.unit_of_measure
          },
          newState: {
            quantityRequired: newQty,
            unitOfMeasure: newUom
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      return mapIngredientRow(updated);
    });
  }

  static async removeRecipeIngredient(params: {
    recipeId: string;
    ingredientId: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<void> {
    const { recipeId, ingredientId, staffId, reqCorrelationId, ipAddress } = params;

    await withTransaction(async (client) => {
      const curRes = await client.query(
        'SELECT * FROM public.recipe_ingredients WHERE id = $1 AND recipe_id = $2 FOR UPDATE;',
        [ingredientId, recipeId]
      );
      if (curRes.rows.length === 0) {
        throw new NotFoundError(
          `Recipe ingredient '${ingredientId}' not found for recipe '${recipeId}'`
        );
      }
      const cur = curRes.rows[0];

      await client.query(
        'DELETE FROM public.recipe_ingredients WHERE id = $1;',
        [ingredientId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'RECIPE_INGREDIENT_REMOVED',
          entityType: 'recipe_ingredients',
          entityId: ingredientId,
          outletId: null,
          oldState: {
            recipeId,
            inventoryItemId: cur.inventory_item_id,
            quantityRequired: cur.quantity_required
          },
          newState: null,
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );
    });
  }
}
