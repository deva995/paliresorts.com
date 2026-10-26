import pg from 'pg';
import crypto from 'crypto';
import { getDbPool, withTransaction } from '../../db/pool.js';
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
import { KitchenService } from '../kitchen/kitchen.service.js';
import {
  OrderResponse,
  OrderItemResponse,
  OrderItemInput,
  OrderStatus,
  OrderSource
} from './orders.types.js';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'ACCEPTED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'PREPARING', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: []
};

/**
 * Authoritative backend validation of portion and item pricing.
 * Never trusts prices provided by client browsers.
 */
function resolveAuthoritativeItemPricePaise(catalogItem: any, item: OrderItemInput): number {
  let effectivePricePaise = parseInt(
    catalogItem.price_override_paise !== null && catalogItem.price_override_paise !== undefined
      ? catalogItem.price_override_paise
      : catalogItem.base_price_paise,
    10
  );

  // Authoritative backend validation of portion pricing:
  // Parse portion options embedded in the authoritative database catalog description
  const portionLabel = item.portion || (item.customizationNotes ? item.customizationNotes.split(' • ')[0] : undefined);
  if (portionLabel && catalogItem.item_description) {
    const portionMatch = catalogItem.item_description.match(/<!--portions:(.*?)-->/);
    if (portionMatch && portionMatch[1]) {
      try {
        const options = JSON.parse(portionMatch[1]);
        if (Array.isArray(options)) {
          const matchedOption = options.find(
            (opt: any) => opt && opt.label && opt.label.trim().toLowerCase() === portionLabel.trim().toLowerCase()
          );
          if (matchedOption && typeof matchedOption.price === 'number') {
            effectivePricePaise = Math.round(matchedOption.price * 100);
          }
        }
      } catch (err) {
        // Ignore JSON parse errors in description
      }
    }
  }

  return effectivePricePaise;
}

export class OrdersService {
  /**
   * Places an order atomically in a transaction.
   * Resolves prices and GST snapshots authoritatively from PostgreSQL.
   * Allocates sequential daily order number from outlet_counters.
   * Enforces sequential round numbering per dining session.
   */
  static async createOrder(params: {
    outletId: string;
    diningSessionId?: string;
    expectedTableId?:string;
    orderSource: OrderSource;
    items: OrderItemInput[];
    specialInstructions?: string;
    idempotencyKey: string;
    staffId?: string | null;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }, transactionClient?:pg.PoolClient): Promise<OrderResponse> {
    const {
      outletId,
      diningSessionId,
      orderSource,
      items,
      specialInstructions,
      idempotencyKey,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    const execute = async (client:pg.PoolClient):Promise<OrderResponse> => {
      // 1. Lock dining session row FOR UPDATE
      const sessionRes = orderSource==='COUNTER_POS' ? {rows:[{id:null,outlet_id:outletId,table_id:null,table_number:null,status:'ACTIVE'}]} : await client.query(
        'SELECT * FROM public.dining_sessions WHERE id = $1 FOR UPDATE;',
        [diningSessionId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundError(`Dining session '${diningSessionId}'`);
      }

      const session = sessionRes.rows[0];
      if(params.expectedTableId && params.expectedTableId!==session.table_id) throw new BadRequestError('Table and dining session do not match.');

      // Resolve table number if table_id is set
      if (session.table_id) {
        const tableLookup = await client.query(
          'SELECT table_number,is_active,active_dining_session_id FROM public.restaurant_tables WHERE id = $1;',
          [session.table_id]
        );
        session.table_number = tableLookup.rows[0]?.table_number || null;
        const table=tableLookup.rows[0];
        if(table?.is_active===false || (table && 'active_dining_session_id' in table && table.active_dining_session_id!==session.id)) throw new ConflictError('Table has no matching active sitting.');
      } else {
        session.table_number = null;
      }

      // 2. Validate outlet association
      if (session.outlet_id !== outletId) {
        throw new BadRequestError(
          `Cross-outlet mismatch: Dining session belongs to outlet '${session.outlet_id}', not '${outletId}'`
        );
      }

      // 2b. Confirm outlet is active
      const outletCheck = await client.query(
        'SELECT id, is_active FROM public.outlets WHERE id = $1 FOR SHARE',
        [outletId]
      );
      if (outletCheck.rows.length > 0 && outletCheck.rows[0].is_active === false) {
        throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
      }

      // 3. Validate dining session status
      if (session.status === 'CLOSED' || session.status === 'CANCELLED') {
        throw new ConflictError(
          `Cannot place orders on a ${session.status.toLowerCase()} dining session`
        );
      }

      if (session.status === 'BILLED') {
        throw new ConflictError(
          'Cannot place additional orders: An interim bill has already been generated for this session. Please ask your steward or cashier to reopen billing.'
        );
      }

      // 4. Resolve authoritative catalog data from PostgreSQL
      const menuItemIds = Array.from(new Set(items.map((i) => i.menuItemId)));

      const catalogQuery = `
        SELECT 
          mi.id AS item_id,
          mi.name AS item_name,
          mi.description AS item_description,
          mi.base_price_paise,
          mi.gst_rate_percent,
          mi.is_active AS master_active,
          mi.archived_at,
          omi.price_override_paise,
          omi.is_available AS outlet_available,
          omi.outlet_id
        FROM public.menu_items mi
        LEFT JOIN public.outlet_menu_items omi 
          ON omi.menu_item_id = mi.id AND omi.outlet_id = $1
        WHERE mi.id = ANY($2::uuid[]);
      `;

      const catalogRes = await client.query(catalogQuery, [outletId, menuItemIds]);
      const catalogMap = new Map<string, any>();
      for (const row of catalogRes.rows) {
        catalogMap.set(row.item_id, row);
      }

      // Validate all items exist and are available at this outlet
      for (const item of items) {
        const catalogItem = catalogMap.get(item.menuItemId);
        if (!catalogItem) {
          throw new NotFoundError(`Menu item '${item.menuItemId}'`);
        }

        if (!catalogItem.master_active || catalogItem.archived_at) {
          throw new UnprocessableEntityError(
            `Menu item '${catalogItem.item_name}' is inactive or archived`
          );
        }

        if (!catalogItem.outlet_id) {
          throw new UnprocessableEntityError(
            `Menu item '${catalogItem.item_name}' is not configured for outlet '${outletId}'`
          );
        }

        if (!catalogItem.outlet_available) {
          throw new UnprocessableEntityError(
            `Menu item '${catalogItem.item_name}' is currently unavailable (86'd)`
          );
        }
      }

      // 5. Determine next sequential round number for the dining session
      const roundRes = await client.query(
        `SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round
         FROM public.orders
         WHERE dining_session_id = $1`,
        [diningSessionId]
      );
      const roundNumber = parseInt(roundRes.rows[0].next_round, 10);

      // 6. Allocate daily order number from outlet_counters
      const todayPartition = new Date().toISOString().split('T')[0];
      const counterQuery = `
        INSERT INTO public.outlet_counters (
          outlet_id, counter_type, partition_key, current_val, updated_at
        ) VALUES ($1, 'DAILY_ORDER', $2, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (outlet_id, counter_type, partition_key)
        DO UPDATE SET 
          current_val = outlet_counters.current_val + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING current_val;
      `;

      const counterRes = await client.query(counterQuery, [outletId, todayPartition]);
      const orderNumber = parseInt(counterRes.rows[0].current_val, 10);

      // 7. Insert orders header
      let orderRow: any;
      try {
        const insertOrderQuery = `
          INSERT INTO public.orders (
            outlet_id,
            dining_session_id,
            order_number,
            round_number,
            order_source,
            status,
            created_by_staff_id,
            idempotency_key,
            special_instructions
          ) VALUES ($1, $2, $3, $4, $5, 'PLACED', $6, $7, $8)
          RETURNING *;
        `;

        const orderInsertRes = await client.query(insertOrderQuery, [
          outletId,
          diningSessionId || null,
          orderNumber,
          roundNumber,
          orderSource,
          staffId || null,
          idempotencyKey,
          specialInstructions || null
        ]);
        orderRow = orderInsertRes.rows[0];
      } catch (err: any) {
        if (err.code === '23505' && err.constraint === 'idx_unique_order_round_per_session') {
          throw new ConflictError(
            'Concurrent round creation detected for dining session. Please retry.'
          );
        }
        throw err;
      }

      // 8. Insert order_items with immutable pricing and GST snapshots
      const itemResponses: OrderItemResponse[] = [];
      let subtotalPaise = 0;
      let taxPaise = 0;

      for (const item of items) {
        const catalogItem = catalogMap.get(item.menuItemId);
        const effectivePricePaise = resolveAuthoritativeItemPricePaise(catalogItem, item);
        const gstRate = parseFloat(catalogItem.gst_rate_percent);
        const lineSubtotal = effectivePricePaise * item.quantity;
        const lineTax = Math.round(lineSubtotal * (gstRate / 100));

        subtotalPaise += lineSubtotal;
        taxPaise += lineTax;

        const insertItemQuery = `
          INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name_snapshot,
            unit_price_paise,
            gst_rate_snapshot,
            quantity,
            customization_notes,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLACED')
          RETURNING *;
        `;

        const itemRes = await client.query(insertItemQuery, [
          orderRow.id,
          item.menuItemId,
          catalogItem.item_name,
          effectivePricePaise,
          gstRate,
          item.quantity,
          item.customizationNotes || null
        ]);

        const insertedItem = itemRes.rows[0];
        itemResponses.push({
          id: insertedItem.id,
          menuItemId: insertedItem.menu_item_id,
          itemName: insertedItem.item_name_snapshot,
          quantity: insertedItem.quantity,
          unitPricePaise: effectivePricePaise,
          gstRate,
          totalPricePaise: lineSubtotal,
          customizationNotes: insertedItem.customization_notes,
          status: insertedItem.status,
          cancelledReason: null
        });
      }

      const totalPaise = subtotalPaise + taxPaise;

      // 9. Insert initial status history
      await client.query(
        `INSERT INTO public.order_status_history (
          order_id, from_status, to_status, changed_by_staff_id, notes
        ) VALUES ($1, 'NONE', 'PLACED', $2, 'Order round placed')`,
        [orderRow.id, staffId || null]
      );

      // 10. Audit log
      await writeAuditLog(
        {
          actorType: orderSource === 'CUSTOMER_QR' ? 'SYSTEM' : 'STAFF',
          actorId: staffId || session.id,
          action: orderSource === 'CUSTOMER_QR' ? 'GUEST_ORDER_CREATED' : 'WAITER_ORDER_CREATED',
          entityType: 'orders',
          entityId: orderRow.id,
          outletId,
          oldState: null,
          newState: {
            orderId: orderRow.id,
            orderNumber,
            roundNumber,
            orderSource,
            totalPaise
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 11. Outlet event log
      const pubEvent = await publishOutletEvent(
        {
          outletId,
          channel: 'orders',
          eventType: 'ORDER_PLACED',
          entityId: orderRow.id,
          payload: {
            orderId: orderRow.id,
            orderNumber,
            roundNumber,
            orderSource,
            tableId: session.table_id,
            totalPaise
          }
        },
        client
      );

      // 12. Atomically generate station KOTs within the same transaction.
      // If KOT generation fails, the entire transaction (including the order) is rolled back.
      let kotResult;
      try {
        kotResult = await KitchenService.generateKotsForOrder(
          {
            orderId: orderRow.id,
            staffId: staffId || null,
            reqCorrelationId,
            ipAddress
          },
          client
        );
      } catch (kotErr: any) {
        throw new UnprocessableEntityError(
          `Kitchen order ticket (KOT) generation failed: ${kotErr.message || 'Unable to route order items to kitchen stations'}`
        );
      }

      // Non-blocking realtime notifications
      realtimeBroadcaster
        .publish({
          outletId,
          channel: 'orders',
          sequenceNumber: parseInt(pubEvent.sequenceNumber, 10) || 1,
          eventType: 'ORDER_PLACED',
          payload: {
            orderId: orderRow.id,
            orderNumber,
            roundNumber,
            orderSource,
            tableId: session.table_id
          },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      for (const kot of kotResult.kots) {
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

      return {
        id: orderRow.id,
        outletId: orderRow.outlet_id,
        diningSessionId: orderRow.dining_session_id || null,
        tableId: session.table_id || null,
        tableNumber: session.table_number || null,
        customerName: session.table_number ? `Table ${session.table_number} Guest` : null,
        hotelStayId: orderRow.hotel_stay_id,
        roomId: orderRow.room_id,
        orderNumber: orderRow.order_number,
        roundNumber: orderRow.round_number,
        orderSource: orderRow.order_source,
        status: (kotResult.orderStatus || 'ACCEPTED') as OrderStatus,
        specialInstructions: orderRow.special_instructions,
        subtotalPaise,
        taxPaise,
        totalPaise,
        items: itemResponses,
        createdAt: orderRow.created_at?.toISOString
          ? orderRow.created_at.toISOString()
          : String(orderRow.created_at || new Date().toISOString()),
        updatedAt: new Date().toISOString()
      };
    };
    return transactionClient ? execute(transactionClient) : withTransaction(execute);
  }

  /**
   * Retrieves an order by ID along with its line items.
   */
  static async getOrderById(orderId: string, client?:pg.PoolClient): Promise<OrderResponse> {
    const pool = client || getDbPool();

    const orderQuery = `
      SELECT o.*, ds.table_id, rt.table_number
      FROM public.orders o
      LEFT JOIN public.dining_sessions ds ON ds.id = o.dining_session_id
      LEFT JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      WHERE o.id = $1;
    `;
    const orderRes = await pool.query(orderQuery, [orderId]);
    if (orderRes.rows.length === 0) {
      throw new NotFoundError(`Order '${orderId}'`);
    }

    const order = orderRes.rows[0];

    const itemsQuery = `
      SELECT * FROM public.order_items WHERE order_id = $1 ORDER BY created_at ASC;
    `;
    const itemsRes = await pool.query(itemsQuery, [orderId]);

    let subtotalPaise = 0;
    let taxPaise = 0;

    const items: OrderItemResponse[] = itemsRes.rows.map((row) => {
      const unitPrice = parseInt(row.unit_price_paise, 10);
      const gstRate = parseFloat(row.gst_rate_snapshot);
      const lineSubtotal = unitPrice * row.quantity;
      const lineTax = Math.round(lineSubtotal * (gstRate / 100));

      if (row.status !== 'CANCELLED') {
        subtotalPaise += lineSubtotal;
        taxPaise += lineTax;
      }

      return {
        id: row.id,
        menuItemId: row.menu_item_id,
        itemName: row.item_name_snapshot,
        quantity: row.quantity,
        unitPricePaise: unitPrice,
        gstRate,
        totalPricePaise: lineSubtotal,
        customizationNotes: row.customization_notes,
        status: row.status,
        cancelledReason: row.cancelled_reason
      };
    });

    const totalPaise = subtotalPaise + taxPaise;

    return {
      id: order.id,
      outletId: order.outlet_id,
      diningSessionId: order.dining_session_id,
      tableId: order.table_id || null,
      tableNumber: order.table_number || null,
      customerName: order.table_number ? `Table ${order.table_number} Guest` : null,
      hotelStayId: order.hotel_stay_id,
      roomId: order.room_id,
      orderNumber: order.order_number,
      roundNumber: order.round_number,
      orderSource: order.order_source,
      status: order.status,
      specialInstructions: order.special_instructions,
      subtotalPaise,
      taxPaise,
      totalPaise,
      items,
      createdAt: order.created_at?.toISOString
        ? order.created_at.toISOString()
        : String(order.created_at || new Date().toISOString()),
      updatedAt: order.updated_at?.toISOString
        ? order.updated_at.toISOString()
        : String(order.updated_at || new Date().toISOString())
    };
  }

  /**
   * Lists orders for an outlet or dining session with optional status filter.
   */
  static async listOrders(filters: {
    outletId?: string;
    diningSessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: OrderResponse[]; total: number }> {
    const pool = getDbPool();

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.outletId) {
      conditions.push(`o.outlet_id = $${idx++}`);
      values.push(filters.outletId);
    }

    if (filters.diningSessionId) {
      conditions.push(`o.dining_session_id = $${idx++}`);
      values.push(filters.diningSessionId);
    }

    if (filters.status) {
      conditions.push(`o.status = $${idx++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM public.orders o ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const listQuery = `
      SELECT o.*, ds.table_id, rt.table_number
      FROM public.orders o
      LEFT JOIN public.dining_sessions ds ON ds.id = o.dining_session_id
      LEFT JOIN public.restaurant_tables rt ON rt.id = ds.table_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(limit, offset);

    const listRes = await pool.query(listQuery, values);
    const orderIds = listRes.rows.map((r) => r.id);

    // Fetch items for all returned orders
    const itemsMap = new Map<string, OrderItemResponse[]>();
    if (orderIds.length > 0) {
      const itemsRes = await pool.query(
        `SELECT * FROM public.order_items WHERE order_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [orderIds]
      );

      for (const row of itemsRes.rows) {
        const unitPrice = parseInt(row.unit_price_paise, 10);
        const gstRate = parseFloat(row.gst_rate_snapshot);
        const lineSubtotal = unitPrice * row.quantity;

        const list = itemsMap.get(row.order_id) || [];
        list.push({
          id: row.id,
          menuItemId: row.menu_item_id,
          itemName: row.item_name_snapshot,
          quantity: row.quantity,
          unitPricePaise: unitPrice,
          gstRate,
          totalPricePaise: lineSubtotal,
          customizationNotes: row.customization_notes,
          status: row.status,
          cancelledReason: row.cancelled_reason
        });
        itemsMap.set(row.order_id, list);
      }
    }

    const orders: OrderResponse[] = listRes.rows.map((order) => {
      const items = itemsMap.get(order.id) || [];
      let subtotalPaise = 0;
      let taxPaise = 0;

      for (const item of items) {
        if (item.status !== 'CANCELLED') {
          subtotalPaise += item.totalPricePaise;
          taxPaise += Math.round(item.totalPricePaise * (item.gstRate / 100));
        }
      }

      return {
        id: order.id,
        outletId: order.outlet_id,
        diningSessionId: order.dining_session_id,
        tableId: order.table_id || null,
        tableNumber: order.table_number || null,
        customerName: order.table_number ? `Table ${order.table_number} Guest` : null,
        hotelStayId: order.hotel_stay_id,
        roomId: order.room_id,
        orderNumber: order.order_number,
        roundNumber: order.round_number,
        orderSource: order.order_source,
        status: order.status,
        specialInstructions: order.special_instructions,
        subtotalPaise,
        taxPaise,
        totalPaise: subtotalPaise + taxPaise,
        items,
        createdAt: order.created_at?.toISOString
          ? order.created_at.toISOString()
          : String(order.created_at || new Date().toISOString()),
        updatedAt: order.updated_at?.toISOString
          ? order.updated_at.toISOString()
          : String(order.updated_at || new Date().toISOString())
      };
    });

    return { orders, total };
  }

  /**
   * Updates an order's lifecycle status.
   * Enforces valid status progression.
   * Appends order_status_history, writes audit log, and publishes outlet event.
   */
  static async updateOrderStatus(
    orderId: string,
    toStatus: OrderStatus,
    staffId: string,
    notes?: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<OrderResponse> {
    return await withTransaction(async (client) => {
      // 1. Lock order row FOR UPDATE
      const orderRes = await client.query(
        'SELECT * FROM public.orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order '${orderId}'`);
      }

      const order = orderRes.rows[0];

      // 2. Validate status transition
      const allowedNext = VALID_STATUS_TRANSITIONS[order.status] || [];
      if (!allowedNext.includes(toStatus)) {
        throw new ConflictError(
          `Cannot transition order status from '${order.status}' to '${toStatus}'`
        );
      }

      if(toStatus==='CANCELLED') throw new ConflictError('Use the authorized cancellation endpoint.');
      // Order and station tickets advance in the same transaction under order-first locking.
      const tickets=await client.query('SELECT id,status FROM public.kots WHERE order_id=$1 ORDER BY id FOR UPDATE',[orderId]);
      const next:Record<string,string[]>={ACCEPTED:['NEW'],PREPARING:['NEW','ACCEPTED'],READY:['PREPARING'],SERVED:['READY']};
      for(const ticket of tickets.rows.filter(t=>!['CANCELLED','SERVED'].includes(t.status))) {
        if(!(next[toStatus] || []).includes(ticket.status)) throw new ConflictError('Kitchen tickets are not ready for this order transition.');
        await client.query("UPDATE public.kots SET status=$1::text,updated_at=CURRENT_TIMESTAMP,served_at=CASE WHEN $1::text='SERVED' THEN CURRENT_TIMESTAMP ELSE served_at END WHERE id=$2",[toStatus,ticket.id]);
        await client.query("UPDATE public.kot_items SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE kot_id=$2 AND status NOT IN ('CANCELLED','SERVED')",[toStatus==='ACCEPTED'?'NEW':toStatus,ticket.id]);
        await client.query('INSERT INTO public.kot_status_history(kot_id,from_status,to_status,changed_by_staff_id) VALUES($1,$2,$3,$4)',[ticket.id,ticket.status,toStatus,staffId]);
      }

      // 3. Update orders status
      await client.query(
        `UPDATE public.orders
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [toStatus, orderId]
      );

      // If moving to PREPARING, READY, or SERVED, advance uncancelled item statuses too
      if (['PREPARING', 'READY', 'SERVED'].includes(toStatus)) {
        await client.query(
          `UPDATE public.order_items
           SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $2 AND status != 'CANCELLED'`,
          [toStatus, orderId]
        );
      }

      // 4. Append to order_status_history
      await client.query(
        `INSERT INTO public.order_status_history (
          order_id, from_status, to_status, changed_by_staff_id, notes
        ) VALUES ($1, $2, $3, $4, $5)`,
        [orderId, order.status, toStatus, staffId, notes || null]
      );

      // 5. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'orders',
          entityId: orderId,
          outletId: order.outlet_id,
          oldState: { status: order.status },
          newState: { status: toStatus, notes },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 6. Outlet event
      await publishOutletEvent(
        {
          outletId: order.outlet_id,
          channel: 'orders',
          eventType: 'ORDER_STATUS_CHANGED',
          entityId: orderId,
          payload: {
            orderId,
            fromStatus: order.status,
            toStatus,
            orderNumber: order.order_number
          }
        },
        client
      );

      // 7. Non-blocking realtime broadcast
      realtimeBroadcaster
        .publish({
          outletId: order.outlet_id,
          channel: 'orders',
          sequenceNumber: 1,
          eventType: 'ORDER_STATUS_CHANGED',
          payload: { orderId, fromStatus: order.status, toStatus },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return await OrdersService.getOrderById(orderId, client);
    });
  }

  /**
   * Cancels an order.
   * Cancels uncancelled order items with cancellation reason.
   * Enforces that order is not already SERVED or part of an active bill.
   */
  static async cancelOrder(
    orderId: string,
    staffId: string,
    reason?: string,
    reqCorrelationId?: string,
    ipAddress?: string | null
  ): Promise<OrderResponse> {
    return await withTransaction(async (client) => {
      // 1. Lock order FOR UPDATE
      const orderRes = await client.query(
        'SELECT * FROM public.orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new NotFoundError(`Order '${orderId}'`);
      }

      const order = orderRes.rows[0];

      if (order.status === 'CANCELLED') {
        throw new ConflictError('Order has already been cancelled');
      }

      if (order.status === 'SERVED') {
        throw new ConflictError('Cannot cancel an order that has already been served');
      }

      // Check if any items belong to an active unsettled/settled bill
      const billCheckRes = await client.query(
        `SELECT b.id, b.invoice_number, b.status 
         FROM public.bills b
         JOIN public.bill_items bi ON bi.bill_id = b.id
         WHERE bi.order_item_id IN (SELECT id FROM public.order_items WHERE order_id = $1)
           AND b.status != 'VOIDED'
         LIMIT 1`,
        [orderId]
      );

      if (billCheckRes.rows.length > 0) {
        throw new ConflictError(
          `Cannot cancel order: Items are attached to bill '${billCheckRes.rows[0].invoice_number}'. Please void the bill first.`
        );
      }

      const tickets=await client.query('SELECT id,status FROM public.kots WHERE order_id=$1 ORDER BY id FOR UPDATE',[orderId]);
      if(tickets.rows.some(t=>t.status==='SERVED')) throw new ConflictError('Cannot cancel served kitchen tickets.');
      for(const ticket of tickets.rows.filter(t=>t.status!=='CANCELLED')) {
        await client.query("UPDATE public.kots SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=$1",[ticket.id]);
        await client.query("UPDATE public.kot_items SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE kot_id=$1 AND status!='CANCELLED'",[ticket.id]);
        await client.query("INSERT INTO public.kot_status_history(kot_id,from_status,to_status,changed_by_staff_id) VALUES($1,$2,'CANCELLED',$3)",[ticket.id,ticket.status,staffId]);
      }
      // 2. Update orders status to CANCELLED
      await client.query(
        `UPDATE public.orders
         SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      );

      // 3. Mark uncancelled order items as CANCELLED
      await client.query(
        `UPDATE public.order_items
         SET status = 'CANCELLED',
             cancelled_reason = $1,
             cancelled_by_staff_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $3 AND status != 'CANCELLED'`,
        [reason || null, staffId, orderId]
      );

      // 4. Status history entry
      await client.query(
        `INSERT INTO public.order_status_history (
          order_id, from_status, to_status, changed_by_staff_id, notes
        ) VALUES ($1, $2, 'CANCELLED', $3, $4)`,
        [orderId, order.status, staffId, reason || null]
      );

      // 5. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ORDER_CANCELLED',
          entityType: 'orders',
          entityId: orderId,
          outletId: order.outlet_id,
          oldState: { status: order.status },
          newState: { status: 'CANCELLED', reason },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 6. Outlet event log
      await publishOutletEvent(
        {
          outletId: order.outlet_id,
          channel: 'orders',
          eventType: 'ORDER_CANCELLED',
          entityId: orderId,
          payload: { orderId, orderNumber: order.order_number, reason }
        },
        client
      );

      // 7. Non-blocking realtime broadcast
      realtimeBroadcaster
        .publish({
          outletId: order.outlet_id,
          channel: 'orders',
          sequenceNumber: 1,
          eventType: 'ORDER_CANCELLED',
          payload: { orderId, orderNumber: order.order_number },
          timestamp: new Date().toISOString()
        })
        .catch(() => {});

      return await OrdersService.getOrderById(orderId, client);
    });
  }

  /**
   * Places a room service order round for an active checked-in hotel stay.
   * Conforms strictly to ck_orders_source_integrity:
   * (order_source = 'ROOM_SERVICE' AND dining_session_id IS NULL AND hotel_stay_id IS NOT NULL AND room_id IS NOT NULL)
   */
  static async createRoomServiceOrder(params: {
    outletId: string;
    hotelStayId: string;
    roomId: string;
    items: OrderItemInput[];
    specialInstructions?: string;
    idempotencyKey: string;
    staffId: string;
    reqCorrelationId?: string;
    ipAddress?: string | null;
  }): Promise<OrderResponse> {
    const {
      outletId,
      hotelStayId,
      roomId,
      items,
      specialInstructions,
      idempotencyKey,
      staffId,
      reqCorrelationId,
      ipAddress
    } = params;

    return await withTransaction(async (client) => {
      // 1. Lock stay FOR UPDATE
      const stayRes = await client.query(
        'SELECT * FROM public.hotel_stays WHERE id = $1 FOR UPDATE;',
        [hotelStayId]
      );
      if (stayRes.rows.length === 0) {
        throw new NotFoundError(`Hotel stay '${hotelStayId}'`);
      }
      const stay = stayRes.rows[0];
      if (stay.status !== 'CHECKED_IN') {
        throw new ConflictError(`Cannot place room service order for a ${stay.status.toLowerCase()} stay`);
      }

      // 2. Lock room FOR UPDATE
      const roomRes = await client.query(
        'SELECT * FROM public.hotel_rooms WHERE id = $1 FOR UPDATE;',
        [roomId]
      );
      if (roomRes.rows.length === 0) {
        throw new NotFoundError(`Hotel room '${roomId}'`);
      }
      const room = roomRes.rows[0];
      if (stay.room_id !== roomId) {
        throw new BadRequestError(`Stay room '${stay.room_id}' does not match requested room '${roomId}'`);
      }
      if (room.status !== 'OCCUPIED') {
        throw new ConflictError(`Room '${room.room_number}' is not currently occupied`);
      }

      // 3. Validate outlet
      const outletRes = await client.query('SELECT id FROM public.outlets WHERE id = $1;', [outletId]);
      if (outletRes.rows.length === 0) {
        throw new NotFoundError(`Outlet '${outletId}'`);
      }
      const activeRes = await client.query('SELECT is_active FROM public.outlets WHERE id = $1;', [outletId]);
      if (activeRes.rows.length > 0 && activeRes.rows[0].is_active === false) {
        throw new ForbiddenError(`Outlet '${outletId}' is currently inactive`);
      }

      // 4. Resolve menu catalog items
      const menuItemIds = Array.from(new Set(items.map((i) => i.menuItemId)));
      const catalogQuery = `
        SELECT mi.id AS item_id,
          mi.name AS item_name,
          mi.description AS item_description,
          mi.base_price_paise,
          mi.gst_rate_percent,
          mi.is_active AS master_active,
          mi.archived_at,
          omi.price_override_paise,
          omi.is_available AS outlet_available,
          omi.outlet_id
        FROM public.menu_items mi
        LEFT JOIN public.outlet_menu_items omi 
          ON omi.menu_item_id = mi.id AND omi.outlet_id = $1
        WHERE mi.id = ANY($2::uuid[]);
      `;
      const catalogRes = await client.query(catalogQuery, [outletId, menuItemIds]);
      const catalogMap = new Map<string, any>();
      for (const row of catalogRes.rows) {
        catalogMap.set(row.item_id, row);
      }

      for (const item of items) {
        const cat = catalogMap.get(item.menuItemId);
        if (!cat || !cat.master_active || cat.archived_at) {
          throw new UnprocessableEntityError(`Menu item '${item.menuItemId}' is not active or not found`);
        }
        if (cat.outlet_available === false) {
          throw new UnprocessableEntityError(`Menu item '${cat.item_name}' is currently unavailable (86'd)`);
        }
      }

      // 5. Sequential order number from outlet_counters
      const counterQuery = `
        INSERT INTO public.outlet_counters (outlet_id, counter_name, current_value, updated_at)
        VALUES ($1, 'daily_order_number', 1, CURRENT_TIMESTAMP)
        ON CONFLICT (outlet_id, counter_name)
        DO UPDATE SET 
          current_value = public.outlet_counters.current_value + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING current_value;
      `;
      const counterRes = await client.query(counterQuery, [outletId]);
      const orderNumber = counterRes.rows[0].current_value;

      // 6. Sequential round number for stay
      const roundRes = await client.query(
        'SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round FROM public.orders WHERE hotel_stay_id = $1;',
        [hotelStayId]
      );
      const roundNumber = roundRes.rows[0].next_round;

      // 7. Insert order
      const insertOrderQuery = `
        INSERT INTO public.orders (
          outlet_id, dining_session_id, hotel_stay_id, room_id,
          order_number, round_number, order_source, status,
          created_by_staff_id, idempotency_key, special_instructions
        )
        VALUES ($1, NULL, $2, $3, $4, $5, 'ROOM_SERVICE', 'PLACED', $6, $7, $8)
        RETURNING *;
      `;
      const orderRes = await client.query(insertOrderQuery, [
        outletId,
        hotelStayId,
        roomId,
        orderNumber,
        roundNumber,
        staffId,
        idempotencyKey,
        specialInstructions || null
      ]);
      const orderRow = orderRes.rows[0];

      // 8. Insert line items
      let subtotalPaise = 0;
      let taxPaise = 0;
      const itemResponses: OrderItemResponse[] = [];

      for (const item of items) {
        const catalogItem = catalogMap.get(item.menuItemId);
        const effectivePricePaise = resolveAuthoritativeItemPricePaise(catalogItem, item);
        const gstRate = parseFloat(catalogItem.gst_rate_percent);

        const lineSubtotal = effectivePricePaise * item.quantity;
        const lineTax = Math.round((lineSubtotal * gstRate) / 100);

        subtotalPaise += lineSubtotal;
        taxPaise += lineTax;

        const insertItemQuery = `
          INSERT INTO public.order_items (
            order_id, menu_item_id, item_name_snapshot,
            unit_price_paise, gst_rate_snapshot, quantity,
            customization_notes, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLACED')
          RETURNING *;
        `;
        const itemRes = await client.query(insertItemQuery, [
          orderRow.id,
          item.menuItemId,
          catalogItem.item_name,
          effectivePricePaise,
          gstRate,
          item.quantity,
          item.customizationNotes || null
        ]);
        const insertedItem = itemRes.rows[0];

        itemResponses.push({
          id: insertedItem.id,
          menuItemId: insertedItem.menu_item_id,
          itemName: insertedItem.item_name_snapshot,
          quantity: insertedItem.quantity,
          unitPricePaise: effectivePricePaise,
          gstRate,
          totalPricePaise: lineSubtotal,
          customizationNotes: insertedItem.customization_notes,
          status: insertedItem.status,
          cancelledReason: null
        });
      }

      const totalPaise = subtotalPaise + taxPaise;

      // 9. Append status history
      await client.query(
        `INSERT INTO public.order_status_history (
          order_id, from_status, to_status, changed_by_staff_id, notes
        ) VALUES ($1, 'NONE', 'PLACED', $2, 'Room service order placed')`,
        [orderRow.id, staffId]
      );

      // 10. Audit log
      await writeAuditLog(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ROOM_SERVICE_ORDER_CREATED',
          entityType: 'orders',
          entityId: orderRow.id,
          outletId,
          oldState: null,
          newState: {
            orderId: orderRow.id,
            orderNumber,
            roundNumber,
            orderSource: 'ROOM_SERVICE',
            hotelStayId,
            roomId,
            roomNumber: room.room_number,
            totalPaise
          },
          requestId: reqCorrelationId || 'unknown',
          ipAddress
        },
        client
      );

      // 11. Event log
      await publishOutletEvent(
        {
          outletId,
          channel: 'orders',
          eventType: 'ROOM_SERVICE_ORDER_PLACED',
          entityId: orderRow.id,
          payload: {
            orderId: orderRow.id,
            orderNumber,
            roundNumber,
            roomNumber: room.room_number,
            subtotalPaise,
            taxPaise,
            totalPaise,
            itemCount: itemResponses.length
          }
        },
        client
      );

      return {
        id: orderRow.id,
        outletId: orderRow.outlet_id,
        diningSessionId: null,
        orderNumber: orderRow.order_number,
        roundNumber: orderRow.round_number,
        orderSource: 'ROOM_SERVICE',
        status: orderRow.status,
        specialInstructions: orderRow.special_instructions,
        subtotalPaise,
        taxPaise,
        totalPaise,
        createdAt: orderRow.created_at.toISOString(),
        updatedAt: orderRow.updated_at.toISOString(),
        items: itemResponses
      };
    });
  }
}
