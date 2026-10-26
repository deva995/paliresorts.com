/**
 * PALI RESORT & CLUB - PHASE 7
 * Hybrid Restaurant Kitchen Production System
 *
 * Implements:
 * - Safe Item Aggregation (Section 7, 8)
 * - Complete Backend Order Traceability (Section 6)
 * - Deterministic FIFO Allocation (Section 15)
 * - Offline Idempotent Event Log (Section 33, 34, 35, 36)
 * - Conflict & Transition Guards (Section 37, 38)
 */

import {
  Order,
  KitchenTicket,
  AggregatedProductionItem,
  ProductionOrderItemRef,
  ProductionEvent
} from '../types';

const OFFLINE_EVENTS_KEY = 'pali_offline_kitchen_events_rest1';
const PROCESSED_EVENT_IDS_KEY = 'pali_processed_kitchen_events_rest1';

/**
 * Derives the station type ('cooking' | 'bar' | 'beverages' | 'drinks')
 */
export function resolveStationType(
  item: { name: string; notes?: string; categoryName?: string; menuType?: string },
  ticketStationType?: 'cooking' | 'bar' | 'beverages' | 'drinks'
): 'cooking' | 'bar' | 'beverages' | 'drinks' {
  if (ticketStationType) return ticketStationType;

  const n = (item.name || '').toLowerCase();
  const c = (item.categoryName || '').toLowerCase();
  const t = (item.menuType || '').toLowerCase();

  if (
    n.includes('mojito') ||
    n.includes('whisky') ||
    n.includes('wine') ||
    n.includes('cocktail') ||
    n.includes('vodka') ||
    n.includes('gin') ||
    n.includes('rum') ||
    c.includes('bar') ||
    c.includes('cocktail')
  ) {
    return 'bar';
  }

  if (
    n.includes('coffee') ||
    n.includes('tea') ||
    n.includes('juice') ||
    n.includes('shake') ||
    n.includes('mocktail') ||
    n.includes('soda') ||
    n.includes('lassi') ||
    c.includes('beverage')
  ) {
    return 'beverages';
  }

  if (
    n.includes('beer') ||
    n.includes('draught') ||
    n.includes('cider') ||
    n.includes('water') ||
    c.includes('drinks')
  ) {
    return 'drinks';
  }

  return 'cooking';
}

/**
 * Derives the specific kitchen station ('tandoor' | 'curry' | 'chinese' | 'pantry' | 'bar')
 */
export function resolveItemStation(
  item: { name: string; notes?: string; categoryName?: string; menuType?: string },
  ticket?: KitchenTicket
): 'tandoor' | 'curry' | 'chinese' | 'pantry' | 'bar' {
  if (ticket) {
    const code = (ticket.stationCode || '').toUpperCase();
    if (code === 'TANDOOR') return 'tandoor';
    if (code === 'CURRY') return 'curry';
    if (code === 'CHINESE') return 'chinese';
    if (code === 'PANTRY') return 'pantry';
    if (code === 'BAR') return 'bar';

    const sName = (ticket.station || '').toLowerCase();
    if (sName.includes('tandoor') || sName.includes('grill') || sName.includes('clay oven')) return 'tandoor';
    if (sName.includes('curry') || sName.includes('gravy')) return 'curry';
    if (sName.includes('chinese') || sName.includes('wok')) return 'chinese';
    if (sName.includes('pantry') || sName.includes('dessert') || sName.includes('cold')) return 'pantry';
    if (sName.includes('bar') || sName.includes('drink') || sName.includes('beverage') || sName.includes('cellar')) return 'bar';
  }

  const n = (item.name || '').toLowerCase();
  const c = (item.categoryName || '').toLowerCase();

  // Bar
  if (
    n.includes('mojito') || n.includes('whisky') || n.includes('wine') ||
    n.includes('cocktail') || n.includes('vodka') || n.includes('gin') ||
    n.includes('rum') || n.includes('beer') || n.includes('draught') ||
    n.includes('cider') || n.includes('coffee') || n.includes('tea') ||
    n.includes('juice') || n.includes('shake') || n.includes('mocktail') ||
    n.includes('soda') || n.includes('lassi') || c.includes('bar') ||
    c.includes('beverage') || c.includes('drink')
  ) {
    return 'bar';
  }

  // Tandoor
  if (n.includes('tikka') || n.includes('tandoor') || n.includes('kebab') || n.includes('roti') || n.includes('naan') || n.includes('kulcha') || n.includes('paratha')) {
    return 'tandoor';
  }

  // Chinese
  if (n.includes('noodle') || n.includes('fried rice') || n.includes('manchurian') || n.includes('chilli') || n.includes('schezwan') || n.includes('wok') || n.includes('dim sum') || n.includes('spring roll')) {
    return 'chinese';
  }

  // Pantry
  if (n.includes('ice cream') || n.includes('kulfi') || n.includes('gulab jamun') || n.includes('rasmalai') || n.includes('halwa') || n.includes('dessert') || n.includes('salad') || n.includes('raita') || n.includes('papad') || c.includes('dessert')) {
    return 'pantry';
  }

  // Curry
  return 'curry';
}

/**
 * Normalizes modifiers for safe aggregation checking (Section 8)
 */
export function getModifiersKey(modifiers?: string[], notes?: string): string {
  const normMods = (modifiers || [])
    .map(m => m.trim().toUpperCase())
    .sort()
    .join('|');

  const n = (notes || '').trim().toLowerCase();
  let criticalTag = '';
  if (n.includes('jain')) criticalTag = 'JAIN';
  else if (n.includes('no onion') || n.includes('no garlic')) criticalTag = 'NO-ONION-GARLIC';
  else if (n.includes('extra spicy')) criticalTag = 'EXTRA-SPICY';
  else if (n.includes('mild')) criticalTag = 'MILD';

  return `${normMods}#${criticalTag}`;
}

/**
 * Builds Aggregated Production Items from active orders and kitchen tickets
 * Scoped to Pali Resort & Club ('rest-1')
 */
export function aggregateProductionItems(
  orders: Order[],
  tickets: KitchenTicket[],
  currentTime: Date = new Date()
): AggregatedProductionItem[] {
  const map = new Map<string, AggregatedProductionItem>();

  // Filter orders for rest-1 that are active (not cancelled, not fully completed/settled with zero food pending)
  const activeOrders = orders.filter(
    o => (o.restaurantId === 'rest-1' || !o.restaurantId) && o.status !== 'cancelled'
  );

  // Index tickets by orderId for faster lookup of instructions and metadata
  const ticketByOrderId = new Map<string, KitchenTicket>();
  tickets.forEach(t => {
    if (t.restaurantId === 'rest-1' || !t.restaurantId) {
      ticketByOrderId.set(t.orderId, t);
    }
  });

  // Iterate each active order item
  activeOrders.forEach(order => {
    const ticket = ticketByOrderId.get(order.id);
    const serviceType = order.type || 'dine-in';

    order.items.forEach((item, idx) => {
      // Find matching item status from ticket if available, else from order item status
      let ticketItem = ticket?.items?.find(ki => ki.name.toLowerCase() === item.name.toLowerCase());
      if (!ticketItem && ticket?.items && ticket.items[idx]) {
        ticketItem = ticket.items[idx];
      }

      const rawStatus = (ticketItem?.status || item.status || 'pending').toLowerCase();
      let status: 'pending' | 'preparing' | 'ready' | 'completed' = 'pending';
      if (rawStatus === 'ready') status = 'ready';
      else if (rawStatus === 'preparing' || rawStatus === 'accepted') status = 'preparing';
      else if (rawStatus === 'completed' || rawStatus === 'served') status = 'completed';
      else status = 'pending';

      // Skip fully completed items from active KDS (Fast Out - Section 13)
      // They are retained in history, but active KDS shows pending, preparing, ready
      const portion = item.portionLabel || (ticketItem as { portion?: string })?.portion || 'Regular';
      const modifiers = (ticketItem as { modifiers?: string[] })?.modifiers || [];
      const notes = item.notes || ticketItem?.notes || '';
      const modifiersKey = getModifiersKey(modifiers, notes);
      const stationType = resolveStationType(item, ticket?.stationType);
      const stationName =
        stationType === 'cooking'
          ? 'Grill & Tandoor'
          : stationType === 'bar'
          ? 'Bar & Cellar'
          : stationType === 'beverages'
          ? 'Beverages Station'
          : 'Drinks Station';

      // Safe Aggregation Key (Section 8)
      // Items only aggregate when MenuItem + Portion + ModifiersKey + Station + ServiceType match
      const aggKey = `${item.name}__${portion}__${modifiersKey}__${stationType}__${serviceType}`;

      const createdAtTimestamp =
        ticket?.createdAtTimestamp ||
        (order.createdAt ? new Date(order.createdAt).getTime() || Date.now() - 5 * 60 * 1000 : Date.now());

      const orderRef: ProductionOrderItemRef = {
        orderItemId: item.id || `item-${order.id}-${idx}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurantId: 'rest-1',
        serviceType,
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        roomNumber: order.roomNumber,
        customerId: (order as { customerId?: string }).customerId,
        customerName: order.guestName,
        waiterId: order.waiterId,
        waiterName: order.waiterName || ticket?.waiterName,
        quantityTotal: item.quantity,
        quantityPending: status === 'pending' ? item.quantity : 0,
        quantityPreparing: status === 'preparing' ? item.quantity : 0,
        quantityReady: status === 'ready' ? item.quantity : 0,
        quantityCompleted: status === 'completed' ? item.quantity : 0,
        portion,
        modifiers,
        specialInstructions: notes || ticket?.specialInstructions,
        allergenInformation: ticket?.allergens,
        stationType,
        stationName,
        createdAt: order.createdAt || ticket?.createdAt || 'Just now',
        createdAtTimestamp,
        updatedAtTimestamp: Date.now()
      };

      if (!map.has(aggKey)) {
        map.set(aggKey, {
          id: aggKey,
          menuItemId: item.menuItemId || item.id,
          menuItemName: item.name,
          portion,
          modifiers,
          modifiersKey,
          stationType,
          stationName,
          stationCode: resolveItemStation(item, ticket).toUpperCase(),
          serviceType,
          isVeg: !!item.isVeg,
          specialInstructions: notes ? [notes] : [],
          allergenInformation: ticket?.allergens || [],
          quantityPending: orderRef.quantityPending,
          quantityPreparing: orderRef.quantityPreparing,
          quantityReady: orderRef.quantityReady,
          quantityCompleted: orderRef.quantityCompleted,
          totalActive: orderRef.quantityPending + orderRef.quantityPreparing + orderRef.quantityReady,
          oldestPendingTimestamp: status === 'pending' ? createdAtTimestamp : Date.now(),
          elapsedMinutes: Math.max(0, Math.floor((currentTime.getTime() - createdAtTimestamp) / 60000)),
          delayStatus: 'normal',
          orderRefs: [orderRef]
        });
      } else {
        const existing = map.get(aggKey)!;
        existing.quantityPending += orderRef.quantityPending;
        existing.quantityPreparing += orderRef.quantityPreparing;
        existing.quantityReady += orderRef.quantityReady;
        existing.quantityCompleted += orderRef.quantityCompleted;
        existing.totalActive =
          existing.quantityPending + existing.quantityPreparing + existing.quantityReady;

        if (status === 'pending' && createdAtTimestamp < existing.oldestPendingTimestamp) {
          existing.oldestPendingTimestamp = createdAtTimestamp;
        }

        if (notes && !existing.specialInstructions?.includes(notes)) {
          existing.specialInstructions = existing.specialInstructions || [];
          existing.specialInstructions.push(notes);
        }

        if (ticket?.allergens) {
          ticket.allergens.forEach(alg => {
            if (!existing.allergenInformation?.includes(alg)) {
              existing.allergenInformation = existing.allergenInformation || [];
              existing.allergenInformation.push(alg);
            }
          });
        }

        existing.orderRefs.push(orderRef);
      }
    });
  });

  // Calculate elapsed time and delay status
  const result: AggregatedProductionItem[] = [];
  map.forEach(item => {
    // Only show items that have active quantities (Fast Out - completed items leave active board)
    if (item.totalActive > 0) {
      const elapsed = Math.max(
        0,
        Math.floor((currentTime.getTime() - item.oldestPendingTimestamp) / 60000)
      );
      item.elapsedMinutes = elapsed;
      if (elapsed >= 15) {
        item.delayStatus = 'delayed';
      } else if (elapsed >= 10) {
        item.delayStatus = 'warning';
      } else {
        item.delayStatus = 'normal';
      }
      result.push(item);
    }
  });

  // Default sorting (Section 27):
  // 1. DELAYED PENDING (>15m)
  // 2. OLDEST PENDING
  // 3. PREPARING
  // 4. READY
  result.sort((a, b) => {
    if (a.delayStatus === 'delayed' && b.delayStatus !== 'delayed') return -1;
    if (b.delayStatus === 'delayed' && a.delayStatus !== 'delayed') return 1;

    // Both have pending: oldest pending first
    if (a.quantityPending > 0 && b.quantityPending > 0) {
      return a.oldestPendingTimestamp - b.oldestPendingTimestamp;
    }
    if (a.quantityPending > 0 && b.quantityPending === 0) return -1;
    if (b.quantityPending > 0 && a.quantityPending === 0) return 1;

    // Next preparing
    if (a.quantityPreparing > 0 && b.quantityPreparing === 0) return -1;
    if (b.quantityPreparing > 0 && a.quantityPreparing === 0) return 1;

    return b.quantityReady - a.quantityReady;
  });

  return result;
}

/**
 * Deterministic FIFO Order Ownership Allocation (Section 15)
 * Transitions pending -> preparing
 */
export function allocatePrepareQuantity(
  item: AggregatedProductionItem,
  qtyToPrepare: number,
  userId: string = 'chef.cooking@pali.com',
  userName: string = 'Kitchen Cooking'
): { events: ProductionEvent[]; remainingToPrepare: number } {
  // Guard against invalid transition (Section 37, 38)
  const actualQty = Math.max(0, Math.min(qtyToPrepare, item.quantityPending));
  if (actualQty <= 0) return { events: [], remainingToPrepare: 0 };

  const events: ProductionEvent[] = [];
  let needed = actualQty;

  // Sort orderRefs FIFO (oldest first)
  const pendingRefs = item.orderRefs
    .filter(r => r.quantityPending > 0)
    .sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);

  for (const ref of pendingRefs) {
    if (needed <= 0) break;
    const canTake = Math.min(needed, ref.quantityPending);

    events.push({
      eventId: `evt-prep-${ref.orderId}-${ref.orderItemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      restaurantId: 'rest-1',
      eventType: 'ITEM_PREPARING_STARTED',
      aggregatedItemId: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      portion: item.portion,
      quantity: canTake,
      orderId: ref.orderId,
      orderItemId: ref.orderItemId,
      tableNumber: ref.tableNumber,
      serviceType: ref.serviceType,
      stationType: item.stationType,
      userId,
      userName,
      timestamp: Date.now(),
      deviceId: 'kds-terminal-1',
      syncStatus: 'synced'
    });

    needed -= canTake;
  }

  return { events, remainingToPrepare: needed };
}

/**
 * Deterministic FIFO Order Ownership Allocation (Section 15)
 * Transitions preparing -> ready
 */
export function allocateReadyQuantity(
  item: AggregatedProductionItem,
  qtyToReady: number,
  userId: string = 'chef.cooking@pali.com',
  userName: string = 'Kitchen Cooking'
): { events: ProductionEvent[]; remainingToReady: number } {
  // Guard against invalid transition (Section 37, 38)
  const actualQty = Math.max(0, Math.min(qtyToReady, item.quantityPreparing));
  if (actualQty <= 0) return { events: [], remainingToReady: 0 };

  const events: ProductionEvent[] = [];
  let needed = actualQty;

  const preparingRefs = item.orderRefs
    .filter(r => r.quantityPreparing > 0)
    .sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);

  for (const ref of preparingRefs) {
    if (needed <= 0) break;
    const canTake = Math.min(needed, ref.quantityPreparing);

    events.push({
      eventId: `evt-ready-${ref.orderId}-${ref.orderItemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      restaurantId: 'rest-1',
      eventType: 'ITEM_READY',
      aggregatedItemId: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      portion: item.portion,
      quantity: canTake,
      orderId: ref.orderId,
      orderItemId: ref.orderItemId,
      tableNumber: ref.tableNumber,
      serviceType: ref.serviceType,
      stationType: item.stationType,
      userId,
      userName,
      timestamp: Date.now(),
      deviceId: 'kds-terminal-1',
      syncStatus: 'synced'
    });

    needed -= canTake;
  }

  return { events, remainingToReady: needed };
}

/**
 * Deterministic FIFO Order Ownership Allocation (Fast Out - Section 13)
 * Transitions ready -> completed
 */
export function allocateCompleteQuantity(
  item: AggregatedProductionItem,
  qtyToComplete: number,
  userId: string = 'chef.cooking@pali.com',
  userName: string = 'Kitchen Cooking'
): { events: ProductionEvent[]; remainingToComplete: number } {
  const actualQty = Math.max(0, Math.min(qtyToComplete, item.quantityReady));
  if (actualQty <= 0) return { events: [], remainingToComplete: 0 };

  const events: ProductionEvent[] = [];
  let needed = actualQty;

  const readyRefs = item.orderRefs
    .filter(r => r.quantityReady > 0)
    .sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);

  for (const ref of readyRefs) {
    if (needed <= 0) break;
    const canTake = Math.min(needed, ref.quantityReady);

    events.push({
      eventId: `evt-comp-${ref.orderId}-${ref.orderItemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      restaurantId: 'rest-1',
      eventType: 'ITEM_COMPLETED',
      aggregatedItemId: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      portion: item.portion,
      quantity: canTake,
      orderId: ref.orderId,
      orderItemId: ref.orderItemId,
      tableNumber: ref.tableNumber,
      serviceType: ref.serviceType,
      stationType: item.stationType,
      userId,
      userName,
      timestamp: Date.now(),
      deviceId: 'kds-terminal-1',
      syncStatus: 'synced'
    });

    needed -= canTake;
  }

  return { events, remainingToComplete: needed };
}

/**
 * Recall Production Item (Section 39)
 */
export function allocateRecallQuantity(
  item: AggregatedProductionItem,
  qtyToRecall: number,
  reason: string,
  userId: string = 'chef.cooking@pali.com',
  userName: string = 'Kitchen Cooking'
): { events: ProductionEvent[] } {
  // If ready, recall to preparing. If preparing, recall to pending.
  const targetSource = item.quantityReady > 0 ? 'ready' : 'preparing';
  const available = targetSource === 'ready' ? item.quantityReady : item.quantityPreparing;
  const actualQty = Math.max(0, Math.min(qtyToRecall, available));
  if (actualQty <= 0) return { events: [] };

  const events: ProductionEvent[] = [];
  let needed = actualQty;

  const refs = item.orderRefs
    .filter(r => (targetSource === 'ready' ? r.quantityReady > 0 : r.quantityPreparing > 0))
    .sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp); // LIFO for recall

  for (const ref of refs) {
    if (needed <= 0) break;
    const availInRef = targetSource === 'ready' ? ref.quantityReady : ref.quantityPreparing;
    const canTake = Math.min(needed, availInRef);

    events.push({
      eventId: `evt-recall-${ref.orderId}-${ref.orderItemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      restaurantId: 'rest-1',
      eventType: 'ITEM_RECALLED',
      aggregatedItemId: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      portion: item.portion,
      quantity: canTake,
      orderId: ref.orderId,
      orderItemId: ref.orderItemId,
      tableNumber: ref.tableNumber,
      serviceType: ref.serviceType,
      stationType: item.stationType,
      userId,
      userName,
      timestamp: Date.now(),
      deviceId: 'kds-terminal-1',
      syncStatus: 'synced',
      recallReason: reason
    });

    needed -= canTake;
  }

  return { events };
}

/**
 * Offline Storage & Event-Based Idempotency Layer (Section 33, 34, 35, 36)
 */
export function getOfflineEvents(): ProductionEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineEvents(events: ProductionEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('Failed to write offline kitchen events:', err);
  }
}

export function getProcessedEventIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PROCESSED_EVENT_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markEventIdProcessed(eventId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getProcessedEventIds();
    ids.add(eventId);
    localStorage.setItem(PROCESSED_EVENT_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch (err) {
    console.error('Failed to mark event id as processed:', err);
  }
}
