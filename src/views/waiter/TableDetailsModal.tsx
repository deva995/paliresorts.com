import { findCurrentTableOrder, orderBelongsToTable } from './waiterHelpers';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { RestaurantTable, Order, KitchenTicket } from '../../types';
import {
  getTableDisplayStatus,
  getTableStatusTheme,
  maskPhoneNumber,
  formatCurrency
} from './waiterHelpers';
import {
  X,
  Users,
  UtensilsCrossed,
  Receipt,
  Bell,
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Wine,
  Phone,
  User,
  RotateCcw,
  Sparkles,
  DollarSign
} from 'lucide-react';

interface TableDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: RestaurantTable | null;
  onPunchOrder: (table: RestaurantTable) => void;
  onOpenBill: (tableNumber: string) => void;
  onRequestBill: (table: RestaurantTable) => void;
}

export const TableDetailsModal: React.FC<TableDetailsModalProps> = ({
  isOpen,
  onClose,
  table,
  onPunchOrder,
  onOpenBill,
  onRequestBill
}) => {
  const {
    orders,
    kitchenTickets,
    waiterRequests,
    resolveWaiterRequest,
    updateOrderItemStatus,
    updateTableStatus,
    refreshRestaurantData,
    activeRestaurant,
    callWaiter,
    currentUser,
    selfAssignTable
  } = useApp();

  const [serviceActionSuccess, setServiceActionSuccess] = useState<string | null>(null);
  const [serviceActionError,setServiceActionError]=useState<string | null>(null);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);

  if (!isOpen || !table) return null;

  // Find active order for this table
  const activeOrder = findCurrentTableOrder(table, orders);

  const displayStatus = getTableDisplayStatus(table, orders, kitchenTickets);
  const statusTheme = getTableStatusTheme(displayStatus);

  // Active service requests for this table
  const tableRequests = waiterRequests.filter(
    r => r.tableId === table.id && r.status === 'pending'
  );

  // Associated kitchen tickets
  const tableTickets = kitchenTickets.filter(
    kt => Boolean(activeOrder) && kt.orderId === activeOrder?.id
  );

  // Tax rate from configured restaurant
  const taxRate = activeRestaurant?.taxRate ?? 5;

  // Unpaid balance check
  const hasUnpaidBalance = Boolean(
    orders.some(order => orderBelongsToTable(order, table) && order.status !== 'cancelled' && order.paymentStatus !== 'paid' && order.grandTotal > 0)
  );

  // Handle Mark Table Available
  const handleMarkAvailable = async () => {
    if (hasUnpaidBalance) {
      alert(
        `Cannot release Table ${table.number}: Outstanding bill of ${formatCurrency(
          activeOrder?.grandTotal || 0
        )} must be settled first!`
      );
      return;
    }

    if (releaseBusy || !window.confirm(`Release Table ${table.number}? This will end the current sitting if the server confirms it can be closed.`)) return;
    setReleaseBusy(true);
    let result;
    try {
      if (table.activeSessionId) {
        await api.closeDiningSession(table.activeSessionId);
        await refreshRestaurantData(table.restaurantId);
        result = { success: true };
      } else result = await updateTableStatus(table.id, 'available');
    }
    catch (error: any) { setServiceActionError(error.detail || error.message || 'Unable to release table.'); return; }
    finally { setReleaseBusy(false); }
    if(!result.success) {setServiceActionError(result.error || 'Unable to release table.');return;}
    setServiceActionError(null);
    setServiceActionSuccess(table.activeSessionId ? `Table ${table.number} sitting closed. Cleaning is required before seating.` : `Table ${table.number} marked AVAILABLE.`);
    setTimeout(() => {
      setServiceActionSuccess(null);
      onClose();
    }, 1500);
  };

  // Seat guests and open dining session for table
  const handleSeatGuests = async () => {
    try {
      await api.guestOpenTable({
        table: table.number,
        restaurant: activeRestaurant?.id || 'rest-1',
        tableId: table.id,
        guestCount: table.capacity || 2
      });
      await refreshRestaurantData(activeRestaurant?.id || 'rest-1');
      setServiceActionSuccess(`Table ${table.number} seated! QR ordering session is now active.`);
      setTimeout(() => setServiceActionSuccess(null), 3000);
    } catch (err: any) {
      setServiceActionError(err.detail || err.message || 'Unable to seat table.');
    }
  };

  // Quick service call
  const handleCreateServiceCall = async (type: 'Water' | 'Call Waiter' | 'Bill' | 'Clean Table' | 'Cutlery') => {
    const result=await callWaiter(table.number, type);
    if(!result.success) {setServiceActionError(result.error || 'Service request failed.');return;}
    setShowServiceMenu(false);
    setServiceActionSuccess(`Service request "${type}" dispatched for Table ${table.number}.`);
    setTimeout(() => setServiceActionSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 font-sans overflow-hidden">
      <div className="bg-white sm:rounded-2xl max-w-2xl w-full border-0 sm:border sm:border-[#DDD8C9] shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-[#163024] text-[#F7F4EC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#526B4A]/40 border border-[#C5A86A]/40 flex items-center justify-center text-[#C5A86A] font-serif font-bold text-lg sm:text-xl shadow-inner">
              {table.number}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#F7F4EC] font-serif tracking-tight">
                  Table {table.number}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${statusTheme.badgeBg} ${statusTheme.badgeText}`}
                >
                  {statusTheme.label}
                </span>
              </div>
              <p className="text-xs text-[#DDD8C9] mt-0.5">
                {table.section} • Capacity: {table.capacity} Guests • {activeRestaurant?.name || 'Pali Resort & Club'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close table details modal"
            className="p-1.5 rounded-xl text-[#DDD8C9] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action / Success Banner */}
        {serviceActionError && <p role="alert" className="text-red-700">{serviceActionError}</p>}
          {serviceActionSuccess && (
          <div className="bg-[#2D5A3D] text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A86A]" />
            <span>{serviceActionSuccess}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-[#1D241F]">
          {/* Customer & Guest Card */}
          <div className="bg-[#F7F4EC] p-4 rounded-xl border border-[#DDD8C9] space-y-3">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-2">
              <span className="text-xs font-bold text-[#163024] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#526B4A]" />
                Customer Details
              </span>
              {(!table.waiterName || table.waiterName.toLowerCase() === 'unassigned') ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
                    No Server Assigned
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await selfAssignTable(table.id);
                      if (res.success) {
                        setServiceActionSuccess(`Table ${table.number} self-assigned to you successfully!`);
                      } else {
                        alert(res.error);
                      }
                    }}
                    className="px-2.5 py-1 bg-[#163024] hover:bg-[#2D5A3D] text-[#C5A86A] text-[10px] font-bold rounded cursor-pointer transition-colors shadow-xs"
                  >
                    + Self Assign
                  </button>
                </div>
              ) : (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#DDD8C9] text-[#163024] font-semibold">
                  Assigned Server: {table.waiterName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[#687067] block text-[11px]">Customer Name:</span>
                <span className="font-bold text-[#163024] text-sm">
                  {activeOrder?.guestName || (table.status === 'occupied' ? 'Resort Guest' : 'Walk-in Table')}
                </span>
              </div>
              <div>
                <span className="text-[#687067] block text-[11px]">Masked Mobile:</span>
                <span className="font-mono font-semibold text-[#1D241F] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#526B4A]" />
                  {maskPhoneNumber(activeOrder?.guestPhone)}
                </span>
              </div>
              <div>
                <span className="text-[#687067] block text-[11px]">Dining Session:</span>
                <span className="text-[#163024] font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#C5A86A]" />
                  {table.occupiedSince || (table.status === 'occupied' ? 'Active session' : 'Table available')}
                  {table.guestCount ? ` (${table.guestCount} covers)` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Active Service Requests for This Table */}
          {tableRequests.length > 0 && (
            <div className="bg-[#B45309]/10 border border-[#B45309]/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#B45309] animate-bounce" />
                  <span className="text-xs font-bold text-[#B45309] uppercase tracking-wider">
                    Active Table Service Calls ({tableRequests.length})
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {tableRequests.map(req => (
                  <div
                    key={req.id}
                    className="bg-white p-2.5 rounded-lg border border-[#B45309]/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#163024]">{req.requestType}</span>
                      {req.notes && <span className="text-[#687067] ml-2 font-normal">— {req.notes}</span>}
                      <span className="text-[10px] text-[#687067] ml-2 font-mono">({req.requestedAt})</span>
                    </div>
                    <button
                      onClick={async () => {
                        const result=await resolveWaiterRequest(req.id);
                        if(!result.success) {setServiceActionError(result.error || 'Service update failed.');return;}
                        setServiceActionSuccess(`Request "${req.requestType}" marked resolved.`);
                        setTimeout(() => setServiceActionSuccess(null), 3000);
                      }}
                      className="px-3 py-1 bg-[#2D5A3D] hover:bg-[#234730] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Table Order & Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-2">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-[#163024]" />
                <h3 className="font-bold text-sm text-[#163024]">
                  Current Dining Order
                </h3>
                {activeOrder && (
                  <span className="text-xs font-mono text-[#526B4A] font-bold">
                    #{activeOrder.orderNumber}
                  </span>
                )}
              </div>
              {activeOrder && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    activeOrder.paymentStatus === 'paid'
                      ? 'bg-[#2D5A3D] text-white'
                      : 'bg-[#C5A86A]/20 text-[#163024]'
                  }`}
                >
                  Payment: {activeOrder.paymentStatus.toUpperCase()}
                </span>
              )}
            </div>

            {!activeOrder || activeOrder.items.length === 0 ? (
              <div className="bg-[#F7F4EC] p-6 rounded-xl border border-[#DDD8C9] text-center space-y-2">
                <UtensilsCrossed className="w-8 h-8 text-[#DDD8C9] mx-auto" />
                <p className="text-xs text-[#687067] font-medium">
                  No active items currently ordered for Table {table.number}.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onPunchOrder(table);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#C5A86A]" />
                  <span>Punch First Order Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Items breakdown list */}
                <div className="bg-white border border-[#DDD8C9] rounded-xl divide-y divide-[#DDD8C9] overflow-hidden text-xs">
                  {activeOrder.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 flex items-center justify-between hover:bg-[#F7F4EC]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                          title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                        />
                        <div>
                          <div className="font-semibold text-[#1D241F]">
                            {item.quantity}x {item.name}
                            {item.portionLabel && (
                              <span className="text-[10px] text-[#687067] ml-1">({item.portionLabel})</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-[#8B6E32] font-medium italic">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            item.status === 'ready'
                              ? 'bg-[#2D5A3D] text-white animate-pulse'
                              : item.status === 'served'
                              ? 'bg-[#526B4A]/15 text-[#526B4A]'
                              : item.status === 'preparing'
                              ? 'bg-[#C5A86A]/20 text-[#163024]'
                              : 'bg-[#F7F4EC] text-[#687067]'
                          }`}
                        >
                          {item.status || 'cooking'}
                        </span>
                        <span className="font-bold font-mono text-[#163024]">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        {['SUPER_ADMIN','RESTAURANT_MANAGER','RESTAURANT_OWNER','WAITER_MANAGER'].includes(currentUser.role) && !['served','cancelled'].includes(item.status || '') && <button aria-label={`Cancel ${item.name}`} onClick={async()=>{const result=await updateOrderItemStatus(activeOrder.id,item.id,'cancelled');if(!result.success)setServiceActionError(result.error || 'Item cancellation failed.');}}>Cancel item</button>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotals, Tax & Tip */}
                <div className="bg-[#F7F4EC] p-3.5 rounded-xl border border-[#DDD8C9] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#687067]">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-[#1D241F]">
                      {formatCurrency(activeOrder.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#687067]">
                    <span>Configured GST ({taxRate}%):</span>
                    <span className="font-mono font-semibold text-[#1D241F]">
                      {formatCurrency(activeOrder.gstAmount)}
                    </span>
                  </div>
                  {activeOrder.tipAmount !== undefined && activeOrder.tipAmount > 0 && (
                    <div className="flex justify-between text-[#526B4A] font-semibold">
                      <span>Service Tip:</span>
                      <span className="font-mono font-bold">
                        +{formatCurrency(activeOrder.tipAmount)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[#DDD8C9] pt-2 flex justify-between items-center text-sm font-bold text-[#163024]">
                    <span>Grand Total:</span>
                    <span className="font-serif text-base text-[#163024]">
                      {formatCurrency(activeOrder.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Call Service Dropdown / Tray */}
          {showServiceMenu && (
            <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-2 text-xs">
              <span className="font-bold text-[#163024] uppercase tracking-wider block">
                Dispatch Guest Request for Table {table.number}:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Water', 'Cutlery', 'Call Waiter', 'Clean Table'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handleCreateServiceCall(type)}
                    className="p-2 bg-white hover:bg-[#DDD8C9]/40 border border-[#DDD8C9] rounded-lg font-semibold text-[#163024] transition-colors cursor-pointer text-center"
                  >
                    + {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-[#F7F4EC] border-t border-[#DDD8C9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              onClick={() => setShowServiceMenu(prev => !prev)}
              className="px-3 py-2.5 bg-white hover:bg-[#DDD8C9]/40 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <Bell className="w-3.5 h-3.5 text-[#526B4A]" />
              <span>{showServiceMenu ? 'Hide Call' : '+ Service Call'}</span>
            </button>

            {/* Mark Table Available: ONLY when no unpaid balance */}
            <button
              onClick={handleMarkAvailable}
              disabled={hasUnpaidBalance || releaseBusy}
              title={
                hasUnpaidBalance
                  ? `Cannot release Table ${table.number} while unpaid bill of ${formatCurrency(
                      activeOrder?.grandTotal || 0
                    )} remains.`
                  : 'Reset and mark table available for new guests'
              }
              className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px] ${
                hasUnpaidBalance
                  ? 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed'
                  : 'bg-white hover:bg-[#2D5A3D]/10 text-[#2D5A3D] border border-[#2D5A3D]/40'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Release Table</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {/* View / Request Bill */}
            {activeOrder && (
              <>
                <button
                  onClick={() => onRequestBill(table)}
                  className="px-3 py-2.5 bg-white hover:bg-[#C5A86A]/20 text-[#163024] border border-[#C5A86A] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#C5A86A]" />
                  <span>Request Bill</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenBill(table.number);
                  }}
                  className="px-3.5 py-2.5 bg-[#C5A86A] hover:bg-[#b09457] text-[#163024] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>View Bill</span>
                </button>
              </>
            )}

            {/* Seat Table / Open Session Button (When table is available) */}
            {!activeOrder && displayStatus === 'AVAILABLE' && (
              <button
                onClick={handleSeatGuests}
                className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-[#526B4A] hover:bg-[#3e5238] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer min-h-[44px]"
              >
                <Users className="w-3.5 h-3.5 text-[#C5A86A]" />
                <span>Seat & Open Table</span>
              </button>
            )}

            {/* Punch Order Button */}
            <button
              onClick={() => {
                onClose();
                onPunchOrder(table);
              }}
              className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span>Punch Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
