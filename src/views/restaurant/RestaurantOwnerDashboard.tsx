import { FEATURES } from '../../config/features';
import { api } from '../../api/client';
import { parseMenuPrice } from './menuPrice';
import { checkRouteAccess } from '../../utils/rbac';
import { findCurrentTableOrder, maskPhoneNumber } from '../waiter/waiterHelpers';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UtensilsCrossed,
  Plus,
  CookingPot,
  Receipt,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  Sparkles,
  Store,
  Settings,
  BellRing,
  Check,
  X,
  ClipboardList,
  Flame,
  CalendarCheck,
  Coffee,
  Wine,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  HelpCircle,
  Eye,
  CheckCheck,
  QrCode,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react';
import {
  RestaurantTable,
  MenuItem,
  Order,
  KitchenTicket,
  DiningReservation,
  WaiterRequest,
  PaymentMethod
} from '../../types';

interface RestaurantOwnerDashboardProps {
  onOpenOrderModal: (table?: RestaurantTable) => void;
}

export const RestaurantOwnerDashboard: React.FC<RestaurantOwnerDashboardProps> = ({
  onOpenOrderModal
}) => {
  const {
    currentUser,
    pushRoute,
    activeRestaurant,
    tables,
    updateTableStatus,
    menuItems,
    addMenuItem,
    menuCategories,
    orders,
    updateOrderStatus,
    kitchenTickets,
    updateKitchenTicketStatus,
    diningReservations,
    addDiningReservation,
    waiterRequests,
    attendWaiterRequest,
    resolveWaiterRequest,
    callWaiter,
    refreshRestaurantData,
    settleTableBill
  } = useApp();

  // Filter States
  const [selectedFloorZone, setSelectedFloorZone] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [requestTab, setRequestTab] = useState<'service' | 'bills'>('service');

  // Modals
  const [menuSaveError, setMenuSaveError] = useState('');
  const [isMenuSaving, setIsMenuSaving] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState<boolean>(false);
  const [showReservationModal, setShowReservationModal] = useState<boolean>(false);
  const [showCallWaiterModal, setShowCallWaiterModal] = useState<boolean>(false);
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<RestaurantTable | null>(null);
  const [selectedOrderForSettle, setSelectedOrderForSettle] = useState<Order | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [settleSuccess, setSettleSuccess] = useState('');
  const [ownerActionError, setOwnerActionError] = useState('');

  // Form states for New Menu Item
  const [newMenuForm, setNewMenuForm] = useState({
    name: '',
    categoryName: 'Starters & Appetizers',
    menuType: 'food' as 'food' | 'drink',
    price: 380,
    isVeg: true,
    isSpicy: false,
    description: '',
    preparationTimeMinutes: 15,
    image: ''
  });
  const [ownerMenuImageUrlInput, setOwnerMenuImageUrlInput] = useState('');
  const [newMenuPortions, setNewMenuPortions] = useState<{ label: string; price: number }[]>([]);
  const [newPortionLabel, setNewPortionLabel] = useState('');
  const [newPortionPrice, setNewPortionPrice] = useState('');

  // Form states for New Reservation
  const [newResForm, setNewResForm] = useState({
    guestName: '',
    guestPhone: '',
    partySize: 4,
    tableNumber: 'T-01',
    date: new Date().toISOString().split('T')[0],
    time: '20:00',
    section: 'Main Dining',
    specialRequests: ''
  });

  // Form state for Call Waiter
  const [selectedCallTable, setSelectedCallTable] = useState<string>('T-01');
  const [selectedCallType, setSelectedCallType] = useState<'Water' | 'Call Waiter' | 'Bill' | 'Clean Table' | 'Cutlery'>('Water');
  const [callSuccessMsg, setCallSuccessMsg] = useState<string>('');

  // Scoped Data: Ensure all data strictly belongs to Pali Resort & Club / activeRestaurant.id
  const targetRestId = activeRestaurant?.id;
  const restaurantOrders = orders.filter(
    o => Boolean(targetRestId) && o.restaurantId === targetRestId
  );

  const restaurantTables = tables.filter(
    t => Boolean(targetRestId) && t.restaurantId === targetRestId
  );

  const restaurantTickets = kitchenTickets.filter(
    k => Boolean(targetRestId) && k.restaurantId === targetRestId
  );

  const restaurantReservations = diningReservations.filter(
    r => Boolean(targetRestId) && r.restaurantId === targetRestId
  );

  const maskPhone = maskPhoneNumber;
  const getTableOrder = (table: RestaurantTable): Order | undefined => findCurrentTableOrder(table, restaurantOrders);

  // Determine standard Table Status conforming to Section 8:
  // AVAILABLE, OCCUPIED, ORDERING, PREPARING, READY, BILL REQUESTED, PAYMENT PENDING, PAID
  const getTableOperationalStatus = (
    table: RestaurantTable,
    order?: Order
  ): 'AVAILABLE' | 'OCCUPIED' | 'ORDERING' | 'PREPARING' | 'READY' | 'BILL REQUESTED' | 'PAYMENT PENDING' | 'PAID' => {
    if (!order) {
      if (table.status === 'billed') return 'BILL REQUESTED';
      if (table.status === 'occupied') return 'OCCUPIED';
      return 'AVAILABLE';
    }

    if (order.paymentStatus === 'paid') return 'PAID';
    if (order.billStatus === 'requested' || table.status === 'billed') return 'BILL REQUESTED';
    if (order.paymentStatus === 'pending' && order.status === 'served') return 'PAYMENT PENDING';
    if (order.status === 'ready') return 'READY';
    if (order.status === 'preparing') return 'PREPARING';
    if (order.status === 'placed' || order.status === 'confirmed') return 'ORDERING';
    return 'OCCUPIED';
  };

  // Metrics Calculations (The 8 Mandatory Metrics from Section 6)
  // 1. Today's Restaurant Sales
  const todayTotalSales = restaurantOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  // 2. Today's Orders
  const todayOrdersCount = restaurantOrders.length;
  // 3. Active Tables
  const occupiedTables = restaurantTables.filter(t => t.status === 'occupied' || t.status === 'billed').length;
  const activeTablesCount = occupiedTables;
  // 4. Occupied Tables (excluding purely billed)
  const strictlyOccupiedCount = restaurantTables.filter(t => t.status === 'occupied').length;
  // 5. Pending Bills
  const pendingBillsCount = restaurantTables.filter(table => table.status === 'billed' ||
    restaurantOrders.some(order => order.tableId === table.id && order.status !== 'cancelled' && order.paymentStatus === 'pending' &&
      (order.status === 'served' || order.billStatus === 'requested'))).length;
  // 6. Kitchen Orders
  const kitchenOrdersCount = restaurantTickets.filter(
    k => k.status === 'new' || k.status === 'preparing'
  ).length;
  // 7. Ready Orders
  const readyOrdersCount = restaurantOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' &&
    (o.status === 'ready' || restaurantTickets.some(ticket => ticket.orderId === o.id && ticket.status === 'ready'))).length;
  // 8. Waiter Requests
  const pendingWaiterRequestsCount = waiterRequests.filter(r => r.status === 'pending').length;

  // Filter tables by floor zone and operational status
  const displayedTables = restaurantTables.filter(t => {
    if (selectedFloorZone !== 'all') {
      if (selectedFloorZone === 'ac' && t.section !== 'AC Family Lounge') return false;
      if (selectedFloorZone === 'outdoor' && t.section !== 'Terrace Garden') return false;
      if (selectedFloorZone === 'vip' && t.section !== 'VIP Private Dining') return false;
      if (selectedFloorZone === 'main' && t.section !== 'Main Dining') return false;
    }

    if (selectedStatusFilter !== 'all') {
      const ord = getTableOrder(t);
      const opStatus = getTableOperationalStatus(t, ord);
      if (selectedStatusFilter.toUpperCase() !== opStatus) return false;
    }

    return true;
  });

  // Filter orders for Section 10
  const displayedOrders = restaurantOrders.filter(o => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.guestName && o.guestName.toLowerCase().includes(orderSearch.toLowerCase())) ||
      (o.tableNumber && o.tableNumber.toLowerCase().includes(orderSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (orderStatusFilter === 'all') return true;
    if (orderStatusFilter === 'payment_pending') return o.paymentStatus === 'pending';
    if (orderStatusFilter === 'paid') return o.paymentStatus === 'paid';
    return o.status === orderStatusFilter;
  });

  // Handle Menu Creation
  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMenuSaving) return;
    setMenuSaveError('');
    setIsMenuSaving(true);
    try {
    if (!newMenuForm.name.trim() || !Number.isFinite(newMenuForm.price) || newMenuForm.price < 0) throw new Error('Enter an item name and a price zero or greater.');
    const category = menuCategories.find(c => c.name === newMenuForm.categoryName) || menuCategories[0];
    if (!category) throw new Error('No menu categories are available.');

    const finalImage = newMenuForm.image.trim() || (
      newMenuForm.menuType === 'drink'
        ? 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
    );

    const baseDesc = newMenuForm.description || 'Signature specialty prepared fresh in the resort kitchen.';
    const finalDesc = newMenuPortions.length > 0
      ? `${baseDesc}<!--portions:${JSON.stringify(newMenuPortions)}-->`
      : baseDesc;

    await addMenuItem({
      restaurantId: activeRestaurant.id,
      name: newMenuForm.name,
      categoryId: category.id,
      categoryName: category.name,
      menuType: newMenuForm.menuType,
      description: finalDesc,
      price: parseMenuPrice(newMenuForm.price),
      portionOptions: newMenuPortions.length > 0 ? newMenuPortions : undefined,
      isVeg: newMenuForm.isVeg,
      isSpicy: newMenuForm.isSpicy,
      preparationTimeMinutes: Number(newMenuForm.preparationTimeMinutes),
      isAvailable: true,
      image: finalImage,
      taxRate: activeRestaurant.taxRate || 5
    });

    setShowAddMenuModal(false);
    setNewMenuPortions([]);
    setNewPortionLabel('');
    setNewPortionPrice('');
    setNewMenuForm({
      name: '',
      categoryName: 'Starters & Appetizers',
      menuType: 'food',
      price: 380,
      isVeg: true,
      isSpicy: false,
      description: '',
      preparationTimeMinutes: 15,
      image: ''
    });
    setOwnerMenuImageUrlInput('');
    } catch (error) {
      setMenuSaveError(error instanceof Error ? error.message : 'Unable to save menu item.');
    } finally { setIsMenuSaving(false); }
  };

  // Handle Reservation Creation
  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResForm.guestName || !newResForm.guestPhone) return;

    addDiningReservation({
      restaurantId: activeRestaurant.id,
      guestName: newResForm.guestName,
      guestPhone: newResForm.guestPhone,
      partySize: Number(newResForm.partySize),
      tableNumber: newResForm.tableNumber,
      date: newResForm.date,
      time: newResForm.time,
      section: newResForm.section,
      specialRequests: newResForm.specialRequests,
      status: 'confirmed'
    });

    setShowReservationModal(false);
    setNewResForm({
      guestName: '',
      guestPhone: '',
      partySize: 4,
      tableNumber: 'T-01',
      date: new Date().toISOString().split('T')[0],
      time: '20:00',
      section: 'Main Dining',
      specialRequests: ''
    });
  };

  // Handle Call Waiter Service Dispatch
  const handleCallWaiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result=await callWaiter(selectedCallTable, selectedCallType);
    if(!result.success) return;
    setCallSuccessMsg(`Dispatched ${selectedCallType} request to Table ${selectedCallTable}`);
    setTimeout(() => {
      setCallSuccessMsg('');
      setShowCallWaiterModal(false);
    }, 1200);
  };

  const handleReleaseTable = async (table: RestaurantTable) => {
    if (!window.confirm(`Release Table ${table.number}? The server will verify the current sitting and unpaid bills.`)) return;
    try {
      if (table.activeSessionId) { await api.closeDiningSession(table.activeSessionId); await refreshRestaurantData(table.restaurantId); setOwnerActionError(''); }
      else { const result = await updateTableStatus(table.id, 'available'); setOwnerActionError(result.success ? '' : result.error || 'Unable to release table.'); }
    } catch (error: any) { setOwnerActionError(error.detail || error.message || 'Unable to release table.'); }
  };

  return (
    <div className="space-y-6 pb-12">
      {ownerActionError && <p role="alert">{ownerActionError}</p>}
      {/* 1. TOP HEADER BANNER (PERMANENTLY ASSIGNED TO PALI RESORT & CLUB) */}
      <div className="bg-white rounded-2xl border border-[#DDD8C9] p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="bg-white p-2 rounded-2xl border border-[#DDD8C9] shadow-xs flex items-center justify-center shrink-0 max-w-[180px]">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club • Pali Village"
              className="h-11 sm:h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#163024] text-[#C5A86A] border border-[#C5A86A]/30 uppercase">
                RESTAURANT OWNER
              </span>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#526B4A] animate-pulse" />
                Cloud Synced
              </span>
            </div>
            <p className="text-xs text-[#687067] mt-1 font-medium flex items-center gap-2 flex-wrap">
              <span>Nature's Gateway • Food & Beverage Operations</span>
              <span className="text-[#DDD8C9]">•</span>
              <span>Tables: {restaurantTables.length}</span>
              <span className="text-[#DDD8C9]">•</span>
              <span>Currency: {activeRestaurant?.currency || 'INR (₹)'}</span>
              <span className="text-[#DDD8C9]">•</span>
              <span>GST Tax: {activeRestaurant?.taxRate ?? 5}%</span>
            </p>
          </div>
        </div>

        {/* Operational Quick Triggers */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onOpenOrderModal()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C5A86A]" />
            <span>Punch Order</span>
          </button>

          <button
            onClick={() => pushRoute('/restaurant/qr-ordering')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#163024]/10 hover:bg-[#163024]/20 text-[#163024] border border-[#163024]/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#526B4A]" />
            <span>Generate Table QRs</span>
          </button>

          <button
            onClick={() => setShowAddMenuModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4 text-[#526B4A]" />
            <span>Add Menu Dish</span>
          </button>

          <button
            disabled={!FEATURES.DINING_RESERVATIONS}
            title={FEATURES.DINING_RESERVATIONS ? 'New Reservation' : 'Reservations are unavailable in this release'}
            onClick={() => FEATURES.DINING_RESERVATIONS && setShowReservationModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-[#C5A86A]" />
            <span>New Reservation</span>
          </button>

          <button
            onClick={() => setShowCallWaiterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <BellRing className="w-4 h-4 text-[#526B4A]" />
            <span>Call Waiter</span>
          </button>
        </div>
      </div>

      {/* 2. THE 8 MANDATORY METRICS (SECTION 6) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Metric 1: Today's Restaurant Sales */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Loaded order value</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#526B4A] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#163024] font-mono tracking-tight truncate">
              {activeRestaurant?.currency || '₹'} {(todayTotalSales ?? 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-[#526B4A] font-semibold mt-0.5">Order totals, excluding cancelled; not collected revenue</p>
          </div>
        </div>

        {/* Metric 2: Today's Orders */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Loaded orders</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5 text-[#C5A86A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#163024] font-mono tracking-tight">
              {todayOrdersCount} Orders
            </div>
            <p className="text-[10px] text-[#687067] font-medium mt-0.5">Dine & Room</p>
          </div>
        </div>

        {/* Metric 3: Active Tables */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Active Tables</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#526B4A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#163024] font-mono tracking-tight">
              {activeTablesCount} / {restaurantTables.length}
            </div>
            <p className="text-[10px] text-[#526B4A] font-semibold mt-0.5">In Service</p>
          </div>
        </div>

        {/* Metric 4: Occupied Tables */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Occupied Tables</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-[#C5A86A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#163024] font-mono tracking-tight">
              {strictlyOccupiedCount} Tables
            </div>
            <p className="text-[10px] text-[#687067] font-medium mt-0.5">Seated Guests</p>
          </div>
        </div>

        {/* Metric 5: Pending Bills */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Pending Bills</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-[#C53030]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#C53030] font-mono tracking-tight">
              {pendingBillsCount} Bills
            </div>
            <p className="text-[10px] text-[#687067] font-medium mt-0.5">Awaiting Pay</p>
          </div>
        </div>

        {/* Metric 6: Kitchen Orders */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Kitchen Orders</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <CookingPot className="w-3.5 h-3.5 text-[#526B4A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#163024] font-mono tracking-tight">
              {kitchenOrdersCount} Tickets
            </div>
            <p className="text-[10px] text-[#526B4A] font-semibold mt-0.5">Cooking on line</p>
          </div>
        </div>

        {/* Metric 7: Ready Orders */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Ready Orders</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#526B4A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#526B4A] font-mono tracking-tight">
              {readyOrdersCount} Ready
            </div>
            <p className="text-[10px] text-[#687067] font-medium mt-0.5">Pickup / Runner</p>
          </div>
        </div>

        {/* Metric 8: Waiter Requests */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#DDD8C9] shadow-sm flex flex-col justify-between hover:border-[#526B4A] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#687067] uppercase tracking-wider">Waiter Calls</span>
            <div className="w-6 h-6 rounded-lg bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <BellRing className="w-3.5 h-3.5 text-[#C5A86A]" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-[#C5A86A] font-mono tracking-tight">
              {pendingWaiterRequestsCount} Calls
            </div>
            <p className="text-[10px] text-[#687067] font-medium mt-0.5">Active alerts</p>
          </div>
        </div>
      </div>

      {/* 3. SECTION 7 & 8: TABLE OPERATIONS (MANDATORY EXACT CARD LAYOUT) */}
      <div className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#DDD8C9] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#163024] tracking-tight">
              Live Table Operations & Guest Status
            </h2>
            <p className="text-xs text-[#687067]">
              Real-time table cards with masked guest contact, live ticket amount, and billing status.
            </p>
          </div>

          {/* Status Filter Badges (Section 8: AVAILABLE, OCCUPIED, ORDERING, PREPARING, READY, BILL REQUESTED, PAYMENT PENDING, PAID) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: 'All', value: 'all' },
              { label: 'Available', value: 'available' },
              { label: 'Occupied', value: 'occupied' },
              { label: 'Ordering', value: 'ordering' },
              { label: 'Preparing', value: 'preparing' },
              { label: 'Ready', value: 'ready' },
              { label: 'Bill Requested', value: 'bill requested' },
              { label: 'Payment Pending', value: 'payment pending' },
              { label: 'Paid', value: 'paid' }
            ].map(pill => (
              <button
                key={pill.value}
                onClick={() => setSelectedStatusFilter(pill.value)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  selectedStatusFilter === pill.value
                    ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                    : 'bg-[#F7F4EC] text-[#687067] hover:text-[#163024] border border-[#DDD8C9]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#687067] font-semibold text-xs shrink-0">Dining Zone:</span>
          {[
            { id: 'all', name: 'All Dining Zones' },
            { id: 'main', name: 'Main Dining' },
            { id: 'ac', name: 'AC Family Lounge' },
            { id: 'outdoor', name: 'Terrace Garden' },
            { id: 'vip', name: 'VIP Private Dining' }
          ].map(zone => (
            <button
              key={zone.id}
              onClick={() => setSelectedFloorZone(zone.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedFloorZone === zone.id
                  ? 'bg-[#526B4A] text-white'
                  : 'bg-white text-[#687067] hover:bg-[#F7F4EC] border border-[#DDD8C9]'
              }`}
            >
              {zone.name}
            </button>
          ))}
        </div>

        {/* Table Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {displayedTables.map(table => {
            const activeOrder = getTableOrder(table);
            const opStatus = getTableOperationalStatus(table, activeOrder);

            // Customer Name
            const customerName = activeOrder?.guestName || (table.status !== 'available' ? 'Guest name not provided' : 'Available');
            // Customer Mobile (Strictly Masked)
            const customerMobile = maskPhone(activeOrder?.guestPhone);
            // Current Order #
            const currentOrderDisplay = activeOrder ? `#${activeOrder.orderNumber}` : '-';
            // Order Amount
            const orderAmountDisplay = activeOrder
              ? `₹${(activeOrder.grandTotal ?? 0).toLocaleString('en-IN')}`
              : '-';
            // Payment Status
            const paymentStatusDisplay = activeOrder
              ? (activeOrder.paymentStatus === 'paid' ? 'PAID' : (activeOrder.billStatus === 'requested' ? 'BILL REQUESTED' : 'PENDING'))
              : (table.status === 'billed' ? 'BILL REQUESTED' : (table.status === 'available' ? 'AVAILABLE' : 'PENDING'));

            // Status Styling
            let statusBadgeClass = 'bg-[#F7F4EC] text-[#526B4A] border-[#DDD8C9]';
            if (opStatus === 'OCCUPIED') statusBadgeClass = 'bg-[#163024] text-[#F7F4EC] border-[#163024]';
            if (opStatus === 'ORDERING') statusBadgeClass = 'bg-[#C5A86A]/20 text-[#163024] border-[#C5A86A]';
            if (opStatus === 'PREPARING') statusBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
            if (opStatus === 'READY') statusBadgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
            if (opStatus === 'BILL REQUESTED') statusBadgeClass = 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse';
            if (opStatus === 'PAYMENT PENDING') statusBadgeClass = 'bg-orange-100 text-orange-900 border-orange-300';
            if (opStatus === 'PAID') statusBadgeClass = 'bg-[#526B4A] text-white border-[#526B4A]';

            return (
              <div
                key={table.id}
                className="bg-white rounded-2xl border border-[#DDD8C9] p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                {/* Header: Table Number & Status */}
                <div className="flex items-start justify-between gap-2 border-b border-[#DDD8C9]/60 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-[#163024] tracking-tight font-mono">
                      TABLE {table.number}
                    </h3>
                    <p className="text-[10px] text-[#687067] font-medium">
                      {table.section} • {table.capacity} Pax
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${statusBadgeClass}`}>
                    {opStatus}
                  </span>
                </div>

                {/* Table Details: Matching Section 7 & 8 Spec Exactly */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[#687067] font-medium text-[11px]">Customer:</span>
                    <span className="font-bold text-[#163024] truncate max-w-[140px]">{customerName}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[#687067] font-medium text-[11px]">Mobile:</span>
                    <span className="font-mono text-[#526B4A] font-bold text-[11px]">{customerMobile}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[#687067] font-medium text-[11px]">Current Order:</span>
                    <span className="font-mono font-bold text-[#163024]">{currentOrderDisplay}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[#687067] font-medium text-[11px]">Order Amount:</span>
                    <span className="font-mono font-bold text-[#163024]">{orderAmountDisplay}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[#687067] font-medium text-[11px]">Payment:</span>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      paymentStatusDisplay === 'PAID'
                        ? 'bg-[#526B4A]/10 text-[#526B4A]'
                        : paymentStatusDisplay === 'BILL REQUESTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {paymentStatusDisplay}
                    </span>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-2 border-t border-[#DDD8C9]/60 flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenOrderModal(table)}
                    className="flex-1 py-1.5 px-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer text-center"
                  >
                    Punch Order
                  </button>

                  {activeOrder && activeOrder.paymentStatus !== 'paid' && (
                    <button
                      onClick={() => setSelectedOrderForSettle(activeOrder)}
                      className="py-1.5 px-2.5 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                      title="Settle Bill"
                    >
                      Bill
                    </button>
                  )}

                  {table.status !== 'available' && !activeOrder && (
                    <button
                      onClick={() => handleReleaseTable(table)}
                      className="py-1.5 px-2.5 bg-white hover:bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9] rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                      title="Mark Table Available"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SECTION 15 & 16: SERVICE REQUESTS & BILL REQUESTS (FOCUSED OPERATIONAL HUB) */}
      <div className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD8C9] pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#163024] tracking-tight">
              Active Dining Service & Billing Requests
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C5A86A]/20 text-[#163024]">
              Live Feed
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
            <button
              onClick={() => setRequestTab('service')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                requestTab === 'service'
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'text-[#687067] hover:text-[#163024]'
              }`}
            >
              Service Requests ({waiterRequests.filter(r => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setRequestTab('bills')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                requestTab === 'bills'
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'text-[#687067] hover:text-[#163024]'
              }`}
            >
              Bill Requests ({restaurantOrders.filter(o => o.billStatus === 'requested' || o.paymentStatus === 'pending').length})
            </button>
          </div>
        </div>

        {/* Tab 1: Service Requests (CALL WAITER, WATER, BILL, CUTLERY, CLEAN TABLE, OTHER) */}
        {requestTab === 'service' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Table</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Request Type</th>
                  <th className="p-3">Requested At</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8C9]/60">
                {waiterRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#687067]">
                      No active service requests at this moment.
                    </td>
                  </tr>
                ) : (
                  waiterRequests.map(req => {
                    const reqTable = restaurantTables.find(t => t.number === req.tableNumber);
                    const reqOrder = reqTable ? getTableOrder(reqTable) : undefined;
                    const custName = reqOrder?.guestName || 'Guest name not provided';
                    const isPending = req.status === 'pending';

                    return (
                      <tr key={req.id} className="hover:bg-[#F7F4EC]/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#163024]">
                          Table {req.tableNumber}
                        </td>
                        <td className="p-3 text-[#1D241F] font-semibold">
                          {custName}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            req.requestType === 'Water'
                              ? 'bg-[#526B4A]/10 text-[#163024] border border-[#526B4A]/30'
                              : req.requestType === 'Bill'
                              ? 'bg-rose-100 text-rose-900 border border-rose-200'
                              : req.requestType === 'Cutlery'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : req.requestType === 'Clean Table'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9]'
                          }`}>
                            {req.requestType.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[#687067]">
                          {req.requestedAt}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isPending
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                              : 'bg-[#526B4A]/20 text-[#526B4A]'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                onClick={() => attendWaiterRequest(req.id)}
                                className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                ATTEND
                              </button>
                            )}
                            <button
                              onClick={() => resolveWaiterRequest(req.id)}
                              className="px-2.5 py-1 bg-[#163024] hover:bg-[#204333] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              RESOLVE
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Bill Requests (BILL REQUESTED, Table, Customer, Order, Subtotal, Tax, Tip, Total, Payment Status) */}
        {requestTab === 'bills' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Table</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Subtotal</th>
                  <th className="p-3">GST Tax</th>
                  <th className="p-3">Tip</th>
                  <th className="p-3">Grand Total</th>
                  <th className="p-3">Payment Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8C9]/60">
                {restaurantOrders
                  .filter(o => o.billStatus === 'requested' || o.paymentStatus === 'pending')
                  .slice(0, 8)
                  .map(order => {
                    const custName = order.guestName || 'Guest name not provided';
                    const taxAmount = order.gstAmount || Math.round(order.subtotal * 0.05);
                    const tipAmount = order.tipAmount || 0;

                    return (
                      <tr key={order.id} className="hover:bg-[#F7F4EC]/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#163024]">
                          {order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway'}
                        </td>
                        <td className="p-3 text-[#1D241F] font-semibold">
                          {custName}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#526B4A]">
                          #{order.orderNumber}
                        </td>
                        <td className="p-3 font-mono text-[#163024]">
                          ₹{(order.subtotal ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-mono text-[#687067]">
                          ₹{(taxAmount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-mono text-[#687067]">
                          ₹{(tipAmount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#163024] text-sm">
                          ₹{(order.grandTotal ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            order.paymentStatus === 'paid'
                              ? 'bg-[#526B4A]/20 text-[#526B4A]'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedOrderForSettle(order)}
                            className="px-3 py-1.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Settle Bill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. SECTION 10: ORDER MANAGEMENT (SPECIFIED COLUMNS & FILTERS) */}
      <div className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DDD8C9] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#163024] tracking-tight">
              Restaurant Orders Master
            </h2>
            <p className="text-xs text-[#687067]">
              Live overview with Food vs. Bar items breakdown, payment status, and order transitions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#687067]" />
              <input
                type="text"
                placeholder="Search orders, table, customer..."
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs text-[#163024] font-medium focus:outline-none focus:border-[#526B4A] w-56"
              />
            </div>

            <button
              onClick={() => onOpenOrderModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* Section 10 Filters: All, New, Preparing, Ready, Completed, Cancelled, Payment Pending, Paid */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'placed', label: 'New' },
            { id: 'preparing', label: 'Preparing' },
            { id: 'ready', label: 'Ready' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'payment_pending', label: 'Payment Pending' },
            { id: 'paid', label: 'Paid' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setOrderStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === f.id
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'bg-[#F7F4EC] text-[#687067] hover:text-[#163024] border border-[#DDD8C9]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Section 10 Columns: Order Number, Table, Customer, Food Items, Bar Items, Amount, Time, Status, Payment Status */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Order Number</th>
                <th className="p-3">Table</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Food Items</th>
                <th className="p-3">Bar Items</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Time</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payment Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD8C9]/60">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-[#687067]">
                    No restaurant orders match the current filter.
                  </td>
                </tr>
              ) : (
                displayedOrders.map(order => {
                  const foodItems = order.items.filter(
                    i => i.menuType !== 'drink' && !i.categoryName?.toLowerCase().includes('beverage')
                  );
                  const barItems = order.items.filter(
                    i => i.menuType === 'drink' || i.categoryName?.toLowerCase().includes('beverage')
                  );

                  return (
                    <tr key={order.id} className="hover:bg-[#F7F4EC]/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#163024]">
                        #{order.orderNumber}
                      </td>
                      <td className="p-3 font-semibold text-[#163024]">
                        {order.tableNumber ? `Table ${order.tableNumber}` : order.roomNumber || 'Takeaway'}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#1D241F]">{order.guestName || 'Guest name not provided'}</div>
                        <div className="text-[10px] font-mono text-[#526B4A]">{maskPhone(order.guestPhone)}</div>
                      </td>
                      <td className="p-3 max-w-[180px]">
                        {foodItems.length > 0 ? (
                          <span className="text-[#163024] truncate block" title={foodItems.map(f => `${f.name} (x${f.quantity})`).join(', ')}>
                            {foodItems.map(f => `${f.name} (x${f.quantity})`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-[#687067] italic">-</span>
                        )}
                      </td>
                      <td className="p-3 max-w-[150px]">
                        {barItems.length > 0 ? (
                          <span className="text-[#526B4A] font-semibold truncate block" title={barItems.map(b => `${b.name} (x${b.quantity})`).join(', ')}>
                            {barItems.map(b => `${b.name} (x${b.quantity})`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-[#687067] italic">-</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#163024] text-sm">
                        ₹{(order.grandTotal ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-mono text-[#687067]">
                        {order.createdAt}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'completed'
                            ? 'bg-[#526B4A]/20 text-[#526B4A]'
                            : order.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'preparing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9]'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.paymentStatus === 'paid'
                            ? 'bg-[#526B4A]/20 text-[#526B4A]'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === 'placed' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'preparing')}
                              className="px-2 py-1 bg-[#163024] hover:bg-[#204333] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Cook
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'ready')}
                              className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Ready
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'completed')}
                              className="px-2 py-1 bg-[#526B4A] hover:bg-[#43573c] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Complete
                            </button>
                          )}
                          {order.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => setSelectedOrderForSettle(order)}
                              className="px-2 py-1 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. OPERATIONAL HUBS QUICK LINKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kitchen KDS Link */}
        <div
          onClick={() => pushRoute('/kitchen/kds')}
          className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm hover:border-[#526B4A] transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#F7F4EC] text-[#526B4A] flex items-center justify-center">
              <CookingPot className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#687067] group-hover:text-[#163024] transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-[#163024] text-sm group-hover:text-[#526B4A] transition-colors">
              Kitchen & KDS Screen
            </h3>
            <p className="text-xs text-[#687067] mt-1">
              Station tickets for Grill, Curries, Tandoor & Bar with elapsed timers and cook actions.
            </p>
          </div>
        </div>

        {/* WAITER DASHBOARD Link */}
        <div
          onClick={() => pushRoute('/waiter/dashboard')}
          className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm hover:border-[#526B4A] transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#F7F4EC] text-[#C5A86A] flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#687067] group-hover:text-[#163024] transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-[#163024] text-sm group-hover:text-[#526B4A] transition-colors">
              WAITER DASHBOARD & Floor Ops
            </h3>
            <p className="text-xs text-[#687067] mt-1">
              Live guest buzzers for water, cutlery, table turn, and mobile ordering support.
            </p>
          </div>
        </div>

        {/* Restaurant Menu & Pricing */}
        <div
          onClick={() => pushRoute('/restaurant/menu')}
          className="bg-white rounded-2xl border border-[#DDD8C9] p-5 shadow-sm hover:border-[#526B4A] transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#F7F4EC] text-[#163024] flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#687067] group-hover:text-[#163024] transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-[#163024] text-sm group-hover:text-[#526B4A] transition-colors">
              Food & Bar Menu Master
            </h3>
            <p className="text-xs text-[#687067] mt-1">
              Configure dishes, bar beverages, portion pricing, categories, and item availability.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD MENU DISH (FOOD / BAR) */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DDD8C9] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2.5">
                <UtensilsCrossed className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Add Menu Dish (Food or Bar)</h3>
              </div>
              <button
                onClick={() => setShowAddMenuModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
            </div>

            <form onSubmit={handleCreateMenuItem} className="space-y-3 text-xs">
              <div className="flex items-center gap-2 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setNewMenuForm({ ...newMenuForm, menuType: 'food' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    newMenuForm.menuType === 'food'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Food Menu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMenuForm({ ...newMenuForm, menuType: 'drink', categoryName: 'Bar & Cocktails' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    newMenuForm.menuType === 'drink'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Wine className="w-3.5 h-3.5" />
                  <span>Bar & Beverage</span>
                </button>
              </div>

              <div>
                <label className="font-bold text-[#163024] block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder={newMenuForm.menuType === 'food' ? 'e.g. Pali Tandoori Platter' : 'e.g. Kokum Coastal Cooler'}
                  value={newMenuForm.name}
                  onChange={e => setNewMenuForm({ ...newMenuForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              {menuSaveError && <p role="alert" className="text-red-700">{menuSaveError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Category</label>
                  <select
                    value={menuCategories.some(category=>category.name===newMenuForm.categoryName) ? newMenuForm.categoryName : menuCategories[0]?.name || ''}
                    onChange={e => setNewMenuForm({ ...newMenuForm, categoryName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  >
                    <option value="">Select category</option>
                    {menuCategories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={20}
                    value={Number.isFinite(newMenuForm.price) ? newMenuForm.price : ''}
                    onChange={e => setNewMenuForm({ ...newMenuForm, price: e.target.value === '' ? NaN : Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Prep Time (mins)</label>
                  <input
                    type="number"
                    min={5}
                    value={newMenuForm.preparationTimeMinutes}
                    onChange={e => setNewMenuForm({ ...newMenuForm, preparationTimeMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMenuForm.isVeg}
                      onChange={e => setNewMenuForm({ ...newMenuForm, isVeg: e.target.checked })}
                      className="rounded text-[#526B4A]"
                    />
                    <span className="font-semibold text-[#163024]">Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMenuForm.isSpicy}
                      onChange={e => setNewMenuForm({ ...newMenuForm, isSpicy: e.target.checked })}
                      className="rounded text-red-600"
                    />
                    <span className="font-semibold text-[#163024]">Spicy</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#163024] block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation notes, chef notes..."
                  value={newMenuForm.description}
                  onChange={e => setNewMenuForm({ ...newMenuForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                />
              </div>

              {/* Portion Pricing Options */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#163024]">Portion Pricing Options</label>
                  <span className="text-[10px] text-[#687067]">e.g. 30ml Peg, 60ml Peg, Glass, Bottle</span>
                </div>
                {newMenuPortions.length > 0 && (
                  <div className="space-y-1 bg-[#F7F4EC] p-2 rounded-xl border border-[#DDD8C9]">
                    {newMenuPortions.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#DDD8C9] text-xs">
                        <span className="font-semibold text-[#163024]">{opt.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#526B4A]">₹{opt.price}</span>
                          <button
                            type="button"
                            aria-label={`Remove portion ${opt.label}`}
                            onClick={() => setNewMenuPortions(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Portion name (e.g. 30ml Peg)"
                    value={newPortionLabel}
                    onChange={e => setNewPortionLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Price (₹)"
                    value={newPortionPrice}
                    onChange={e => setNewPortionPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPortionLabel.trim() && newPortionPrice.trim() && Number(newPortionPrice) >= 0) {
                        setNewMenuPortions(prev => [...prev, { label: newPortionLabel.trim(), price: Number(newPortionPrice) }]);
                        setNewPortionLabel('');
                        setNewPortionPrice('');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#163024] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer hover:bg-[#204333]"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Image Upload, Preview, Replace, Remove */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <label className="font-bold text-[#163024] block">Dish Image</label>
                {newMenuForm.image ? (
                  <div className="relative rounded-xl border border-[#DDD8C9] overflow-hidden bg-[#F7F4EC]">
                    <img
                      src={newMenuForm.image}
                      alt="Dish preview"
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-2 bg-white border-t border-[#DDD8C9] flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-[#526B4A] font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-2 py-0.5 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] rounded-lg text-xs font-bold border border-[#DDD8C9] cursor-pointer flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                  setNewMenuForm({ ...newMenuForm, image: reader.result });
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewMenuForm({ ...newMenuForm, image: '' });
                            setOwnerMenuImageUrlInput('');
                          }}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="border-2 border-dashed border-[#DDD8C9] hover:border-[#526B4A] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-[#F7F4EC]/40 hover:bg-[#F7F4EC] transition-all">
                      <Upload className="w-5 h-5 text-[#526B4A] mb-1" />
                      <span className="text-xs font-bold text-[#163024]">Click to upload dish photo</span>
                      <span className="text-[10px] text-[#687067]">PNG, JPG, WEBP</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setNewMenuForm({ ...newMenuForm, image: reader.result });
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="Or paste image URL"
                        value={ownerMenuImageUrlInput}
                        onChange={e => setOwnerMenuImageUrlInput(e.target.value)}
                        className="flex-1 px-3 py-1 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                      />
                      {ownerMenuImageUrlInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewMenuForm({ ...newMenuForm, image: ownerMenuImageUrlInput.trim() });
                            setOwnerMenuImageUrlInput('');
                          }}
                          className="px-2.5 py-1 bg-[#163024] text-[#C5A86A] rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Set
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#687067] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={isMenuSaving || menuCategories.length===0}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW DINING RESERVATION */}
      {FEATURES.DINING_RESERVATIONS && showReservationModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DDD8C9] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Book Dining Table</h3>
              </div>
              <button
                onClick={() => setShowReservationModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#163024] block mb-1">Guest Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={newResForm.guestName}
                  onChange={e => setNewResForm({ ...newResForm, guestName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              <div>
                <label className="font-bold text-[#163024] block mb-1">Guest Contact Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98200 45210"
                  value={newResForm.guestPhone}
                  onChange={e => setNewResForm({ ...newResForm, guestPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newResForm.date}
                    onChange={e => setNewResForm({ ...newResForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={newResForm.time}
                    onChange={e => setNewResForm({ ...newResForm, time: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Party Size</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newResForm.partySize}
                    onChange={e => setNewResForm({ ...newResForm, partySize: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Table</label>
                  <select
                    value={newResForm.tableNumber}
                    onChange={e => setNewResForm({ ...newResForm, tableNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  >
                    {restaurantTables.map(t => (
                      <option key={t.id} value={t.number}>
                        Table {t.number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Section</label>
                  <select
                    value={newResForm.section}
                    onChange={e => setNewResForm({ ...newResForm, section: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  >
                    <option value="Main Dining">Main</option>
                    <option value="Terrace Garden">Terrace</option>
                    <option value="AC Family Lounge">AC Lounge</option>
                    <option value="VIP Private Dining">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#163024] block mb-1">Special Notes / Dietary Requests</label>
                <input
                  type="text"
                  placeholder="e.g. Anniversary dinner, corner booth preferred"
                  value={newResForm.specialRequests}
                  onChange={e => setNewResForm({ ...newResForm, specialRequests: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReservationModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#687067] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CALL WAITER / SERVICE DISPATCH */}
      {showCallWaiterModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#DDD8C9] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2.5">
                <BellRing className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Dispatch Waiter Service</h3>
              </div>
              <button
                onClick={() => setShowCallWaiterModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {callSuccessMsg ? (
              <div className="p-4 bg-[#F7F4EC] text-[#526B4A] rounded-xl font-bold text-center border border-[#DDD8C9]">
                {callSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleCallWaiterSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-[#163024] block mb-1">Target Table</label>
                  <select
                    value={selectedCallTable}
                    onChange={e => setSelectedCallTable(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  >
                    {restaurantTables.map(t => (
                      <option key={t.id} value={t.number}>
                        Table {t.number} ({t.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#163024] block mb-1">Service Request Type</label>
                  <select
                    value={selectedCallType}
                    onChange={e => setSelectedCallType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-medium focus:outline-none"
                  >
                    <option value="Water">Water Service</option>
                    <option value="Call Waiter">Call Waiter</option>
                    <option value="Bill">Bill Request</option>
                    <option value="Cutlery">Cutlery & Napkins</option>
                    <option value="Clean Table">Clean Table</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCallWaiterModal(false)}
                    className="px-4 py-2 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#687067] rounded-xl font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl font-bold shadow-sm cursor-pointer"
                  >
                    Send Alert
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Billing & Settlement Modal */}
      {selectedOrderForSettle && (
        <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div role="dialog" aria-label="Order Settlement" className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-[#DDD8C9]">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-[#163024]">
                  Settle Bill • Order #{selectedOrderForSettle.orderNumber}
                </h3>
                <p className="text-xs text-[#687067]">
                  Table {selectedOrderForSettle.tableNumber} • {selectedOrderForSettle.guestName || 'Resort Guest'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedOrderForSettle(null);
                  setSettleError('');
                  setSettleSuccess('');
                }}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                {settleError}
              </div>
            )}
            {settleSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{settleSuccess}</span>
              </div>
            )}

            <div className="bg-[#F7F4EC] p-3 rounded-xl border border-[#DDD8C9] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#687067]">
                <span>Items:</span>
                <span className="font-medium text-[#163024]">{selectedOrderForSettle.items?.length || 0} items</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-[#DDD8C9]">
                <span className="text-[#163024]">Amount Due:</span>
                <span className="font-mono text-base text-[#163024]">
                  ₹{(selectedOrderForSettle.grandTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Tender Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#687067] block">Select Tender Method:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'upi', 'card', 'room_folio'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettleMethod(m)}
                    className={`py-2 px-1 rounded-lg text-xs font-bold capitalize border transition-colors cursor-pointer ${
                      settleMethod === m
                        ? 'bg-[#163024] text-[#C5A86A] border-[#163024]'
                        : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-stone-200'
                    }`}
                  >
                    {m === 'room_folio' ? 'Folio' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSettling}
                onClick={async () => {
                  setIsSettling(true);
                  setSettleError('');
                  setSettleSuccess('');
                  try {
                    const res = await settleTableBill(selectedOrderForSettle.id, settleMethod, selectedOrderForSettle.grandTotal);
                    if (res.success) {
                      setSettleSuccess(`Order #${selectedOrderForSettle.orderNumber} settled successfully via ${settleMethod.toUpperCase()}!`);
                      setTimeout(() => {
                        setSelectedOrderForSettle(null);
                        setSettleSuccess('');
                      }, 1500);
                    } else {
                      setSettleError(res.error || 'Failed to settle bill.');
                    }
                  } catch (e: any) {
                    setSettleError(e.detail || e.message || 'Settlement error.');
                  } finally {
                    setIsSettling(false);
                  }
                }}
                className="w-full py-2.5 bg-[#2D5A3D] hover:bg-[#1f402a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSettling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C5A86A]" />
                    <span>Processing Settlement...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-[#C5A86A]" />
                    <span>Confirm ₹{(selectedOrderForSettle.grandTotal || 0).toFixed(2)} Settlement</span>
                  </>
                )}
              </button>

              {checkRouteAccess('/cashier/dashboard', currentUser.role, currentUser).allowed && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderForSettle(null);
                    pushRoute('/cashier/dashboard');
                  }}
                  className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-[#163024] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Open Full Cashier POS &amp; Billing
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForSettle(null);
                  setSettleError('');
                  setSettleSuccess('');
                }}
                className="w-full py-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
