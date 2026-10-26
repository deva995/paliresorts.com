import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, RestaurantTable } from '../../types';
import { scopeServiceTables, maskPhoneNumber, formatCurrency } from './waiterHelpers';
import {
  ClipboardList,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Utensils,
  Receipt,
  Plus,
  Eye,
  Wine
} from 'lucide-react';

interface WaiterOrdersViewProps {
  onSelectTableByNumber: (tableNumber: string) => void;
  onPunchOrderForTable: (tableNumber: string) => void;
  onOpenBillForTable: (tableNumber: string) => void;
}

export const WaiterOrdersView: React.FC<WaiterOrdersViewProps> = ({
  onSelectTableByNumber,
  onPunchOrderForTable,
  onOpenBillForTable
}) => {
  const { orders, activeRestaurantId, tables, currentUser } = useApp();

  // Isolation: strictly rest-1
  const scopedOrders = useMemo(
    () => orders.filter(o => o.restaurantId === activeRestaurantId && (currentUser.role !== 'WAITER' ||
      scopeServiceTables(tables, activeRestaurantId, currentUser).some(table => table.id === o.tableId))),
    [orders, activeRestaurantId, tables, currentUser]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'preparing' | 'ready' | 'completed'>('active');

  const filteredOrders = useMemo(() => {
    return scopedOrders.filter(order => {
      if (statusFilter === 'active' && (order.status === 'completed' || order.status === 'cancelled')) {
        return false;
      }
      if (statusFilter === 'preparing' && order.status !== 'preparing' && order.status !== 'accepted') {
        return false;
      }
      if (statusFilter === 'ready' && order.status !== 'ready') {
        return false;
      }
      if (statusFilter === 'completed' && order.status !== 'completed') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesTable = order.tableNumber.toLowerCase().includes(q);
        const matchesName = order.guestName.toLowerCase().includes(q);
        if (!matchesNum && !matchesTable && !matchesName) return false;
      }

      return true;
    });
  }, [scopedOrders, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header filter & search */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#687067] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by order #, table #, or guest name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none focus:border-[#163024] focus:bg-white"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            {(['all', 'active', 'preparing', 'ready', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                    : 'bg-[#F7F4EC] hover:bg-[#DDD8C9]/40 text-[#1D241F] border border-[#DDD8C9]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#DDD8C9] text-center space-y-2">
          <ClipboardList className="w-10 h-10 text-[#DDD8C9] mx-auto" />
          <h3 className="font-bold text-sm text-[#163024]">No orders found</h3>
          <p className="text-xs text-[#687067]">
            There are currently no orders matching the specified filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const isReady = order.status === 'ready';
            const isCompleted = order.status === 'completed';
            const foodCount = order.items.filter(i => i.menuType !== 'drink').length;
            const barCount = order.items.filter(i => i.menuType === 'drink').length;

            return (
              <div
                key={order.id}
                className="bg-white border border-[#DDD8C9] rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD8C9]/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] flex items-center justify-center font-serif font-black text-[#163024]">
                      {order.tableNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#163024]">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isReady
                              ? 'bg-[#2D5A3D] text-white animate-pulse'
                              : isCompleted
                              ? 'bg-[#526B4A]/20 text-[#526B4A]'
                              : order.status === 'preparing'
                              ? 'bg-[#C5A86A]/20 text-[#163024]'
                              : 'bg-[#F7F4EC] text-[#687067]'
                          }`}
                        >
                          {order.status}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            order.paymentStatus === 'paid'
                              ? 'bg-[#2D5A3D]/10 text-[#2D5A3D]'
                              : 'bg-[#B45309]/10 text-[#B45309]'
                          }`}
                        >
                          Payment: {order.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[#687067] mt-0.5">
                        Table {order.tableNumber} • Guest: {order.guestName} ({maskPhoneNumber(order.guestPhone)})
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-serif font-bold text-base text-[#163024] block">
                      {formatCurrency(order.grandTotal)}
                    </span>
                    <span className="text-[10px] text-[#687067]">
                      {order.items.reduce((acc, i) => acc + i.quantity, 0)} items ({foodCount} Food, {barCount} Bar)
                    </span>
                  </div>
                </div>

                {/* Items preview pills */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {order.items.map((item, idx) => (
                    <span
                      key={item.id || idx}
                      className="bg-[#F7F4EC] px-2.5 py-1 rounded-lg border border-[#DDD8C9] text-[#1D241F] flex items-center gap-1.5 text-[11px]"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[#687067] text-[11px] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#C5A86A]" />
                    Punched {order.createdAt || 'Today'}
                  </span>

                  <div className="flex items-center gap-2">
                    {order.tableId && <>
                    <button
                      onClick={() => onSelectTableByNumber(order.tableNumber)}
                      className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#526B4A]" />
                      <span>Table Details</span>
                    </button>

                    <button
                      onClick={() => onPunchOrderForTable(order.tableNumber)}
                      className="px-3 py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#526B4A]" />
                      <span>+ Add Items</span>
                    </button>

                    <button
                      onClick={() => onOpenBillForTable(order.tableNumber)}
                      className="px-3 py-1.5 bg-[#C5A86A] hover:bg-[#b09457] text-[#163024] rounded-xl font-black text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View Bill</span>
                    </button>
                    </>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
