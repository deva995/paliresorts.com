import { RestaurantTable, Order, KitchenTicket, User } from '../../types';

export type WaiterTableDisplayStatus =
  | 'CLEANING'
  | 'OUT OF SERVICE'
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'ORDERING'
  | 'PREPARING'
  | 'READY'
  | 'BILL REQUESTED'
  | 'PAYMENT PENDING'
  | 'PAID';

export interface TableStatusInfo {
  status: WaiterTableDisplayStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  borderColor: string;
  accentColor: string;
  description: string;
}

/**
 * Privacy-preserving phone masking: e.g. +91 ******4521
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone || phone.trim() === '') {
    return 'Not provided';
  }
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `+91 ******${last4}`;
  }
  return 'Not provided';
}

/**
 * Format currency with Indian Rupee symbol and commas
 */
export function formatCurrency(amount: number): string {
  if (amount == null || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Authoritative table state determination combining table status, active orders, and KDS tickets.
 */
export function getTableDisplayStatus(
  table: RestaurantTable,
  orders: Order[],
  kitchenTickets: KitchenTicket[] = []
): WaiterTableDisplayStatus {
  if(table.status==='cleaning') return 'CLEANING';
  if(table.status==='out_of_service') return 'OUT OF SERVICE';
  const activeOrder = findCurrentTableOrder(table, orders);
  const currentOrders = orders.filter(order => orderBelongsToTable(order, table) && order.status !== 'cancelled' && order.status !== 'completed');

  // If table is explicitly marked billed or order bill was requested
  if (table.status === 'billed' || activeOrder?.billStatus === 'requested') {
    if (activeOrder?.paymentStatus === 'pending') {
      return 'BILL REQUESTED';
    }
  }

  // If order is paid
  if (activeOrder && activeOrder.paymentStatus === 'paid') {
    return 'PAID';
  }

  if (activeOrder) {
    // Check if table order has pending payment after bill settlement
    if (activeOrder.billStatus === 'settled' && activeOrder.paymentStatus === 'pending') {
      return 'PAYMENT PENDING';
    }

    // Check kitchen tickets for this order
    const orderTickets = kitchenTickets.filter(
      kt => currentOrders.some(order => order.id === kt.orderId)
    );

    // If any ticket or item is ready for service
    const hasReady =
      orderTickets.some(kt => kt.status === 'ready') ||
      currentOrders.some(order => order.status === 'ready' || order.items.some(i => i.status === 'ready'));
    if (hasReady) {
      return 'READY';
    }

    // If any ticket or item is preparing / in-progress
    const isPreparing =
      orderTickets.some(kt => kt.status === 'preparing') ||
      currentOrders.some(order => order.status === 'preparing' || order.items.some(i => i.status === 'preparing'));
    if (isPreparing) {
      return 'PREPARING';
    }

    // If order was just placed / new
    if (
      activeOrder.status === 'placed' ||
      activeOrder.status === 'confirmed' ||
      orderTickets.some(kt => kt.status === 'new')
    ) {
      return 'ORDERING';
    }

    return 'OCCUPIED';
  }

  if (table.status === 'occupied') {
    return 'OCCUPIED';
  }

  if (table.status === 'reserved') {
    return 'OCCUPIED';
  }

  return 'AVAILABLE';
}

/**
 * Natural, elegant Pali Resort & Club status styling
 * Deep Forest Green: #163024
 * Muted Olive: #526B4A
 * Champagne Gold: #C5A86A
 * Warm Ivory: #F7F4EC
 * Natural Border: #DDD8C9
 */
export function getTableStatusTheme(status: WaiterTableDisplayStatus): TableStatusInfo {
  switch (status) {
    case 'CLEANING':
    case 'OUT OF SERVICE':
      return {status,label:status,badgeBg:'bg-slate-200',badgeText:'text-slate-800',cardBg:'bg-slate-50',borderColor:'border-slate-300',accentColor:'#64748b',description:'Not available for seating'};
    case 'AVAILABLE':
      return {
        status,
        label: 'AVAILABLE',
        badgeBg: 'bg-[#F7F4EC]',
        badgeText: 'text-[#526B4A]',
        cardBg: 'bg-white hover:bg-[#FDFBF7]',
        borderColor: 'border-[#DDD8C9]',
        accentColor: '#526B4A',
        description: 'Ready for new guests'
      };

    case 'OCCUPIED':
      return {
        status,
        label: 'OCCUPIED',
        badgeBg: 'bg-[#163024]',
        badgeText: 'text-[#F7F4EC]',
        cardBg: 'bg-white hover:bg-[#F7F4EC]/50',
        borderColor: 'border-[#163024]/40',
        accentColor: '#163024',
        description: 'Guests seated'
      };

    case 'ORDERING':
      return {
        status,
        label: 'ORDERING',
        badgeBg: 'bg-[#526B4A]',
        badgeText: 'text-[#F7F4EC]',
        cardBg: 'bg-white hover:bg-[#F7F4EC]/60',
        borderColor: 'border-[#526B4A]/50',
        accentColor: '#526B4A',
        description: 'KOT being punched'
      };

    case 'PREPARING':
      return {
        status,
        label: 'PREPARING',
        badgeBg: 'bg-[#C5A86A]',
        badgeText: 'text-[#163024]',
        cardBg: 'bg-white hover:bg-[#FDFBF7]',
        borderColor: 'border-[#C5A86A]/60',
        accentColor: '#C5A86A',
        description: 'Kitchen is cooking'
      };

    case 'READY':
      return {
        status,
        label: 'READY FOR SERVICE',
        badgeBg: 'bg-[#2D5A3D]',
        badgeText: 'text-white shadow-xs',
        cardBg: 'bg-[#2D5A3D]/5 hover:bg-[#2D5A3D]/10',
        borderColor: 'border-[#2D5A3D]',
        accentColor: '#2D5A3D',
        description: 'Food/Drink ready at counter!'
      };

    case 'BILL REQUESTED':
      return {
        status,
        label: 'BILL REQUESTED',
        badgeBg: 'bg-[#C5A86A]',
        badgeText: 'text-[#163024] font-black',
        cardBg: 'bg-[#C5A86A]/8 hover:bg-[#C5A86A]/15',
        borderColor: 'border-[#C5A86A]',
        accentColor: '#C5A86A',
        description: 'Guest requested bill'
      };

    case 'PAYMENT PENDING':
      return {
        status,
        label: 'PAYMENT PENDING',
        badgeBg: 'bg-[#B45309]',
        badgeText: 'text-white',
        cardBg: 'bg-[#B45309]/5 hover:bg-[#B45309]/10',
        borderColor: 'border-[#B45309]/50',
        accentColor: '#B45309',
        description: 'Awaiting cash/card/UPI'
      };

    case 'PAID':
      return {
        status,
        label: 'PAID / SETTLED',
        badgeBg: 'bg-[#526B4A]',
        badgeText: 'text-white',
        cardBg: 'bg-[#526B4A]/5 hover:bg-[#526B4A]/10',
        borderColor: 'border-[#526B4A]/40',
        accentColor: '#526B4A',
        description: 'Bill paid — ready to release'
      };
  }
}

/** Use persisted staff IDs; an empty assignment must never expose the whole floor. */
export function scopeServiceTables(tables: RestaurantTable[], outletId: string | undefined, user: Pick<User, 'id' | 'role'>): RestaurantTable[] {
  return tables.filter(table => Boolean(outletId) && table.restaurantId === outletId &&
    (user.role !== 'WAITER' || table.waiterId === user.id));
}

export function orderBelongsToTable(order: Order, table: RestaurantTable): boolean {
  if (!table.restaurantId || order.restaurantId !== table.restaurantId) return false;
  if (table.activeSessionId) return order.diningSessionId === table.activeSessionId;
  if (order.diningSessionId) return false;
  return order.tableId ? order.tableId === table.id : order.tableNumber === table.number;
}

export function findCurrentTableOrder(table: RestaurantTable, orders: Order[]): Order | undefined {
  if (table.status === 'available' && !table.activeSessionId) return undefined;
  const matching = orders.filter(order => orderBelongsToTable(order, table) && order.status !== 'cancelled');
  return matching.find(order => order.status === 'ready' || order.items.some(item => item.status === 'ready')) ||
    matching.find(order => order.id === table.currentOrderId) ||
    matching.find(order => order.paymentStatus !== 'paid' && order.status !== 'completed') ||
    (table.activeSessionId ? matching[0] : undefined);
}

export function elapsedDiningMinutes(startedAt?: string, now = Date.now()): number | undefined {
  const started = startedAt ? Date.parse(startedAt) : NaN;
  return Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 60000)) : undefined;
}
