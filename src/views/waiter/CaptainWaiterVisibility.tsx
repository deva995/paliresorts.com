import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RestaurantTable, Order, WaiterRequest } from '../../types';
import { getTableDisplayStatus, formatCurrency } from './waiterHelpers';
import {
  Users,
  Store,
  UtensilsCrossed,
  CheckCircle2,
  BellRing,
  ClipboardList,
  AlertTriangle,
  UserCheck,
  Plus,
  ArrowRight,
  Filter,
  Check,
  X,
  Clock,
  Sparkles
} from 'lucide-react';

interface CaptainWaiterVisibilityProps {
  onFilterByWaiter?: (waiterName: string | null) => void;
  onSelectTable?: (table: RestaurantTable) => void;
  selectedWaiterFilter?: string | null;
}

export const CaptainWaiterVisibility: React.FC<CaptainWaiterVisibilityProps> = ({
  onFilterByWaiter,
  onSelectTable,
  selectedWaiterFilter
}) => {
  const {
    tables,
    orders,
    waiterRequests,
    kitchenTickets,
    assignTableToWaiter,
    unassignTable,
    floorStaff,
    activeRestaurantId
  } = useApp();

  const [assignModalWaiter, setAssignModalWaiter] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const floorWaiters = useMemo(() => floorStaff.map(staff=>({...staff, email:undefined,phone:undefined,avatar:undefined,department:'Floor service',shift:''})), [floorStaff]);
  const [assignmentError,setAssignmentError]=useState('');
  const [assignmentBusy,setAssignmentBusy]=useState(false);

  // Restaurant tables scoped to rest-1
  const rest1Tables = useMemo(() => tables.filter(t => t.restaurantId === activeRestaurantId), [tables,activeRestaurantId]);
  const rest1Orders = useMemo(() => orders.filter(o => o.restaurantId === activeRestaurantId), [orders,activeRestaurantId]);

  // Unassigned tables (no active server)
  const unassignedTables = useMemo(() => {
    return rest1Tables.filter(t => !t.waiterId);
  }, [rest1Tables]);

  // Compute visibility metrics for each waiter
  const waiterMetrics = useMemo(() => {
    return floorWaiters.map(waiter => {
      // 1. Assigned tables
      const assigned = rest1Tables.filter(t => t.waiterId === waiter.id);
      const assignedTableNumbers = assigned.map(t => t.number);

      // 2. Currently serving: tables with active dining / order in progress
      const currentlyServingTables = assigned.filter(t => {
        const displayStatus = getTableDisplayStatus(t, rest1Orders, kitchenTickets);
        const hasActiveOrder = rest1Orders.some(
          o => o.tableNumber === t.number && o.status !== 'completed' && o.status !== 'cancelled'
        );
        return (
          t.status === 'occupied' ||
          displayStatus === 'OCCUPIED' ||
          displayStatus === 'ORDERING' ||
          displayStatus === 'PREPARING' ||
          displayStatus === 'READY' ||
          hasActiveOrder
        );
      });

      // 3. Served / completed tables:
      // Clearly tracks how many tables this waiter has served / completed
      const servedCompletedSet = new Set<string>();

      // Check assigned tables where display status is served/paid/billed
      assigned.forEach(t => {
        const displayStatus = getTableDisplayStatus(t, rest1Orders, kitchenTickets);
        const activeOrder = rest1Orders.find(
          o => o.tableNumber === t.number && o.status !== 'completed' && o.status !== 'cancelled'
        );
        if (
          displayStatus === 'PAID' ||
          displayStatus === 'BILL REQUESTED' ||
          activeOrder?.status === 'served' ||
          t.status === 'billed'
        ) {
          servedCompletedSet.add(t.number);
        }
      });

      // Also check orders explicitly served or completed by this waiter
      rest1Orders.forEach(o => {
        if (
          (o.waiterName === waiter.name || assignedTableNumbers.includes(o.tableNumber)) &&
          (o.status === 'served' || o.status === 'completed' || o.paymentStatus === 'paid')
        ) {
          servedCompletedSet.add(o.tableNumber);
        }
      });

      const servedCompletedTables = Array.from(servedCompletedSet);
      const servedCompletedCount = servedCompletedTables.length;

      // 4. Pending service requests
      const pendingRequests = waiterRequests.filter(
        r => r.status === 'pending' && assignedTableNumbers.includes(r.tableNumber)
      );

      // 5. Active orders
      const activeOrders = rest1Orders.filter(
        o => o.status !== 'completed' && o.status !== 'cancelled' && assignedTableNumbers.includes(o.tableNumber)
      );
      const activeOrdersTotal = activeOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

      return {
        ...waiter,
        assignedTables: assigned,
        assignedTableCount: assigned.length,
        assignedTableNumbers,
        currentlyServingTables,
        currentlyServingCount: currentlyServingTables.length,
        servedCompletedTables,
        servedCompletedCount,
        pendingRequests,
        pendingServiceCount: pendingRequests.length,
        activeOrders,
        activeOrdersCount: activeOrders.length,
        activeOrdersTotal
      };
    });
  }, [floorWaiters, rest1Tables, rest1Orders, kitchenTickets, waiterRequests]);

  // Aggregate floor totals
  const totalFloorTables = rest1Tables.length;
  const totalAssignedTables = rest1Tables.length - unassignedTables.length;
  const totalCurrentlyServing = waiterMetrics.reduce((sum, w) => sum + w.currentlyServingCount, 0);
  const totalTablesServed = waiterMetrics.reduce((sum, w) => sum + w.servedCompletedCount, 0);

  const handleAssignTableToWaiter = async (tableId:string,waiterId:string) => {
    if (assignmentBusy) return;
    const waiter=floorStaff.find(staff=>staff.id===waiterId);
    if (!waiter) {setAssignmentError('Select a current outlet staff member.');return;}
    setAssignmentBusy(true);setAssignmentError('');
    try { const result=await assignTableToWaiter(tableId,waiter.name,waiter.id);
      if (!result.success) {setAssignmentError(result.error || 'Assignment failed.');return;}
      showToast(`Table assigned to ${waiter.name}.`);setAssignModalWaiter(null);
    } finally {setAssignmentBusy(false);}
  };
  const handleUnassignTable = async (tableId:string,tableNumber:string) => {
    if (assignmentBusy) return;
    const table = rest1Tables.find(current => current.id === tableId);
    if (table && (table.activeSessionId || table.status === 'occupied' || table.status === 'billed') &&
      !window.confirm(`Release the staff assignment for Table ${tableNumber}? The dining session will remain open.`)) return;
    setAssignmentBusy(true);setAssignmentError('');
    try {const result=await unassignTable(tableId);
      if (!result.success) {setAssignmentError(result.error || 'Release failed.');return;}
      showToast(`Table ${tableNumber} released.`);
    } finally {setAssignmentBusy(false);}
  };

  return (
    <div className="space-y-4 font-sans">
      {assignmentError && <p role="alert">{assignmentError}</p>}
      {/* Toast Feedback */}
      {successToast && (
        <div className="bg-[#2D5A3D] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-150 border border-[#1b3b27]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A86A]" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Panel with Operational Floor Summary */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DDD8C9] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#DDD8C9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#163024] text-[#C5A86A] flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-base sm:text-lg text-[#163024] tracking-tight">
                  WAITER SERVICE VISIBILITY & TABLE COVERAGE
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#163024] text-[#F7F4EC] text-[10px] font-bold uppercase tracking-wider">
                  Captain Supervision
                </span>
              </div>
              <p className="text-xs text-[#687067] mt-0.5">
                Real-time server floor coverage, active guest serving, completed table counts, and open table allocations.
              </p>
            </div>
          </div>

          {selectedWaiterFilter && (
            <button
              onClick={() => onFilterByWaiter?.(null)}
              className="px-3 py-1.5 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Showing: {selectedWaiterFilter}</span>
              <X className="w-3.5 h-3.5 text-[#C53030]" />
            </button>
          )}
        </div>

        {/* 4 Floor Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5">
          <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9]/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#687067] block">
              Active Servers on Duty
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif font-black text-xl text-[#163024]">{floorWaiters.length}</span>
              <span className="text-[11px] text-[#526B4A] font-semibold">servers active</span>
            </div>
          </div>

          <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9]/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#687067] block">
              Assigned vs Unassigned
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif font-black text-xl text-[#163024]">{totalAssignedTables}</span>
              <span className="text-[11px] text-[#687067]">
                / {totalFloorTables} tables ({unassignedTables.length} open)
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9]/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#687067] block">
              Currently Serving
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif font-black text-xl text-[#B45309]">{totalCurrentlyServing}</span>
              <span className="text-[11px] text-[#687067]">tables dining now</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
              Total Tables Served
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-serif font-black text-xl text-emerald-950">{totalTablesServed}</span>
              <span className="text-[11px] text-emerald-800 font-semibold">tables served</span>
            </div>
          </div>
        </div>

        {/* Unassigned Tables Callout Banner */}
        {unassignedTables.length > 0 && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold">
                  {unassignedTables.length} Floor Tables Have No Active Server:
                </span>{' '}
                <span className="font-medium text-amber-900">
                  {unassignedTables.map(t => `${t.number} (${t.section})`).join(', ')}.
                </span>
                <span className="text-[11px] block text-amber-800">
                  Waiters can self-assign these tables from their floor console, or Captain can allocate them below.
                </span>
              </div>
            </div>

            <button
              onClick={() => setAssignModalWaiter(floorWaiters[0]?.name || null)}
              className="px-3 py-1.5 bg-[#163024] hover:bg-[#2D5A3D] text-[#C5A86A] font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              + Quick Allocate Table
            </button>
          </div>
        )}
      </div>

      {/* Waiter Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {waiterMetrics.map(waiter => {
          const isFilterActive = selectedWaiterFilter === waiter.name;

          return (
            <div
              key={waiter.id}
              className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs flex flex-col justify-between gap-4 ${
                isFilterActive
                  ? 'border-[#163024] ring-2 ring-[#C5A86A]/60 shadow-md'
                  : 'border-[#DDD8C9] hover:border-[#163024]'
              }`}
            >
              {/* Waiter Identity & Shift Info */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DDD8C9]/70">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {waiter.avatar ? (
                      <img
                        src={waiter.avatar}
                        alt={waiter.name}
                        className="w-11 h-11 rounded-xl object-cover border border-[#DDD8C9]"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] flex items-center justify-center font-bold text-[#163024]">
                        {waiter.name.charAt(0)}
                      </div>
                    )}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif font-bold text-base text-[#163024]">
                        {waiter.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9] text-[10px] font-bold uppercase">
                        Floor Server
                      </span>
                    </div>
                    <p className="text-xs text-[#687067] mt-0.5">
                      {waiter.department || 'Floor Service'} • {waiter.shift || 'Morning Shift'}
                    </p>
                  </div>
                </div>

                {/* Assigned Table Count Pill */}
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#687067] block">
                    Assigned Tables
                  </span>
                  <span className="font-serif font-black text-lg text-[#163024]">
                    {waiter.assignedTableCount}
                  </span>
                </div>
              </div>

              {/* Service Visibility Breakdown */}
              <div className="space-y-3 text-xs">
                {/* 1. Assigned Tables Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[#687067] text-[11px] uppercase tracking-wide">
                      Assigned Station Tables:
                    </span>
                    <button
                      disabled={assignmentBusy} aria-label={`Assign table to ${waiter.name}`} onClick={() => {setAssignmentError('');setAssignModalWaiter(waiter.id);}}
                      className="text-[11px] text-[#526B4A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Assign Table</span>
                    </button>
                  </div>

                  {waiter.assignedTableNumbers.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {waiter.assignedTables.map(tbl => {
                        const isServing = waiter.currentlyServingTables.some(t => t.id === tbl.id);
                        return (
                          <div
                            key={tbl.id}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 group ${
                              isServing
                                ? 'bg-amber-50 text-amber-950 border-amber-300'
                                : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9]'
                            }`}
                          >
                            <span>{tbl.number}</span>
                            <span className="text-[10px] font-normal text-[#687067]">
                              ({tbl.section.split(' ')[0]})
                            </span>
                            <button
                              type="button"
                              title="Unassign table" disabled={assignmentBusy} aria-label={`Release table ${tbl.number}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleUnassignTable(tbl.id, tbl.number);
                              }}
                              className="text-[#687067] hover:text-[#C53030] ml-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-[#F7F4EC] text-[#687067] text-xs italic">
                      No tables currently assigned • Standby for floor allocation or waiter self-assignment.
                    </div>
                  )}
                </div>

                {/* 2. Currently Serving & Served/Completed Tables (Requirement 2 & 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Currently Serving */}
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div className="flex items-center justify-between text-amber-950">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Currently Serving
                      </span>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    </div>
                    <div className="mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif font-black text-lg text-amber-950">
                          {waiter.currentlyServingCount}
                        </span>
                        <span className="text-[10px] text-amber-800 font-semibold">tables dining</span>
                      </div>
                      <p className="text-[11px] text-amber-900 mt-0.5 font-medium truncate">
                        {waiter.currentlyServingTables.length > 0
                          ? waiter.currentlyServingTables.map(t => t.number).join(', ')
                          : 'No active dining currently'}
                      </p>
                    </div>
                  </div>

                  {/* Served / Completed Tables (Requirement 3: Clearly know how many tables each waiter has served) */}
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300">
                    <div className="flex items-center justify-between text-emerald-950">
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Tables Served</span>
                      </span>
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-700 text-white text-[9px] font-black uppercase">
                        Completed
                      </span>
                    </div>
                    <div className="mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif font-black text-lg text-emerald-950">
                          {waiter.servedCompletedCount}
                        </span>
                        <span className="text-[10px] text-emerald-800 font-bold">
                          {waiter.servedCompletedCount === 1 ? 'table served' : 'tables served'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900 mt-0.5 font-semibold truncate">
                        {waiter.servedCompletedTables.length > 0
                          ? `Served: ${waiter.servedCompletedTables.join(', ')}`
                          : '0 completed tables'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Pending Service & Active Orders Row */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  {/* Pending Service Requests */}
                  <div
                    className={`p-2 rounded-xl border flex items-center justify-between ${
                      waiter.pendingServiceCount > 0
                        ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                        : 'bg-[#F7F4EC] border-[#DDD8C9] text-[#687067]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase block">Pending Service</span>
                      <span className="font-bold text-xs text-[#163024]">
                        {waiter.pendingServiceCount > 0
                          ? `${waiter.pendingServiceCount} Calls (${waiter.pendingRequests.map(r => r.requestType).join(', ')})`
                          : '0 Pending'}
                      </span>
                    </div>
                    <BellRing className={`w-4 h-4 ${waiter.pendingServiceCount > 0 ? 'text-amber-700 animate-bounce' : 'text-[#687067]'}`} />
                  </div>

                  {/* Active Running Orders */}
                  <div className="p-2 rounded-xl border border-[#DDD8C9] bg-[#F7F4EC] flex items-center justify-between text-[#163024]">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#687067] block">Active Orders</span>
                      <span className="font-bold text-xs">
                        {waiter.activeOrdersCount} tabs ({formatCurrency(waiter.activeOrdersTotal)})
                      </span>
                    </div>
                    <ClipboardList className="w-4 h-4 text-[#526B4A]" />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 border-t border-[#DDD8C9]/70 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isFilterActive) {
                      onFilterByWaiter?.(null);
                    } else {
                      onFilterByWaiter?.(waiter.name);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isFilterActive
                      ? 'bg-[#163024] text-[#F7F4EC]'
                      : 'bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{isFilterActive ? 'Clear Filter' : 'Filter Grid to Server'}</span>
                </button>

                <button
                  type="button"
                  disabled={assignmentBusy} aria-label={`Assign table to ${waiter.name}`} onClick={() => {setAssignmentError('');setAssignModalWaiter(waiter.id);}}
                  className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
                  <span>Assign Table</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Table Assignment Modal for Captain */}
      {assignModalWaiter && (
        <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#DDD8C9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#163024] text-[#F7F4EC] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#C5A86A]" />
                <div>
                  <h3 className="font-serif font-bold text-base text-[#F7F4EC]">
                    Assign Table to {floorStaff.find(staff=>staff.id===assignModalWaiter)?.name}
                  </h3>
                  <p className="text-xs text-[#DDD8C9]">
                    Select an unassigned floor table to allocate to this server.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalWaiter(null)}
                className="p-1 rounded-lg text-[#DDD8C9] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <span className="font-bold text-[#687067] uppercase tracking-wide block">
                Unassigned Tables on Floor ({unassignedTables.length} Available):
              </span>

              {unassignedTables.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {unassignedTables.map(t => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-[#DDD8C9] bg-[#F7F4EC] hover:border-[#163024] flex flex-col justify-between gap-2 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-sm text-[#163024]">
                            Table {t.number}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {t.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#687067] mt-0.5">
                          {t.section} • Capacity: {t.capacity} Guests
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={assignmentBusy} aria-label={`Allocate table ${t.number}`} onClick={() => void handleAssignTableToWaiter(t.id, assignModalWaiter)}
                        className="w-full py-2 bg-[#163024] hover:bg-[#2D5A3D] text-[#C5A86A] font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Allocate to {floorStaff.find(staff=>staff.id===assignModalWaiter)?.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#F7F4EC] text-center text-[#687067] space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-[#526B4A] mx-auto" />
                  <p className="font-bold text-[#163024]">All Floor Tables Are Currently Assigned</p>
                  <p className="text-xs">
                    Every table currently has an active server. To reallocate, first unassign a table from another server.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#F7F4EC] border-t border-[#DDD8C9] flex justify-end">
              <button
                type="button"
                onClick={() => setAssignModalWaiter(null)}
                className="px-4 py-2 bg-white hover:bg-[#DDD8C9]/40 text-[#163024] border border-[#DDD8C9] font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
