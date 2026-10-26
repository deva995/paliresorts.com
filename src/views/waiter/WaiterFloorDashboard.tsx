import { WaiterBillModal } from './WaiterBillModal';
import { findCurrentTableOrder } from './waiterHelpers';
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RestaurantTable, Order, AppNotification } from '../../types';
import { TableDetailsModal } from './TableDetailsModal';
import { WaiterOrderModal } from './WaiterOrderModal';
import { ProfileModal } from '../../components/layout/ProfileModal';
import {
  maskPhoneNumber,
  formatCurrency,
  getTableDisplayStatus,
  getTableStatusTheme
} from './waiterHelpers';
import {
  Store,
  BellRing,
  Plus,
  UtensilsCrossed,
  Wine,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Receipt,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Eye,
  Check,
  Search,
  Filter,
  X,
  Smartphone,
  CookingPot,
  BadgeCheck,
  Flame,
  Volume2,
  Users,
  CheckSquare,
  ClipboardList,
  RefreshCw,
  LogOut,
  Info
} from 'lucide-react';

export const WaiterFloorDashboard: React.FC = () => {
  const {
    currentUser,
    tables,
    orders,
    notifications,
    waiterRequests,
    kitchenTickets,
    updateTableStatus,
    callWaiter,
    updateOrderStatus,
    markNotificationRead,
    resolveWaiterRequest,
    activeRestaurant,
    selfAssignTable,
    refreshRestaurantData,
    restaurantSyncError,
    requestSettlementForSession,
    logout
  } = useApp();

  // AppContext owns authorization-aware polling; manual refresh remains available.

  const [activeTab, setActiveTab] = useState<'tables' | 'notifications'>('tables');

  // Modal states
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<RestaurantTable | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [billTableNumber, setBillTableNumber] = useState<string | null>(null);
  const [selectedTableIdForOrder, setSelectedTableIdForOrder] = useState<string | undefined>(undefined);
  const [showSelfAssignModal, setShowSelfAssignModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Filter states
  const [tableFilter, setTableFilter] = useState<'all' | 'ready' | 'available' | 'occupied' | 'service' | 'billed' | 'served' | 'unassigned'>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [selectedTableChip, setSelectedTableChip] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<'all' | 'ready' | 'qr' | 'service'>('all');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Assigned tables: dynamically scoped to current waiter
  const assignedTableNumbers = useMemo(() => {
    return tables
      .filter(
        t =>
          t.restaurantId === activeRestaurant?.id &&
          (t.waiterId === currentUser.id ||
            (currentUser.assignedTables && currentUser.assignedTables.includes(t.number)))
      )
      .map(t => t.number);
  }, [tables, currentUser.id, currentUser.assignedTables, activeRestaurant?.id]);

  // Filter tables scoped to this restaurant & assigned to waiter
  const assignedTables = useMemo(() => {
    return tables.filter(
      t =>
        t.restaurantId === activeRestaurant?.id &&
        (t.waiterId === currentUser.id ||
          (currentUser.assignedTables && currentUser.assignedTables.includes(t.number)))
    );
  }, [tables, currentUser.id, currentUser.assignedTables, activeRestaurant?.id]);

  // Unassigned tables on the restaurant floor (no active server assigned)
  const unassignedTables = useMemo(() => {
    return tables.filter(
      t =>
        t.restaurantId === activeRestaurant?.id &&
        !t.waiterId &&
        (!t.waiterName || t.waiterName.toLowerCase() === 'unassigned') &&
        !assignedTableNumbers.includes(t.number)
    );
  }, [tables, assignedTableNumbers, activeRestaurant?.id]);

  // Manual server sync handler
  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await refreshRestaurantData(activeRestaurant?.id || 'rest-1');
      showToast('Floor dashboard synced with server.');
    } catch (err: any) {
      showToast(err.detail || err.message || 'Failed to sync floor data.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Self-assign table action with toast feedback and concurrency safety
  const handleSelfAssign = async (tableId: string, tableNumber: string) => {
    const res = await selfAssignTable(tableId);
    if (res.success) {
      showToast(`Table ${tableNumber} self-assigned to you successfully! Now visible under My Tables.`);
      setTableFilter('all');
      setSelectedTableChip(null);
    } else {
      showToast(res.error || 'Failed to self-assign table.');
    }
  };

  // 6 Required Server-Synced Floor Dashboard Metrics:
  // 1. Active Tables
  const activeTablesCount = useMemo(() => {
    return assignedTables.filter(t => t.status === 'occupied' || t.status === 'billed').length;
  }, [assignedTables]);

  // 2. Guests
  const totalGuestsCount = useMemo(() => {
    return assignedTables.filter(t => t.status === 'occupied' || t.status === 'billed')
      .reduce((sum, t) => sum + (t.guestCount ?? 0), 0);
  }, [assignedTables]);

  // 3. Running KOTs
  const runningKotsCount = useMemo(() => {
    return kitchenTickets.filter(
      kt => kt.restaurantId === activeRestaurant?.id && assignedTables.some(table => orders.some(order => order.id === kt.orderId && order.tableId === table.id)) && (kt.status === 'new' || kt.status === 'preparing')
    ).length;
  }, [kitchenTickets, activeRestaurant?.id, assignedTables, orders]);

  // 4. Ready to Serve
  const readyToServeCount = useMemo(() => {
    return assignedTables.filter(table => getTableDisplayStatus(table, orders, kitchenTickets) === 'READY').length;
  }, [kitchenTickets, assignedTables, orders]);

  // 5. Service Calls
  const serviceCallsCount = useMemo(() => {
    return waiterRequests.filter(r => r.status === 'pending' && assignedTables.some(table => table.id === r.tableId)).length;
  }, [waiterRequests, assignedTables]);

  // 6. Unassigned Tables is unassignedTables.length

  // Active orders for assigned tables
  const activeOrdersList = useMemo(() => {
    return orders.filter(
      o =>
        o.restaurantId === activeRestaurant?.id &&
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        assignedTableNumbers.includes(o.tableNumber)
    );
  }, [orders, assignedTableNumbers, activeRestaurant?.id]);

  // Pending service calls for assigned tables
  const pendingServiceRequests = useMemo(() => {
    return waiterRequests.filter(
      r => r.status === 'pending' && assignedTableNumbers.includes(r.tableNumber)
    );
  }, [waiterRequests, assignedTableNumbers]);

  // Bill requests count
  const billRequestsList = useMemo(() => {
    return assignedTables.filter(t => {
      const status = getTableDisplayStatus(t, orders, kitchenTickets);
      return status === 'BILL REQUESTED' || status === 'PAYMENT PENDING' || t.status === 'billed';
    });
  }, [assignedTables, orders, kitchenTickets]);

  // Ready orders count
  const readyOrdersCount = useMemo(() => {
    return assignedTables.filter(t => {
      const status = getTableDisplayStatus(t, orders, kitchenTickets);
      return status === 'READY';
    }).length;
  }, [assignedTables, orders, kitchenTickets]);

  // Served / completed tables count
  const servedCompletedCount = useMemo(() => {
    return assignedTables.filter(t => {
      const status = getTableDisplayStatus(t, orders, kitchenTickets);
      const activeOrder = findCurrentTableOrder(t, orders);
      return status === 'PAID' || activeOrder?.status === 'served';
    }).length;
  }, [assignedTables, orders, kitchenTickets]);

  // Available tables count
  const availableTablesCount = useMemo(() => {
    return assignedTables.filter(t => t.status === 'available').length;
  }, [assignedTables]);

  // Displayed Tables with Priority Ordering & Filter selection
  const displayedTables = useMemo(() => {
    let result = [...assignedTables];

    if (tableFilter === 'unassigned') {
      result = [...unassignedTables];
    } else if (selectedTableChip) {
      result = result.filter(t => t.number === selectedTableChip);
    } else if (tableFilter === 'ready') {
      result = result.filter(t => {
        const status = getTableDisplayStatus(t, orders, kitchenTickets);
        return status === 'READY';
      });
    } else if (tableFilter === 'occupied') {
      result = result.filter(t => {
        const status = getTableDisplayStatus(t, orders, kitchenTickets);
        return status === 'OCCUPIED' || status === 'ORDERING' || status === 'PREPARING';
      });
    } else if (tableFilter === 'service') {
      result = result.filter(t => {
        return pendingServiceRequests.some(r => r.tableNumber === t.number);
      });
    } else if (tableFilter === 'available') {
      result = result.filter(t => t.status === 'available');
    } else if (tableFilter === 'billed') {
      result = result.filter(t => {
        const status = getTableDisplayStatus(t, orders, kitchenTickets);
        return status === 'BILL REQUESTED' || status === 'PAYMENT PENDING' || t.status === 'billed';
      });
    } else if (tableFilter === 'served') {
      result = result.filter(t => {
        const status = getTableDisplayStatus(t, orders, kitchenTickets);
        const activeOrder = findCurrentTableOrder(t, orders);
        return status === 'PAID' || activeOrder?.status === 'served';
      });
    }

    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase();
      result = result.filter(t => {
        const activeOrder = findCurrentTableOrder(t, orders);
        return (
          t.number.toLowerCase().includes(q) ||
          t.section.toLowerCase().includes(q) ||
          (activeOrder?.guestName && activeOrder.guestName.toLowerCase().includes(q)) ||
          (activeOrder?.guestPhone && activeOrder.guestPhone.toLowerCase().includes(q))
        );
      });
    }

    // Sort: READY first (priority 0), AVAILABLE second (priority 1), then active/other (priority 2+)
    result.sort((a, b) => {
      const statusA = getTableDisplayStatus(a, orders, kitchenTickets);
      const statusB = getTableDisplayStatus(b, orders, kitchenTickets);

      const getPriority = (status: string): number => {
        if (status === 'READY') return 0;
        if (status === 'BILL REQUESTED' || status === 'PAYMENT PENDING') return 1;
        if (status === 'AVAILABLE') return 2;
        if (status === 'PREPARING' || status === 'ORDERING' || status === 'OCCUPIED') return 3;
        return 4;
      };

      const priorityDiff = getPriority(statusA) - getPriority(statusB);
      if (priorityDiff !== 0) return priorityDiff;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });

    return result;
  }, [assignedTables, unassignedTables, tableFilter, selectedTableChip, tableSearchQuery, orders, kitchenTickets, pendingServiceRequests]);

  // Waiter relevant notifications
  const waiterNotifications = useMemo(() => {
    return notifications.filter(n => {
      const isTargeted =
        n.targetRoles?.includes('WAITER') ||
        n.targetRoles?.includes('WAITER_MANAGER') ||
        n.notificationCategory === 'order_ready' ||
        n.notificationCategory === 'qr_order' ||
        n.notificationCategory === 'service_request' ||
        n.notificationCategory === 'bill_request' ||
        n.title.includes('READY') ||
        n.title.includes('QR') ||
        n.title.includes('Service Request');

      return isTargeted;
    });
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'ready') {
      return waiterNotifications.filter(n => n.notificationCategory === 'order_ready' || n.title.includes('READY'));
    }
    if (notifFilter === 'qr') {
      return waiterNotifications.filter(n => n.notificationCategory === 'qr_order' || n.title.includes('QR'));
    }
    if (notifFilter === 'service') {
      return waiterNotifications.filter(
        n =>
          n.notificationCategory === 'service_request' ||
          n.notificationCategory === 'bill_request' ||
          n.title.includes('Service Request')
      );
    }
    return waiterNotifications;
  }, [waiterNotifications, notifFilter]);

  // Unread badge count
  const unreadNotifsCount = useMemo(() => {
    return waiterNotifications.filter(n => !n.read).length;
  }, [waiterNotifications]);

  // Handler: Tap table -> Punch Order
  const handleTableTap = (table: RestaurantTable) => {
    setSelectedTableIdForOrder(table.id);
    setShowOrderModal(true);
  };

  // Handler: Open View Order Details
  const handleOpenOrderDetails = (table: RestaurantTable) => {
    setSelectedTableForDetails(table);
  };

  // Handler: Open order from notification
  const handleOpenOrderFromNotification = (notif: AppNotification) => {
    if (notif.tableNumber) {
      const table = assignedTables.find(t => t.number === notif.tableNumber);
      if (table) {
        setSelectedTableForDetails(table);
        markNotificationRead(notif.id);
        return;
      }
    }
    if (notif.orderId) {
      const order = orders.find(o => o.id === notif.orderId || o.orderNumber === notif.orderId);
      if (order?.tableNumber) {
        const table = assignedTables.find(t => t.number === order.tableNumber);
        if (table) {
          setSelectedTableForDetails(table);
          markNotificationRead(notif.id);
          return;
        }
      }
    }
    markNotificationRead(notif.id);
    showToast(`Viewing details for: ${notif.title}`);
  };

  // Handler: Mark Served for ready order
  const handleMarkServed = async (orderId?:string,tableNumber?:string,notifId?:string) => {
    const id=orderId || orders.find(o=>o.tableNumber===tableNumber && o.status==='ready')?.id;
    if(!id) {showToast('Refresh and select a ready order.');return;}
    const result=await updateOrderStatus(id,'served');
    if(!result.success) {showToast(result.error || 'Unable to serve order.');return;}
    if(notifId) markNotificationRead(notifId);
    showToast(`Order for Table ${tableNumber || ''} marked as SERVED.`);
  };

  // Handler: Mark service request attended
  const handleAttendServiceRequest = async (notif: AppNotification) => {
    if (notif.tableNumber) {
      const req = waiterRequests.find(r => r.tableNumber === notif.tableNumber && r.status === 'pending');
      if (req) {
        const result=await resolveWaiterRequest(req.id);
        if(!result.success) {showToast(result.error || 'Service update failed.');return;}
      }
    }
    markNotificationRead(notif.id);
    showToast(`Service request for Table ${notif.tableNumber || ''} attended!`);
  };

  return (
    <div className="space-y-4 pb-24 md:pb-12 font-sans max-w-7xl mx-auto px-2 sm:px-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-[#163024] text-[#F7F4EC] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-[#C5A86A]/40 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-[#C5A86A] shrink-0" />
          <span className="text-xs font-bold flex-1">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* COMPACT WAITER HEADER (Req 1, 2, 3)                       */}
      {/* ========================================================= */}
      <div className="bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-[#DDD8C9] shadow-xs flex items-center justify-between gap-3">
        {/* Compact Profile: Name, Avatar, and Designation "Waiter" */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={currentUser.avatar || '/palilogo.png'}
            alt={currentUser.name}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-[#C5A86A]/40 shrink-0"
          />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm sm:text-base text-[#163024] truncate">
                {currentUser.name}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#163024] text-[#dfc78f] text-[10px] font-bold uppercase tracking-wider shrink-0">
                Waiter
              </span>
            </div>
          </div>
        </div>

        {/* Accessible Top Actions: Sync, Self-Assign, Profile, and Sign Out */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {readyOrdersCount > 0 && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold animate-pulse items-center gap-1">
              <Flame className="w-3 h-3 text-amber-300" />
              <span>{readyOrdersCount} Ready</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="p-2 text-[#687067] hover:text-[#163024] hover:bg-stone-100 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Sync Floor Data"
            aria-label="Sync Floor Data"
          >
            <RefreshCw className={`w-4 h-4 text-[#526B4A] ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowSelfAssignModal(true)}
            className="px-2.5 py-1.5 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 min-h-[40px]"
            title="Self Assign Open Tables"
            aria-label="Self Assign Open Tables"
          >
            <Plus className="w-3.5 h-3.5 text-[#526B4A]" />
            <span className="hidden sm:inline">Self-Assign</span>
            {unassignedTables.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#163024] text-[#C5A86A] text-[9px] font-bold">
                {unassignedTables.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="btn-waiter-profile"
            onClick={() => setShowProfileModal(true)}
            className="p-2 text-[#687067] hover:text-[#163024] hover:bg-stone-100 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="My Profile"
            aria-label="My Profile"
          >
            <User className="w-4 h-4 text-[#163024]" />
          </button>

          <button
            type="button"
            id="btn-waiter-logout"
            onClick={logout}
            className="p-2 text-[#687067] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Profile Details Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />

      {restaurantSyncError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-xs font-medium">{restaurantSyncError}</p>
          </div>
          <button
            type="button"
            onClick={() => refreshRestaurantData()}
            className="px-3.5 py-1.5 bg-[#163024] hover:bg-[#0f2219] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2 PRIMARY TABS (TABLE VIEW vs NOTIFICATIONS)              */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 p-1.5 bg-[#F7F4EC] rounded-2xl border border-[#DDD8C9] gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer select-none min-h-[44px] ${
            activeTab === 'tables'
              ? 'bg-[#163024] text-[#F7F4EC] shadow-md scale-[1.01]'
              : 'text-[#687067] hover:text-[#163024] hover:bg-white/60'
          }`}
        >
          <Store className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'tables' ? 'text-[#C5A86A]' : 'text-[#687067]'}`} />
          <span className="tracking-wide">TABLES & PUNCH ORDER</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'tables' ? 'bg-[#C5A86A] text-[#163024]' : 'bg-[#DDD8C9] text-[#163024]'
            }`}
          >
            {assignedTables.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer select-none relative min-h-[44px] ${
            activeTab === 'notifications'
              ? 'bg-[#163024] text-[#F7F4EC] shadow-md scale-[1.01]'
              : 'text-[#687067] hover:text-[#163024] hover:bg-white/60'
          }`}
        >
          <BellRing className={`w-4 h-4 sm:w-5 sm:h-5 ${activeTab === 'notifications' ? 'text-[#C5A86A]' : 'text-[#687067]'}`} />
          <span className="tracking-wide">NOTIFICATIONS</span>
          {unreadNotifsCount > 0 ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse ${
                readyOrdersCount > 0
                  ? 'bg-emerald-500 text-white'
                  : activeTab === 'notifications'
                  ? 'bg-[#C5A86A] text-[#163024]'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {unreadNotifsCount} New
            </span>
          ) : (
            <span className="text-[10px] text-[#687067] bg-[#DDD8C9]/40 px-2 py-0.5 rounded-full">
              0
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* OPTION A: RESPONSIVE WAITER TABLE VIEW                    */}
      {/* ========================================================= */}
      {activeTab === 'tables' && (
        <div className="space-y-3.5">
          {/* Table Search & Category Filter Chips */}
          <div className="bg-white p-3 rounded-2xl border border-[#DDD8C9] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#687067] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search table, guest or phone..."
                value={tableSearchQuery}
                onChange={e => setTableSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none focus:border-[#163024] text-xs min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `All Tables (${assignedTables.length})` },
                { id: 'ready', label: `Ready (${readyOrdersCount})`, alert: readyOrdersCount > 0 },
                { id: 'occupied', label: `Active (${activeOrdersList.length})` },
                { id: 'service', label: `Service (${pendingServiceRequests.length})`, alert: pendingServiceRequests.length > 0 },
                { id: 'billed', label: `Billed (${billRequestsList.length})`, alert: billRequestsList.length > 0 },
                { id: 'available', label: `Available (${availableTablesCount})` },
                { id: 'unassigned', label: `Unassigned (${unassignedTables.length})`, alert: unassignedTables.length > 0 }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedTableChip(null);
                    setTableFilter(f.id as any);
                  }}
                  className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer text-xs min-h-[38px] flex items-center gap-1.5 ${
                    tableFilter === f.id && !selectedTableChip
                      ? 'bg-[#163024] text-[#F7F4EC]'
                      : f.alert
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                      : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#DDD8C9]/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE GRID: 1-column on mobile, 2/3-column on tablet & desktop (Requirement 1 & 7) */}
          {displayedTables.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[#DDD8C9] space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#F7F4EC] text-[#526B4A] mx-auto flex items-center justify-center">
                <Search className="w-8 h-8 text-[#526B4A]" />
              </div>
              <h4 className="font-serif font-bold text-lg text-[#163024]">
                No Tables Found
              </h4>
              <p className="text-xs text-[#687067] max-w-md mx-auto">
                No dining tables match your active section or status filter. Reset filters to see all tables.
              </p>
              <button
                type="button"
                onClick={() => { setTableSearchQuery(''); setTableFilter('all'); setSelectedTableChip(null); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#163024] hover:bg-[#1f4232] text-[#F7F4EC] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C5A86A]" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {displayedTables.map(table => {
                const activeOrder = findCurrentTableOrder(table, orders);
                const displayStatus = getTableDisplayStatus(table, orders, kitchenTickets);
                const statusTheme = getTableStatusTheme(displayStatus);

                const isReady = displayStatus === 'READY';
                const isAvailable = table.status === 'available';
                const isOccupied = table.status === 'occupied';
                const isBilled = table.status === 'billed';

                // Check if any items are ready in this table
                const hasReadyItem = activeOrder?.status === 'ready' || activeOrder?.items.some(i => i.status === 'ready');

                // Guest reference
                const guestName = activeOrder?.guestName || (isOccupied ? 'Walk-in Guest' : 'No Guest Seated');
                const guestPhone = activeOrder?.guestPhone;
                const guestCount = table.guestCount ?? 0;

                // Kitchen Progress Calculation (Requirement 2)
                let kitchenProgressText = 'No active order';
                let progressPercent = 0;
                let progressBarColor = 'bg-stone-200';

                if (activeOrder && activeOrder.items.length > 0) {
                  const totalItems = activeOrder.items.length;
                  const readyOrServed = activeOrder.items.filter(i => i.status === 'ready' || i.status === 'served').length;
                  const preparing = activeOrder.items.filter(i => i.status === 'preparing').length;

                  if (readyOrServed === totalItems) {
                    kitchenProgressText = 'All items ready / served';
                    progressPercent = 100;
                    progressBarColor = 'bg-emerald-600';
                  } else if (hasReadyItem) {
                    kitchenProgressText = `${readyOrServed}/${totalItems} items ready for pickup`;
                    progressPercent = Math.round((readyOrServed / totalItems) * 100);
                    progressBarColor = 'bg-amber-500';
                  } else if (preparing > 0) {
                    kitchenProgressText = `Cooking (${preparing}/${totalItems} items)`;
                    progressPercent = 45;
                    progressBarColor = 'bg-blue-500';
                  } else {
                    kitchenProgressText = `Order Sent to Kitchen (${totalItems} items)`;
                    progressPercent = 20;
                    progressBarColor = 'bg-stone-400';
                  }
                } else if (isAvailable) {
                  kitchenProgressText = 'Table vacant • Ready to seat';
                  progressPercent = 0;
                  progressBarColor = 'bg-emerald-200';
                }

                const isTableUnassigned = !table.waiterName || table.waiterName.trim() === '' || table.waiterName.toLowerCase() === 'unassigned';
                const isMyAssignedTable = assignedTables.some(at => at.id === table.id || at.number === table.number);
                const isAssignedToOther = Boolean(table.waiterName && !isMyAssignedTable && !isTableUnassigned);

                return (
                  <div
                    key={table.id}
                    aria-label={`Place order for table ${table.number}`} onClick={() => handleTableTap(table)}
                    className={`relative rounded-2xl border p-4 transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between h-full group ${
                    isReady
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30'
                      : isOccupied
                      ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-400/40'
                      : isBilled
                      ? 'border-indigo-400 bg-indigo-50/40'
                      : isMyAssignedTable
                      ? 'border-emerald-700/50 bg-[#EBF3ED] hover:bg-[#E2EDE5]'
                      : isTableUnassigned
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-[#DDD8C9] bg-white hover:border-[#163024]'
                  }`}
                >
                  <div>
                    {/* Top Bar: Table Number & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-serif font-bold text-base shadow-xs shrink-0 ${
                          isOccupied
                            ? 'bg-amber-700 text-white'
                            : isMyAssignedTable
                            ? 'bg-[#163024] text-[#C5A86A]'
                            : 'bg-[#2A3B32] text-[#F7F4EC]'
                        }`}>
                          {table.number}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#163024] flex items-center gap-1.5 flex-wrap">
                            <span>Table {table.number}</span>
                            <span className="text-[11px] text-[#687067] font-normal flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#526B4A]" />
                              {guestCount} Guests ({table.capacity} Pax)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-[#687067] font-sans">
                              {table.section || 'Main Dining Floor'}
                            </span>
                            {isMyAssignedTable ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#163024] text-[#C5A86A] border border-[#244737]">
                                Assigned
                              </span>
                            ) : isTableUnassigned ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                No Server
                              </span>
                            ) : isAssignedToOther ? (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 border border-stone-200">
                                Server: {table.waiterName}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge (Requirement 2) */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusTheme.badgeBg} ${statusTheme.badgeText}`}
                        >
                          {statusTheme.label}
                        </span>

                        {isReady && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold animate-pulse flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5 text-amber-300" />
                            <span>READY FOR PICKUP</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Name & Running Order Amount (Requirement 2) */}
                    <div className="mt-3 p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9]/60 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <User className="w-4 h-4 text-[#526B4A] shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-[#163024] block truncate text-xs">
                            {guestName}
                          </span>
                          {guestPhone && (
                            <span className="text-[10px] font-mono text-[#687067]">
                              {maskPhoneNumber(guestPhone)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-[#687067] block font-medium">Running Amount</span>
                        <span className="font-bold text-xs sm:text-sm text-[#163024] font-serif">
                          {activeOrder ? formatCurrency(activeOrder.grandTotal) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Kitchen Progress Bar & Label (Requirement 2) */}
                    <div className="mt-3 pt-2 border-t border-[#DDD8C9]/60">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#687067] flex items-center gap-1 font-medium">
                          <CookingPot className="w-3.5 h-3.5 text-[#526B4A]" />
                          Kitchen Progress:
                        </span>
                        <span className="font-bold text-[11px] text-[#163024] truncate max-w-[180px]">
                          {kitchenProgressText}
                        </span>
                      </div>
                      
                      {/* Visual progress bar */}
                      <div className="w-full bg-[#DDD8C9]/50 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {/* Items Preview if active */}
                      {activeOrder && activeOrder.items.length > 0 && (
                        <div className="mt-2 text-[11px] text-[#163024] truncate bg-white p-1.5 rounded-lg border border-[#DDD8C9]/50 font-mono">
                          {activeOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions on Table Card: Punch Order + View Order / Bill or Self-Assign (Phase 2 Requirement 1) */}
                  <div
                    className="mt-4 pt-3 border-t border-[#DDD8C9]/60 grid grid-cols-2 gap-2"
                    onClick={e => e.stopPropagation()}
                  >
                    {isTableUnassigned ? (
                      <button
                        type="button"
                        onClick={() => handleSelfAssign(table.id, table.number)}
                        className="col-span-2 py-2.5 px-3 bg-[#163024] hover:bg-[#2D5A3D] text-[#C5A86A] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm min-h-[44px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Self Assign to Me</span>
                      </button>
                    ) : isAssignedToOther ? (
                      <div className="col-span-2 py-2.5 px-3 bg-[#F7F4EC] text-[#687067] border border-[#DDD8C9] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px]">
                        <span>Assigned to {table.waiterName}</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`Place order for table ${table.number}`} onClick={() => handleTableTap(table)}
                          className="py-2.5 px-3 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
                          <span>Punch Order</span>
                        </button>

                        {activeOrder ? (
                          isReady ? (
                            <button
                              type="button"
                              aria-label={`Serve order for table ${table.number}`} onClick={() => handleMarkServed(activeOrder.id, table.number)}
                              className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                            >
                              <Check className="w-3.5 h-3.5 text-amber-300" />
                              <span>Mark Served</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenOrderDetails(table)}
                              className="py-2.5 px-3 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#526B4A]" />
                              <span>View Order/Bill</span>
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            aria-label={`Seat guests at table ${table.number}`} onClick={() => handleTableTap(table)}
                            className="py-2.5 px-3 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                          >
                            <User className="w-3.5 h-3.5 text-[#526B4A]" />
                            <span>Seat Guest</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* OPTION B: WAITER NOTIFICATIONS (Requirement 6)            */}
      {/* ========================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-3.5">
          {/* Notification Filter Chips */}
          <div className="bg-white p-3 rounded-2xl border border-[#DDD8C9] flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setNotifFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  notifFilter === 'all'
                    ? 'bg-[#163024] text-[#F7F4EC]'
                    : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#DDD8C9]/60'
                }`}
              >
                All Alerts ({waiterNotifications.length})
              </button>

              <button
                type="button"
                onClick={() => setNotifFilter('ready')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  notifFilter === 'ready'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Food Ready</span>
                {readyOrdersCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-900 text-white rounded-full text-[10px]">
                    {readyOrdersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setNotifFilter('qr')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  notifFilter === 'qr'
                    ? 'bg-[#163024] text-[#F7F4EC]'
                    : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#DDD8C9]/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer QR Orders</span>
              </button>

              <button
                type="button"
                onClick={() => setNotifFilter('service')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  notifFilter === 'service'
                    ? 'bg-[#163024] text-[#F7F4EC]'
                    : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#DDD8C9]/60'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>Service Requests</span>
              </button>
            </div>

            <span className="text-[11px] text-[#687067]">
              Real-time feed for assigned floor stations
            </span>
          </div>

          {/* Notifications Feed (Requirement 6) */}
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#DDD8C9] p-12 text-center text-[#687067]">
              <BellRing className="w-10 h-10 mx-auto text-[#DDD8C9] mb-3" />
              <p className="font-bold text-sm text-[#163024]">No notifications in this category</p>
              <p className="text-xs text-[#687067] mt-1">
                New Customer QR orders, Kitchen Ready food alerts, and Service calls appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map(notif => {
                const isReadyNotif = notif.notificationCategory === 'order_ready' || notif.title.includes('READY');
                const isQRNotif = notif.notificationCategory === 'qr_order' || notif.title.includes('QR');
                const isServiceNotif =
                  notif.notificationCategory === 'service_request' ||
                  notif.notificationCategory === 'bill_request' ||
                  notif.title.includes('Service Request');

                // Extract amount for customer QR order if available
                let displayAmount: string | null = null;
                if (isQRNotif) {
                  const match = notif.message.match(/₹[\d,]+/);
                  if (match) {
                    displayAmount = match[0];
                  } else if (notif.orderId) {
                    const matchedOrder = orders.find(o => o.id === notif.orderId || o.orderNumber === notif.orderId);
                    if (matchedOrder) displayAmount = formatCurrency(matchedOrder.grandTotal);
                  }
                }

                return (
                  <div
                    key={notif.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isReadyNotif
                        ? 'bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-400/20'
                        : isQRNotif
                        ? 'bg-blue-50/30 border-blue-200'
                        : isServiceNotif
                        ? 'bg-amber-50/30 border-amber-200'
                        : 'bg-white border-[#DDD8C9]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isReadyNotif
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isQRNotif
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isServiceNotif
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-[#163024] text-[#F7F4EC]'
                        }`}
                      >
                        {isReadyNotif ? (
                          <Flame className="w-5 h-5 text-amber-300" />
                        ) : isQRNotif ? (
                          <Smartphone className="w-5 h-5" />
                        ) : isServiceNotif ? (
                          <BellRing className="w-5 h-5" />
                        ) : (
                          <UtensilsCrossed className="w-5 h-5 text-[#C5A86A]" />
                        )}
                      </div>

                      {/* Content structured strictly as requested in Requirement 6 */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Status Heading */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              isReadyNotif
                                ? 'bg-emerald-700 text-white'
                                : isQRNotif
                                ? 'bg-blue-700 text-white'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            {isReadyNotif ? 'FOOD READY' : isQRNotif ? 'CUSTOMER ORDER RECEIVED' : 'SERVICE REQUEST'}
                          </span>

                          {notif.tableNumber && (
                            <span className="px-2 py-0.5 rounded-full bg-[#163024] text-[#F7F4EC] text-[10px] font-bold">
                              Table {notif.tableNumber}
                            </span>
                          )}

                          {!notif.read && (
                            <span className="px-2 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-bold uppercase animate-pulse">
                              New
                            </span>
                          )}
                        </div>

                        {/* Customer Name */}
                        <div className="text-xs font-bold text-[#163024]">
                          Customer Name: <span className="text-[#526B4A]">{notif.customerName || 'Resort Guest'}</span>
                        </div>

                        {/* Items / Ready Items */}
                        {notif.itemsSummary && (
                          <div className="text-xs text-[#1D241F] font-medium">
                            <span className="text-[#687067]">
                              {isReadyNotif ? 'Ready Items: ' : 'Items: '}
                            </span>
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#DDD8C9]/60 inline-block mt-0.5">
                              {notif.itemsSummary}
                            </span>
                          </div>
                        )}

                        {/* Amount for QR Order */}
                        {displayAmount && (
                          <div className="text-xs text-[#163024] font-bold">
                            <span className="text-[#687067] font-normal">Amount: </span>
                            <span className="font-serif text-[#163024]">{displayAmount}</span>
                          </div>
                        )}

                        {/* Message / Details if Service */}
                        {isServiceNotif && (
                          <p className="text-xs text-[#687067] leading-relaxed">
                            {notif.message}
                          </p>
                        )}

                        <span className="text-[10px] text-[#687067] block font-mono">
                          {notif.createdAt}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons strictly conforming to Requirement 6 */}
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DDD8C9]/60">
                      {isReadyNotif ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenOrderFromNotification(notif)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#526B4A]" />
                            <span>VIEW ORDER</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkServed(notif.orderId, notif.tableNumber, notif.id)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-amber-300" />
                            <span>MARK SERVED</span>
                          </button>
                        </>
                      ) : isQRNotif ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenOrderFromNotification(notif)}
                            className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C5A86A]" />
                            <span>VIEW ORDER</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => markNotificationRead(notif.id)}
                            className="px-3.5 py-2.5 bg-white hover:bg-[#F7F4EC] text-[#687067] border border-[#DDD8C9] rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : isServiceNotif ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAttendServiceRequest(notif)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                          >
                            <Check className="w-4 h-4" />
                            <span>MARK ATTENDED</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenOrderFromNotification(notif)}
                            className="px-3.5 py-2.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                          >
                            VIEW TABLE
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(notif.id)}
                          className="w-full sm:w-auto px-4 py-2.5 bg-[#163024] text-[#F7F4EC] rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Essential Guidelines (Unobtrusive) */}
          <div className="mt-6 p-4 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs text-[#5C584E]">
            <div className="flex items-center gap-2 mb-2 font-semibold text-[#163024]">
              <Info className="w-4 h-4 text-[#8C733E]" />
              <span>Service Guidelines</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
              <li>Tap any assigned table card to punch orders or manage dining courses.</li>
              <li>Attend to guest assistance requests promptly when alerts trigger.</li>
              <li>Mark orders as Served immediately upon table delivery.</li>
              <li>Coordinate with cashier for bill clearance and table reset.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE STICKY BOTTOM ACTION / NAVIGATION BAR (Req 1 & 7)  */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#163024] text-[#F7F4EC] border-t border-[#244737] shadow-2xl px-4 py-2 flex items-center justify-around gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          className={`flex-1 py-2 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[48px] ${
            activeTab === 'tables' ? 'bg-white/15 text-[#C5A86A]' : 'text-[#DDD8C9]'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>Tables ({assignedTables.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 py-2 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer relative min-h-[48px] ${
            activeTab === 'notifications' ? 'bg-white/15 text-[#C5A86A]' : 'text-[#DDD8C9]'
          }`}
        >
          <div className="relative">
            <BellRing className="w-5 h-5 mb-0.5" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold font-mono">
                {unreadNotifsCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </button>
      </nav>

      {/* ========================================================= */}
      {/* RESPONSIVE POS SCREEN (FULL-SCREEN ON MOBILE / SPLIT VIEW ON TABLET) */}
      {/* ========================================================= */}
      {showOrderModal && (
        <WaiterOrderModal
          isOpen={showOrderModal}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedTableIdForOrder(undefined);
          }}
          selectedTableId={selectedTableIdForOrder}
          onOrderPlaced={orderNumber => {
            showToast(`Order #${orderNumber} fired to kitchen and bar!`);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* RESPONSIVE TABLE DETAILS / ORDER MODAL                    */}
      {/* ========================================================= */}
      {selectedTableForDetails && (
        <TableDetailsModal
          isOpen={Boolean(selectedTableForDetails)}
          onClose={() => setSelectedTableForDetails(null)}
          table={selectedTableForDetails}
          onPunchOrder={table => {
            setSelectedTableForDetails(null);
            setSelectedTableIdForOrder(table.id);
            setShowOrderModal(true);
          }}
          onOpenBill={tableNum => {
            setSelectedTableForDetails(null);
            setBillTableNumber(tableNum);
          }}
          onRequestBill={async table => {
            if (table.activeSessionId) {
              const result = await requestSettlementForSession(table.activeSessionId, { paymentMethodPreference: 'CASH' });
              setSelectedTableForDetails(null);
              setBillTableNumber(table.number);
              showToast(result.success ? `Settlement requested for Table ${table.number}. Cashier notified!` : result.error || 'Failed to request settlement.');
            } else {
              setSelectedTableForDetails(null);
              setBillTableNumber(table.number);
            }
          }}
        />
      )}

      {/* ========================================================= */}
      {billTableNumber && <WaiterBillModal isOpen tableNumber={billTableNumber} onClose={() => setBillTableNumber(null)} />}

      {/* SELF ASSIGN TABLES MODAL (Phase 2 Requirement 1)         */}
      {/* ========================================================= */}
      {showSelfAssignModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-[#DDD8C9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-[#163024] text-[#F7F4EC] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-[#C5A86A]" />
                <div>
                  <h3 className="font-serif font-bold text-base text-[#F7F4EC]">
                    Floor Tables • Self-Assign to My Station
                  </h3>
                  <p className="text-xs text-[#DDD8C9]">
                    Select any open, unassigned table to take charge. Tables with other servers are locked to prevent conflicts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSelfAssignModal(false)}
                className="p-1 rounded-lg text-[#DDD8C9] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
              <div className="flex items-center justify-between text-[#687067]">
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  Unassigned Floor Tables ({unassignedTables.length} Open)
                </span>
                <span className="text-[11px] font-semibold text-[#526B4A]">
                  My Station: {currentUser.name}
                </span>
              </div>

              {unassignedTables.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unassignedTables.map(t => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-[#DDD8C9] bg-[#F7F4EC] hover:border-[#163024] flex flex-col justify-between gap-3 transition-all shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-base text-[#163024]">
                            Table {t.number}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.status === 'available'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#687067] mt-1">
                          {t.section} • Capacity: {t.capacity} Guests
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>No Active Server</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelfAssign(t.id, t.number);
                          setShowSelfAssignModal(false);
                        }}
                        className="w-full py-2.5 bg-[#163024] hover:bg-[#2D5A3D] text-[#C5A86A] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[40px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Self Assign to Me</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#F7F4EC] border border-[#DDD8C9] text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#526B4A] mx-auto" />
                  <h4 className="font-serif font-bold text-sm text-[#163024]">
                    All Floor Tables Are Currently Assigned
                  </h4>
                  <p className="text-xs text-[#687067] max-w-sm mx-auto">
                    All tables in the dining areas currently have active servers assigned. You currently have {assignedTables.length} tables under your station.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#F7F4EC] border-t border-[#DDD8C9] flex justify-end">
              <button
                type="button"
                onClick={() => setShowSelfAssignModal(false)}
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
