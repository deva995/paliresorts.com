import { hasGlobalOutletAccess } from '../../utils/outletAccess.js';
import type { AuthenticatedStaffContext } from '../../middleware/auth.js';
import pg from 'pg';
import { getDbPool, withTransaction } from '../../db/pool.js';
import { runtimeContextEnabled } from '../../db/runtimeContext.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { publishOutletEvent } from '../../services/outletEvent.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import { rupeesToPaise } from '../../utils/currency.js';
import {
  MenuCategory,
  EffectiveMenuItem,
  GroupedCategoryMenu,
  OutletMenuResponse,
  MenuItemDetailResponse,
  OutletAllocationDetail,
  MenuRevisionResponse,
  ProposedMasterItemData,
  ProposedOutletItemData
} from './menu.types.js';

export class MenuService {
  static async authorizeRevisionById(id:string, actor:AuthenticatedStaffContext, beforeReplay = false) {
    const result=await getDbPool().query('SELECT * FROM public.menu_item_revisions WHERE id = $1',[id]);
    if (!result.rows.length) throw new NotFoundError('Menu revision');
    if ((beforeReplay || result.rows[0].status === 'PENDING') && result.rows[0].submitted_by_staff_id === actor.id) {
      throw new UnprocessableEntityError('Maker-Checker Violation: Staff member cannot review a menu revision they submitted.');
    }
    await this.authorizeRevision(actor,result.rows[0],true);
  }

  static async authorizeRevision(staff: AuthenticatedStaffContext | undefined, revision: {outlet_id: string | null; menu_item_id: string}, review = false, client?: pg.PoolClient) {
    if (!staff) return; // Internal service callers; HTTP controllers always supply authenticated context.
    if (hasGlobalOutletAccess(staff)) return;
    const allowed = new Set(staff.outlets.map(outlet => outlet.outletId));
    if (revision.outlet_id) {
      if (!allowed.has(revision.outlet_id)) throw new ForbiddenError('No access to this revision outlet');
      return;
    }
    const allocations = await (client || getDbPool()).query(runtimeContextEnabled()
      ? 'SELECT outlet_id FROM pali_runtime.catalog_outlets($1)'
      : 'SELECT outlet_id FROM public.outlet_menu_items WHERE menu_item_id = $1', [revision.menu_item_id]);
    const scope = allocations.rows.map(row => row.outlet_id as string);
    if (!scope.length || (review ? !scope.every(outlet => allowed.has(outlet)) : !scope.some(outlet => allowed.has(outlet)))) {
      throw new ForbiddenError(review ? 'Shared catalog review requires access to every affected outlet' : 'No access to this shared catalog item');
    }
  }

  /**
   * Retrieves the effective menu for a given outlet from public_outlet_menu.
   * Enforces integer paise, excludes internal staff/audit metadata,
   * groups by category, and sorts by display order.
   */
  static async getOutletMenu(outletId: string): Promise<OutletMenuResponse> {
    const pool = getDbPool();

    // 1. Verify outlet existence and active status
    const outletRes = await pool.query(
      'SELECT id, name, is_active FROM public.outlets WHERE id = $1',
      [outletId]
    );

    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet '${outletId}'`);
    }

    if (!outletRes.rows[0].is_active) {
      throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
    }

    // 2. Query safe public_outlet_menu view (security_invoker = true)
    const query = `
      SELECT 
        outlet_id,
        category_id,
        category_name,
        category_code,
        category_display_order,
        item_id,
        item_name,
        description,
        effective_price_paise,
        gst_rate_percent,
        is_vegetarian,
        is_vegan,
        is_spicy,
        preparation_time_minutes,
        image_url,
        is_available,
        kitchen_station_code,
        item_display_order
      FROM ${runtimeContextEnabled() ? 'pali_runtime' : 'public'}.public_outlet_menu
      WHERE outlet_id = $1
      ORDER BY category_display_order ASC, item_display_order ASC, item_name ASC;
    `;

    const result = await pool.query(query, [outletId]);

    const items: EffectiveMenuItem[] = result.rows.map((row) => ({
      itemId: row.item_id,
      name: row.item_name,
      description: row.description,
      effectivePricePaise: parseInt(row.effective_price_paise, 10),
      gstRatePercent: parseFloat(row.gst_rate_percent),
      isVegetarian: Boolean(row.is_vegetarian),
      isVegan: Boolean(row.is_vegan),
      isSpicy: Boolean(row.is_spicy),
      preparationTimeMinutes: parseInt(row.preparation_time_minutes, 10),
      imageUrl: row.image_url,
      isAvailable: Boolean(row.is_available),
      kitchenStationCode: row.kitchen_station_code,
      displayOrder: parseInt(row.item_display_order, 10),
      category: {
        id: row.category_id,
        name: row.category_name,
        code: row.category_code,
        displayOrder: parseInt(row.category_display_order, 10)
      }
    }));

    // Group items into category containers
    const categoryMap = new Map<string, GroupedCategoryMenu>();
    for (const item of items) {
      let cat = categoryMap.get(item.category.id);
      if (!cat) {
        cat = {
          id: item.category.id,
          name: item.category.name,
          code: item.category.code,
          displayOrder: item.category.displayOrder,
          items: []
        };
        categoryMap.set(item.category.id, cat);
      }
      cat.items.push(item);
    }

    return {
      outletId,
      categories: Array.from(categoryMap.values()),
      items
    };
  }

  /**
   * Retrieves all active menu categories ordered by display order.
   */
  static async getCategories(): Promise<MenuCategory[]> {
    const pool = getDbPool();
    const query = `
      SELECT id, property_id, name, code, display_order, is_active, created_at, updated_at
      FROM public.menu_categories
      WHERE is_active = true
      ORDER BY display_order ASC, name ASC;
    `;

    const result = await pool.query(query);

    return result.rows.map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      name: row.name,
      code: row.code,
      displayOrder: parseInt(row.display_order, 10),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at.toISOString ? row.updated_at.toISOString() : String(row.updated_at)
    }));
  }

  /**
   * Retrieves a single master catalog item by ID along with its category
   * and all current outlet allocations and overrides.
   */
  static async getMenuItemById(itemId: string, actor?: AuthenticatedStaffContext): Promise<MenuItemDetailResponse> {
    const pool = getDbPool();

    // 1. Fetch master item
    const itemQuery = `
      SELECT 
        mi.id, mi.property_id, mi.category_id, mi.name, mi.description,
        mi.base_price_paise, mi.gst_rate_percent, mi.is_vegetarian, mi.is_vegan,
        mi.is_spicy, mi.preparation_time_minutes, mi.image_url,
        mi.target_kitchen_station_code, mi.is_active, mi.archived_at,
        mi.created_at, mi.updated_at,
        mc.name AS category_name, mc.code AS category_code
      FROM public.menu_items mi
      JOIN public.menu_categories mc ON mc.id = mi.category_id
      WHERE mi.id = $1;
    `;

    const itemRes = await pool.query(itemQuery, [itemId]);
    if (itemRes.rows.length === 0 || itemRes.rows[0].archived_at !== null) {
      throw new NotFoundError(`Menu item '${itemId}'`);
    }

    const row = itemRes.rows[0];
    if (actor) await this.authorizeRevision(actor,{outlet_id:null,menu_item_id:itemId});
    const basePricePaise = parseInt(row.base_price_paise, 10);

    // 2. Fetch outlet allocations
    const allocQuery = `
      SELECT 
        omi.outlet_id, o.name AS outlet_name, omi.price_override_paise,
        omi.is_available, omi.kitchen_station_override_code, omi.display_order
      FROM public.outlet_menu_items omi
      JOIN public.outlets o ON o.id = omi.outlet_id
      WHERE omi.menu_item_id = $1
        ${actor && !hasGlobalOutletAccess(actor) ? 'AND omi.outlet_id = ANY($2::varchar[])' : ''}
      ORDER BY omi.display_order ASC, o.name ASC;
    `;

    const allocRes = await pool.query(allocQuery, actor && !hasGlobalOutletAccess(actor) ? [itemId,actor.outlets.map(outlet=>outlet.outletId)] : [itemId]);
    const outletAllocations: OutletAllocationDetail[] = allocRes.rows.map((a) => {
      const priceOverride = a.price_override_paise !== null ? parseInt(a.price_override_paise, 10) : null;
      return {
        outletId: a.outlet_id,
        outletName: a.outlet_name,
        priceOverridePaise: priceOverride,
        effectivePricePaise: priceOverride !== null ? priceOverride : basePricePaise,
        isAvailable: Boolean(a.is_available),
        kitchenStationOverrideCode: a.kitchen_station_override_code,
        displayOrder: parseInt(a.display_order, 10)
      };
    });

    return {
      id: row.id,
      propertyId: row.property_id,
      categoryId: row.category_id,
      category: {
        id: row.category_id,
        name: row.category_name,
        code: row.category_code
      },
      name: row.name,
      description: row.description,
      basePricePaise,
      gstRatePercent: parseFloat(row.gst_rate_percent),
      isVegetarian: Boolean(row.is_vegetarian),
      isVegan: Boolean(row.is_vegan),
      isSpicy: Boolean(row.is_spicy),
      preparationTimeMinutes: parseInt(row.preparation_time_minutes, 10),
      imageUrl: row.image_url,
      targetKitchenStationCode: row.target_kitchen_station_code,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at.toISOString ? row.updated_at.toISOString() : String(row.updated_at),
      outletAllocations
    };
  }

  /**
   * Submits a proposal to menu_item_revisions (status = 'PENDING').
   * Validates target kitchen station, category, price, and captures canonical previous_data.
   * Derives submitted_by_staff_id strictly from authenticated staff context.
   */
  static async createMenuRevision(
    data: {
      menuItemId: string;
      outletId?: string | null;
      changeSummary: string;
      effectiveFrom?: string | null;
      proposedData: ProposedMasterItemData | ProposedOutletItemData;
    },
    actorStaffId: string,
    requestId: string,
    ipAddress?: string | null,
    client?: pg.PoolClient
  ): Promise<MenuRevisionResponse> {
    if (!client) {
      return withTransaction(transaction => this.createMenuRevision(data, actorStaffId, requestId, ipAddress, transaction));
    }
    const queryRunner = client || getDbPool();
    const outletFields = new Set(['priceOverridePaise', 'isAvailable', 'kitchenStationOverrideCode', 'displayOrder']);
    if (Object.keys(data.proposedData).some(key => data.outletId ? !outletFields.has(key) : outletFields.has(key))) {
      throw new BadRequestError('Master and outlet proposal fields must use separate scopes');
    }


    // 1. Verify menu item exists and is active
    const itemRes = await queryRunner.query(
      `SELECT id, category_id, name, description, base_price_paise,
              gst_rate_percent, is_vegetarian, is_vegan, is_spicy,
              preparation_time_minutes, image_url, target_kitchen_station_code,
              is_active, archived_at
       FROM public.menu_items
       WHERE id = $1 FOR UPDATE`,
      [data.menuItemId]
    );

    if (itemRes.rows.length === 0 || itemRes.rows[0].archived_at !== null) {
      throw new NotFoundError(`Menu item '${data.menuItemId}'`);
    }

    const currentItem = itemRes.rows[0];
    let previousData: Record<string, unknown> = {};

    // 2. Validate outlet scope & previous data capture
    if (data.outletId) {
      // Validate outlet existence
      const outletRes = await queryRunner.query(
        'SELECT id, name, is_active FROM public.outlets WHERE id = $1',
        [data.outletId]
      );
      if (outletRes.rows.length === 0) {
        throw new NotFoundError(`Outlet '${data.outletId}'`);
      }

      const proposedOutlet = data.proposedData as ProposedOutletItemData;

      // Validate station override if specified
      if (proposedOutlet.kitchenStationOverrideCode) {
        const stationRes = await queryRunner.query(
          `SELECT id FROM public.kitchen_stations
           WHERE outlet_id = $1 AND code = $2 AND is_active = true`,
          [data.outletId, proposedOutlet.kitchenStationOverrideCode]
        );
        if (stationRes.rows.length === 0) {
          throw new BadRequestError(
            `Kitchen station '${proposedOutlet.kitchenStationOverrideCode}' does not exist or is inactive for outlet '${data.outletId}'`
          );
        }
      }

      // Capture existing outlet allocation
      const currentAllocRes = await queryRunner.query(
        `SELECT price_override_paise, is_available, kitchen_station_override_code, display_order
         FROM public.outlet_menu_items
         WHERE outlet_id = $1 AND menu_item_id = $2`,
        [data.outletId, data.menuItemId]
      );

      if (currentAllocRes.rows.length > 0) {
        const alloc = currentAllocRes.rows[0];
        previousData = {
          priceOverridePaise: alloc.price_override_paise !== null ? parseInt(alloc.price_override_paise, 10) : null,
          isAvailable: Boolean(alloc.is_available),
          kitchenStationOverrideCode: alloc.kitchen_station_override_code,
          displayOrder: parseInt(alloc.display_order, 10)
        };
      } else {
        previousData = {
          priceOverridePaise: null,
          isAvailable: true,
          kitchenStationOverrideCode: null,
          displayOrder: 0
        };
      }
    } else {
      // Master item revision
      const proposedMaster = data.proposedData as ProposedMasterItemData;

      // Validate category if specified
      if (proposedMaster.categoryId) {
        const catRes = await queryRunner.query(
          'SELECT id FROM public.menu_categories WHERE id = $1 AND is_active = true',
          [proposedMaster.categoryId]
        );
        if (catRes.rows.length === 0) {
          throw new BadRequestError(`Menu category '${proposedMaster.categoryId}' does not exist or is inactive`);
        }
      }

      // Validate master kitchen station code
      if (proposedMaster.targetKitchenStationCode) {
        const stationRes = await queryRunner.query(
          'SELECT DISTINCT code FROM public.kitchen_stations WHERE code = $1 AND is_active = true',
          [proposedMaster.targetKitchenStationCode]
        );
        if (stationRes.rows.length === 0) {
          throw new BadRequestError(`Invalid target kitchen station code '${proposedMaster.targetKitchenStationCode}'`);
        }
      }

      previousData = {
        name: currentItem.name,
        description: currentItem.description,
        basePricePaise: parseInt(currentItem.base_price_paise, 10),
        gstRatePercent: parseFloat(currentItem.gst_rate_percent),
        isVegetarian: Boolean(currentItem.is_vegetarian),
        isVegan: Boolean(currentItem.is_vegan),
        isSpicy: Boolean(currentItem.is_spicy),
        preparationTimeMinutes: parseInt(currentItem.preparation_time_minutes, 10),
        imageUrl: currentItem.image_url,
        targetKitchenStationCode: currentItem.target_kitchen_station_code,
        isActive: Boolean(currentItem.is_active),
        categoryId: currentItem.category_id
      };
    }

    // 3. Compute next revision number
    const revNumRes = await queryRunner.query(
      `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_rev
       FROM public.menu_item_revisions
       WHERE menu_item_id = $1`,
      [data.menuItemId]
    );
    const revisionNumber = parseInt(revNumRes.rows[0].next_rev, 10);

    // 4. Insert revision into queue
    const insertQuery = `
      INSERT INTO public.menu_item_revisions (
        menu_item_id, outlet_id, revision_number, change_summary,
        proposed_data, previous_data, status, effective_from,
        submitted_by_staff_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)
      RETURNING id, menu_item_id, outlet_id, revision_number, change_summary,
                proposed_data, previous_data, status, effective_from,
                submitted_by_staff_id, created_at;
    `;

    const insertValues = [
      data.menuItemId,
      data.outletId || null,
      revisionNumber,
      data.changeSummary,
      JSON.stringify(data.proposedData),
      JSON.stringify(previousData),
      data.effectiveFrom ? new Date(data.effectiveFrom) : null,
      actorStaffId
    ];

    const insertRes = await queryRunner.query(insertQuery, insertValues);
    const rev = insertRes.rows[0];

    // 5. Write audit log entry
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: actorStaffId,
        action: 'MENU_REVISION_CREATED',
        entityType: 'menu_item_revisions',
        entityId: rev.id,
        outletId: data.outletId || null,
        oldState: null,
        newState: {
          revisionNumber,
          menuItemId: data.menuItemId,
          outletId: data.outletId || null,
          changeSummary: data.changeSummary,
          proposedData: data.proposedData
        },
        requestId,
        ipAddress
      },
      client
    );

    return {
      id: rev.id,
      menuItemId: rev.menu_item_id,
      menuItemName: currentItem.name,
      outletId: rev.outlet_id,
      revisionNumber: rev.revision_number,
      changeSummary: rev.change_summary,
      proposedData: rev.proposed_data,
      previousData: rev.previous_data,
      status: rev.status,
      effectiveFrom: rev.effective_from ? rev.effective_from.toISOString() : null,
      submittedByStaffId: rev.submitted_by_staff_id,
      createdAt: rev.created_at.toISOString ? rev.created_at.toISOString() : String(rev.created_at)
    };
  }

  /**
   * Lists revisions with optional filtering by status, item, or outlet.
   */
  static async listMenuRevisions(filters: {
    status?: string;
    menuItemId?: string;
    outletId?: string;
    limit: number;
    offset: number;
  }, actor?: AuthenticatedStaffContext): Promise<{ total: number; revisions: MenuRevisionResponse[] }> {
    const pool = getDbPool();
    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereClauses.push(`r.status = $${paramIndex++}`);
      values.push(filters.status);
    }
    if (filters.menuItemId) {
      whereClauses.push(`r.menu_item_id = $${paramIndex++}`);
      values.push(filters.menuItemId);
    }
    if (filters.outletId) {
      whereClauses.push(`r.outlet_id = $${paramIndex++}`);
      values.push(filters.outletId);
    }

    if (actor && !hasGlobalOutletAccess(actor)) {
      const scopeIndex = paramIndex++;
      values.push(actor.outlets.map(outlet => outlet.outletId));
      whereClauses.push(`(r.outlet_id = ANY($${scopeIndex}::varchar[]) OR (r.outlet_id IS NULL AND EXISTS (
        SELECT 1 FROM public.outlet_menu_items access_alloc WHERE access_alloc.menu_item_id=r.menu_item_id
        AND access_alloc.outlet_id=ANY($${scopeIndex}::varchar[]))))`);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.menu_item_revisions r ${whereSql}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    // Page items
    const query = `
      SELECT 
        r.id, r.menu_item_id, r.outlet_id, r.revision_number, r.change_summary,
        r.proposed_data, r.previous_data, r.status, r.effective_from,
        r.submitted_by_staff_id, r.created_at,
        mi.name AS menu_item_name,
        CONCAT(s.first_name, ' ', s.last_name) AS submitter_name
      FROM public.menu_item_revisions r
      JOIN public.menu_items mi ON mi.id = r.menu_item_id
      JOIN public.staff s ON s.id = r.submitted_by_staff_id
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    values.push(filters.limit, filters.offset);
    const listRes = await pool.query(query, values);

    const revisions: MenuRevisionResponse[] = listRes.rows.map((row) => ({
      id: row.id,
      menuItemId: row.menu_item_id,
      menuItemName: row.menu_item_name,
      outletId: row.outlet_id,
      revisionNumber: parseInt(row.revision_number, 10),
      changeSummary: row.change_summary,
      proposedData: row.proposed_data,
      previousData: row.previous_data,
      status: row.status,
      effectiveFrom: row.effective_from ? row.effective_from.toISOString() : null,
      submittedByStaffId: row.submitted_by_staff_id,
      submitterName: row.submitter_name?.trim() || undefined,
      createdAt: row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at)
    }));

    return { total, revisions };
  }

  /**
   * Retrieves single revision with maker details and approval audit history.
   */
  static async getMenuRevisionById(revisionId: string, actor?: AuthenticatedStaffContext, review = false): Promise<MenuRevisionResponse> {
    const pool = getDbPool();

    const revQuery = `
      SELECT 
        r.id, r.menu_item_id, r.outlet_id, r.revision_number, r.change_summary,
        r.proposed_data, r.previous_data, r.status, r.effective_from,
        r.submitted_by_staff_id, r.created_at,
        mi.name AS menu_item_name,
        CONCAT(s.first_name, ' ', s.last_name) AS submitter_name
      FROM public.menu_item_revisions r
      JOIN public.menu_items mi ON mi.id = r.menu_item_id
      JOIN public.staff s ON s.id = r.submitted_by_staff_id
      WHERE r.id = $1;
    `;

    const revRes = await pool.query(revQuery, [revisionId]);
    if (revRes.rows.length === 0) {
      throw new NotFoundError(`Menu revision '${revisionId}'`);
    }

    const row = revRes.rows[0];

    await this.authorizeRevision(actor, row, review);

    // Fetch approvals
    const appQuery = `
      SELECT 
        mra.id, mra.revision_id, mra.action, mra.reviewed_by_staff_id,
        mra.review_notes, mra.reviewed_at,
        CONCAT(s.first_name, ' ', s.last_name) AS reviewer_name
      FROM public.menu_revision_approvals mra
      JOIN public.staff s ON s.id = mra.reviewed_by_staff_id
      WHERE mra.revision_id = $1
      ORDER BY mra.reviewed_at ASC;
    `;

    const appRes = await pool.query(appQuery, [revisionId]);
    const approvals = appRes.rows.map((a) => ({
      id: a.id,
      revisionId: a.revision_id,
      action: a.action as 'APPROVED' | 'REJECTED',
      reviewedByStaffId: a.reviewed_by_staff_id,
      reviewerName: a.reviewer_name?.trim() || undefined,
      reviewNotes: a.review_notes,
      reviewedAt: a.reviewed_at.toISOString ? a.reviewed_at.toISOString() : String(a.reviewed_at)
    }));

    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      menuItemName: row.menu_item_name,
      outletId: row.outlet_id,
      revisionNumber: parseInt(row.revision_number, 10),
      changeSummary: row.change_summary,
      proposedData: row.proposed_data,
      previousData: row.previous_data,
      status: row.status,
      effectiveFrom: row.effective_from ? row.effective_from.toISOString() : null,
      submittedByStaffId: row.submitted_by_staff_id,
      submitterName: row.submitter_name?.trim() || undefined,
      createdAt: row.created_at.toISOString ? row.created_at.toISOString() : String(row.created_at),
      approvals
    };
  }

  /**
   * Approves a revision in a single atomic transaction:
   * 1. SELECT ... FOR UPDATE (locks revision)
   * 2. Enforces Maker-Checker: reviewer !== submitter (throws 422)
   * 3. Validates status: must be PENDING (throws 409 if already resolved)
   * 4. Inserts menu_revision_approvals record
   * 5. Mutates live catalog: menu_items or outlet_menu_items
   * 6. Updates revision status to APPROVED
   * 7. Writes audit log entry
   * 8. Emits outlet_event_log entry inside the transaction
   * 9. Broadcasts realtime notification
   */
  static async approveMenuRevision(
    revisionId: string,
    reviewerStaffId: string,
    reviewNotes?: string,
    requestId?: string,
    ipAddress?: string | null,
    actor?: AuthenticatedStaffContext
  ): Promise<{ approvalId: string; revisionId: string; status: 'APPROVED' }> {
    return await withTransaction(async (client) => {
      // 1. Lock revision record for update
      const revRes = await client.query(
        'SELECT * FROM public.menu_item_revisions WHERE id = $1 FOR UPDATE',
        [revisionId]
      );

      if (revRes.rows.length === 0) {
        throw new NotFoundError(`Menu revision '${revisionId}'`);
      }

      const revision = revRes.rows[0];
      await client.query('SELECT id FROM public.menu_items WHERE id=$1 FOR UPDATE',[revision.menu_item_id]);
      await this.authorizeRevision(actor, revision, true, client);

      // 2. Validate revision lifecycle state
      if (revision.status === 'APPROVED') {
        throw new ConflictError('This menu revision has already been approved');
      }
      if (revision.status === 'REJECTED') {
        throw new ConflictError('This menu revision was rejected and cannot be approved');
      }
      if (revision.status !== 'PENDING') {
        throw new ConflictError(`Cannot approve revision in status '${revision.status}'`);
      }

      // 3. Maker-Checker check (service level validation for clear 422 error before trigger fires)
      if (revision.submitted_by_staff_id === reviewerStaffId) {
        throw new UnprocessableEntityError(
          'Maker-Checker Violation: Staff member cannot approve a menu revision they submitted.'
        );
      }

      // 4. Insert approval record (trigger trg_menu_revision_maker_checker runs as second defense)
      const approvalRes = await client.query(
        `INSERT INTO public.menu_revision_approvals (
          revision_id, action, reviewed_by_staff_id, review_notes
        ) VALUES ($1, 'APPROVED', $2, $3)
        RETURNING id, reviewed_at;`,
        [revisionId, reviewerStaffId, reviewNotes || null]
      );
      const approvalId = approvalRes.rows[0].id;

      // 5. Apply approved changes to live catalog
      const proposed = revision.proposed_data as Record<string, any>;

      if (revision.outlet_id) {
        // Apply to outlet_menu_items (upsert)
        const currentAlloc = await client.query(
          'SELECT * FROM public.outlet_menu_items WHERE outlet_id = $1 AND menu_item_id = $2',
          [revision.outlet_id, revision.menu_item_id]
        );

        if (currentAlloc.rows.length > 0) {
          const updates: string[] = [];
          const values: unknown[] = [revision.outlet_id, revision.menu_item_id];
          let pIdx = 3;

          if (proposed.priceOverridePaise !== undefined) {
            updates.push(`price_override_paise = $${pIdx++}`);
            values.push(proposed.priceOverridePaise);
          }
          if (proposed.isAvailable !== undefined) {
            updates.push(`is_available = $${pIdx++}`);
            values.push(proposed.isAvailable);
          }
          if (proposed.kitchenStationOverrideCode !== undefined) {
            updates.push(`kitchen_station_override_code = $${pIdx++}`);
            values.push(proposed.kitchenStationOverrideCode);
          }
          if (proposed.displayOrder !== undefined) {
            updates.push(`display_order = $${pIdx++}`);
            values.push(proposed.displayOrder);
          }

          updates.push('updated_at = CURRENT_TIMESTAMP');

          await client.query(
            `UPDATE public.outlet_menu_items
             SET ${updates.join(', ')}
             WHERE outlet_id = $1 AND menu_item_id = $2`,
            values
          );
        } else {
          // New allocation
          await client.query(
            `INSERT INTO public.outlet_menu_items (
              outlet_id, menu_item_id, price_override_paise, is_available,
              kitchen_station_override_code, display_order, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
            [
              revision.outlet_id,
              revision.menu_item_id,
              proposed.priceOverridePaise ?? null,
              proposed.isAvailable ?? true,
              proposed.kitchenStationOverrideCode ?? null,
              proposed.displayOrder ?? 0
            ]
          );
        }
      } else {
        // Master menu item update
        const updates: string[] = [];
        const values: unknown[] = [revision.menu_item_id];
        let pIdx = 2;

        if (proposed.name !== undefined) {
          updates.push(`name = $${pIdx++}`);
          values.push(proposed.name);
        }
        if (proposed.description !== undefined) {
          updates.push(`description = $${pIdx++}`);
          values.push(proposed.description);
        }
        if (proposed.basePricePaise !== undefined) {
          updates.push(`base_price_paise = $${pIdx++}`);
          values.push(proposed.basePricePaise);
        }
        if (proposed.gstRatePercent !== undefined) {
          updates.push(`gst_rate_percent = $${pIdx++}`);
          values.push(proposed.gstRatePercent);
        }
        if (proposed.isVegetarian !== undefined) {
          updates.push(`is_vegetarian = $${pIdx++}`);
          values.push(proposed.isVegetarian);
        }
        if (proposed.isVegan !== undefined) {
          updates.push(`is_vegan = $${pIdx++}`);
          values.push(proposed.isVegan);
        }
        if (proposed.isSpicy !== undefined) {
          updates.push(`is_spicy = $${pIdx++}`);
          values.push(proposed.isSpicy);
        }
        if (proposed.preparationTimeMinutes !== undefined) {
          updates.push(`preparation_time_minutes = $${pIdx++}`);
          values.push(proposed.preparationTimeMinutes);
        }
        if (proposed.imageUrl !== undefined) {
          updates.push(`image_url = $${pIdx++}`);
          values.push(proposed.imageUrl);
        }
        if (proposed.targetKitchenStationCode !== undefined) {
          updates.push(`target_kitchen_station_code = $${pIdx++}`);
          values.push(proposed.targetKitchenStationCode);
        }
        if (proposed.isActive !== undefined) {
          updates.push(`is_active = $${pIdx++}`);
          values.push(proposed.isActive);
        }
        if (proposed.categoryId !== undefined) {
          updates.push(`category_id = $${pIdx++}`);
          values.push(proposed.categoryId);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length > 1) {
          await client.query(
            `UPDATE public.menu_items
             SET ${updates.join(', ')}
             WHERE id = $1`,
            values
          );
        }
      }

      // 6. Update revision status to APPROVED
      await client.query(
        "UPDATE public.menu_item_revisions SET status = 'APPROVED' WHERE id = $1",
        [revisionId]
      );

      // 7. Write audit log entry in the same transaction
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: reviewerStaffId,
          action: 'MENU_REVISION_APPROVED',
          entityType: 'menu_item_revisions',
          entityId: revisionId,
          outletId: revision.outlet_id || null,
          oldState: revision.previous_data,
          newState: {
            status: 'APPROVED',
            appliedChanges: revision.proposed_data,
            reviewNotes: reviewNotes || null
          },
          requestId: requestId || 'unknown',
          ipAddress
        },
        client
      );

      // 8. Write outlet_event_log in the same transaction for transactional consistency
      const targetOutlets: string[] = [];
      if (revision.outlet_id) {
        targetOutlets.push(revision.outlet_id);
      } else {
        // Query outlets that stock this item
        const outletsRes = await client.query(
          'SELECT DISTINCT outlet_id FROM public.outlet_menu_items WHERE menu_item_id = $1',
          [revision.menu_item_id]
        );
        for (const r of outletsRes.rows) {
          targetOutlets.push(r.outlet_id);
        }
      }

      for (const outId of targetOutlets) {
        const pubEvent = await publishOutletEvent(
          {
            outletId: outId,
            channel: 'menu',
            eventType: 'MENU_ITEM_UPDATED',
            entityId: revision.menu_item_id,
            payload: {
              menuItemId: revision.menu_item_id,
              outletId: outId,
              revisionId
            }
          },
          client
        );

        // Broadcast non-blocking via realtime broadcaster
        realtimeBroadcaster.publish({
          outletId: outId,
          channel: 'menu' as any,
          sequenceNumber: parseInt(pubEvent.sequenceNumber, 10) || 1,
          eventType: 'MENU_ITEM_UPDATED',
          payload: { menuItemId: revision.menu_item_id, outletId: outId },
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }

      return {
        approvalId,
        revisionId,
        status: 'APPROVED'
      };
    });
  }

  /**
   * Rejects a revision in a single atomic transaction:
   * 1. SELECT ... FOR UPDATE (locks revision)
   * 2. Enforces Maker-Checker: reviewer !== submitter (throws 422)
   * 3. Validates status: must be PENDING (throws 409 if already resolved)
   * 4. Inserts menu_revision_approvals record with action = 'REJECTED'
   * 5. Updates revision status to REJECTED
   * 6. Live menu tables remain completely untouched
   * 7. Writes audit log entry
   */
  static async rejectMenuRevision(
    revisionId: string,
    reviewerStaffId: string,
    reviewNotes?: string,
    requestId?: string,
    ipAddress?: string | null,
    actor?: AuthenticatedStaffContext
  ): Promise<{ approvalId: string; revisionId: string; status: 'REJECTED' }> {
    return await withTransaction(async (client) => {
      // 1. Lock revision
      const revRes = await client.query(
        'SELECT * FROM public.menu_item_revisions WHERE id = $1 FOR UPDATE',
        [revisionId]
      );

      if (revRes.rows.length === 0) {
        throw new NotFoundError(`Menu revision '${revisionId}'`);
      }

      const revision = revRes.rows[0];
      await this.authorizeRevision(actor, revision, true, client);

      // 2. Status validation
      if (revision.status === 'APPROVED') {
        throw new ConflictError('This menu revision has already been approved');
      }
      if (revision.status === 'REJECTED') {
        throw new ConflictError('This menu revision has already been rejected');
      }
      if (revision.status !== 'PENDING') {
        throw new ConflictError(`Cannot reject revision in status '${revision.status}'`);
      }

      // 3. Maker-Checker check
      if (revision.submitted_by_staff_id === reviewerStaffId) {
        throw new UnprocessableEntityError(
          'Maker-Checker Violation: Staff member cannot reject a menu revision they submitted.'
        );
      }

      // 4. Insert rejection approval record
      const approvalRes = await client.query(
        `INSERT INTO public.menu_revision_approvals (
          revision_id, action, reviewed_by_staff_id, review_notes
        ) VALUES ($1, 'REJECTED', $2, $3)
        RETURNING id, reviewed_at;`,
        [revisionId, reviewerStaffId, reviewNotes || null]
      );
      const approvalId = approvalRes.rows[0].id;

      // 5. Update revision status to REJECTED (live catalog data is NOT touched)
      await client.query(
        "UPDATE public.menu_item_revisions SET status = 'REJECTED' WHERE id = $1",
        [revisionId]
      );

      // 6. Write audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: reviewerStaffId,
          action: 'MENU_REVISION_REJECTED',
          entityType: 'menu_item_revisions',
          entityId: revisionId,
          outletId: revision.outlet_id || null,
          oldState: { status: 'PENDING' },
          newState: {
            status: 'REJECTED',
            reviewNotes: reviewNotes || null
          },
          requestId: requestId || 'unknown',
          ipAddress
        },
        client
      );

      return {
        approvalId,
        revisionId,
        status: 'REJECTED'
      };
    });
  }

  /**
   * Retrieves guest-safe read-only menu for public dining guests.
   * Excludes all internal kitchen routing, cost margins, staff configs, and audit metadata.
   * Returns only guest-safe fields: category, name, description, price_paise, veg flag, availability, image.
   * All amounts in integer paise.
   */
  static async getGuestSafeMenu(outletId: string): Promise<{
    outletId: string;
    categories: Array<{ id: string; name: string }>;
    items: Array<{
      id: string;
      category: string;
      sectionName: string | null;
      categoryId: string;
      name: string;
      description: string;
      price_paise: number;
      pricePaise: number;
      is_veg: boolean;
      isVeg: boolean;
      is_available: boolean;
      isAvailable: boolean;
      image: string;
      imageUrl: string;
    }>;
  }> {
    const pool = getDbPool();

    // 1. Verify outlet existence and active status
    const outletRes = await pool.query(
      'SELECT id, name, is_active FROM public.outlets WHERE id = $1',
      [outletId]
    );

    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet '${outletId}'`);
    }

    if (!outletRes.rows[0].is_active) {
      throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
    }

    // 2. Query safe public_outlet_menu view
    const query = `
      SELECT 
        item_id,
        item_name,
        description,
        effective_price_paise,
        is_vegetarian,
        is_available,
        image_url,
        category_id,
        category_name,
        section_name,
        category_display_order,
        item_display_order
      FROM ${runtimeContextEnabled() ? 'pali_runtime' : 'public'}.public_outlet_menu
      WHERE outlet_id = $1
      ORDER BY category_display_order ASC, item_display_order ASC, item_name ASC;
    `;

    const res = await pool.query(query, [outletId]);

    const categoriesMap = new Map<string, string>();
    const items = res.rows.map((row) => {
      categoriesMap.set(row.category_id, row.category_name);
      const pricePaise = parseInt(row.effective_price_paise, 10);
      const isVeg = Boolean(row.is_vegetarian);
      const isAvail = Boolean(row.is_available);
      const img = row.image_url || '';

      return {
        id: row.item_id,
        category: row.category_name,
        sectionName: row.section_name ?? null,
        categoryId: row.category_id,
        name: row.item_name,
        description: row.description || '',
        price_paise: pricePaise,
        pricePaise,
        is_veg: isVeg,
        isVeg,
        is_available: isAvail,
        isAvailable: isAvail,
        image: img,
        imageUrl: img
      };
    });

    const categories = Array.from(categoriesMap.entries()).map(([id, name]) => ({
      id,
      name
    }));

    return {
      outletId,
      categories,
      items
    };
  }

  /**
   * Direct menu item creation for authorized staff (RESTAURANT_OWNER, SUPER_ADMIN, KITCHEN_EXECUTIVE).
   * Inserts into public.menu_items and associates with outlet_menu_items.
   * Records audit trail and emits realtime event.
   */
  static async createMenuItem(
    outletId: string,
    data: {
      name: string;
      description?: string | null;
      categoryId: string;
      priceRupees?: number;
      basePricePaise?: number;
      gstRatePercent?: number;
      isVegetarian?: boolean;
      isVegan?: boolean;
      isSpicy?: boolean;
      preparationTimeMinutes?: number;
      imageUrl?: string | null;
      targetKitchenStationCode?: string;
      displayOrder?: number;
    },
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<any> {
    const pool = getDbPool();

    // 1. Resolve property from outlet
    const outletRes = await pool.query('SELECT property_id, is_active FROM public.outlets WHERE id = $1;', [outletId]);
    if (outletRes.rows.length === 0) {
      throw new NotFoundError(`Outlet '${outletId}'`);
    }
    const propertyId = outletRes.rows[0].property_id;

    if (!outletRes.rows[0].is_active) throw new BadRequestError('Outlet is inactive');
    const catCheck = await pool.query(
      'SELECT id FROM public.menu_categories WHERE id::text = $1 AND property_id = $2 AND is_active = true;',
      [data.categoryId, propertyId]
    );
    if (!catCheck.rows.length) throw new BadRequestError('Select an active category belonging to this property');
    const categoryId = catCheck.rows[0].id;

    // 3. Centralized price conversion
    const basePricePaise = data.basePricePaise !== undefined 
      ? data.basePricePaise 
      : data.priceRupees !== undefined 
      ? rupeesToPaise(data.priceRupees) 
      : 0;

    const prepTime = data.preparationTimeMinutes || 15;
    const gstRate = data.gstRatePercent !== undefined ? data.gstRatePercent : 5.0;
    const stationCode = (data.targetKitchenStationCode || 'CURRY').toUpperCase();

    return await withTransaction(async (client) => {
      // 4. Insert master item
      const insertItemQuery = `
        INSERT INTO public.menu_items (
          property_id, category_id, name, description,
          base_price_paise, gst_rate_percent, is_vegetarian, is_vegan, is_spicy,
          preparation_time_minutes, image_url, target_kitchen_station_code, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        RETURNING *;
      `;

      const itemRes = await client.query(insertItemQuery, [
        propertyId,
        categoryId,
        data.name.trim(),
        data.description || null,
        basePricePaise,
        gstRate,
        Boolean(data.isVegetarian),
        Boolean(data.isVegan),
        Boolean(data.isSpicy),
        prepTime,
        data.imageUrl || null,
        stationCode
      ]);

      const newItem = itemRes.rows[0];

      // 5. Insert allocation into outlet_menu_items
      await client.query(`
        INSERT INTO public.outlet_menu_items (
          outlet_id, menu_item_id, price_override_paise, is_available,
          kitchen_station_override_code, display_order
        ) VALUES ($1, $2, NULL, true, NULL, $3)
        ON CONFLICT (outlet_id, menu_item_id) DO UPDATE SET
          is_available = true;
      `, [outletId, newItem.id, data.displayOrder || 0]);

      // 6. Audit log entry
      await writeAuditLog({
        actorType: 'STAFF',
        actorId: staffId,
        action: 'MENU_ITEM_CREATED',
        entityType: 'menu_items',
        entityId: newItem.id,
        outletId,
        newState: {
          id: newItem.id,
          name: newItem.name,
          basePricePaise,
          stationCode,
          outletId
        },
        requestId: reqCorrelationId || 'unknown',
        ipAddress: ipAddress || null
      }, client);

      return {
        id: newItem.id,
        name: newItem.name,
        description: newItem.description,
        categoryId: newItem.category_id,
        basePricePaise,
        effectivePricePaise: basePricePaise,
        gstRatePercent: gstRate,
        isVegetarian: newItem.is_vegetarian,
        isVegan: newItem.is_vegan,
        isSpicy: newItem.is_spicy,
        preparationTimeMinutes: newItem.preparation_time_minutes,
        imageUrl: newItem.image_url,
        targetKitchenStationCode: newItem.target_kitchen_station_code,
        isAvailable: true,
        displayOrder: data.displayOrder || 0
      };
    });
  }

  /**
   * Direct menu item update for authorized staff.
   * Updates master item details and outlet overrides.
   */
  static async updateMenuItem(
    outletId: string, itemId: string,
    data: { name?: string; description?: string | null; categoryId?: string;
      priceRupees?: number; basePricePaise?: number; gstRatePercent?: number;
      isVegetarian?: boolean; isVegan?: boolean; isSpicy?: boolean;
      preparationTimeMinutes?: number; imageUrl?: string | null;
      targetKitchenStationCode?: string; displayOrder?: number; isAvailable?: boolean },
    staffId: string, reqCorrelationId?: string, ipAddress?: string | null
  ): Promise<any> {
    return withTransaction(async client => {
      const outlet = await client.query('SELECT property_id, is_active FROM public.outlets WHERE id=$1 FOR SHARE', [outletId]);
      if (!outlet.rows.length) throw new NotFoundError('Outlet');
      if (!outlet.rows[0].is_active) throw new ConflictError('Outlet is inactive');
      const existing = await client.query(
        'SELECT mi.* FROM public.menu_items mi JOIN public.outlet_menu_items omi ON omi.menu_item_id=mi.id WHERE mi.id=$1 AND omi.outlet_id=$2 FOR UPDATE OF mi, omi',
        [itemId, outletId]);
      if (!existing.rows.length) throw new NotFoundError('Menu item allocation');
      const current = existing.rows[0];
      if (current.property_id !== outlet.rows[0].property_id) throw new ForbiddenError('Menu item belongs to a different property');
      const masterColumns: Record<string, string> = { name: 'name', description: 'description', categoryId: 'category_id',
        gstRatePercent: 'gst_rate_percent', isVegetarian: 'is_vegetarian', isVegan: 'is_vegan', isSpicy: 'is_spicy',
        preparationTimeMinutes: 'preparation_time_minutes', imageUrl: 'image_url', targetKitchenStationCode: 'target_kitchen_station_code' };
      const normalized: Record<string, unknown> = { ...data };
      if (data.name !== undefined) normalized.name = data.name.trim();
      if (data.targetKitchenStationCode !== undefined) normalized.targetKitchenStationCode = data.targetKitchenStationCode.trim().toUpperCase();
      if (data.categoryId !== undefined) {
        const category = await client.query('SELECT id FROM public.menu_categories WHERE id::text=$1 AND property_id=$2 AND is_active=true', [data.categoryId, current.property_id]);
        if (!category.rows.length) throw new BadRequestError('Choose a valid active category for this property');
      }
      if (data.targetKitchenStationCode !== undefined) {
        const station = await client.query('SELECT id FROM public.kitchen_stations WHERE outlet_id=$1 AND code=$2 AND is_active=true', [outletId, normalized.targetKitchenStationCode]);
        if (!station.rows.length) throw new BadRequestError('Choose a valid kitchen station for this outlet');
      }
      const changes: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(masterColumns)) {
        if (normalized[key] === undefined) continue;
        const previous = ['gstRatePercent', 'preparationTimeMinutes'].includes(key) ? Number(current[column]) : current[column];
        if (normalized[key] !== previous) changes[key] = normalized[key];
      }
      const shared = await client.query(runtimeContextEnabled()
        ? 'SELECT count(*)::int AS count FROM pali_runtime.catalog_outlets($1)'
        : 'SELECT count(*)::int AS count FROM public.outlet_menu_items WHERE menu_item_id=$1', [itemId]);
      let updated = current;
      let pendingRevisionId: string | undefined;
      if (Object.keys(changes).length && shared.rows[0].count > 1) {
        const revision = await this.createMenuRevision({ menuItemId: itemId, outletId: null,
          changeSummary: 'Shared catalog changes submitted from outlet menu', proposedData: changes },
          staffId, reqCorrelationId || 'unknown', ipAddress, client);
        pendingRevisionId = revision.id;
      } else if (Object.keys(changes).length) {
        const values = Object.values(changes);
        const assignments = Object.keys(changes).map((key, index) => masterColumns[key] + '=$' + (index + 1));
        values.push(itemId);
        const changed = await client.query('UPDATE public.menu_items SET ' + assignments.join(', ') + ', updated_at=CURRENT_TIMESTAMP WHERE id=$' + values.length + ' RETURNING *', values);
        updated = changed.rows[0];
      }
      const price = data.basePricePaise !== undefined ? data.basePricePaise : data.priceRupees !== undefined ? rupeesToPaise(data.priceRupees) : null;
      const allocation = await client.query(
        'UPDATE public.outlet_menu_items SET price_override_paise=COALESCE($3,price_override_paise), is_available=COALESCE($4,is_available), display_order=COALESCE($5,display_order), updated_at=CURRENT_TIMESTAMP WHERE outlet_id=$1 AND menu_item_id=$2 RETURNING *',
        [outletId, itemId, price, data.isAvailable ?? null, data.displayOrder ?? null]);
      const effectivePricePaise = Number(allocation.rows[0].price_override_paise ?? updated.base_price_paise);
      await writeAuditLog({ actorType: 'STAFF', actorId: staffId, action: 'MENU_ITEM_UPDATED',
        entityType: 'menu_items', entityId: itemId, outletId,
        oldState: { name: current.name, basePricePaise: Number(current.base_price_paise) },
        newState: { name: updated.name, effectivePricePaise, pendingRevisionId: pendingRevisionId || null },
        requestId: reqCorrelationId || 'unknown', ipAddress: ipAddress || null }, client);
      return { id: updated.id, name: updated.name, description: updated.description, categoryId: updated.category_id,
        basePricePaise: Number(updated.base_price_paise), effectivePricePaise,
        gstRatePercent: Number(updated.gst_rate_percent), isVegetarian: updated.is_vegetarian,
        isVegan: updated.is_vegan, isSpicy: updated.is_spicy, preparationTimeMinutes: updated.preparation_time_minutes,
        imageUrl: updated.image_url, targetKitchenStationCode: updated.target_kitchen_station_code,
        isAvailable: allocation.rows[0].is_available, pendingRevisionId };
    });
  }

  /**
   * Direct stock availability toggle (86-item control) for an outlet.
   */
  static async toggleMenuItemAvailability(
    outletId: string,
    itemId: string,
    isAvailableExplicit: boolean | undefined,
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<{ itemId: string; outletId: string; isAvailable: boolean }> {
    return await withTransaction(async (client) => {
      const allocation = await client.query(`
        SELECT omi.is_available, mi.name FROM public.outlet_menu_items omi
        JOIN public.menu_items mi ON mi.id = omi.menu_item_id
        JOIN public.outlets o ON o.id = omi.outlet_id
        WHERE omi.outlet_id = $1 AND omi.menu_item_id = $2 AND o.is_active = true
        FOR UPDATE OF omi;
      `, [outletId, itemId]);
      if (!allocation.rows.length) throw new NotFoundError('Active outlet menu allocation');
      const itemName = allocation.rows[0].name;
      const currentAvail = Boolean(allocation.rows[0].is_available);
      const newAvail = isAvailableExplicit ?? !currentAvail;
      await client.query(`UPDATE public.outlet_menu_items SET is_available = $3,
        updated_at = CURRENT_TIMESTAMP WHERE outlet_id = $1 AND menu_item_id = $2;`,
        [outletId, itemId, newAvail]);

      // Write audit log
      await writeAuditLog({
        actorType: 'STAFF',
        actorId: staffId,
        action: 'MENU_ITEM_AVAILABILITY_TOGGLED',
        entityType: 'outlet_menu_items',
        entityId: itemId,
        outletId,
        oldState: { isAvailable: currentAvail },
        newState: { isAvailable: newAvail, itemName },
        requestId: reqCorrelationId || 'unknown',
        ipAddress: ipAddress || null
      }, client);

      // Publish outlet realtime event
      await publishOutletEvent({
        outletId,
        channel: 'menu',
        eventType: 'ITEM_AVAILABILITY_CHANGED',
        entityId: itemId,
        payload: { itemId, itemName, isAvailable: newAvail }
      }, client);

      return {
        itemId,
        outletId,
        isAvailable: newAvail
      };
    });
  }
}

