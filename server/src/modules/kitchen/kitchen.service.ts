import pg from 'pg';
import { getDbPool, withTransaction } from '../../db/pool.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  BadRequestError
} from '../../utils/errors.js';
import { writeAuditLog } from '../../services/audit.service.js';
import { publishOutletEvent } from '../../services/outletEvent.service.js';
import { realtimeBroadcaster } from '../../realtime/broadcaster.js';
import {
  KitchenStation,
  KotResponse,
  KotItemResponse,
  KotStatus,
  KotItemStatus,
  GenerateKotsResult
} from './kitchen.types.js';

const VALID_KOT_TRANSITIONS: Record<KotStatus, KotStatus[]> = {
  NEW: ['ACCEPTED', 'PREPARING', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: []
};

const VALID_KOT_ITEM_TRANSITIONS: Record<KotItemStatus, KotItemStatus[]> = {
  NEW: ['PREPARING', 'READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'PREPARING', 'CANCELLED'],
  SERVED: [],
  CANCELLED: []
};

function formatDate(val: any): string | null {
  if (!val) return null;
  return val.toISOString ? val.toISOString() : String(val);
}

export class KitchenService {
  /**
   * Lists physical active kitchen preparation stations for an outlet.
   */
  static async assertItemsUnbilled(client:pg.PoolClient,orderId:string) {
    const billed=await client.query(`SELECT bi.id FROM public.bill_items bi JOIN public.bills b ON b.id=bi.bill_id
      JOIN public.order_items oi ON oi.id=bi.order_item_id WHERE oi.order_id=$1 AND b.status!='VOIDED' LIMIT 1`,[orderId]);
    if(billed.rows.length) throw new ConflictError('Billed items cannot be cancelled.');
  }

  static async listStations(outletId: string): Promise<KitchenStation[]> {
    const pool = getDbPool();
    const query = `
      SELECT id, outlet_id, code, name, display_order, is_active, created_at
      FROM public.kitchen_stations WHERE outlet_id = $1 AND is_active = true
      ORDER BY display_order ASC, name ASC;
    `;
    const res = await pool.query(query, [outletId]);
    return res.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      code: row.code,
      name: row.name,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: formatDate(row.created_at) || new Date().toISOString()
    }));
  }

  /**
   * Retrieves a single KOT along with its line items.
   * Strips all financial fields, customer PII, and internal secrets.
   */
  static async getKotById(kotId: string, client?: pg.PoolClient): Promise<KotResponse> {
    const queryRunner = client || getDbPool();

    const kotQuery = `
      SELECT 
        k.id,
        k.outlet_id,
        k.order_id,
        k.station_id,
        k.kot_number,
        k.location_label_snapshot,
        k.status,
        k.accepted_at,
        k.preparing_at,
        k.ready_at,
        k.served_at,
        k.created_at,
        k.updated_at,
        s.code AS station_code,
        s.name AS station_name
      FROM public.kots k
      JOIN public.kitchen_stations s ON s.id = k.station_id
      WHERE k.id = $1;
    `;
    const kotRes = await queryRunner.query(kotQuery, [kotId]);
    if (kotRes.rows.length === 0) {
      throw new NotFoundError(`KOT '${kotId}'`);
    }

    const kotRow = kotRes.rows[0];

    const itemsQuery = `
      SELECT 
        id,
        kot_id,
        order_item_id,
        item_name_snapshot,
        quantity,
        customization_notes,
        status,
        created_at,
        updated_at
      FROM public.kot_items WHERE kot_id = $1
      ORDER BY created_at ASC;
    `;
    const itemsRes = await queryRunner.query(itemsQuery, [kotId]);

    const items: KotItemResponse[] = itemsRes.rows.map((row) => ({
      id: row.id,
      kotId: row.kot_id,
      orderItemId: row.order_item_id,
      itemName: row.item_name_snapshot,
      quantity: row.quantity,
      customizationNotes: row.customization_notes,
      status: row.status as KotItemStatus,
      createdAt: formatDate(row.created_at) || new Date().toISOString(),
      updatedAt: formatDate(row.updated_at) || new Date().toISOString()
    }));

    return {
      id: kotRow.id,
      outletId: kotRow.outlet_id,
      orderId: kotRow.order_id,
      stationId: kotRow.station_id,
      stationCode: kotRow.station_code,
      stationName: kotRow.station_name,
      kotNumber: kotRow.kot_number,
      locationLabelSnapshot: kotRow.location_label_snapshot,
      status: kotRow.status as KotStatus,
      acceptedAt: formatDate(kotRow.accepted_at),
      preparingAt: formatDate(kotRow.preparing_at),
      readyAt: formatDate(kotRow.ready_at),
      servedAt: formatDate(kotRow.served_at),
      createdAt: formatDate(kotRow.created_at) || new Date().toISOString(),
      updatedAt: formatDate(kotRow.updated_at) || new Date().toISOString(),
      items
    };
  }

  /**
   * Lists KOTs for an outlet with optional station, status, or active queue filtering.
   */
  static async listKots(filters: {
    outletId: string;
    stationId?: string;
    stationCode?: string;
    stationCodes?: string[];
    status?: KotStatus;
    activeOnly?: boolean;
    orderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ kots: KotResponse[]; total: number }> {
    const pool = getDbPool();
    const conditions: string[] = ['k.outlet_id = $1'];
    const values: any[] = [filters.outletId];
    let paramIndex = 2;

    if (filters.stationId) {
      conditions.push(`k.station_id = $${paramIndex++}`);
      values.push(filters.stationId);
    }

    if (filters.stationCodes && filters.stationCodes.length > 0) {
      conditions.push(`s.code = ANY($${paramIndex++}::varchar[])`);
      values.push(filters.stationCodes);
    } else if (filters.stationCode) {
      conditions.push(`s.code = $${paramIndex++}`);
      values.push(filters.stationCode);
    }

    if (filters.status) {
      conditions.push(`k.status = $${paramIndex++}`);
      values.push(filters.status);
    } else if (filters.activeOnly) {
      conditions.push(`k.status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')`);
    }

    if (filters.orderId) {
      conditions.push(`k.order_id = $${paramIndex++}`);
      values.push(filters.orderId);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM public.kots k
      JOIN public.kitchen_stations s ON s.id = k.station_id
      WHERE ${whereClause};
    `;
    const countRes = await pool.query(countQuery, values);
    const total = countRes.rows[0]?.total || 0;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const paginationValues = [...values, limit, offset];

    const listQuery = `
      SELECT 
        k.id,
        k.outlet_id,
        k.order_id,
        k.station_id,
        k.kot_number,
        k.location_label_snapshot,
        k.status,
        k.accepted_at,
        k.preparing_at,
        k.ready_at,
        k.served_at,
        k.created_at,
        k.updated_at,
        s.code AS station_code,
        s.name AS station_name
      FROM public.kots k
      JOIN public.kitchen_stations s ON s.id = k.station_id
      WHERE ${whereClause}
      ORDER BY k.created_at ASC, k.kot_number ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const listRes = await pool.query(listQuery, paginationValues);

    if (listRes.rows.length === 0) {
      return { kots: [], total };
    }

    const kotIds = listRes.rows.map((r) => r.id);
    const itemsQuery = `
      SELECT 
        id,
        kot_id,
        order_item_id,
        item_name_snapshot,
        quantity,
        customization_notes,
        status,
        created_at,
        updated_at
      FROM public.kot_items
      WHERE kot_id = ANY($1::uuid[])
      ORDER BY created_at ASC;
    `;
    const itemsRes = await pool.query(itemsQuery, [kotIds]);

    const itemsMap = new Map<string, KotItemResponse[]>();
    for (const row of itemsRes.rows) {
      const list = itemsMap.get(row.kot_id) || [];
      list.push({
        id: row.id,
        kotId: row.kot_id,
        orderItemId: row.order_item_id,
        itemName: row.item_name_snapshot,
        quantity: row.quantity,
        customizationNotes: row.customization_notes,
        status: row.status as KotItemStatus,
        createdAt: formatDate(row.created_at) || new Date().toISOString(),
        updatedAt: formatDate(row.updated_at) || new Date().toISOString()
      });
      itemsMap.set(row.kot_id, list);
    }

    const kots: KotResponse[] = listRes.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      orderId: row.order_id,
      stationId: row.station_id,
      stationCode: row.station_code,
      stationName: row.station_name,
      kotNumber: row.kot_number,
      locationLabelSnapshot: row.location_label_snapshot,
      status: row.status as KotStatus,
      acceptedAt: formatDate(row.accepted_at),
      preparingAt: formatDate(row.preparing_at),
      readyAt: formatDate(row.ready_at),
      servedAt: formatDate(row.served_at),
      createdAt: formatDate(row.created_at) || new Date().toISOString(),
      updatedAt: formatDate(row.updated_at) || new Date().toISOString(),
      items: itemsMap.get(row.id) || []
    }));

    return { kots, total };
  }

  /**
   * Generates station-specific KOT tickets for an order.
   * Atomically splits multi-station items, allocates daily KOT numbers,
   * inserts KOTs, items, and initial history, and advances order to ACCEPTED.
   */
  static async generateKotsForOrder(
    params: {
      orderId: string;
      staffId?: string | null;
      reqCorrelationId?: string;
      ipAddress?: string | null;
    },
    externalClient?: pg.PoolClient
  ): Promise<GenerateKotsResult> {
    const { orderId, staffId = null, reqCorrelationId, ipAddress } = params;

    const executeLogic = async (client: pg.PoolClient): Promise<GenerateKotsResult> => {
      // 1. Lock order row FOR UPDATE
      const orderRes = await client.query(
        'SELECT * FROM public.orders WHERE id = $1 FOR UPDATE;',
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order '${orderId}'`);
      }

      const order = orderRes.rows[0];

      // Validate order status: must not be terminal or served
      if (['CANCELLED', 'SERVED', 'READY'].includes(order.status)) {
        throw new ConflictError(
          `Cannot generate KOTs for an order with status '${order.status}'`
        );
      }

      // 2. Load active order items
      const itemsRes = await client.query(
        `SELECT * FROM public.order_items WHERE order_id = $1 AND status != 'CANCELLED'
         ORDER BY created_at ASC;`,
        [orderId]
      );

      if (itemsRes.rows.length === 0) {
        throw new UnprocessableEntityError('Order has no active items for kitchen preparation');
      }

      const orderItems = itemsRes.rows;

      // 3. Resolve location label snapshot
      let locationLabel = `Order #${order.order_number}`;
      if (order.dining_session_id) {
        const tableRes = await client.query(
          `SELECT t.table_number FROM public.dining_sessions ds
           JOIN public.restaurant_tables t ON t.id = ds.table_id
           WHERE ds.id = $1;`,
          [order.dining_session_id]
        );
        if (tableRes.rows.length > 0) {
          const t = tableRes.rows[0];
          locationLabel = `Table ${t.table_number}`;
        }
      } else if (order.room_id) {
        locationLabel = `Room ${order.room_id}`;
      }

      // 4. Resolve kitchen station routing for every active order item
      const menuItemIds = Array.from(new Set(orderItems.map((i: any) => i.menu_item_id)));
      const catalogQuery = `
        SELECT 
          mi.id AS menu_item_id,
          mi.name AS menu_item_name,
          mi.is_active AS master_active,
          mi.archived_at,
          COALESCE(omi.kitchen_station_override_code, mi.target_kitchen_station_code) AS target_station_code
        FROM public.menu_items mi LEFT JOIN public.outlet_menu_items omi 
          ON omi.menu_item_id = mi.id AND omi.outlet_id = $1
        WHERE mi.id = ANY($2::uuid[]);
      `;
      const catalogRes = await client.query(catalogQuery, [order.outlet_id, menuItemIds]);
      const catalogMap = new Map<string, any>();
      for (const row of catalogRes.rows) {
        catalogMap.set(row.menu_item_id, row);
      }

      // Load all active stations configured for this outlet
      const stationsRes = await client.query(
        `SELECT id, outlet_id, code, name, display_order, is_active
         FROM public.kitchen_stations WHERE outlet_id = $1 AND is_active = true;`,
        [order.outlet_id]
      );
      const stationByCode = new Map<string, any>();
      for (const st of stationsRes.rows) {
        stationByCode.set(st.code, st);
      }

      // Group order items by physical station
      const stationGroups = new Map<string, { station: any; items: any[] }>();

      for (const item of orderItems) {
        const cat = catalogMap.get(item.menu_item_id);
        if (!cat) {
          throw new NotFoundError(`Menu item '${item.menu_item_id}' for item '${item.item_name_snapshot}'`);
        }

        if (!cat.master_active || cat.archived_at) {
          throw new UnprocessableEntityError(`Menu item '${item.item_name_snapshot}' is inactive or archived`);
        }

        const targetCode = cat.target_station_code;
        if (!targetCode) {
          throw new UnprocessableEntityError(
            `Menu item '${item.item_name_snapshot}' has no kitchen station configured`
          );
        }

        const station = stationByCode.get(targetCode);
        if (!station) {
          throw new UnprocessableEntityError(
            `No active kitchen station found for station code '${targetCode}' at outlet '${order.outlet_id}' for item '${item.item_name_snapshot}'`
          );
        }

        // Verify cross-outlet invariant
        if (station.outlet_id !== order.outlet_id) {
          throw new BadRequestError(
            `Cross-outlet mismatch: Station '${station.code}' belongs to outlet '${station.outlet_id}', not '${order.outlet_id}'`
          );
        }

        const group = stationGroups.get(station.id) || { station, items: [] };
        group.items.push(item);
        stationGroups.set(station.id, group);
      }

      // 5. Generate station KOTs
      const todayPartition = new Date().toISOString().split('T')[0];
      const createdKots: KotResponse[] = [];

      for (const [, group] of stationGroups.entries()) {
        const { station, items: groupItems } = group;

        // Allocate sequential daily KOT number from outlet_counters
        const counterQuery = `
          INSERT INTO public.outlet_counters (
            outlet_id, counter_type, partition_key, current_val, updated_at
          ) VALUES ($1, 'DAILY_KOT', $2, 1, CURRENT_TIMESTAMP)
          ON CONFLICT (outlet_id, counter_type, partition_key)
          DO UPDATE SET 
            current_val = outlet_counters.current_val + 1,
            updated_at = CURRENT_TIMESTAMP
          RETURNING current_val;
        `;
        const counterRes = await client.query(counterQuery, [order.outlet_id, todayPartition]);
        const kotNumber = parseInt(counterRes.rows[0].current_val, 10);

        // Insert KOT header
        const insertKotQuery = `
          INSERT INTO public.kots (
            outlet_id, order_id, station_id, kot_number, location_label_snapshot, status
          ) VALUES ($1, $2, $3, $4, $5, 'NEW')
          RETURNING *;
        `;
        const kotRes = await client.query(insertKotQuery, [
          order.outlet_id,
          order.id,
          station.id,
          kotNumber,
          locationLabel
        ]);
        const kotRow = kotRes.rows[0];

        // Insert KOT line items
        const insertedItems: KotItemResponse[] = [];
        for (const item of groupItems) {
          const insertItemQuery = `
            INSERT INTO public.kot_items (
              kot_id, order_item_id, item_name_snapshot, quantity, customization_notes, status
            ) VALUES ($1, $2, $3, $4, $5, 'NEW')
            RETURNING *;
          `;
          const itemRes = await client.query(insertItemQuery, [
            kotRow.id,
            item.id,
            item.item_name_snapshot,
            item.quantity,
            item.customization_notes || null
          ]);
          const itemRow = itemRes.rows[0];

          insertedItems.push({
            id: itemRow.id,
            kotId: itemRow.kot_id,
            orderItemId: itemRow.order_item_id,
            itemName: itemRow.item_name_snapshot,
            quantity: itemRow.quantity,
            customizationNotes: itemRow.customization_notes,
            status: itemRow.status as KotItemStatus,
            createdAt: formatDate(itemRow.created_at) || new Date().toISOString(),
            updatedAt: formatDate(itemRow.updated_at) || new Date().toISOString()
          });
        }

        // Insert initial KOT status history
        await client.query(
          `INSERT INTO public.kot_status_history (
            kot_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, 'CREATED', 'NEW', $2);`,
          [kotRow.id, staffId || null]
        );

        // Audit log
        await writeAuditLog(
          {
            actorType: staffId ? 'STAFF' : 'SYSTEM',
            actorId: staffId || order.dining_session_id || order.id,
            action: 'KOT_GENERATED',
            entityType: 'kots',
            entityId: kotRow.id,
            outletId: order.outlet_id,
            oldState: null,
            newState: {
              kotNumber,
              stationId: station.id,
              stationCode: station.code,
              orderId: order.id,
              itemCount: insertedItems.length
            },
            requestId: reqCorrelationId || 'unknown',
            ipAddress
          },
          client
        );

        // Outlet event log
        await publishOutletEvent(
          {
            outletId: order.outlet_id,
            channel: 'kds',
            eventType: 'KOT_CREATED',
            entityId: kotRow.id,
            payload: {
              kotId: kotRow.id,
              kotNumber,
              stationId: station.id,
              stationCode: station.code,
              orderId: order.id
            }
          },
          client
        );

        createdKots.push({
          id: kotRow.id,
          outletId: kotRow.outlet_id,
          orderId: kotRow.order_id,
          stationId: station.id,
          stationCode: station.code,
          stationName: station.name,
          kotNumber,
          locationLabelSnapshot: kotRow.location_label_snapshot,
          status: 'NEW',
          acceptedAt: null,
          preparingAt: null,
          readyAt: null,
          servedAt: null,
          createdAt: formatDate(kotRow.created_at) || new Date().toISOString(),
          updatedAt: formatDate(kotRow.updated_at) || new Date().toISOString(),
          items: insertedItems
        });
      }

      // 6. Advance parent order to ACCEPTED if currently PLACED
      let resultingOrderStatus = order.status;
      if (order.status === 'PLACED') {
        await client.query(
          `UPDATE public.orders SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [order.id]
        );

        await client.query(
          `INSERT INTO public.order_status_history (
            order_id, from_status, to_status, changed_by_staff_id, notes
          ) VALUES ($1, 'PLACED', 'ACCEPTED', $2, 'KOTs fired to kitchen stations');`,
          [order.id, staffId || null]
        );

        await writeAuditLog(
          {
            actorType: staffId ? 'STAFF' : 'SYSTEM',
            actorId: staffId || order.dining_session_id || order.id,
            action: 'ORDER_STATUS_CHANGED',
            entityType: 'orders',
            entityId: order.id,
            outletId: order.outlet_id,
            oldState: { status: 'PLACED' },
            newState: { status: 'ACCEPTED', notes: 'KOTs fired' },
            requestId: reqCorrelationId || 'unknown',
            ipAddress
          },
          client
        );

        await publishOutletEvent(
          {
            outletId: order.outlet_id,
            channel: 'orders',
            eventType: 'ORDER_STATUS_CHANGED',
            entityId: order.id,
            payload: {
              orderId: order.id,
              fromStatus: 'PLACED',
              toStatus: 'ACCEPTED',
              orderNumber: order.order_number
            }
          },
          client
        );

        resultingOrderStatus = 'ACCEPTED';
      }

      return {
        kots: createdKots,
        orderId: order.id,
        orderStatus: resultingOrderStatus
      };
    };

    if (externalClient) {
      return await executeLogic(externalClient);
    }

    return await withTransaction(async (client) => {
      return await executeLogic(client);
    }).then((result) => {
      // Broadcast realtime notifications after commit
      for (const kot of result.kots) {
        realtimeBroadcaster
          .publish({
            outletId: kot.outletId,
            channel: 'kds',
            sequenceNumber: 1,
            eventType: 'KOT_CREATED',
            payload: {
              kotId: kot.id,
              kotNumber: kot.kotNumber,
              stationId: kot.stationId,
              stationCode: kot.stationCode,
              orderId: kot.orderId
            },
            timestamp: new Date().toISOString()
          })
          .catch(() => {});
      }

      return result;
    });
  }

  /**
   * Advances a KOT's lifecycle status.
   * Enforces valid state transitions and updates milestone timestamps.
   * Synchronizes active kot_items and parent order status.
   */
  static async transitionKotStatus(
    kotId: string,
    toStatus: KotStatus,
    staffId: string,
    notes?: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<KotResponse> {
    const updatedKot = await withTransaction(async (client) => {
      await client.query('SELECT o.id FROM public.orders o JOIN public.kots k ON k.order_id=o.id WHERE k.id=$1 FOR UPDATE OF o',[kotId]);
      // 1. Lock KOT FOR UPDATE
      const kotRes = await client.query(
        `SELECT k.*, s.code AS station_code, s.name AS station_name
         FROM public.kots k
         JOIN public.kitchen_stations s ON s.id = k.station_id
         WHERE k.id = $1 FOR UPDATE;`,
        [kotId]
      );

      if (kotRes.rows.length === 0) {
        throw new NotFoundError(`KOT '${kotId}'`);
      }

      const kot = kotRes.rows[0];

      // 2. Validate status transition
      const allowedNext = VALID_KOT_TRANSITIONS[kot.status as KotStatus] || [];
      if (!allowedNext.includes(toStatus)) {
        throw new ConflictError(
          `Cannot transition KOT status from '${kot.status}' to '${toStatus}'`
        );
      }

      if(toStatus==='CANCELLED') {
        if (!notes || notes.trim().length < 3 || notes.trim().length > 500) throw new BadRequestError('A cancellation reason of 3 to 500 characters is required.');
        const served=await client.query("SELECT id FROM public.kot_items WHERE kot_id=$1 AND status='SERVED' LIMIT 1",[kotId]);
        if(served.rows.length) throw new ConflictError('Cannot cancel served items.');
        await KitchenService.assertItemsUnbilled(client,kot.order_id);
      }
      // 3. Update KOT status and milestone timestamps
      const updateQuery = `
        UPDATE public.kots
        SET 
          status = $1::text,
          accepted_at = CASE 
            WHEN ($1::text = 'ACCEPTED' OR $1::text = 'PREPARING') AND accepted_at IS NULL THEN CURRENT_TIMESTAMP 
            ELSE accepted_at 
          END,
          preparing_at = CASE 
            WHEN $1::text = 'PREPARING' AND preparing_at IS NULL THEN CURRENT_TIMESTAMP 
            ELSE preparing_at 
          END,
          ready_at = CASE 
            WHEN $1::text = 'READY' AND ready_at IS NULL THEN CURRENT_TIMESTAMP 
            ELSE ready_at 
          END,
          served_at = CASE 
            WHEN $1::text = 'SERVED' AND served_at IS NULL THEN CURRENT_TIMESTAMP 
            ELSE served_at 
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;
      await client.query(updateQuery, [toStatus, kotId]);

      // 4. Update uncancelled line items within this KOT
      if (toStatus === 'PREPARING') {
        await client.query(
          `UPDATE public.kot_items
           SET status = 'PREPARING', updated_at = CURRENT_TIMESTAMP
           WHERE kot_id = $1 AND status = 'NEW';`,
          [kotId]
        );
      } else if (toStatus === 'READY') {
        await client.query(
          `UPDATE public.kot_items
           SET status = 'READY', updated_at = CURRENT_TIMESTAMP
           WHERE kot_id = $1 AND status IN ('NEW', 'PREPARING');`,
          [kotId]
        );
      } else if (toStatus === 'SERVED') {
        await client.query(
          `UPDATE public.kot_items
           SET status = 'SERVED', updated_at = CURRENT_TIMESTAMP
           WHERE kot_id = $1 AND status != 'CANCELLED';`,
          [kotId]
        );
      } else if (toStatus === 'CANCELLED') {
        await client.query(
          `UPDATE public.kot_items
           SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
           WHERE kot_id = $1 AND status != 'CANCELLED';`,
          [kotId]
        );
      }

      // 5. Append to kot_status_history
      await client.query(
        `INSERT INTO public.kot_status_history (
          kot_id, from_status, to_status, changed_by_staff_id
        ) VALUES ($1, $2, $3, $4);`,
        [kotId, kot.status, toStatus, staffId]
      );

      // 6. Write audit log
      const auditAction = toStatus === 'CANCELLED' ? 'KOT_CANCELLED' : 'KOT_STATUS_CHANGED';
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: auditAction,
          entityType: 'kots',
          entityId: kotId,
          outletId: kot.outlet_id,
          oldState: { status: kot.status },
          newState: { status: toStatus, notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 7. Write outlet event log
      await publishOutletEvent(
        {
          outletId: kot.outlet_id,
          channel: 'kds',
          eventType: `KOT_${toStatus}`,
          entityId: kotId,
          payload: {
            kotId,
            kotNumber: kot.kot_number,
            stationId: kot.station_id,
            stationCode: kot.station_code,
            orderId: kot.order_id,
            fromStatus: kot.status,
            toStatus
          }
        },
        client
      );

      await client.query(`UPDATE public.order_items oi SET status=CASE WHEN ki.status='NEW' THEN 'PLACED' ELSE ki.status END,updated_at=CURRENT_TIMESTAMP
        FROM public.kot_items ki WHERE ki.order_item_id=oi.id AND ki.kot_id=$1 AND oi.status!='CANCELLED'`,[kotId]);
      // 8. Synchronize parent order status based on all station KOT states
      await KitchenService.syncOrderStatusFromKots(
        client,
        kot.order_id,
        staffId,
        reqCorrelationId,
        ipAddress
      );

      return await KitchenService.getKotById(kotId, client);
    });

    // Realtime notification after successful commit
    realtimeBroadcaster
      .publish({
        outletId: updatedKot.outletId,
        channel: 'kds',
        sequenceNumber: 1,
        eventType: `KOT_${toStatus}`,
        payload: {
          kotId: updatedKot.id,
          kotNumber: updatedKot.kotNumber,
          stationId: updatedKot.stationId,
          stationCode: updatedKot.stationCode,
          orderId: updatedKot.orderId,
          status: toStatus
        },
        timestamp: new Date().toISOString()
      })
      .catch(() => {});

    return updatedKot;
  }

  /**
   * Updates status of an individual KOT line item.
   * Deterministically synchronizes parent KOT status and order status.
   */
  static async updateKotItemStatus(
    kotItemId: string,
    toStatus: KotItemStatus,
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null,
    cancellationReason?: string
  ): Promise<{ item: KotItemResponse; kot: KotResponse }> {
    if (toStatus === 'CANCELLED' && (!cancellationReason || cancellationReason.trim().length < 3 || cancellationReason.trim().length > 500)) throw new BadRequestError('A cancellation reason of 3 to 500 characters is required.');
    return await withTransaction(async (client) => {
      // 1. Lock item FOR UPDATE
      const itemRes = await client.query(
        'SELECT * FROM public.kot_items WHERE id = $1;',
        [kotItemId]
      );
      if (itemRes.rows.length === 0) {
        throw new NotFoundError(`KOT Item '${kotItemId}'`);
      }
      let item = itemRes.rows[0];
      await client.query('SELECT o.id FROM public.orders o JOIN public.kots k ON k.order_id=o.id WHERE k.id=$1 FOR UPDATE OF o',[item.kot_id]);

      // 2. Lock parent KOT FOR UPDATE
      const kotRes = await client.query(
        `SELECT k.*, s.code AS station_code, s.name AS station_name
         FROM public.kots k
         JOIN public.kitchen_stations s ON s.id = k.station_id
         WHERE k.id = $1 FOR UPDATE;`,
        [item.kot_id]
      );
      if (kotRes.rows.length === 0) {
        throw new NotFoundError(`Parent KOT for item '${kotItemId}'`);
      }
      const kot = kotRes.rows[0];

      item=(await client.query('SELECT * FROM public.kot_items WHERE id = $1 FOR UPDATE;',[kotItemId])).rows[0];
      if(!item) throw new NotFoundError('Kitchen item');
      if(['SERVED','CANCELLED'].includes(kot.status)) throw new ConflictError('Kitchen ticket is terminal.');
      // 3. Validate item transition
      const allowedNext = VALID_KOT_ITEM_TRANSITIONS[item.status as KotItemStatus] || [];
      if (!allowedNext.includes(toStatus)) {
        throw new ConflictError(
          `Cannot transition KOT item status from '${item.status}' to '${toStatus}'`
        );
      }

      if (toStatus === 'CANCELLED' || (item.status === 'READY' && toStatus === 'PREPARING')) await KitchenService.assertItemsUnbilled(client,kot.order_id);
      await writeAuditLog({actorType:'STAFF',actorId:staffId,action:'KOT_ITEM_STATUS_CHANGED',entityType:'kot_items',entityId:kotItemId,outletId:kot.outlet_id,oldState:{status:item.status},newState:{status:toStatus, reason:cancellationReason?.trim()},requestId:reqCorrelationId || 'unknown',ipAddress},client);
      await publishOutletEvent({outletId:kot.outlet_id,channel:'kds',eventType:'KOT_ITEM_STATUS_CHANGED',entityId:kotItemId,payload:{kotId:kot.id,orderId:kot.order_id,itemId:kotItemId,status:toStatus}},client);
      // 4. Update item status
      await client.query(
        `UPDATE public.kot_items
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [toStatus, kotItemId]
      );

      // 5. Deterministically recompute parent KOT status
      const allItemsRes = await client.query(
        'SELECT status FROM public.kot_items WHERE kot_id = $1;',
        [kot.id]
      );
      const activeItems = allItemsRes.rows.filter((r) => r.status !== 'CANCELLED');

      let newKotStatus = kot.status as KotStatus;
      if (activeItems.length === 0) {
        newKotStatus = 'CANCELLED';
      } else if (activeItems.length > 0 && activeItems.every((r) => r.status === 'SERVED')) {
        newKotStatus = 'SERVED';
      } else if (activeItems.length > 0 && activeItems.every((r) => r.status === 'READY' || r.status === 'SERVED')) {
        newKotStatus = 'READY';
      } else if (activeItems.length > 0 && activeItems.some((r) => r.status === 'PREPARING' || r.status === 'READY')) {
        newKotStatus = 'PREPARING';
      }

      if (newKotStatus !== kot.status) {
        await client.query(
          `UPDATE public.kots
           SET 
             status = $1::text,
             accepted_at = CASE WHEN ($1::text = 'ACCEPTED' OR $1::text = 'PREPARING') AND accepted_at IS NULL THEN CURRENT_TIMESTAMP ELSE accepted_at END,
             preparing_at = CASE WHEN $1::text = 'PREPARING' AND preparing_at IS NULL THEN CURRENT_TIMESTAMP ELSE preparing_at END,
             ready_at = CASE WHEN $1::text = 'READY' AND ready_at IS NULL THEN CURRENT_TIMESTAMP ELSE ready_at END,
             served_at = CASE WHEN $1::text = 'SERVED' AND served_at IS NULL THEN CURRENT_TIMESTAMP ELSE served_at END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $2;`,
          [newKotStatus, kot.id]
        );

        await client.query(
          `INSERT INTO public.kot_status_history (
            kot_id, from_status, to_status, changed_by_staff_id
          ) VALUES ($1, $2, $3, $4);`,
          [kot.id, kot.status, newKotStatus, staffId]
        );

        await writeAuditLog(
          {
            actorType: 'STAFF',
            actorId: staffId,
            action: 'KOT_STATUS_CHANGED',
            entityType: 'kots',
            entityId: kot.id,
            outletId: kot.outlet_id,
            oldState: { status: kot.status },
            newState: { status: newKotStatus, triggeredByItem: kotItemId },
            requestId: reqCorrelationId || 'unknown',
            ipAddress
          },
          client
        );

        await publishOutletEvent(
          {
            outletId: kot.outlet_id,
            channel: 'kds',
            eventType: `KOT_${newKotStatus}`,
            entityId: kot.id,
            payload: {
              kotId: kot.id,
              kotNumber: kot.kot_number,
              stationId: kot.station_id,
              orderId: kot.order_id,
              status: newKotStatus
            }
          },
          client
        );

        await KitchenService.syncOrderStatusFromKots(
          client,
          kot.order_id,
          staffId,
          reqCorrelationId,
          ipAddress
        );
      }

      await client.query('UPDATE public.order_items SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[toStatus,item.order_item_id]);
      const updatedKot = await KitchenService.getKotById(kot.id, client);
      const updatedItem = updatedKot.items.find((i) => i.id === kotItemId)!;

      return { item: updatedItem, kot: updatedKot };
    });
  }

  /**
   * Helper: Synchronizes parent order status from the collective state of all its station KOTs.
   *
   * Aggregation Rules:
   * 1. Terminal states (CANCELLED or SERVED) are never regressed.
   * 2. If all active non-cancelled KOTs are SERVED -> order transitions to SERVED.
   * 3. Else if all active non-cancelled KOTs are READY or SERVED -> order transitions to READY.
   * 4. Else if any active KOT is PREPARING or READY (and order is PLACED or ACCEPTED) -> order transitions to PREPARING.
   */
  static async syncOrderStatusFromKots(
    client: pg.PoolClient,
    orderId: string,
    staffId: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<void> {
    const orderRes = await client.query(
      'SELECT * FROM public.orders WHERE id = $1 FOR UPDATE;',
      [orderId]
    );
    if (orderRes.rows.length === 0) return;

    const order = orderRes.rows[0];
    if (['CANCELLED', 'SERVED'].includes(order.status)) {
      return;
    }

    const allKotsRes = await client.query(
      'SELECT status FROM public.kots WHERE order_id = $1;',
      [orderId]
    );
    const activeKots = allKotsRes.rows.filter((k) => k.status !== 'CANCELLED');

    let targetOrderStatus: string | null = null;

    if (allKotsRes.rows.length > 0 && activeKots.length === 0) {
      // All KOTs for this order have been cancelled -> order transitions to CANCELLED
      if (order.status !== 'CANCELLED') {
        targetOrderStatus = 'CANCELLED';
      }
    } else if (activeKots.length > 0 && activeKots.every((k) => k.status === 'SERVED')) {
      if (order.status !== 'SERVED') {
        targetOrderStatus = 'SERVED';
      }
    } else if (activeKots.length > 0 && activeKots.every((k) => k.status === 'READY' || k.status === 'SERVED')) {
      if (order.status !== 'READY' && order.status !== 'SERVED') {
        targetOrderStatus = 'READY';
      }
    } else if (activeKots.length > 0 && activeKots.some((k) => k.status === 'PREPARING' || k.status === 'READY')) {
      if (order.status === 'PLACED' || order.status === 'ACCEPTED' || order.status === 'READY') {
        targetOrderStatus = 'PREPARING';
      }
    } else if (activeKots.length > 0 && activeKots.some((k) => k.status === 'ACCEPTED')) {
      if (order.status === 'PLACED') {
        targetOrderStatus = 'ACCEPTED';
      }
    }

    if (targetOrderStatus && targetOrderStatus !== order.status) {
      await client.query(
        `UPDATE public.orders
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2;`,
        [targetOrderStatus, orderId]
      );

      // Advance uncancelled order line items to match order milestone
      await client.query(
        `UPDATE public.order_items oi SET status=CASE WHEN ki.status='NEW' THEN 'PLACED' ELSE ki.status END,updated_at=CURRENT_TIMESTAMP
         FROM public.kot_items ki JOIN public.kots k ON k.id=ki.kot_id
         WHERE ki.order_item_id=oi.id AND k.order_id=$1 AND oi.status!='CANCELLED'`,[orderId]);

      await client.query(
        `INSERT INTO public.order_status_history (
          order_id, from_status, to_status, changed_by_staff_id, notes
        ) VALUES ($1, $2, $3, $4, 'Synchronized from kitchen station KOT progression');`,
        [orderId, order.status, targetOrderStatus, staffId]
      );

      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'orders',
          entityId: orderId,
          outletId: order.outlet_id,
          oldState: { status: order.status },
          newState: { status: targetOrderStatus, reason: 'KOT_AGGREGATION' },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      await publishOutletEvent(
        {
          outletId: order.outlet_id,
          channel: 'orders',
          eventType: 'ORDER_STATUS_CHANGED',
          entityId: orderId,
          payload: {
            orderId,
            fromStatus: order.status,
            toStatus: targetOrderStatus,
            orderNumber: order.order_number
          }
        },
        client
      );
    }
  }
}
