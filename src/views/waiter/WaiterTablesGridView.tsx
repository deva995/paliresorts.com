import { scopeServiceTables, findCurrentTableOrder, elapsedDiningMinutes as calculateElapsedDiningMinutes } from './waiterHelpers';
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RestaurantTable, Order } from '../../types';
import {
  getTableDisplayStatus,
  getTableStatusTheme,
  maskPhoneNumber,
  formatCurrency,
  WaiterTableDisplayStatus
} from './waiterHelpers';
import {
  Search,
  Filter,
  Users,
  UtensilsCrossed,
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  Phone,
  Sparkles,
  AlertCircle,
  Eye,
  RefreshCw,
  ArrowUpDown,
  BellRing,
  X
} from 'lucide-react';

export type WaiterSortOption =
  | 'readyFirst'
  | 'availableFirst'
  | 'status'
  | 'tableNumber'
  | 'customerName'
  | 'orderValue'
  | 'waitingTime';

interface WaiterTablesGridViewProps {
  onSelectTable: (table: RestaurantTable) => void;
  onPunchOrder: (table: RestaurantTable) => void;
  onOpenBill: (tableNumber: string) => void;
  onRequestBill: (table: RestaurantTable) => void;
  waiterFilter?: string | null;
  onClearWaiterFilter?: () => void;
}

// Operational sorting ranks as specified in Requirement 12
const READY_FIRST_RANKS: Record<WaiterTableDisplayStatus, number> = {
  'READY': 1,
  'AVAILABLE': 2,
  'BILL REQUESTED': 3,
  'PAYMENT PENDING': 4,
  'ORDERING': 5,
  'PREPARING': 6,
  'OCCUPIED': 7,
  'PAID': 8,
  'CLEANING': 9,
  'OUT OF SERVICE': 10
};

const AVAILABLE_FIRST_RANKS: Record<WaiterTableDisplayStatus, number> = {
  'AVAILABLE': 1,
  'READY': 2,
  'BILL REQUESTED': 3,
  'PAYMENT PENDING': 4,
  'ORDERING': 5,
  'PREPARING': 6,
  'OCCUPIED': 7,
  'PAID': 8,
  'CLEANING': 9,
  'OUT OF SERVICE': 10
};

const STATUS_RANKS: Record<WaiterTableDisplayStatus, number> = {
  'AVAILABLE': 1,
  'OCCUPIED': 2,
  'ORDERING': 3,
  'PREPARING': 4,
  'READY': 5,
  'BILL REQUESTED': 6,
  'PAYMENT PENDING': 7,
  'PAID': 8,
  'CLEANING': 9,
  'OUT OF SERVICE': 10
};

export const WaiterTablesGridView: React.FC<WaiterTablesGridViewProps> = ({
  onSelectTable,
  onPunchOrder,
  onOpenBill,
  onRequestBill,
  waiterFilter,
  onClearWaiterFilter
}) => {
  const {
    activeRestaurantId,
    tables,
    orders,
    kitchenTickets,
    currentUser,
    updateOrderItemStatus,
    updateOrderStatus,
    updateKitchenTicketStatus
  } = useApp();

  // Regular Waiter table isolation: Amit Deshmukh sees ONLY assigned tables (T-01 to T-05)
  const isRegularWaiter = currentUser.role === 'WAITER';
  const scopedTables = useMemo(() => scopeServiceTables(tables, activeRestaurantId, currentUser)
    .filter(table => !waiterFilter || table.waiterName === waiterFilter), [tables, activeRestaurantId, currentUser, waiterFilter]);
  const assignedTableNumbers = scopedTables.map(table => table.number);
  const scopedOrders = useMemo(() => orders.filter(order => order.restaurantId === activeRestaurantId &&
    (!isRegularWaiter || scopedTables.some(table => table.id === order.tableId))), [orders, activeRestaurantId, isRegularWaiter, scopedTables]);

  // Filters & Sorting state
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<WaiterSortOption>('readyFirst'); // Default: Ready First (with Available second)
  const [servedToast, setServedToast] = useState<string | null>(null);

  // Sections
  const sections = useMemo(() => {
    const list = Array.from(new Set(scopedTables.map(t => t.section))).filter(Boolean);
    return ['all', ...list];
  }, [scopedTables]);

  // Statuses
  const allStatuses: WaiterTableDisplayStatus[] = [
    'READY',
    'AVAILABLE',
    'BILL REQUESTED',
    'PAYMENT PENDING',
    'ORDERING',
    'PREPARING',
    'OCCUPIED',
    'PAID'
  ];

  // Processed table records with their live status and order details
  const tablesWithDetails = useMemo(() => {
    return scopedTables.map(table => {
      const activeOrder = findCurrentTableOrder(table, scopedOrders);

      const displayStatus = getTableDisplayStatus(table, scopedOrders, kitchenTickets);
      const theme = getTableStatusTheme(displayStatus);

      // Preparation progress
      let readyCount = 0;
      let totalItems = 0;
      if (activeOrder) {
        totalItems = activeOrder.items.reduce((acc, i) => acc + i.quantity, 0);
        readyCount = activeOrder.items
          .filter(i => i.status === 'ready' || i.status === 'served')
          .reduce((acc, i) => acc + i.quantity, 0);
      }

      // Guest Count vs Table Capacity
      const guestCount = table.guestCount ?? 0;
      const elapsedDiningMinutes = calculateElapsedDiningMinutes(table.occupiedSince || activeOrder?.createdAt) ?? 'Unknown';

      return {
        table,
        activeOrder,
        displayStatus,
        theme,
        readyCount,
        totalItems,
        guestCount,
        elapsedDiningMinutes
      };
    });
  }, [scopedTables, scopedOrders, kitchenTickets]);

  // Filtered and Sorted tables
  const sortedAndFilteredTables = useMemo(() => {
    const list = tablesWithDetails.filter(({ table, activeOrder, displayStatus }) => {
      // Section filter
      if (selectedSection !== 'all' && table.section !== selectedSection) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && displayStatus !== selectedStatusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = table.number.toLowerCase().includes(q);
        const matchesSection = table.section.toLowerCase().includes(q);
        const matchesCustomer = activeOrder?.guestName.toLowerCase().includes(q);
        const matchesPhone = activeOrder?.guestPhone?.includes(q);
        if (!matchesNumber && !matchesSection && !matchesCustomer && !matchesPhone) {
          return false;
        }
      }

      return true;
    });

    // Sort comparator based on selected sort control
    list.sort((a, b) => {
      switch (sortBy) {
        case 'readyFirst': {
          const rankA = READY_FIRST_RANKS[a.displayStatus] || 99;
          const rankB = READY_FIRST_RANKS[b.displayStatus] || 99;
          if (rankA !== rankB) return rankA - rankB;
          return a.table.number.localeCompare(b.table.number);
        }
        case 'availableFirst': {
          const rankA = AVAILABLE_FIRST_RANKS[a.displayStatus] || 99;
          const rankB = AVAILABLE_FIRST_RANKS[b.displayStatus] || 99;
          if (rankA !== rankB) return rankA - rankB;
          return a.table.number.localeCompare(b.table.number);
        }
        case 'status': {
          const rankA = STATUS_RANKS[a.displayStatus] || 99;
          const rankB = STATUS_RANKS[b.displayStatus] || 99;
          if (rankA !== rankB) return rankA - rankB;
          return a.table.number.localeCompare(b.table.number);
        }
        case 'tableNumber':
          return a.table.number.localeCompare(b.table.number);
        case 'customerName': {
          const nameA = a.activeOrder?.guestName || 'ZZZ';
          const nameB = b.activeOrder?.guestName || 'ZZZ';
          return nameA.localeCompare(nameB);
        }
        case 'orderValue': {
          const valA = a.activeOrder?.grandTotal || 0;
          const valB = b.activeOrder?.grandTotal || 0;
          return valB - valA;
        }
        case 'waitingTime':
          return b.elapsedDiningMinutes - a.elapsedDiningMinutes;
        default:
          return 0;
      }
    });

    return list;
  }, [tablesWithDetails, selectedSection, selectedStatusFilter, searchQuery, sortBy]);

  // Mark ready items as served
  const handleMarkServed = async (e: React.MouseEvent, table: RestaurantTable, order?: Order | null) => {
    e.stopPropagation();if(!order) return;
    const result=await updateOrderStatus(order.id,'served');
    setServedToast(result.success ? `Table ${table.number}: Order served.` : result.error || 'Unable to serve order.');
    setTimeout(()=>setServedToast(null),3500);
  };

  return (
    <div className="space-y-4">
      {/* Toast confirmation */}
      {servedToast && (
        <div className="p-3 bg-[#2D5A3D] text-white rounded-xl shadow-md text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A86A]" />
            <span>{servedToast}</span>
          </div>
          <button onClick={() => setServedToast(null)} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Quick Action Bar: Search, Section, Sort & Punch Order */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Fast Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#687067] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search table # (e.g. T-04), customer name, or mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-16 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-medium text-[#1D241F] outline-none focus:border-[#163024] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-[#687067] hover:text-[#163024] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Controls (Requirement 13) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#F7F4EC] border border-[#DDD8C9] px-3 py-1.5 rounded-xl text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#526B4A] shrink-0" />
              <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider shrink-0">
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as WaiterSortOption)}
                className="bg-transparent text-xs font-bold text-[#163024] outline-none cursor-pointer pr-1"
              >
                <option value="readyFirst">Ready First (Default)</option>
                <option value="availableFirst">Available First</option>
                <option value="status">Status</option>
                <option value="tableNumber">Table Number</option>
                <option value="customerName">Customer Name</option>
                <option value="orderValue">Order Value</option>
                <option value="waitingTime">Waiting Time</option>
              </select>
            </div>

            {/* Quick Punch Order Button */}
            <button
              onClick={() => onPunchOrder(scopedTables[0])}
              className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-[#C5A86A]" />
              <span>Punch Order</span>
            </button>
          </div>
        </div>

        {/* Section and Status Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#DDD8C9]/60 pt-2.5 text-xs">
          {/* Status Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar flex-1">
            <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider mr-1 shrink-0">
              Filter:
            </span>
            <button
              onClick={() => setSelectedStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatusFilter === 'all'
                  ? 'bg-[#163024] text-[#F7F4EC]'
                  : 'bg-white hover:bg-[#F7F4EC] text-[#687067] border border-[#DDD8C9]'
              }`}
            >
              All ({tablesWithDetails.length})
            </button>
            {allStatuses.map(status => {
              const count = tablesWithDetails.filter(t => t.displayStatus === status).length;
              if (count === 0 && selectedStatusFilter !== status) return null;
              const theme = getTableStatusTheme(status);
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStatusFilter === status
                      ? `${theme.badgeBg} ${theme.badgeText} shadow-xs`
                      : 'bg-white hover:bg-[#F7F4EC] text-[#1D241F] border border-[#DDD8C9]'
                  }`}
                >
                  <span>{theme.label}</span>
                  <span className="opacity-80 font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Section Indicator */}
          {isRegularWaiter && (
            <span className="text-[11px] font-mono text-[#526B4A] bg-[#526B4A]/10 px-2.5 py-1 rounded-lg shrink-0 font-bold">
              Station: {assignedTableNumbers.join(', ')}
            </span>
          )}

          {/* Active Waiter Filter Indicator */}
          {waiterFilter && (
            <div className="flex items-center gap-1.5 bg-[#163024] text-[#F7F4EC] px-2.5 py-1 rounded-lg text-xs font-bold shrink-0">
              <span>Server: {waiterFilter}</span>
              {onClearWaiterFilter && (
                <button
                  type="button"
                  onClick={onClearWaiterFilter}
                  className="text-[#C5A86A] hover:text-white cursor-pointer ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Responsive Table Grid View */}
      {sortedAndFilteredTables.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#DDD8C9] text-center space-y-2">
          <UtensilsCrossed className="w-10 h-10 text-[#DDD8C9] mx-auto" />
          <h3 className="font-bold text-sm text-[#163024]">No tables found</h3>
          <p className="text-xs text-[#687067]">
            Try adjusting your search query, status filter, or sorting option.
          </p>
          <button
            onClick={() => {
              setSelectedSection('all');
              setSelectedStatusFilter('all');
              setSearchQuery('');
              setSortBy('readyFirst');
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F4EC] text-[#163024] rounded-lg text-xs font-bold border border-[#DDD8C9] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
          {sortedAndFilteredTables.map(item => {
            const {
              table,
              activeOrder,
              displayStatus,
              theme,
              readyCount,
              totalItems,
              guestCount,
              elapsedDiningMinutes
            } = item;

            const isReady = displayStatus === 'READY';
            const isBillRequested = displayStatus === 'BILL REQUESTED';
            const isAvailable = displayStatus === 'AVAILABLE';
            const isPaid = displayStatus === 'PAID';

            // Distinct rendering for READY TABLE (Requirement 14)
            if (isReady) {
              return (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table)}
                  className="group rounded-2xl border-2 border-[#2D5A3D] bg-[#2D5A3D]/5 p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg relative overflow-hidden ring-2 ring-[#2D5A3D]/40 ring-offset-2"
                >
                  {/* Top Status Accent Bar */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#2D5A3D]" />

                  <div>
                    {/* Header: Table Number & Prominent READY FOR SERVICE Badge */}
                    <div className="flex items-start justify-between gap-1 mb-2.5">
                      <div>
                        <span className="font-serif font-black text-2xl text-[#163024] tracking-tight">
                          TABLE {table.number}
                        </span>
                        <span className="block text-[10px] text-[#526B4A] font-semibold mt-0.5">
                          {table.section}
                        </span>
                      </div>

                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-[#2D5A3D] text-white shadow-xs animate-pulse flex items-center gap-1">
                        <BellRing className="w-3 h-3 text-[#C5A86A]" />
                        <span>READY FOR SERVICE</span>
                      </span>
                    </div>

                    {/* Customer Name & Guest Count vs Capacity */}
                    <div className="space-y-1.5 pt-2 border-t border-[#2D5A3D]/20 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#163024] truncate">
                          {activeOrder?.guestName || 'Guest name not provided'}
                        </span>
                        <span className="text-[11px] font-bold text-[#163024] bg-white px-2 py-0.5 rounded-md border border-[#DDD8C9]">
                          {guestCount} Guests / {table.capacity} Seats
                        </span>
                      </div>

                      {/* Running Order Amount */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-[#687067]">Current Order:</span>
                        <span className="font-serif font-bold text-sm text-[#163024]">
                          {formatCurrency(activeOrder?.grandTotal ?? 0)}
                        </span>
                      </div>

                      {/* Kitchen Readiness & Waiting Time */}
                      <div className="bg-white/80 p-2 rounded-xl border border-[#2D5A3D]/30 space-y-1 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#2D5A3D]">
                          <span>Kitchen:</span>
                          <span>{`${readyCount} Items Ready`}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#687067] font-mono">
                          <span>Waiting:</span>
                          <span className="font-bold text-[#B45309]">{elapsedDiningMinutes} min</span>
                        </div>
                        <div className="text-[10px] text-[#526B4A] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Dining: {elapsedDiningMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions for READY table: [ VIEW ORDER ] and [ MARK SERVED ] */}
                  <div className="pt-3 border-t border-[#2D5A3D]/20 mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectTable(table);
                      }}
                      className="py-2 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#526B4A]" />
                      <span>VIEW ORDER</span>
                    </button>

                    <button
                      type="button"
                      onClick={e => handleMarkServed(e, table, activeOrder)}
                      className="py-2 bg-[#2D5A3D] hover:bg-[#234730] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A86A]" />
                      <span>MARK SERVED</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Distinct rendering for AVAILABLE TABLE (Requirement 15)
            if (isAvailable) {
              return (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table)}
                  className="group rounded-2xl border border-[#DDD8C9] bg-white hover:bg-[#FDFBF7] p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#526B4A]" />

                  <div>
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div>
                        <span className="font-serif font-black text-2xl text-[#163024] tracking-tight">
                          TABLE {table.number}
                        </span>
                        <span className="block text-[10px] text-[#687067] font-medium mt-0.5">
                          {table.section}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9]">
                        AVAILABLE
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#DDD8C9]/60 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#163024] text-xs">Ready for Guests</span>
                        <span className="text-[11px] font-mono text-[#526B4A] bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#DDD8C9]">
                          {table.capacity} Seats
                        </span>
                      </div>
                      <p className="text-[11px] text-[#687067] italic pt-1">
                        Clean and ready for seating.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#DDD8C9]/60 mt-3">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onPunchOrder(table);
                      }}
                      className="w-full py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
                      <span>START ORDER</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Standard card for OCCUPIED, ORDERING, PREPARING, BILL REQUESTED, PAYMENT PENDING, PAID
            return (
              <div
                key={table.id}
                onClick={() => onSelectTable(table)}
                className={`group rounded-2xl border ${theme.borderColor} ${theme.cardBg} p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md relative overflow-hidden`}
              >
                {/* Top Status Accent Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: theme.accentColor }}
                />

                {/* Card Header: Table Number & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div>
                      <span className="font-serif font-black text-xl text-[#163024] tracking-tight group-hover:text-[#526B4A] transition-colors">
                        TABLE {table.number}
                      </span>
                      <span className="block text-[10px] text-[#687067] font-medium leading-none mt-0.5">
                        {table.section}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-center shrink-0 ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {theme.label}
                    </span>
                  </div>

                  {/* Customer Information & Capacity */}
                  <div className="space-y-1.5 my-2 pt-2 border-t border-[#DDD8C9]/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#163024] truncate text-xs">
                        {activeOrder?.guestName || 'Resort Guest'}
                      </span>
                      <span className="text-[10px] font-bold text-[#163024] bg-white px-1.5 py-0.5 rounded border border-[#DDD8C9] shrink-0">
                        {guestCount} Guests / {table.capacity} Seats
                      </span>
                    </div>

                    {/* Masked phone */}
                    <div className="text-[10px] font-mono text-[#687067] flex items-center gap-1 truncate">
                      <Phone className="w-2.5 h-2.5 text-[#526B4A]" />
                      <span>{maskPhoneNumber(activeOrder?.guestPhone)}</span>
                    </div>

                    {/* Current Order Amount & Elapsed Dining Time */}
                    {activeOrder ? (
                      <div className="pt-1 space-y-1 border-t border-[#DDD8C9]/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#687067]">Order Amount:</span>
                          <span className="font-serif font-bold text-xs text-[#163024]">
                            {formatCurrency(activeOrder.grandTotal)}
                          </span>
                        </div>

                        {totalItems > 0 && (
                          <div className="text-[10px] text-[#526B4A] font-medium flex items-center justify-between">
                            <span>Kitchen Progress:</span>
                            <span className="font-mono">
                              {readyCount}/{totalItems} ready
                            </span>
                          </div>
                        )}

                        <div className="text-[10px] text-[#687067] flex items-center justify-between pt-0.5">
                          <span>Elapsed Time:</span>
                          <span className="font-mono font-medium text-[#163024]">
                            Dining: {elapsedDiningMinutes} min
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 text-[10px] text-[#687067] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#526B4A]" />
                        <span>Dining: {elapsedDiningMinutes} min</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-[#DDD8C9]/60 mt-1 flex items-center gap-1.5">
                  {isBillRequested ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onOpenBill(table.number);
                      }}
                      className="w-full py-1.5 bg-[#C5A86A] hover:bg-[#b09457] text-[#163024] rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>View Bill</span>
                    </button>
                  ) : (
                    <div className="w-full grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onPunchOrder(table);
                        }}
                        className="py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#526B4A]" />
                        <span>+ Add</span>
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenBill(table.number);
                        }}
                        className="py-1.5 bg-[#F7F4EC] hover:bg-[#DDD8C9]/50 text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Receipt className="w-3 h-3 text-[#C5A86A]" />
                        <span>Bill</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
