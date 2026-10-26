import { scopeServiceTables } from './waiterHelpers';
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RestaurantTable } from '../../types';
import { WaiterTablesGridView } from './WaiterTablesGridView';
import { CaptainWaiterVisibility } from './CaptainWaiterVisibility';
import { getTableDisplayStatus, formatCurrency } from './waiterHelpers';
import {
  Store,
  ClipboardList,
  BellRing,
  Receipt,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Utensils
} from 'lucide-react';

interface WaiterDashboardProps {
  onSelectTable: (table: RestaurantTable) => void;
  onPunchOrder: (table: RestaurantTable) => void;
  onOpenBill: (tableNumber: string) => void;
  onRequestBill: (table: RestaurantTable) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const WaiterDashboard: React.FC<WaiterDashboardProps> = ({
  onSelectTable,
  onPunchOrder,
  onOpenBill,
  onRequestBill,
  onNavigateToTab
}) => {
  const {
    activeRestaurantId,
    tables,
    orders,
    kitchenTickets,
    waiterRequests,
    currentUser,
    effectiveRole,
    updateKitchenTicketStatus,
    updateOrderItemStatus,
    updateOrderStatus
  } = useApp();

  const [selectedWaiterFilter, setSelectedWaiterFilter] = useState<string | null>(null);

  const isRegularWaiter = currentUser.role === 'WAITER';
  const scopedTables = useMemo(() => scopeServiceTables(tables, activeRestaurantId, currentUser), [tables, activeRestaurantId, currentUser]);
  const assignedTableNumbers = scopedTables.map(table => table.number);
  const scopedOrders = useMemo(() => orders.filter(order => order.restaurantId === activeRestaurantId &&
    (!isRegularWaiter || scopedTables.some(table => table.id === order.tableId))), [orders, activeRestaurantId, isRegularWaiter, scopedTables]);

  // Compute table status breakdown
  const stats = useMemo(() => {
    let activeOrdersCount = 0;
    let billsRequestedCount = 0;
    let paymentPendingCount = 0;
    const readyCount = scopedOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && (o.status === 'ready' || o.items.some(i => i.status === 'ready'))).length;

    scopedTables.forEach(table => {
      const status = getTableDisplayStatus(table, scopedOrders, kitchenTickets);
      if (status === 'BILL REQUESTED') billsRequestedCount++;
      if (status === 'PAYMENT PENDING') paymentPendingCount++;

    });

    activeOrdersCount = scopedOrders.filter(
      o => o.status !== 'completed' && o.status !== 'cancelled'
    ).length;

    const pendingRequestsCount = waiterRequests.filter(r => {
      if (r.status !== 'pending' || !scopedTables.some(table => table.id === r.tableId)) return false;
      if (isRegularWaiter && !assignedTableNumbers.includes(r.tableNumber)) return false;
      return true;
    }).length;

    return {
      totalTables: scopedTables.length,
      activeOrders: activeOrdersCount,
      pendingRequests: pendingRequestsCount,
      billsRequested: billsRequestedCount,
      readyOrders: readyCount,
      paymentPending: paymentPendingCount
    };
  }, [scopedTables, scopedOrders, kitchenTickets, waiterRequests, isRegularWaiter, assignedTableNumbers]);

  // Find any order or ticket that is currently READY for service
  const readyOrders = useMemo(() => {
    return scopedOrders.filter(o => {
      if (o.status === 'completed' || o.status === 'cancelled') return false;
      if (o.status === 'ready') return true;
      const orderTickets = kitchenTickets.filter(kt => kt.orderId === o.id);
      return (
        orderTickets.some(kt => kt.status === 'ready') ||
        o.items.some(i => i.status === 'ready')
      );
    });
  }, [scopedOrders, kitchenTickets]);

  const handleMarkReadyServed = async (orderId: string, tableNumber: string) => {
    const result = await updateOrderStatus(orderId,'served');
    if (!result.success) window.alert(result.error || 'Unable to serve order.');
  };

  return (
    <div className="space-y-5">
      {/* Live Alert Banner: Ready Orders for immediate service */}
      {readyOrders.length > 0 && (
        <div className="bg-[#2D5A3D] text-white p-4 rounded-2xl shadow-md border border-[#1b3b27] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-[#C5A86A] flex items-center justify-center font-bold animate-bounce shrink-0">
              🛎️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm text-[#F7F4EC] tracking-wide">
                  READY FOR TABLE SERVICE ({readyOrders.length})
                </span>
                <span className="px-2 py-0.5 bg-[#C5A86A] text-[#163024] rounded-full text-[10px] font-black uppercase">
                  Pick Up Now
                </span>
              </div>
              <p className="text-xs text-[#DDD8C9] mt-0.5">
                {readyOrders.map(o => `Table ${o.tableNumber} (#${o.orderNumber})`).join(' • ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {readyOrders.slice(0, 2).map(o => (
              <button
                key={o.id}
                onClick={() => handleMarkReadyServed(o.id, o.tableNumber)}
                className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                Mark Table {o.tableNumber} Served
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tables / My Tables */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#687067]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isRegularWaiter ? 'My Tables' : "Today's Tables"}
            </span>
            <Store className="w-4 h-4 text-[#526B4A]" />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl text-[#163024]">{stats.totalTables}</span>
            <span className="text-[10px] text-[#526B4A] font-semibold block">
              {isRegularWaiter ? assignedTableNumbers.join(', ') : activeRestaurantId}
            </span>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#687067]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Orders</span>
            <ClipboardList className="w-4 h-4 text-[#526B4A]" />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl text-[#163024]">{stats.activeOrders}</span>
            <span className="text-[10px] text-[#526B4A] font-medium block">Running tabs</span>
          </div>
        </div>

        {/* Ready Orders */}
        <div
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${
            stats.readyOrders > 0
              ? 'bg-[#2D5A3D]/10 border-[#2D5A3D]/40 text-[#2D5A3D]'
              : 'bg-white border-[#DDD8C9] text-[#163024]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready Orders</span>
            <span
              className={`w-2 h-2 rounded-full ${
                stats.readyOrders > 0 ? 'bg-[#2D5A3D] animate-ping' : 'bg-[#DDD8C9]'
              }`}
            />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl">{stats.readyOrders}</span>
            <span className="text-[10px] block opacity-80">Ready at counter</span>
          </div>
        </div>

        {/* Service Requests */}
        <div
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${
            stats.pendingRequests > 0
              ? 'bg-[#B45309]/10 border-[#B45309]/40 text-[#B45309]'
              : 'bg-white border-[#DDD8C9] text-[#163024]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">Service Calls</span>
            <BellRing className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl">{stats.pendingRequests}</span>
            <span className="text-[10px] block opacity-80">Guest requests</span>
          </div>
        </div>

        {/* Bills Requested */}
        <div
          className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${
            stats.billsRequested > 0
              ? 'bg-[#C5A86A]/20 border-[#C5A86A] text-[#163024]'
              : 'bg-white border-[#DDD8C9] text-[#163024]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bills Requested</span>
            <Receipt className="w-4 h-4 text-[#C5A86A]" />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl">{stats.billsRequested}</span>
            <span className="text-[10px] block text-[#687067]">Print & present</span>
          </div>
        </div>

        {/* Payment Pending */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#687067]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Payment Pending</span>
            <DollarSign className="w-4 h-4 text-[#526B4A]" />
          </div>
          <div className="mt-2">
            <span className="font-serif font-bold text-2xl text-[#163024]">{stats.paymentPending}</span>
            <span className="text-[10px] text-[#687067] block">Awaiting payment</span>
          </div>
        </div>
      </div>

      {/* Captain Waiter Service Visibility & Roster (Phase 2 Requirement 2 & 3) */}
      {(effectiveRole === 'WAITER_MANAGER' || currentUser.role === 'WAITER_MANAGER') && (
        <CaptainWaiterVisibility
          selectedWaiterFilter={selectedWaiterFilter}
          onFilterByWaiter={waiterName => setSelectedWaiterFilter(waiterName)}
          onSelectTable={onSelectTable}
        />
      )}

      {/* Main Table Grid View */}
      <WaiterTablesGridView
        onSelectTable={onSelectTable}
        onPunchOrder={onPunchOrder}
        onOpenBill={onOpenBill}
        onRequestBill={onRequestBill}
        waiterFilter={selectedWaiterFilter}
        onClearWaiterFilter={() => setSelectedWaiterFilter(null)}
      />
    </div>
  );
};
