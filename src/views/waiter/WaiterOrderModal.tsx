import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem, RestaurantTable } from '../../types';
import { maskPhoneNumber, formatCurrency } from './waiterHelpers';
import { api, generateIdempotencyKey } from '../../api/client';
import { SharedMenuItemCard } from '../../components/menu/SharedMenuItemCard';
import {
  X,
  Search,
  Utensils,
  Wine,
  Plus,
  Minus,
  Trash2,
  Send,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Phone,
  ChevronLeft,
  ShoppingBag,
  ShoppingCart,
  ArrowLeft,
  Coffee,
  Check,
  MessageSquare,
  Flame,
  ChevronRight,
  Users
} from 'lucide-react';

export interface WaiterCartItem {
  id: string;
  item: MenuItem;
  quantity: number;
  selectedPortionLabel?: string;
  unitPrice: number;
  notes: string;
}

interface WaiterOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTableId?: string;
  preSelectedTableId?: string;
  onOrderPlaced?: (orderNumber: string) => void;
}

export const WaiterOrderModal: React.FC<WaiterOrderModalProps> = ({
  isOpen,
  onClose,
  selectedTableId: propSelectedTableId,
  preSelectedTableId,
  onOrderPlaced
}) => {
  const {
    tables,
    orders,
    customers,
    guests,
    menuItems,
    refreshRestaurantData,
    activeRestaurant,
    currentUser
  } = useApp();

  const initialTableId = propSelectedTableId || preSelectedTableId;

  // Scoped tables for rest-1
  const scopedTables = useMemo(
    () => tables.filter(t => t.restaurantId === activeRestaurant?.id),
    [tables,activeRestaurant?.id]
  );

  // Table selection
  const [selectedTableId, setSelectedTableId] = useState<string>(
    initialTableId || scopedTables[0]?.id || 't-1'
  );

  useEffect(() => {
    if (initialTableId) {
      setSelectedTableId(initialTableId);
    } else if (scopedTables.length > 0 && !selectedTableId) {
      setSelectedTableId(scopedTables[0].id);
    }
  }, [initialTableId, scopedTables]);

  const activeTable = useMemo(
    () => scopedTables.find(t => t.id === selectedTableId) || scopedTables[0],
    [scopedTables, selectedTableId]
  );

  // Existing active order for table if running bill
  const existingOrder = useMemo(() => {
    if (!activeTable) return undefined;
    return orders.find(
      o => (o.tableId === activeTable.id || o.tableNumber === activeTable.number) &&
           o.paymentStatus !== 'paid' &&
           o.status !== 'cancelled'
    );
  }, [orders, activeTable]);

  // Customer notes below are not persisted by the staff order API.
  // Customer state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{
    name: string;
    phone?: string;
  } | null>(null);

  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customGuestName, setCustomGuestName] = useState('');
  const [customGuestPhone, setCustomGuestPhone] = useState('');

  // Auto-populate customer from table/order if available
  useEffect(() => {
    if (existingOrder) {
      setSelectedCustomer({
        name: existingOrder.guestName,
        phone: existingOrder.guestPhone
      });
      setCustomGuestName(existingOrder.guestName);
      setCustomGuestPhone(existingOrder.guestPhone || '');
    } else if (activeTable && activeTable.status === 'occupied') {
      setSelectedCustomer({
        name: 'Resort Guest',
        phone: '+91 98205 56789'
      });
      setCustomGuestName('Resort Guest');
      setCustomGuestPhone('+91 98205 56789');
    } else {
      setSelectedCustomer({
        name: 'Walk-in Guest',
        phone: '+91 98205 56789'
      });
      setCustomGuestName('Walk-in Guest');
      setCustomGuestPhone('+91 98205 56789');
    }
  }, [existingOrder, activeTable]);

  // Dual Menu selection: 'food' vs 'drink' (Requirement 4)
  const [activeMenuType, setActiveMenuType] = useState<'food' | 'drink'>('food');
  const [menuSearch, setMenuSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);

  // Cart
  const [cart, setCart] = useState<WaiterCartItem[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [guestNotes, setGuestNotes] = useState('');

  // Mobile Bottom Sheet / Full Cart Drawer visibility
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Selected portions map: itemId -> portionLabel
  const [selectedPortions, setSelectedPortions] = useState<Record<string, string>>({});

  // Submission idempotency key & guest count
  const [submissionIdempotencyKey, setSubmissionIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [guestCount, setGuestCount] = useState<number>(() => activeTable?.guestCount || activeTable?.capacity || 2);
  const [hasSubmissionError, setHasSubmissionError] = useState(false);

  useEffect(() => {
    if (activeTable?.guestCount) {
      setGuestCount(activeTable.guestCount);
    }
  }, [activeTable]);

  // Submission feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    tableNumber: string;
    guestName: string;
    grandTotal: number;
    paymentStatus: string;
    status: string;
  } | null>(null);

  // Active notes item id for inline note adding
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);

  // Menu lists
  const foodItems = useMemo(
    () => menuItems.filter(i => i.menuType !== 'drink'),
    [menuItems]
  );
  const drinkItems = useMemo(
    () => menuItems.filter(i => i.menuType === 'drink'),
    [menuItems]
  );

  const currentBaseItems = activeMenuType === 'food' ? foodItems : drinkItems;

  const categories = useMemo(() => {
    const cats: { id: string; name: string }[] = [{ id: 'all', name: 'All' }];
    currentBaseItems.forEach(item => {
      if (!cats.some(c => c.id === item.categoryId)) {
        cats.push({ id: item.categoryId, name: item.categoryName });
      }
    });
    return cats;
  }, [currentBaseItems]);

  const filteredItems = useMemo(() => {
    return currentBaseItems.filter(item => {
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) {
        return false;
      }
      if (vegOnly && !item.isVeg) return false;
      if (menuSearch.trim()) {
        const q = menuSearch.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.categoryName.toLowerCase().includes(q);
        const matchesSub = item.subCategory?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesSub && !matchesDesc) return false;
      }
      return true;
    });
  }, [currentBaseItems, activeCategoryId, vegOnly, menuSearch]);

  if (!isOpen) return null;

  // Cart operations
  const handleAddToCart = (item: MenuItem, portionLabel?: string, portionPrice?: number) => {
    if (item.isAvailable === false) return;

    let finalLabel = portionLabel;
    let finalPrice = portionPrice ?? item.price;

    if (!finalLabel) {
      const chosenPortionLabel = selectedPortions[item.id];
      if (chosenPortionLabel && item.portionOptions) {
        const matched = item.portionOptions.find(p => p.label === chosenPortionLabel);
        if (matched) {
          finalLabel = matched.label;
          finalPrice = matched.price;
        }
      } else if (item.portionOptions && item.portionOptions.length > 0) {
        finalLabel = item.portionOptions[0].label;
        finalPrice = item.portionOptions[0].price;
      } else {
        finalLabel = 'Standard';
        finalPrice = item.price;
      }
    }

    const existingIndex = cart.findIndex(
      c => c.item.id === item.id && c.selectedPortionLabel === finalLabel
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      const newItem: WaiterCartItem = {
        id: `wc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        item,
        quantity: 1,
        selectedPortionLabel: finalLabel,
        unitPrice: finalPrice,
        notes: ''
      };
      setCart(prev => [...prev, newItem]);
    }
    setSubmissionIdempotencyKey(generateIdempotencyKey());
    setHasSubmissionError(false);
    setErrorMessage(null);
  };

  const handleUpdateQty = (cartId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(line => {
          if (line.id === cartId) {
            const nextQty = line.quantity + delta;
            return nextQty > 0 ? { ...line, quantity: nextQty } : null;
          }
          return line;
        })
        .filter(Boolean) as WaiterCartItem[]
    );
    setSubmissionIdempotencyKey(generateIdempotencyKey());
    setHasSubmissionError(false);
    setErrorMessage(null);
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart(prev => prev.filter(line => line.id !== cartId));
    setSubmissionIdempotencyKey(generateIdempotencyKey());
    setHasSubmissionError(false);
    setErrorMessage(null);
  };

  const handleUpdateItemNote = (cartId: string, note: string) => {
    setCart(prev =>
      prev.map(line => (line.id === cartId ? { ...line, notes: note } : line))
    );
    setSubmissionIdempotencyKey(generateIdempotencyKey());
    setHasSubmissionError(false);
    setErrorMessage(null);
  };

  // Find quantity in cart for an item
  const getItemCartQty = (itemId: string): number => {
    return cart
      .filter(c => c.item.id === itemId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  // Cart Separation: Food vs Bar
  const foodCartItems = cart.filter(c => c.item.menuType !== 'drink');
  const barCartItems = cart.filter(c => c.item.menuType === 'drink');
  const totalCartQty = cart.reduce((acc, c) => acc + c.quantity, 0);

  // Send Order to Server (Prices, taxes and totals calculated entirely server-side)
  const handleSendOrder = async () => {
    if(isSubmitting) return;
    if (cart.length === 0 || !activeTable) {
      setErrorMessage('Please add items to cart before sending order.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    const guestName = customGuestName.trim() || selectedCustomer?.name || 'Walk-in Guest';

    try {
      const itemsPayload = cart.map(c => ({
        menuItemId: c.item.id,
        quantity: c.quantity,
        portion: c.selectedPortionLabel && c.selectedPortionLabel !== 'Standard' ? c.selectedPortionLabel : undefined,
        notes: c.notes || undefined
      }));

      const specialNotes = [kitchenNotes, guestNotes].filter(Boolean).join(' • ');

      const res = await api.createStaffOrder(
        {
          outletId: activeRestaurant?.id || 'rest-1',
          tableId: activeTable.id,
          guestCount,
          items: itemsPayload,
          specialInstructions: specialNotes || undefined
        },
        { idempotencyKey: submissionIdempotencyKey }
      );

      // Refresh restaurant floor data from server immediately
      await refreshRestaurantData(activeRestaurant?.id || 'rest-1');

      setIsSubmitting(false);
      setHasSubmissionError(false);

      setConfirmedOrder({
        orderNumber: String(res.orderNumber),
        tableNumber: activeTable.number,
        guestName: existingOrder?.guestName || `Table ${activeTable.number} Guest`,
        grandTotal: res.totalPaise / 100,
        paymentStatus: 'pending',
        status: res.status ? (res.status.toLowerCase() as any) : 'placed'
      });

      // Clear cart on successful submission and generate new key for next order
      setCart([]);
      setSubmissionIdempotencyKey(generateIdempotencyKey());

      if (onOrderPlaced) {
        onOrderPlaced(`ORD-${res.orderNumber}`);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setHasSubmissionError(true);
      // On failure: keep modal open with the selected items and show Retry
      const errorDetail = err.detail || err.message || 'Failed to place order on server. Please try again.';
      setErrorMessage(errorDetail);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#163024]/70 backdrop-blur-xs flex items-center justify-center font-sans overflow-hidden">
      {/* Container: Full-screen on Mobile, Split View on Tablet/Desktop */}
      <div className="bg-[#F7F4EC] w-full h-full md:max-w-7xl md:h-[96vh] md:rounded-2xl shadow-2xl border-0 md:border md:border-[#DDD8C9] overflow-hidden flex flex-col">
        
        {/* ========================================================= */}
        {/* TOP HEADER: RESPONSIVE ACROSS ALL BREAKPOINTS             */}
        {/* ========================================================= */}
        <header className="bg-[#163024] text-[#F7F4EC] px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between border-b border-[#244737] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-1 sm:ml-0 rounded-xl bg-white/10 hover:bg-white/20 text-[#F7F4EC] transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              aria-label="Back to tables"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#C5A86A]" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#526B4A]/50 border border-[#C5A86A]/40 flex items-center justify-center font-serif font-bold text-sm sm:text-base text-[#C5A86A] shadow-inner">
                {activeTable?.number || 'T-??'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-sm sm:text-base text-[#F7F4EC] font-serif tracking-tight">
                    Table {activeTable?.number}
                  </h2>
                  <span className="text-[10px] sm:text-xs text-[#DDD8C9] font-normal">
                    ({activeTable?.capacity} Pax)
                  </span>
                  {existingOrder && (
                    <span className="text-[9px] sm:text-[10px] bg-[#C5A86A] text-[#163024] font-bold px-1.5 py-0.5 rounded font-mono">
                      Tab #{existingOrder.orderNumber}
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-[#DDD8C9]/80 truncate max-w-[180px] sm:max-w-xs">
                  Guest: <strong className="text-white">{customGuestName || 'Walk-in'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Cart Trigger Button */}
            <button
              type="button"
              onClick={() => setShowMobileCart(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A86A] text-[#163024] rounded-xl text-xs font-bold shadow-sm transition-transform active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{totalCartQty}</span>
              <span className="border-l border-[#163024]/20 pl-1.5">{totalCartQty === 1 ? '1 item' : `${totalCartQty} items`}</span>
            </button>

            {/* Close POS */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close POS"
              className="p-1.5 rounded-xl text-[#DDD8C9] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="bg-red-700 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Confirmation Screen */}
        {confirmedOrder ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4 bg-white">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center border-4 border-emerald-200 animate-in zoom-in-75">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold font-serif text-[#163024]">
                Order Sent to Kitchen & Bar!
              </h3>
              <p className="text-xs sm:text-sm text-[#687067] max-w-md">
                KOT tickets dispatched to Kitchen and Bar preparation stations. Waiter notified of real-time prep progress.
              </p>
            </div>

            <div className="bg-[#F7F4EC] p-4 sm:p-5 rounded-2xl border border-[#DDD8C9] max-w-sm w-full text-xs space-y-2.5 text-left shadow-xs">
              <div className="flex justify-between border-b border-[#DDD8C9]/60 pb-1.5">
                <span className="text-[#687067]">Order Number:</span>
                <span className="font-mono font-bold text-[#163024]">#{confirmedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between border-b border-[#DDD8C9]/60 pb-1.5">
                <span className="text-[#687067]">Table:</span>
                <span className="font-bold text-[#163024]">Table {confirmedOrder.tableNumber}</span>
              </div>
              <div className="flex justify-between border-b border-[#DDD8C9]/60 pb-1.5">
                <span className="text-[#687067]">Guest Name:</span>
                <span className="font-bold text-[#163024]">{confirmedOrder.guestName}</span>
              </div>
              <div className="flex justify-between border-b border-[#DDD8C9]/60 pb-1.5">
                <span className="text-[#687067]">Total Amount:</span>
                <span className="font-mono font-bold text-[#163024] text-sm">
                  {formatCurrency(confirmedOrder.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#687067]">Kitchen Status:</span>
                <span className="font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                  {confirmedOrder.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setCart([]);
                  onClose();
                }}
                className="px-6 py-3 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-transform active:scale-95"
              >
                RETURN TO FLOOR
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setCart([]);
                }}
                className="px-5 py-3 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                PUNCH ANOTHER ORDER
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN POS BODY: SPLIT VIEW ON TABLET, SINGLE SCREEN ON MOBILE */
          /* ========================================================= */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

            {/* ----------------------------------------------------- */}
            {/* LEFT / MAIN COLUMN: MENU CATALOG (FOOD / BAR)         */}
            {/* ----------------------------------------------------- */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#F7F4EC] md:border-r md:border-[#DDD8C9]">

              {/* DUAL MENU SWITCHER: [ FOOD ] and [ BAR & BEVERAGES ] (Requirement 4) */}
              <div className="p-2.5 sm:p-3.5 bg-white border-b border-[#DDD8C9] shrink-0 space-y-2.5">
                <div className="grid grid-cols-2 p-1 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuType('food');
                      setActiveCategoryId('all');
                    }}
                    className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeMenuType === 'food'
                        ? 'bg-[#163024] text-[#F7F4EC] shadow-sm'
                        : 'text-[#687067] hover:text-[#163024]'
                    }`}
                  >
                    <Utensils className={`w-4 h-4 ${activeMenuType === 'food' ? 'text-[#C5A86A]' : 'text-[#687067]'}`} />
                    <span className="tracking-wide">FOOD MENU</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
                      {foodItems.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuType('drink');
                      setActiveCategoryId('all');
                    }}
                    className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeMenuType === 'drink'
                        ? 'bg-[#163024] text-[#F7F4EC] shadow-sm'
                        : 'text-[#687067] hover:text-[#163024]'
                    }`}
                  >
                    <Wine className={`w-4 h-4 ${activeMenuType === 'drink' ? 'text-[#C5A86A]' : 'text-[#687067]'}`} />
                    <span className="tracking-wide">BAR & BEVERAGES</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
                      {drinkItems.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar & Veg Filter */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#687067] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search ${activeMenuType === 'food' ? 'dishes, starters...' : 'drinks, cocktails, beer...'}`}
                      value={menuSearch}
                      onChange={e => setMenuSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none focus:border-[#163024] text-xs font-medium"
                    />
                    {menuSearch && (
                      <button
                        type="button"
                        onClick={() => setMenuSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#687067] hover:text-[#163024]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {activeMenuType === 'food' && (
                    <button
                      type="button"
                      onClick={() => setVegOnly(!vegOnly)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        vegOnly
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-[#DDD8C9]/50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Veg Only</span>
                    </button>
                  )}
                </div>

                {/* Horizontal Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        activeCategoryId === cat.id
                          ? 'bg-[#163024] text-[#F7F4EC]'
                          : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#DDD8C9]/60'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vertical Menu Item List (Requirement 3) */}
              <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 pb-24 md:pb-4">
                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-[#687067] bg-white rounded-2xl border border-[#DDD8C9]">
                    <Utensils className="w-8 h-8 mx-auto text-[#DDD8C9] mb-2" />
                    <p className="font-bold text-xs text-[#163024]">No items found matching your search</p>
                    <p className="text-[11px] text-[#687067] mt-1">Try searching a different item name or select another category.</p>
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const cartQty = getItemCartQty(item.id);
                    const selectedPortionLabel = selectedPortions[item.id] || item.portionOptions?.[0]?.label;
                    const selectedPortion = item.portionOptions?.find(p => p.label === selectedPortionLabel);
                    const displayPrice = selectedPortion ? selectedPortion.price : item.price;

                    return (
                      <SharedMenuItemCard
                        key={item.id}
                        item={item}
                        cartQuantity={cartQty}
                        selectedPortionLabel={selectedPortionLabel}
                        showCategoryBadge={true}
                        onSelectPortion={(menuItem, portionLabel) => {
                          setSelectedPortions(prev => ({ ...prev, [menuItem.id]: portionLabel }));
                        }}
                        onAddToCart={(menuItem, portionLabel, portionPrice) => {
                          handleAddToCart(menuItem, portionLabel, portionPrice);
                        }}
                        onUpdateQuantity={(delta) => {
                          if (delta > 0) {
                            handleAddToCart(item, selectedPortion?.label, selectedPortion?.price);
                          } else {
                            const match = cart.find(
                              c => c.item.id === item.id && (selectedPortion ? c.selectedPortionLabel === selectedPortion.label : true)
                            );
                            if (match) {
                              handleUpdateQty(match.id, -1);
                            } else {
                              const anyMatch = cart.find(c => c.item.id === item.id);
                              if (anyMatch) handleUpdateQty(anyMatch.id, -1);
                            }
                          }
                        }}
                      />
                    );
                  })
                )}
              </div>

              {/* MOBILE STICKY BOTTOM CART SUMMARY */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#163024] text-[#F7F4EC] p-3 border-t border-[#244737] shadow-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">
                      {totalCartQty} {totalCartQty === 1 ? 'Item' : 'Items'} selected
                    </span>
                  </div>
                  <span className="text-[10px] text-[#DDD8C9] block">
                    Table {activeTable?.number} • {guestCount} Guests
                  </span>
                </div>

                <button
                  type="button"
                  id="btn-waiter-view-cart"
                  onClick={() => setShowMobileCart(true)}
                  aria-label={`View Cart (${totalCartQty} items)`}
                  className="relative p-2.5 bg-[#C5A86A] hover:bg-[#b5995b] text-[#163024] rounded-xl flex items-center justify-center cursor-pointer shadow-md active:scale-95"
                  title="View Cart"
                >
                  <ShoppingCart className="w-5 h-5 text-[#163024]" />
                  {totalCartQty > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#163024] text-[#F7F4EC] text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      {totalCartQty}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ----------------------------------------------------- */}
            {/* RIGHT COLUMN: PERSISTENT CART PANEL FOR TABLET & DESKTOP (Requirement 3 & 5) */}
            {/* ----------------------------------------------------- */}
            <div className="hidden md:flex flex-col w-80 lg:w-96 bg-white border-l border-[#DDD8C9] shrink-0 h-full overflow-hidden">
              {/* Cart Header */}
              <div className="p-3.5 bg-[#F7F4EC] border-b border-[#DDD8C9] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#526B4A]" />
                  <h3 className="font-serif font-bold text-sm text-[#163024]">
                    Current Order • Table {activeTable?.number}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#163024] text-[#F7F4EC] text-[10px] font-bold font-mono">
                  {totalCartQty} Items
                </span>
              </div>

              {/* Scrollable Cart Items with Food / Bar Separation (Requirement 4 & 5) */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-[#687067] p-4">
                    <ShoppingBag className="w-10 h-10 text-[#DDD8C9] mb-2" />
                    <p className="font-bold text-xs text-[#163024]">Order is empty</p>
                    <p className="text-[11px] text-[#687067] mt-1">
                      Select items from the Food Menu or Bar & Beverages to build this table's order.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Food Items Section */}
                    {foodCartItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-[#DDD8C9]/60 text-xs font-bold text-[#163024]">
                          <span className="flex items-center gap-1.5">
                            <Utensils className="w-3.5 h-3.5 text-[#526B4A]" />
                            FOOD ITEMS ({foodCartItems.length})
                          </span>
                          <span className="text-[11px] text-[#526B4A] font-semibold">
                            {foodCartItems.reduce((acc, c) => acc + c.quantity, 0)} Items
                          </span>
                        </div>

                        <div className="space-y-2">
                          {foodCartItems.map(c => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-bold text-[#163024] block leading-tight">
                                    {c.item.name}
                                  </span>
                                  {c.selectedPortionLabel && c.selectedPortionLabel !== 'Standard' && (
                                    <span className="text-[10px] text-[#526B4A] font-semibold">
                                      Portion: {c.selectedPortionLabel}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-[#163024] bg-white px-2 py-0.5 rounded border border-[#DDD8C9] text-xs">
                                  ×{c.quantity}
                                </span>
                              </div>

                              {/* Quantity & Notes Controls */}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteItemId(editingNoteItemId === c.id ? null : c.id)}
                                  className="text-[10px] text-[#526B4A] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{c.notes ? 'Edit note' : '+ Add note'}</span>
                                </button>

                                <div className="flex items-center gap-1.5 bg-white px-1.5 py-0.5 rounded-lg border border-[#DDD8C9]">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(c.id, -1)}
                                    className="w-6 h-6 rounded bg-[#F7F4EC] hover:bg-[#DDD8C9] flex items-center justify-center cursor-pointer"
                                    aria-label="Decrease"
                                  >
                                    <Minus className="w-3 h-3 text-[#163024]" />
                                  </button>
                                  <span className="font-mono font-bold text-xs min-w-4 text-center">
                                    {c.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(c.id, 1)}
                                    className="w-6 h-6 rounded bg-[#163024] hover:bg-[#0f2219] text-white flex items-center justify-center cursor-pointer"
                                    aria-label="Increase"
                                  >
                                    <Plus className="w-3 h-3 text-[#C5A86A]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCartItem(c.id)}
                                    className="w-6 h-6 rounded text-stone-400 hover:text-red-600 flex items-center justify-center cursor-pointer ml-1"
                                    aria-label="Remove item"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Note Input */}
                              {(editingNoteItemId === c.id || c.notes) && (
                                <input
                                  type="text"
                                  placeholder="Kitchen instruction (e.g., less spicy)..."
                                  value={c.notes}
                                  onChange={e => handleUpdateItemNote(c.id, e.target.value)}
                                  className="w-full text-[11px] p-1.5 bg-white border border-[#DDD8C9] rounded-lg outline-none focus:border-[#163024]"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bar & Beverages Section */}
                    {barCartItems.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#DDD8C9]/60">
                        <div className="flex items-center justify-between pb-1 border-b border-[#DDD8C9]/60 text-xs font-bold text-[#163024]">
                          <span className="flex items-center gap-1.5">
                            <Wine className="w-3.5 h-3.5 text-[#C5A86A]" />
                            BAR & BEVERAGES ({barCartItems.length})
                          </span>
                          <span className="text-[11px] text-[#C5A86A] font-semibold">
                            {barCartItems.reduce((acc, c) => acc + c.quantity, 0)} Items
                          </span>
                        </div>

                        <div className="space-y-2">
                          {barCartItems.map(c => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-bold text-[#163024] block leading-tight">
                                    {c.item.name}
                                  </span>
                                  {c.selectedPortionLabel && c.selectedPortionLabel !== 'Standard' && (
                                    <span className="text-[10px] text-[#526B4A] font-semibold">
                                      Portion: {c.selectedPortionLabel}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-[#163024] bg-white px-2 py-0.5 rounded border border-[#DDD8C9] text-xs">
                                  ×{c.quantity}
                                </span>
                              </div>

                              {/* Quantity & Notes Controls */}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteItemId(editingNoteItemId === c.id ? null : c.id)}
                                  className="text-[10px] text-[#526B4A] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{c.notes ? 'Edit note' : '+ Add note'}</span>
                                </button>

                                <div className="flex items-center gap-1.5 bg-white px-1.5 py-0.5 rounded-lg border border-[#DDD8C9]">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(c.id, -1)}
                                    className="w-6 h-6 rounded bg-[#F7F4EC] hover:bg-[#DDD8C9] flex items-center justify-center cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3 text-[#163024]" />
                                  </button>
                                  <span className="font-mono font-bold text-xs min-w-4 text-center">
                                    {c.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(c.id, 1)}
                                    className="w-6 h-6 rounded bg-[#163024] hover:bg-[#0f2219] text-white flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 text-[#C5A86A]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCartItem(c.id)}
                                    className="w-6 h-6 rounded text-stone-400 hover:text-red-600 flex items-center justify-center cursor-pointer ml-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Note Input */}
                              {(editingNoteItemId === c.id || c.notes) && (
                                <input
                                  type="text"
                                  placeholder="Bar instruction (e.g., no ice, extra lime)..."
                                  value={c.notes}
                                  onChange={e => handleUpdateItemNote(c.id, e.target.value)}
                                  className="w-full text-[11px] p-1.5 bg-white border border-[#DDD8C9] rounded-lg outline-none focus:border-[#163024]"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Cart Summary & Actions */}
              <div className="p-3.5 bg-[#F7F4EC] border-t border-[#DDD8C9] shrink-0 space-y-2.5">
                {/* Guest Count Stepper */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white border border-[#DDD8C9]">
                  <span className="font-bold text-[#163024]">Guest Count (Pax):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                      className="w-6 h-6 rounded-md bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#DDD8C9]"
                      title="Decrease guest count"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-sm text-[#163024] min-w-[20px] text-center">
                      {guestCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuestCount(g => Math.min(30, g + 1))}
                      className="w-6 h-6 rounded-md bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] font-bold text-xs flex items-center justify-center cursor-pointer border border-[#DDD8C9]"
                      title="Increase guest count"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Items Summary (Authoritative prices calculated by server) */}
                <div className="space-y-1 text-xs pt-1 border-t border-[#DDD8C9]/60">
                  <div className="flex justify-between text-[#687067]">
                    <span>Food Items:</span>
                    <span className="font-mono font-bold text-[#163024]">
                      {foodCartItems.reduce((acc, c) => acc + c.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#687067]">
                    <span>Bar & Beverages:</span>
                    <span className="font-mono font-bold text-[#163024]">
                      {barCartItems.reduce((acc, c) => acc + c.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#163024] pt-1.5 border-t border-[#DDD8C9]">
                    <span>Total Punch Items:</span>
                    <span className="font-serif text-base text-[#163024]">{totalCartQty}</span>
                  </div>
                  <p className="text-[10px] text-[#687067] italic pt-1 leading-snug">
                    Prices, taxes and order totals are calculated authoritatively by the server on punch.
                  </p>
                </div>

                {/* Submission Error Banner with Retry */}
                {errorMessage && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-[11px] leading-tight">{errorMessage}</span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendOrder}
                        disabled={isSubmitting}
                        className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        Retry Submission
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions: [ ADD MORE ] and [ SEND ORDER ] */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {}}
                    className="py-2.5 px-3 bg-white hover:bg-[#DDD8C9]/40 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    ADD MORE
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOrder}
                    disabled={cart.length === 0 || isSubmitting}
                    className="py-2.5 px-3 bg-[#163024] hover:bg-[#0f2219] disabled:bg-stone-300 text-[#F7F4EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5 text-[#C5A86A]" />
                    <span>{isSubmitting ? 'SENDING...' : (hasSubmissionError ? 'RETRY SEND' : 'SEND ORDER')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* MOBILE CART BOTTOM SHEET / FULL DRAWER (Requirement 5)    */}
            {/* ========================================================= */}
            {showMobileCart && (
              <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
                <div className="bg-white rounded-t-3xl border-t border-[#DDD8C9] max-h-[85vh] h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
                  {/* Sheet Header */}
                  <div className="p-4 bg-[#163024] text-[#F7F4EC] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag className="w-5 h-5 text-[#C5A86A]" />
                      <div>
                        <h3 className="font-serif font-bold text-base">
                          Current Order • Table {activeTable?.number}
                        </h3>
                        <span className="text-[10px] text-[#DDD8C9]">
                          Guest: {customGuestName || 'Walk-in'} • {totalCartQty} Items
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowMobileCart(false)}
                      className="p-1.5 rounded-xl bg-white/10 text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Scrollable Cart Items */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F4EC]">
                    {cart.length === 0 ? (
                      <div className="p-8 text-center text-[#687067]">
                        <ShoppingBag className="w-10 h-10 mx-auto text-[#DDD8C9] mb-2" />
                        <p className="font-bold text-xs text-[#163024]">No items in cart</p>
                        <p className="text-[11px] text-[#687067] mt-1">Add items from the menu to build the order.</p>
                      </div>
                    ) : (
                      <>
                        {/* Food Items */}
                        {foodCartItems.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-[#DDD8C9] text-xs font-bold text-[#163024]">
                              <span className="flex items-center gap-1.5">
                                <Utensils className="w-3.5 h-3.5 text-[#526B4A]" />
                                FOOD ITEMS ({foodCartItems.length})
                              </span>
                              <span className="text-[11px] text-[#526B4A] font-semibold">
                                {foodCartItems.reduce((acc, c) => acc + c.quantity, 0)} Items
                              </span>
                            </div>

                            <div className="space-y-2">
                              {foodCartItems.map(c => (
                                <div
                                  key={c.id}
                                  className="p-3 rounded-xl bg-white border border-[#DDD8C9] text-xs space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-[#163024] block">
                                        {c.item.name}
                                      </span>
                                      {c.selectedPortionLabel && c.selectedPortionLabel !== 'Standard' && (
                                        <span className="text-[10px] text-[#526B4A] font-semibold">
                                          Portion: {c.selectedPortionLabel}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-bold text-[#163024] bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#DDD8C9] text-xs">
                                      ×{c.quantity}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingNoteItemId(editingNoteItemId === c.id ? null : c.id)}
                                      className="text-[11px] text-[#526B4A] hover:underline flex items-center gap-1"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>{c.notes ? 'Edit note' : '+ Add kitchen note'}</span>
                                    </button>

                                    <div className="flex items-center gap-2 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQty(c.id, -1)}
                                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center cursor-pointer shadow-2xs"
                                      >
                                        <Minus className="w-3.5 h-3.5 text-[#163024]" />
                                      </button>
                                      <span className="font-mono font-bold text-xs min-w-5 text-center">
                                        {c.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQty(c.id, 1)}
                                        className="w-7 h-7 rounded-lg bg-[#163024] text-white flex items-center justify-center cursor-pointer shadow-2xs"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCartItem(c.id)}
                                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-red-600 flex items-center justify-center cursor-pointer ml-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {(editingNoteItemId === c.id || c.notes) && (
                                    <input
                                      type="text"
                                      placeholder="Kitchen instruction..."
                                      value={c.notes}
                                      onChange={e => handleUpdateItemNote(c.id, e.target.value)}
                                      className="w-full text-xs p-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-lg outline-none focus:border-[#163024]"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bar Items */}
                        {barCartItems.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-[#DDD8C9]">
                            <div className="flex items-center justify-between pb-1 border-b border-[#DDD8C9] text-xs font-bold text-[#163024]">
                              <span className="flex items-center gap-1.5">
                                <Wine className="w-3.5 h-3.5 text-[#C5A86A]" />
                                BAR & BEVERAGES ({barCartItems.length})
                              </span>
                              <span className="text-[11px] text-[#C5A86A] font-semibold">
                                {barCartItems.reduce((acc, c) => acc + c.quantity, 0)} Items
                              </span>
                            </div>

                            <div className="space-y-2">
                              {barCartItems.map(c => (
                                <div
                                  key={c.id}
                                  className="p-3 rounded-xl bg-white border border-[#DDD8C9] text-xs space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-[#163024] block">
                                        {c.item.name}
                                      </span>
                                      {c.selectedPortionLabel && c.selectedPortionLabel !== 'Standard' && (
                                        <span className="text-[10px] text-[#526B4A] font-semibold">
                                          Portion: {c.selectedPortionLabel}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-bold text-[#163024] bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#DDD8C9] text-xs">
                                      ×{c.quantity}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingNoteItemId(editingNoteItemId === c.id ? null : c.id)}
                                      className="text-[11px] text-[#526B4A] hover:underline flex items-center gap-1"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>{c.notes ? 'Edit note' : '+ Add bar note'}</span>
                                    </button>

                                    <div className="flex items-center gap-2 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQty(c.id, -1)}
                                        className="w-7 h-7 rounded-lg bg-white flex items-center justify-center cursor-pointer shadow-2xs"
                                      >
                                        <Minus className="w-3.5 h-3.5 text-[#163024]" />
                                      </button>
                                      <span className="font-mono font-bold text-xs min-w-5 text-center">
                                        {c.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQty(c.id, 1)}
                                        className="w-7 h-7 rounded-lg bg-[#163024] text-white flex items-center justify-center cursor-pointer shadow-2xs"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCartItem(c.id)}
                                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-red-600 flex items-center justify-center cursor-pointer ml-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {(editingNoteItemId === c.id || c.notes) && (
                                    <input
                                      type="text"
                                      placeholder="Bar instruction (e.g. no ice)..."
                                      value={c.notes}
                                      onChange={e => handleUpdateItemNote(c.id, e.target.value)}
                                      className="w-full text-xs p-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-lg outline-none focus:border-[#163024]"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Mobile Sheet Footer Controls & Actions */}
                  <div className="p-4 bg-white border-t border-[#DDD8C9] shrink-0 space-y-3">
                    {/* Guest Count Stepper */}
                    <div className="flex items-center justify-between text-xs bg-[#F7F4EC] p-2.5 rounded-xl border border-[#DDD8C9]">
                      <div className="flex items-center gap-1.5 text-[#163024]">
                        <Users className="w-4 h-4 text-[#526B4A]" />
                        <span className="font-bold">Guests</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                          className="w-7 h-7 rounded-lg bg-white border border-[#DDD8C9] text-sm font-bold flex items-center justify-center text-[#163024] cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-sm w-5 text-center text-[#163024]">{guestCount}</span>
                        <button
                          type="button"
                          onClick={() => setGuestCount(prev => prev + 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#DDD8C9] text-sm font-bold flex items-center justify-center text-[#163024] cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Items Summary (Authoritative prices calculated by server) */}
                    <div className="space-y-1 text-xs pt-1 border-t border-[#DDD8C9]/60">
                      <div className="flex justify-between text-[#687067]">
                        <span>Food Items:</span>
                        <span className="font-mono font-bold text-[#163024]">
                          {foodCartItems.reduce((acc, c) => acc + c.quantity, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#687067]">
                        <span>Bar & Beverages:</span>
                        <span className="font-mono font-bold text-[#163024]">
                          {barCartItems.reduce((acc, c) => acc + c.quantity, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-[#163024] pt-1.5 border-t border-[#DDD8C9]">
                        <span>Total Punch Items:</span>
                        <span className="font-serif text-base text-[#163024]">{totalCartQty}</span>
                      </div>
                      <p className="text-[10px] text-[#687067] italic pt-0.5 leading-snug">
                        Prices, taxes and order totals are calculated authoritatively by the server on punch.
                      </p>
                    </div>

                    {/* Submission Error Banner with Retry */}
                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span className="font-medium text-[11px] leading-tight">{errorMessage}</span>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSendOrder}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                          >
                            Retry Submission
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions: [ ADD MORE ] & [ SEND ORDER ] */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowMobileCart(false)}
                        className="py-3 px-3 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-colors cursor-pointer text-center min-h-[44px]"
                      >
                        ADD MORE
                      </button>

                      <button
                        type="button"
                        onClick={handleSendOrder}
                        disabled={cart.length === 0 || isSubmitting}
                        className="py-3 px-3 bg-[#163024] hover:bg-[#0f2219] disabled:bg-stone-300 text-[#F7F4EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        <Send className="w-4 h-4 text-[#C5A86A]" />
                        <span>{isSubmitting ? 'SENDING...' : (hasSubmissionError ? 'RETRY SEND' : 'SEND ORDER')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
