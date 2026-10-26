import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem, MenuCategory, Order, PaymentMethod } from '../../types';
import { convertOutletMenuResponse, convertGuestMenuResponse } from '../../api/menuAdapter';
import { QRCoverView } from './QRCoverView';
import { QRHomeExploreView } from './QRHomeExploreView';
import { QRMenuView } from './QRMenuView';
import { CustomerMobileAuth } from './CustomerMobileAuth';
import { QRPaymentView } from './QRPaymentView';
import { QROrderConfirmationView } from './QROrderConfirmationView';
import { QROrderTrackingView } from './QROrderTrackingView';
import { QRThankYouView } from './QRThankYouView';
import { QRItemDetailModal } from './QRItemDetailModal';
import { QRCartDrawer, CartLineItem } from './QRCartDrawer';
import { QRWaiterServiceModal } from './QRWaiterServiceModal';
import { QRTableBillModal } from './QRTableBillModal';
import { InvalidDiningQRView } from './InvalidDiningQRView';
import { TableNotOpenView } from './TableNotOpenView';
import { api, ApiError } from '../../api/client';
import { guestQrContext, scrubOrderingQrUrl, type QrNavigation } from '../../utils/guestQrContext';
import {
  Smartphone,
  Maximize2,
  ShieldCheck,
  Receipt,
  WifiOff,
  LogOut,
  User,
  Utensils,
  RefreshCw
} from 'lucide-react';

export type CustomerJourneyViewState =
  | 'cover'
  | 'explore'
  | 'menu'
  | 'auth'
  | 'payment'
  | 'confirmation'
  | 'tracking'
  | 'thankyou';

interface PendingCheckoutMeta {
  specialNotes: string;
  customGuestName: string;
  calculatedTip: number;
  selectedTipType: any;
  tipPercentageNum: number;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
}

export const CustomerQRMenu: React.FC = () => {
  const {
    restaurants,
    placeCustomerQROrder,
    orders,
    currentRoute,
    customerSession,
    selfSeatCustomerFromQr,
    endCustomerDiningSession,
    validateQRContext,
    settleTableBill,
    settlePayment
  } = useApp();

  // Screen State - Preserves current view state across refreshes (default 'menu' to avoid redirect to cover)
  const [viewState, setViewState] = useState<CustomerJourneyViewState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('pali_customer_view_state') as CustomerJourneyViewState;
        if (saved && ['cover', 'explore', 'menu', 'auth', 'payment', 'confirmation', 'tracking', 'thankyou'].includes(saved)) {
          return saved;
        }
      } catch {}
    }
    return 'cover';
  });
  const [selectedMenuType, setSelectedMenuType] = useState<'food' | 'drink' | 'all'>('food');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('pali_customer_view_state', viewState);
      } catch {}
    }
  }, [viewState]);

  // Network Status for Offline Queueing
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  interface ResolvedTableData {
    tableId: string;
    outletId: string;
    outletName: string;
    zoneName: string;
    tableNumber: string;
    capacity: number;
    status: string;
    hasActiveSession: boolean;
    sessionId: string | null;
  }

  const [qrParams, setQrParams] = useState<QrNavigation>(() => guestQrContext.read());
  const resolveVersion = useRef(0);

  const [resolvedTable, setResolvedTable] = useState<ResolvedTableData | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'loading' | 'invalid' | 'not_open' | 'ready' | 'connection_error'>('loading');
  const [resolveError, setResolveError] = useState<string>('This QR code is not valid for dining.');
  // Modals & Action State
  const [detailModalItem, setDetailModalItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [initialWaiterType, setInitialWaiterType] = useState<string>('call-waiter');
  const [authPendingAction, setAuthPendingAction] = useState<'checkout' | 'bill' | 'service' | null>(null);

  // Live Menu Catalog State
  const [menuData, setMenuData] = useState<{ categories: MenuCategory[]; items: MenuItem[] } | null>(null);
  const [menuLoading, setMenuLoading] = useState<boolean>(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const loadMenu = async (outletId: string) => {
    if (!outletId) return;
    const version = resolveVersion.current;
    setMenuLoading(true);
    setMenuError(null);
    try {
      const rawMenu = await api.getGuestMenu({
        outletId,
        table: resolvedTable?.tableNumber || qrParams.table || undefined,
        restaurant: qrParams.restaurant || outletId,
        qrPublicCode: qrParams.c || undefined
      });
      const converted = convertGuestMenuResponse(rawMenu);
      if(version === resolveVersion.current) setMenuData(converted);
    } catch (err: any) {
      if(version === resolveVersion.current) setMenuError('Failed to load menu. Please check your connection and tap retry.');
    } finally {
      if(version === resolveVersion.current) setMenuLoading(false);
    }
  };

  const resolveTable = async (silent = false) => {
    const version = ++resolveVersion.current;
    const snapshot = guestQrContext.capture(currentRoute);
    setQrParams(snapshot);
    if (!snapshot.binding) endCustomerDiningSession();
    if (snapshot.s) scrubOrderingQrUrl();

    // Secure QR credential enforcement: Table resolution requires either public QR code or table identifier
    if (!snapshot.c && !snapshot.table) {
      setResolvedTable(null);
      setResolveStatus('invalid');
      setResolveError('A valid table QR code scan is required for dining. Please scan the official physical QR standee on your table.');
      return;
    }

    if (!silent) setResolveStatus('loading');
    try {
      const payload: {
        qrPublicCode?: string;
        qrSecretToken?: string;
        table?: string;
        restaurant?: string;
        outletId?: string;
      } = {};
      if (snapshot.c) payload.qrPublicCode = snapshot.c;
      if (snapshot.s) payload.qrSecretToken = snapshot.s;
      if (snapshot.table) payload.table = snapshot.table;
      if (snapshot.restaurant) {
        payload.restaurant = snapshot.restaurant;
        payload.outletId = snapshot.restaurant;
      }
      const data = await api.guestResolveTable(payload);
      if (version !== resolveVersion.current || !guestQrContext.bind(snapshot, data)) return;
      if (customerSession && customerSession.tableId !== data.tableId) endCustomerDiningSession();
      if (resolvedTable && resolvedTable.tableId !== data.tableId) {
        setViewState('cover');
      }
      setResolvedTable(data);
      setResolveStatus('ready');
    } catch (err: unknown) {
      if (version !== resolveVersion.current) return;
      const status = err instanceof ApiError ? err.status : 0;
      setResolvedTable(null);
      setResolveStatus([400, 401, 403, 404].includes(status) ? 'invalid' : 'connection_error');
      setResolveError(
        [400, 401, 403, 404].includes(status)
          ? 'This QR code is invalid or expired. Please ask floor staff for a new QR.'
          : 'Unable to load this table. Please retry.'
      );
    }
  };

  useEffect(() => {
    setAuthPendingAction(null);
    setActiveConfirmedOrder(null);
    setIsWaiterModalOpen(false);
    setIsBillModalOpen(false);
    setIsCartOpen(false);
    setDetailModalItem(null);
    void resolveTable(false);
    return () => { resolveVersion.current++; };
  }, [currentRoute]);
  // Active table metadata stored from resolved table response
  const activeTableNumber = resolvedTable?.tableNumber || customerSession?.tableNumber || '';
  const activeTableId = resolvedTable?.tableId || customerSession?.tableId || '';
  const activeRestaurantId = resolvedTable?.outletId || customerSession?.restaurantId || '';
  const activeRestaurantName = resolvedTable?.outletName || 'Pali Resort & Club';
  const activeSessionId = customerSession?.sessionId || resolvedTable?.sessionId || '';
  const activeGuestName = customerSession?.customerName || 'Resort Guest';

  // Load menu once table is successfully resolved
  useEffect(() => {
    if (activeRestaurantId && resolveStatus === 'ready') {
      loadMenu(activeRestaurantId);
    }
  }, [activeRestaurantId, resolveStatus]);

  const [orderError, setOrderError] = useState<string | null>(null);

  // Cart & Order State - Preserved across refreshes
  const [cart, setCart] = useState<CartLineItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('pali_customer_cart');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('pali_customer_cart', JSON.stringify(cart));
      } catch {}
    }
  }, [cart]);

  const [pendingCheckoutMeta, setPendingCheckoutMeta] = useState<PendingCheckoutMeta | null>(null);
  const [activeConfirmedOrder, setActiveConfirmedOrder] = useState<Order | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const orderIdempotencyKeyRef = useRef<string | null>(null);

  // Clear idempotency key whenever cart contents change
  useEffect(() => {
    orderIdempotencyKeyRef.current = null;
  }, [cart]);

  // Device Frame vs Full Canvas
  const [isDeviceFrame, setIsDeviceFrame] = useState(true);

  // Live server orders polling for live status tracking (declared before any early returns)
  const [serverOrders, setServerOrders] = useState<Order[]>([]);

  const fetchLiveOrders = useCallback(async () => {
    if (!api.getGuestToken() || customerSession?.tableId!==activeTableId || customerSession.sessionId!==activeSessionId) {setServerOrders([]);return;}
    try {
      const res = await api.guestListOrders();
      const list = res.orders || res.items || [];
      if (Array.isArray(list)) {
        const converted: Order[] = list.map((so: any) => ({
          id: so.id,
          orderNumber: so.orderNumber ? `ORD-${so.orderNumber}` : `ORD-${so.id.slice(-4)}`,
          restaurantId: so.outletId || activeRestaurantId,
          tableId: so.tableId || activeTableId,
          tableNumber: so.tableNumber || activeTableNumber,
          customerId: `guest-${so.diningSessionId || 'session'}`,
          customerName: `Table ${so.tableNumber || activeTableNumber} Guest`,
          items: (so.items || []).map((it: any) => ({
            id: it.id || `item-${Math.random()}`,
            menuItemId: it.menuItemId || it.menu_item_id,
            name: it.itemName || it.menuItemName || it.name || 'Menu Item',
            quantity: it.quantity,
            price: (it.unitPricePaise || 0) / 100,
            totalPrice: (it.totalPricePaise || 0) / 100,
            isVeg: true,
            status: (it.status || it.itemStatus || so.status || 'placed').toLowerCase(),
            notes: it.customizationNotes || it.specialInstructions || it.notes,
            round: so.roundNumber || 1
          })),
          subtotal: (so.subtotalPaise || 0) / 100,
          tax: (so.taxPaise || 0) / 100,
          discount: (so.discountPaise || 0) / 100,
          tipAmount: 0,
          grandTotal: (so.totalPaise || 0) / 100,
          status: (so.status || 'placed').toLowerCase() as any,
          paymentStatus: 'pending',
          orderedAt: so.createdAt || new Date().toISOString(),
          time: so.createdAt ? new Date(so.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          notes: so.specialInstructions
        }));
        setServerOrders(converted);
      }
    } catch (err: any) {
      setOrderError(err?.message || 'Unable to refresh your orders. Please retry.');
    }
  }, [activeRestaurantId, activeTableId, activeTableNumber, activeSessionId, customerSession]);

  useEffect(() => {
    if (resolvedTable?.hasActiveSession || activeConfirmedOrder || viewState === 'tracking') {
      fetchLiveOrders();
      const timer = setInterval(fetchLiveOrders, 5000);
      return () => clearInterval(timer);
    }
  }, [resolvedTable?.hasActiveSession, activeConfirmedOrder, viewState, fetchLiveOrders]);

  // 1. Check for Invalid QR Context (400, 401, 404 or missing parameters)
  if (resolveStatus === 'invalid') {
    return (
      <div className="w-full flex justify-center py-6">
        <InvalidDiningQRView
          errorReason={resolveError}
          onScanAgain={() => resolveTable(false)}
        />
      </div>
    );
  }

  // 2. Check for Table Not Open
  if (resolveStatus === 'not_open') {
    return (
      <div className="w-full flex justify-center py-6">
        <TableNotOpenView
          tableNumber={activeTableNumber}
          outletName={activeRestaurantName}
          onRetry={() => resolveTable(true)}

        />
      </div>
    );
  }

  // 3. Check for Connection Error (network or server errors other than 400/401/404)
  if (resolveStatus === 'connection_error') {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 font-sans">
        <div className="bg-[#fcfbf7] rounded-3xl border border-[#DDD8C9] shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="border-b border-[#DDD8C9] pb-4">
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-[#DDD8C9] inline-block mx-auto max-w-[240px]">
              <img
                src="/palilogo.png"
                alt="Pali Resort & Club • Pali Village"
                className="h-14 sm:h-16 w-auto object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="w-20 h-20 mx-auto rounded-2xl bg-[#163024]/5 border-2 border-dashed border-[#526B4A]/30 flex items-center justify-center relative">
            <WifiOff className="w-10 h-10 text-[#526B4A]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-serif text-[#163024] tracking-tight">
              CONNECTION PROBLEM
            </h1>
            <p className="text-sm font-semibold text-[#1D241F]">
              Connection problem, try again
            </p>
            <p className="text-xs text-[#687067] leading-relaxed">
              We could not reach the resort service. Please check your connection and tap retry.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={() => resolveTable(false)}
              className="w-full py-3.5 px-5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#C5A86A]" />
              <span>RETRY</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Loading state while resolving table
  if (resolveStatus === 'loading') {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#163024] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#163024]">Resolving dining table...</p>
        </div>
      </div>
    );
  }

  // 5. Loading state while fetching menu catalog
  if (resolveStatus === 'ready' && menuLoading && !menuData) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#163024] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#163024]">Loading restaurant menu...</p>
        </div>
      </div>
    );
  }

  // 6. Error state when menu fails to load
  if (resolveStatus === 'ready' && menuError && !menuData) {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 font-sans">
        <div className="bg-[#fcfbf7] rounded-3xl border border-[#DDD8C9] shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="border-b border-[#DDD8C9] pb-4">
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-[#DDD8C9] inline-block mx-auto max-w-[240px]">
              <img
                src="/palilogo.png"
                alt="Pali Resort & Club"
                className="h-14 sm:h-16 w-auto object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="w-20 h-20 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <Utensils className="w-10 h-10 text-rose-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-serif text-[#163024]">
              Failed to Load Menu
            </h1>
            <p className="text-xs text-rose-700 font-medium">
              {menuError}
            </p>
          </div>
          <button
            onClick={() => loadMenu(activeRestaurantId)}
            className="w-full py-3.5 px-5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#C5A86A]" />
            <span>RETRY LOADING MENU</span>
          </button>
        </div>
      </div>
    );
  }

  // Handle Quick Add (standard portion)
  const handleQuickAddToCart = (item: MenuItem) => {
    if (item.isAvailable === false) return;

    const existingIndex = cart.findIndex(c => c.item.id === item.id && !c.notes);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      const newLine: CartLineItem = {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        item,
        quantity: 1,
        selectedPortion: { label: 'Standard', price: item.price },
        unitPrice: item.price,
      };
      setCart(prev => [...prev, newLine]);
    }
  };

  const handleAddToCartWithPortion = (
    item: MenuItem,
    portionLabel?: string,
    portionPrice?: number
  ) => {
    if (item.isAvailable === false) return;
    const label = portionLabel || (item.portionOptions && item.portionOptions.length > 0 ? item.portionOptions[0].label : 'Standard');
    const price = portionPrice ?? (item.portionOptions && item.portionOptions.length > 0 ? item.portionOptions[0].price : item.price);

    const existingIndex = cart.findIndex(c => c.item.id === item.id && c.selectedPortion?.label === label);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      const newLine: CartLineItem = {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        item,
        quantity: 1,
        selectedPortion: { label, price },
        unitPrice: price,
      };
      setCart(prev => [...prev, newLine]);
    }
  };

  // Handle Detailed Add (from Modal)
  const handleAddCustomToCart = (
    item: MenuItem,
    quantity: number,
    portion?: { label: string; price: number },
    notes?: string
  ) => {
    if (item.isAvailable === false) return;

    const price = portion?.price || item.price;
    const newLine: CartLineItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      item,
      quantity,
      selectedPortion: portion || { label: 'Standard', price },
      unitPrice: price,
      notes: notes?.trim() || undefined,
    };
    setCart(prev => [...prev, newLine]);
    setDetailModalItem(null);
  };

  const handleUpdateCartQty = (lineId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.id === lineId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartLineItem => item !== null);
    });
  };

  const handleRemoveCartItem = (lineId: string) => {
    setCart(prev => prev.filter(c => c.id !== lineId));
  };

  const authorizedGuest = Boolean(api.getGuestToken() && customerSession?.status==='active' && customerSession.tableId===activeTableId && customerSession.sessionId===activeSessionId);
  const openVerifiedService = () => {
    if(!authorizedGuest) {setAuthPendingAction('service');setViewState('auth');return;}
    setIsWaiterModalOpen(true);
  };

  // Multi-round Order Placement: Direct dispatch to Kitchen via api.guestPlaceOrder
  const handleSendOrderToKitchen = async (specialNotes: string, customGuestName: string) => {
    if (cart.length === 0 || isPlacingOrder) return;
    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      if (!authorizedGuest) {
        if (!activeTableId || !activeRestaurantId || resolvedTable?.hasActiveSession) {
          throw new Error('This table is unavailable. Please request floor assistance.');
        }
        const seated = await selfSeatCustomerFromQr(activeTableId,activeRestaurantId);
        if (!seated.success) throw new Error(seated.error || 'QR authentication failed');
      }
      if (!orderIdempotencyKeyRef.current) {
        orderIdempotencyKeyRef.current = `qr-${activeTableId || activeTableNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
      const idempotencyKey = orderIdempotencyKeyRef.current;
      const orderPayload = {
        items: cart.map(line => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
          customizationNotes: line.notes || (line.selectedPortion && line.selectedPortion.label !== 'Standard' ? line.selectedPortion.label : undefined)
        })),
        specialInstructions: specialNotes || undefined
      };

      const serverOrder = await api.guestPlaceOrder(orderPayload, { idempotencyKey });

      // Build Order confirmation object strictly from server response
      const confirmedOrder: Order = {
        id: serverOrder.id,
        orderNumber: serverOrder.orderNumber ? `ORD-${serverOrder.orderNumber}` : `ORD-${serverOrder.id.slice(-4)}`,
        restaurantId: activeRestaurantId,
        tableId: activeTableId,
        tableNumber: activeTableNumber,
        customerId: customerSession?.customerId || `guest-${Date.now()}`,
        customerName: customerSession?.customerName || customGuestName || activeGuestName || `Table ${activeTableNumber} Guest`,
        items: (serverOrder.items || []).map((it: any) => ({
          id: it.id || `item-${Math.random()}`,
          menuItemId: it.menuItemId || it.menu_item_id,
          name: it.itemName || it.name || it.menuItemName || 'Menu Item',
          quantity: it.quantity,
          price: (it.unitPricePaise || it.pricePaise || 0) / 100,
          totalPrice: (it.totalPricePaise || 0) / 100,
          isVeg: it.isVeg ?? it.is_veg ?? true,
          status: it.status || 'ordered',
          notes: it.customizationNotes || it.notes,
          kitchenStationCode: it.kitchenStationCode,
          round: serverOrder.roundNumber || 1
        })),
        subtotal: (serverOrder.subtotalPaise || 0) / 100,
        tax: (serverOrder.taxPaise || 0) / 100,
        discount: 0,
        tipAmount: 0,
        grandTotal: (serverOrder.totalPaise || 0) / 100,
        status: (serverOrder.status as any) || 'placed',
        paymentStatus: 'pending',
        orderedAt: serverOrder.createdAt || new Date().toISOString(),
        notes: specialNotes
      };

      // Clear idempotency key on successful order
      orderIdempotencyKeyRef.current = null;
      // Save active confirmed order, clear cart, close drawer, and show Confirmation
      setActiveConfirmedOrder(confirmedOrder);
      setCart([]);
      setIsCartOpen(false);
      setViewState('confirmation');
      fetchLiveOrders();
    } catch (err: any) {
      // Keep cart intact on failure and display server message
      setOrderError(err?.message || 'Failed to send order to kitchen. Please notify your captain.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Handler for Final Bill: Customer login flow required before viewing/paying the bill
  const handleViewBill = () => {
    setAuthPendingAction('bill');
    setViewState('auth');
  };

  // Step 4: Triggered if customer uses full-page QRPaymentView
  const handleConfirmPayment = async (_method: PaymentMethod) => {
    throw new Error('Online payments are blocked - CLIENT API REQUIRED. Please ask an authorized cashier to record cash received.');
  };

  // Sync active order with live orders state for status progression and multi-round tracking
  const allOrders = authorizedGuest ? serverOrders : [];
  const tableActiveOrder = allOrders.find(
    o => (o.tableId === activeTableId || o.tableNumber === activeTableNumber) &&
         o.status !== 'cancelled' &&
         o.paymentStatus !== 'paid'
  );

  const currentRound = tableActiveOrder
    ? (tableActiveOrder.items.reduce((max, it) => Math.max(max, it.round || 1), 1) + 1)
    : 1;

  const isRepeatOrder = !!tableActiveOrder && tableActiveOrder.items.length > 0;

  const liveConfirmedOrder = (activeConfirmedOrder && allOrders.find(o => o.id === activeConfirmedOrder.id))
    || tableActiveOrder
    || (activeConfirmedOrder ? allOrders.find(o => (o.tableId === activeTableId || o.tableNumber === activeTableNumber) && o.status !== 'cancelled') : null);

  // Cart summary amounts
  const cartSubtotal = cart.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0);
  const cartTax = Math.round(cartSubtotal * 0.05);
  const cartGrandTotal = cartSubtotal + cartTax;

  return (
    <div className="w-full flex flex-col items-center">
      {orderError && <div role="alert" className="p-3 text-red-700">{orderError}</div>}
      
      {/* Desktop Helper Toolbar (hidden on first welcome cover screen for immersion) */}
      {viewState !== 'cover' && (
        <div className="hidden lg:flex items-center justify-between w-full max-w-md mb-3 px-2 text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${customerSession ? 'bg-emerald-600' : 'bg-amber-500'} animate-pulse`} />
            <span className="font-semibold text-stone-700">
              {customerSession ? `Verified: ${customerSession.customerName}` : 'Guest Browsing (No Login Required)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBillModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#163024] hover:bg-[#0f2219] text-[#dfc78f] border border-[#c5a86a]/40 rounded-lg shadow-2xs font-semibold cursor-pointer"
              title="View Live Table Bill"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Table Bill</span>
            </button>

            {/* Authoritative Table Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#DDD8C9] rounded-lg text-stone-800 shadow-2xs font-sans">
              <ShieldCheck className="w-3.5 h-3.5 text-[#526B4A]" />
              <span className="font-mono font-bold text-xs">Table {activeTableNumber}</span>
            </div>

            <button
              onClick={() => setIsDeviceFrame(!isDeviceFrame)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-stone-700 shadow-2xs cursor-pointer"
              title="Toggle Smartphone Frame"
            >
              {isDeviceFrame ? <Maximize2 className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
              <span>{isDeviceFrame ? 'Full Width' : 'Phone Frame'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Canvas or Smartphone Frame */}
      <div
        className={`w-full transition-all duration-300 ${
          viewState === 'cover'
            ? 'w-full h-[100dvh] min-h-[100dvh] max-w-full sm:max-w-md sm:mx-auto sm:my-auto sm:rounded-3xl sm:shadow-2xl sm:border sm:border-white/10 p-0 overflow-hidden flex flex-col bg-[#163024]'
            : isDeviceFrame
            ? 'w-full max-w-md mx-auto bg-[#fcfbf7] rounded-[36px] shadow-2xl border-4 sm:border-8 border-stone-800 relative min-h-[100dvh] sm:min-h-[840px] overflow-hidden flex flex-col p-3 sm:p-4'
            : 'w-full max-w-2xl mx-auto bg-[#fcfbf7] sm:rounded-3xl sm:shadow-xl sm:border sm:border-[#DDD8C9] p-3 sm:p-6 min-h-[100dvh] flex flex-col'
        }`}
      >
        {/* Phone Notch simulation for mobile mockup */}
        {isDeviceFrame && (
          <div className="hidden sm:flex justify-center -mt-2 mb-2">
            <div className="w-24 h-3.5 bg-stone-800 rounded-b-xl flex items-center justify-center">
              <div className="w-8 h-1 bg-stone-600 rounded-full" />
            </div>
          </div>
        )}

        {/* Verified Customer Status Bar (hidden on welcome cover screen) */}
        {customerSession && viewState !== 'cover' && (
          <div className="mb-3 px-3 py-1.5 bg-[#163024] text-[#F7F4EC] rounded-xl flex items-center justify-between text-xs shadow-sm border border-[#244737]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#C5A86A]/20 border border-[#C5A86A]/40 flex items-center justify-center text-[#C5A86A]">
                <User className="w-3 h-3" />
              </div>
              <div>
                <p className="font-bold text-xs text-[#F7F4EC] truncate max-w-[140px]">
                  {customerSession.customerName}
                </p>
                <p className="text-[10px] font-mono text-[#C5A86A]">
                  Table {customerSession.tableNumber}
                </p>
              </div>
            </div>

            <button
              onClick={endCustomerDiningSession}
              className="px-2 py-0.5 bg-white/10 hover:bg-rose-900/60 text-stone-200 hover:text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
              title="Exit session"
            >
              <LogOut className="w-3 h-3" />
              <span>Exit</span>
            </button>
          </div>
        )}

        {/* Offline Mode Banner (hidden on welcome cover screen) */}
        {!isOnline && viewState !== 'cover' && (
          <div className="mb-3 px-3.5 py-2 bg-amber-500/15 border border-amber-600/30 rounded-xl text-amber-900 text-xs flex items-center justify-between font-sans">
            <div className="flex items-center gap-2 font-medium">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Offline Mode Active • Orders stored in local sync queue</span>
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded font-bold uppercase shrink-0">IndexedDB</span>
          </div>
        )}

        {/* DYNAMIC SCREEN ROUTING */}
        <div className="flex-1 flex flex-col">
          {/* SCREEN 1: LUXURY COVER VIEW */}
          {viewState === 'cover' && (
            <QRCoverView
              tableNumber={activeTableNumber}
              restaurantName={activeRestaurantName}
              onEnter={() => setViewState('menu')}
              onExplore={() => setViewState('explore')}
            />
          )}

          {/* SCREEN 3: LUXURY EXPLORE HOME */}
          {viewState === 'explore' && (
            <QRHomeExploreView
              tableNumber={activeTableNumber}
              guestName={activeGuestName}
              restaurantName={activeRestaurantName}
              items={menuData?.items}
              categories={menuData?.categories}
              onOpenFoodMenu={() => {
                setSelectedMenuType('food');
                setViewState('menu');
              }}
              onOpenDrinkMenu={() => {
                setSelectedMenuType('drink');
                setViewState('menu');
              }}
              onOpenSearch={(_q) => {
                setViewState('menu');
              }}
              onOpenWaiterModal={(type) => {
                setInitialWaiterType(type || 'call-waiter');
                openVerifiedService();
              }}
              onViewBill={handleViewBill}
              cart={cart}
              onQuickAddToCart={handleQuickAddToCart}
              onOpenCart={() => setIsCartOpen(true)}
              activeOrder={liveConfirmedOrder}
              onViewOrderStatus={() => setViewState('tracking')}
            />
          )}

          {/* SCREEN 4: FOOD & BAR MENU (Direct access, no login required) */}
          {viewState === 'menu' && (
            <QRMenuView
              initialMenuType={selectedMenuType}
              tableNumber={activeTableNumber}
              cart={cart}
              items={menuData?.items}
              categories={menuData?.categories}
              onBackToLanding={() => setViewState('cover')}
              onOpenItemDetail={(item) => setDetailModalItem(item)}
              onQuickAddToCart={handleQuickAddToCart}
              onAddToCartWithPortion={handleAddToCartWithPortion}
              onUpdateCartQty={handleUpdateCartQty}
              onOpenCartDrawer={() => setIsCartOpen(true)}
              activeOrder={liveConfirmedOrder}
              onViewOrderStatus={() => setViewState('tracking')}
              onCallWaiter={(type) => {
                setInitialWaiterType(type || 'call-waiter');
                openVerifiedService();
              }}
              onViewBill={handleViewBill}
            />
          )}

          {/* SCREEN 2: MOBILE AUTH & OTP VERIFICATION (Shown before checkout or before final bill) */}
          {viewState === 'auth' && (
            <CustomerMobileAuth
              tableNumber={activeTableNumber}
              tableId={activeTableId}
              restaurantId={activeRestaurantId}
              title="Customer Verification"
              subtitle="Verify your mobile number before viewing or settling your bill."
              submitButtonText="VERIFY & CONTINUE"
              onSuccess={(session) => {
                if(authPendingAction==='checkout') {setAuthPendingAction(null);setViewState('menu');setIsCartOpen(true);return;}
                if(authPendingAction==='service') {setAuthPendingAction(null);setViewState('menu');setIsWaiterModalOpen(true);return;}
                setAuthPendingAction(null);
                // Return to the previous screen (menu or tracking) and open bill modal
                if (liveConfirmedOrder) {
                  setViewState('tracking');
                } else {
                  setViewState('menu');
                }
                setIsBillModalOpen(true);
              }}
              onCancel={() => {
                setAuthPendingAction(null);
                if (liveConfirmedOrder) {
                  setViewState('tracking');
                } else {
                  setViewState('menu');
                }
              }}
            />
          )}

          {/* SCREEN 6: PAYMENT METHOD */}
          {viewState === 'payment' && (
            <QRPaymentView
              tableNumber={activeTableNumber}
              guestName={customerSession?.customerName || activeGuestName}
              totalAmount={pendingCheckoutMeta ? pendingCheckoutMeta.grandTotal : cartGrandTotal}
              subtotal={pendingCheckoutMeta ? pendingCheckoutMeta.subtotal : cartSubtotal}
              taxAmount={pendingCheckoutMeta ? pendingCheckoutMeta.gstAmount : cartTax}
              tipAmount={pendingCheckoutMeta ? pendingCheckoutMeta.calculatedTip : 0}
              itemCount={cart.reduce((a, b) => a + b.quantity, 0)}
              items={cart}
              onBack={() => {
                setIsCartOpen(true);
                setViewState('menu');
              }}
              onConfirmPayment={handleConfirmPayment}
            />
          )}

          {/* SCREEN 7: ORDER CONFIRMATION */}
          {viewState === 'confirmation' && (
            liveConfirmedOrder ? (
              <QROrderConfirmationView
                order={liveConfirmedOrder}
                onTrackOrder={() => setViewState('tracking')}
                onOrderMore={() => {
                  setSelectedMenuType('food');
                  setViewState('menu');
                }}
                onViewBill={handleViewBill}
              />
            ) : (
              <div className="p-8 text-center space-y-4 my-auto">
                <p className="text-sm font-semibold text-stone-700">Order successfully received!</p>
                <button
                  onClick={() => setViewState('menu')}
                  className="px-6 py-2.5 rounded-xl bg-[#163024] text-[#f7f4ec] text-xs font-bold uppercase"
                >
                  Return to Menu
                </button>
              </div>
            )
          )}

          {/* SCREEN 8: ORDER TRACKING */}
          {viewState === 'tracking' && (
            liveConfirmedOrder ? (
              <QROrderTrackingView
                order={liveConfirmedOrder}
                onOrderMore={() => {
                  setSelectedMenuType('food');
                  setViewState('menu');
                }}
                onCallWaiter={() => {
                  setInitialWaiterType('call-waiter');
                  openVerifiedService();
                }}
                onViewBill={handleViewBill}
                onViewThankYou={() => setViewState('thankyou')}
                onRefresh={fetchLiveOrders}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-[#e8e1cf] space-y-4 my-auto">
                <p className="text-sm font-semibold text-stone-700">
                  No active orders in progress for Table {activeTableNumber}.
                </p>
                <button
                  onClick={() => setViewState('menu')}
                  className="px-6 py-2.5 rounded-xl bg-[#163024] text-[#f7f4ec] text-xs font-bold uppercase tracking-wider"
                >
                  Browse Menu & Order Dishes
                </button>
              </div>
            )
          )}

          {/* SCREEN 9: THANK YOU & FINAL BILL */}
          {viewState === 'thankyou' && (
            <QRThankYouView
              tableNumber={activeTableNumber}
              order={liveConfirmedOrder}
              onViewDetailedBill={handleViewBill}
              onBackToMenu={() => setViewState('menu')}
              onEndSession={customerSession ? endCustomerDiningSession : undefined}
            />
          )}
        </div>

      </div>

      {/* Item Customization Bottom Sheet / Modal */}
      <QRItemDetailModal
        item={detailModalItem}
        isOpen={!!detailModalItem}
        onClose={() => setDetailModalItem(null)}
        onAddToCart={handleAddCustomToCart}
      />

      {/* Cart & Order Dispatch Drawer (Screen 5) */}
      <QRCartDrawer
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          setOrderError(null);
        }}
        cart={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        onPlaceOrder={handleSendOrderToKitchen}
        tableNumber={activeTableNumber}
        guestName={customerSession?.customerName || activeGuestName}
        taxRate={5}
        activeRound={currentRound}
        isRepeatOrder={isRepeatOrder}
        errorMessage={orderError}
        isPlacingOrder={isPlacingOrder}
      />

      {/* Waiter Service Page Modal */}
      <QRWaiterServiceModal
        isOpen={isWaiterModalOpen}
        onClose={() => setIsWaiterModalOpen(false)}
        tableNumber={activeTableNumber}
        guestName={activeGuestName}
      />

      {/* Unified Table Bill & Online Payment Modal */}
      <QRTableBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        tableNumber={activeTableNumber}
        onOrderMore={() => {
          setIsBillModalOpen(false);
          setViewState('menu');
        }}
        onPaymentSuccess={() => {
          setViewState('thankyou');
        }}
      />

    </div>
  );
};
