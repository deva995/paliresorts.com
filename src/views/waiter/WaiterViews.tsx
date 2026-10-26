import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RestaurantTable } from '../../types';
import { scopeServiceTables } from './waiterHelpers';
import { TableDetailsModal } from './TableDetailsModal';
import { WaiterOrderModal } from './WaiterOrderModal';
import { WaiterBillModal } from './WaiterBillModal';
import { WaiterDashboard } from './WaiterDashboard';
import { WaiterTablesGridView } from './WaiterTablesGridView';
import { WaiterOrdersView } from './WaiterOrdersView';
import { WaiterServiceRequestsView } from './WaiterServiceRequestsView';
import { WaiterBillsView } from './WaiterBillsView';
import { WaiterProfileView } from './WaiterProfileView';
import { WaiterFloorDashboard } from './WaiterFloorDashboard';
import { CaptainWaiterVisibility } from './CaptainWaiterVisibility';
import {
  LayoutDashboard,
  Store,
  ClipboardList,
  BellRing,
  Receipt,
  User,
  Users,
  Plus,
  CheckCircle2,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const WaiterViews: React.FC = () => {
  const {
    currentRoute,
    pushRoute,
    tables,
    orders,
    waiterRequests,
    restaurantSyncError,
    refreshRestaurantData,
    updateTableStatus,
    callWaiter,
    currentUser,
    effectiveRole,
    activeRestaurant,
    activeRestaurantId
  } = useApp();

  // Route extraction
  const subpath = currentRoute.replace('/waiter/', '').split('/')[0] || 'dashboard';

  // Modal states (Declared unconditionally at top of component)
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<RestaurantTable | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedTableIdForOrder, setSelectedTableIdForOrder] = useState<string | undefined>(undefined);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedTableNumberForBill, setSelectedTableNumberForBill] = useState<string | null>(null);

  // Success Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live polling for waiter floor data every 5 seconds
  React.useEffect(() => {
    refreshRestaurantData(activeRestaurant?.id || 'rest-1');
    const interval = setInterval(() => {
      refreshRestaurantData(activeRestaurant?.id || 'rest-1');
    }, 5000);
    return () => clearInterval(interval);
  }, [activeRestaurant?.id, refreshRestaurantData]);

  // If authenticated as regular WAITER, present the Single Simple Floor Dashboard
  if (effectiveRole === 'WAITER') {
    return <WaiterFloorDashboard />;
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Open table details modal
  const handleSelectTable = (table: RestaurantTable) => {
    setSelectedTableForDetails(table);
  };

  // Open punch order modal
  const handlePunchOrder = (table?: RestaurantTable) => {
    if (table) {
      setSelectedTableIdForOrder(table.id);
    }
    setShowOrderModal(true);
  };

  // Open bill modal
  const handleOpenBill = (tableNumber: string) => {
    setSelectedTableNumberForBill(tableNumber);
    setShowBillModal(true);
  };

  // Request bill action
  const handleRequestBill = async (table: RestaurantTable) => {
    const result = await callWaiter(table.number, 'Bill');
    showToast(result.success ? `Bill requested for Table ${table.number}.` : result.error || 'Bill request failed.');
  };

  // Helpers to jump from other views by table number
  const handleSelectTableByNumber = (tableNumber: string) => {
    const table = tables.find(t => t.restaurantId === activeRestaurantId && t.number === tableNumber);
    if (table) {
      setSelectedTableForDetails(table);
    }
  };

  const handlePunchOrderByNumber = (tableNumber: string) => {
    const table = tables.find(t => t.restaurantId === activeRestaurantId && t.number === tableNumber);
    if (table) {
      setSelectedTableIdForOrder(table.id);
    }
    setShowOrderModal(true);
  };

  // Assigned tables scoping for badges
  const isRegularWaiter = currentUser.role === 'WAITER';
  const assignedTableNumbers = scopeServiceTables(tables, activeRestaurantId, currentUser).map(table => table.number);

  // Badges
  const pendingRequestsCount = waiterRequests.filter(r => {
    if (r.status !== 'pending' || !scopeServiceTables(tables, activeRestaurantId, currentUser).some(table => table.id === r.tableId)) return false;
    if (isRegularWaiter && !assignedTableNumbers.includes(r.tableNumber)) return false;
    return true;
  }).length;

  const activeOrdersCount = orders.filter(o => {
    if (o.restaurantId !== activeRestaurantId || o.status === 'completed' || o.status === 'cancelled') return false;
    if (isRegularWaiter && !assignedTableNumbers.includes(o.tableNumber)) return false;
    return true;
  }).length;

  const occupiedTablesCount = tables.filter(t => {
    if (t.restaurantId !== activeRestaurantId || t.status !== 'occupied') return false;
    if (isRegularWaiter && !assignedTableNumbers.includes(t.number)) return false;
    return true;
  }).length;

  const billedTablesCount = tables.filter(t => {
    if (t.restaurantId !== activeRestaurantId || t.status !== 'billed') return false;
    if (isRegularWaiter && !assignedTableNumbers.includes(t.number)) return false;
    return true;
  }).length;

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#2D5A3D] text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 border border-[#1b3b27]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A86A]" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Waiter Dashboard Title Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="bg-[#F7F4EC] p-2 rounded-xl border border-[#DDD8C9] flex items-center justify-center shrink-0">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club • Pali Village"
              className="h-10 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif font-bold text-xl text-[#163024] tracking-tight">
                {effectiveRole === 'WAITER_MANAGER' ? 'CAPTAIN DASHBOARD' : 'WAITER DASHBOARD'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#163024] text-[#F7F4EC] text-[10px] font-bold uppercase tracking-wider">
                {currentUser.name} • {effectiveRole === 'WAITER_MANAGER' ? 'CAPTAIN' : 'WAITER'}
              </span>
            </div>
            <p className="text-xs text-[#687067] mt-1">
              {effectiveRole === 'WAITER_MANAGER'
                ? 'Floor oversight, station assignments, table supervision, fast order punching, bill reviews, and guest service support.'
                : isRegularWaiter
                ? `Assigned Station: ${currentUser.department || 'Main Dining'} • Tables: ${assignedTableNumbers.join(', ')}`
                : 'Floor table grid, fast dual-menu order punching, kitchen ticket routing, bill reviews, and service requests.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePunchOrder()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C5A86A]" />
            <span>Punch Order</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#DDD8C9] text-xs no-scrollbar">
        {[
          { id: 'dashboard', label: 'OVERVIEW', path: '/waiter/dashboard', icon: LayoutDashboard },
          ...(effectiveRole === 'WAITER_MANAGER'
            ? [{ id: 'roster', label: 'SERVER VISIBILITY', path: '/waiter/roster', icon: Users }]
            : []),
          { id: 'tables', label: 'MY TABLES', path: '/waiter/tables', icon: Store, badge: occupiedTablesCount },
          { id: 'orders', label: 'ACTIVE ORDERS', path: '/waiter/orders', icon: ClipboardList, badge: activeOrdersCount },
          { id: 'requests', label: 'SERVICE CALLS', path: '/waiter/requests', icon: BellRing, badge: pendingRequestsCount },
          { id: 'bills', label: 'BILLS', path: '/waiter/bills', icon: Receipt, badge: billedTablesCount },
          { id: 'profile', label: 'PROFILE', path: '/waiter/profile', icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive =
            currentRoute === tab.path ||
            (tab.id === 'dashboard' && (currentRoute === '/waiter' || currentRoute === '/waiter/dashboard'));

          return (
            <button
              key={tab.id}
              onClick={() => pushRoute(tab.path)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'bg-white text-[#1D241F] hover:bg-[#F7F4EC] border border-[#DDD8C9]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C5A86A]' : 'text-[#526B4A]'}`} />
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-[#C5A86A] text-[#163024]'
                      : 'bg-[#163024] text-[#F7F4EC]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {restaurantSyncError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p className="text-xs font-medium">{restaurantSyncError}</p>
          </div>
          <button
            onClick={() => refreshRestaurantData()}
            className="px-3.5 py-1.5 bg-[#163024] hover:bg-[#0f2219] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Sub-view router */}
      {subpath === 'roster' ? (
        <CaptainWaiterVisibility
          onFilterByWaiter={waiterName => {
            if (waiterName) {
              pushRoute('/waiter/tables');
            }
          }}
          onSelectTable={handleSelectTable}
        />
      ) : subpath === 'dashboard' || currentRoute === '/waiter' ? (
        <WaiterDashboard
          onSelectTable={handleSelectTable}
          onPunchOrder={handlePunchOrder}
          onOpenBill={handleOpenBill}
          onRequestBill={handleRequestBill}
          onNavigateToTab={pushRoute}
        />
      ) : subpath === 'tables' ? (
        <WaiterTablesGridView
          onSelectTable={handleSelectTable}
          onPunchOrder={handlePunchOrder}
          onOpenBill={handleOpenBill}
          onRequestBill={handleRequestBill}
        />
      ) : subpath === 'orders' ? (
        <WaiterOrdersView
          onSelectTableByNumber={handleSelectTableByNumber}
          onPunchOrderForTable={handlePunchOrderByNumber}
          onOpenBillForTable={handleOpenBill}
        />
      ) : subpath === 'requests' ? (
        <WaiterServiceRequestsView
          onSelectTableByNumber={handleSelectTableByNumber}
          onPunchOrderForTable={handlePunchOrderByNumber}
        />
      ) : subpath === 'bills' ? (
        <WaiterBillsView
          onOpenBillForTable={handleOpenBill}
          onSelectTableByNumber={handleSelectTableByNumber}
        />
      ) : subpath === 'profile' ? (
        <WaiterProfileView />
      ) : (
        <WaiterDashboard
          onSelectTable={handleSelectTable}
          onPunchOrder={handlePunchOrder}
          onOpenBill={handleOpenBill}
          onRequestBill={handleRequestBill}
          onNavigateToTab={pushRoute}
        />
      )}

      {/* Table Details Modal */}
      <TableDetailsModal
        isOpen={Boolean(selectedTableForDetails)}
        onClose={() => setSelectedTableForDetails(null)}
        table={selectedTableForDetails}
        onPunchOrder={table => {
          setSelectedTableIdForOrder(table.id);
          setShowOrderModal(true);
        }}
        onOpenBill={tableNumber => {
          setSelectedTableNumberForBill(tableNumber);
          setShowBillModal(true);
        }}
        onRequestBill={table => {
          handleRequestBill(table);
        }}
      />

      {/* Waiter Punch Order Modal (Dual Menu, Categories, Live Cart, Tips, Configured Tax) */}
      <WaiterOrderModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedTableIdForOrder(undefined);
        }}
        preSelectedTableId={selectedTableIdForOrder}
        onOrderPlaced={orderNumber => {
          showToast(`Order #${orderNumber} fired to kitchen and bar successfully!`);
        }}
      />

      {/* Waiter Bill & Settlement Modal (Food & Bar subtotals, taxRate, Tip selection, Settle) */}
      {selectedTableNumberForBill && (
        <WaiterBillModal
          isOpen={showBillModal}
          onClose={() => {
            setShowBillModal(false);
            setSelectedTableNumberForBill(null);
          }}
          tableNumber={selectedTableNumberForBill}
          onSettled={msg => {
            showToast(msg);
          }}
        />
      )}
    </div>
  );
};
