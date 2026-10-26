import React, { useState, useMemo } from 'react';
import { MenuItem, MenuCategory, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  RESORT_FOOD_MENU,
  RESORT_DRINK_MENU,
  RESORT_ALL_MENU,
  RESORT_CATEGORIES,
  ResortCategory
} from '../../data/resortMenuData';
import { CartLineItem } from './QRCartDrawer';
import {
  Search,
  ArrowLeft,
  Sparkles,
  Plus,
  Minus,
  Utensils,
  Wine,
  X,
  Clock,
  ChevronRight,
  ShieldCheck,
  Bell,
  Receipt,
  Droplets,
  ShoppingCart
} from 'lucide-react';
import { SharedMenuItemCard } from '../../components/menu/SharedMenuItemCard';

interface QRMenuViewProps {
  initialMenuType: 'food' | 'drink' | 'all';
  tableNumber: string;
  cart: CartLineItem[];
  items?: MenuItem[];
  categories?: MenuCategory[];
  onBackToLanding: () => void;
  onOpenItemDetail: (item: MenuItem) => void;
  onQuickAddToCart: (item: MenuItem) => void;
  onAddToCartWithPortion?: (item: MenuItem, portionLabel?: string, portionPrice?: number) => void;
  onUpdateCartQty: (lineId: string, delta: number) => void;
  onOpenCartDrawer: () => void;
  activeOrder?: Order | null;
  onViewOrderStatus?: () => void;
  onCallWaiter?: (type?: string) => void;
  onViewBill?: () => void;
}

export const QRMenuView: React.FC<QRMenuViewProps> = ({
  initialMenuType,
  tableNumber,
  cart,
  items,
  categories,
  onBackToLanding,
  onOpenItemDetail,
  onQuickAddToCart,
  onAddToCartWithPortion,
  onUpdateCartQty,
  onOpenCartDrawer,
  activeOrder,
  onViewOrderStatus,
  onCallWaiter,
  onViewBill
}) => {
  const { menuItems } = useApp();
  const [activeMenuType, setActiveMenuType] = useState<'food' | 'drink'>(() => {
    return initialMenuType === 'drink' ? 'drink' : 'food';
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [chefSpecialsOnly, setChefSpecialsOnly] = useState(false);

  // Seamless instant switch between FOOD MENU and BAR & BEVERAGES
  const handleSwitchMenuType = (type: 'food' | 'drink') => {
    if (activeMenuType === type) return;
    setActiveMenuType(type);
    setActiveCategoryId('all');
    setSearchQuery('');
    setVegOnly(false);
    setNonVegOnly(false);
    setChefSpecialsOnly(false);
  };

  // Filter Categories matching current activeMenuType
  const visibleCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      // Map loaded categories into visible format
      return categories.map(c => ({
        id: c.id,
        name: c.name,
        menuType: 'all' as const,
        icon: c.icon || 'Utensils'
      }));
    }
    return RESORT_CATEGORIES.filter(c => c.menuType === 'all' || c.menuType === activeMenuType);
  }, [activeMenuType, categories]);

  // Live guest API is the only source of menu items.
  // Never display legacy hardcoded dishes when the API returns an empty menu.
  const baseItems = useMemo(() => {
    const liveItems = items ?? [];
    return liveItems.filter(item => {
      if (activeMenuType === 'food') return item.menuType !== 'drink';
      if (activeMenuType === 'drink') return item.menuType === 'drink';
      return true;
    });
  }, [activeMenuType, items]);

  // Filtered items based on category, search, dietary toggles
  const filteredItems = useMemo(() => {
    return baseItems.filter(item => {
      // Category filter
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) {
        return false;
      }

      // Veg filter
      if (vegOnly && !item.isVeg) return false;
      // Non-Veg filter
      if (nonVegOnly && item.isVeg) return false;
      // Chef Special filter
      if (chefSpecialsOnly && !item.isChefSpecial) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q) || false;
        const matchesCat = item.categoryName?.toLowerCase().includes(q) || false;
        const matchesSub = item.subCategory?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesDesc && !matchesCat && !matchesSub) return false;
      }

      return true;
    });
  }, [baseItems, activeCategoryId, vegOnly, nonVegOnly, chefSpecialsOnly, searchQuery]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const map = new Map<string, { category: ResortCategory | undefined; items: MenuItem[] }>();
    filteredItems.forEach(item => {
      const cat = visibleCategories.find(c => c.id === item.categoryId);
      const catId = item.categoryId;
      if (!map.has(catId)) {
        map.set(catId, { category: cat, items: [] });
      }
      map.get(catId)!.items.push(item);
    });
    return Array.from(map.values());
  }, [filteredItems, visibleCategories]);

  // Cart totals
  const totalCartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalCartPrice = cart.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0);

  return (
    <div className="space-y-4 pb-36 sm:pb-40 animate-in fade-in duration-200 font-sans max-w-full overflow-x-hidden">
      
      {/* Sticky Top Header Navigation */}
      <div className="sticky top-0 z-30 bg-[#fcfbf7]/95 backdrop-blur-md -mx-3 sm:-mx-4 px-3 sm:px-4 pt-2 pb-3 border-b border-[#DDD8C9] shadow-2xs space-y-3">
        
        {/* Row 1: Back to Cover, Table Badge, Concierge Actions & Cart Icon */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={onBackToLanding}
              aria-label="Back to Cover"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#163024] hover:text-[#c5a86a] transition-colors p-2 -ml-1 rounded-full hover:bg-stone-100 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#163024]" />
            </button>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-[#163024] tracking-tight">
              Menu
            </h1>
          </div>

          <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end">
            {/* Active Order Pill */}
            {activeOrder && onViewOrderStatus && (
              <button
                onClick={onViewOrderStatus}
                className="min-h-[44px] inline-flex items-center gap-1 px-3 py-1.5 bg-[#c5a86a] text-[#163024] rounded-full text-[11px] font-bold shadow-xs hover:bg-[#b89a5b] transition-all cursor-pointer"
                title="Track Live Order"
              >
                <Clock className="w-3.5 h-3.5 text-[#163024]" />
                <span className="font-mono">#{activeOrder.orderNumber}</span>
              </button>
            )}

            {/* Table Badge */}
            <div className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#163024] text-[#f7f4ec] rounded-full text-xs font-sans font-bold shadow-xs border border-[#c5a86a]/40">
              <ShieldCheck className="w-3.5 h-3.5 text-[#dfc78f]" />
              <span className="text-[10px] text-[#dfc78f] uppercase">Table</span>
              <span className="font-mono">{tableNumber}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Premium Segmented Switch — [ FOOD MENU ] vs [ BAR & BEVERAGES ] */}
        <div
          role="tablist"
          aria-label="Dining Menu Selection"
          className="p-1.5 bg-[#EDE8DB] border border-[#DDD8C9] rounded-2xl flex items-center gap-1.5 shadow-xs"
        >
          <button
            id="tab-food-menu"
            role="tab"
            aria-selected={activeMenuType === 'food'}
            type="button"
            onClick={() => handleSwitchMenuType('food')}
            className={`flex-1 min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMenuType === 'food'
                ? 'bg-[#163024] text-[#F7F4EC] shadow-md border border-[#C5A86A]/60'
                : 'text-stone-700 hover:text-stone-950 hover:bg-black/5'
            }`}
          >
            <Utensils className={`w-4 h-4 transition-colors ${activeMenuType === 'food' ? 'text-[#C5A86A]' : 'text-stone-500'}`} />
            <span className="tracking-wide">FOOD MENU</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
              activeMenuType === 'food'
                ? 'bg-[#C5A86A]/20 text-[#dfc78f] border border-[#C5A86A]/30'
                : 'bg-stone-200/80 text-stone-600'
            }`}>
              {RESORT_FOOD_MENU.length}
            </span>
          </button>

          <button
            id="tab-bar-menu"
            role="tab"
            aria-selected={activeMenuType === 'drink'}
            type="button"
            onClick={() => handleSwitchMenuType('drink')}
            className={`flex-1 min-h-[46px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMenuType === 'drink'
                ? 'bg-[#163024] text-[#F7F4EC] shadow-md border border-[#C5A86A]/60'
                : 'text-stone-700 hover:text-stone-950 hover:bg-black/5'
            }`}
          >
            <Wine className={`w-4 h-4 transition-colors ${activeMenuType === 'drink' ? 'text-[#C5A86A]' : 'text-stone-500'}`} />
            <span className="tracking-wide">BAR & BEVERAGES</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
              activeMenuType === 'drink'
                ? 'bg-[#C5A86A]/20 text-[#dfc78f] border border-[#C5A86A]/30'
                : 'bg-stone-200/80 text-stone-600'
            }`}>
              {RESORT_DRINK_MENU.length}
            </span>
          </button>
        </div>

        {/* Row 3: Concierge Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-menu-search"
            type="text"
            placeholder={
              activeMenuType === 'drink'
                ? 'Search fine spirits, beer, vintage wines, signature cocktails, mocktails, juices...'
                : 'Search chef specials, appetizers, tandoori, curries, biryani, breads...'
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#DDD8C9] focus:border-[#163024] rounded-xl text-xs text-stone-900 placeholder:text-stone-400 outline-none shadow-2xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 4: Dietary & Preference Filters (Shown for FOOD MENU) */}
        {activeMenuType === 'food' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs animate-in fade-in duration-150">
            {/* All Pill */}
            <button
              onClick={() => {
                setVegOnly(false);
                setNonVegOnly(false);
                setChefSpecialsOnly(false);
              }}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                !vegOnly && !nonVegOnly && !chefSpecialsOnly
                  ? 'bg-[#163024] text-[#f7f4ec] border-[#163024] shadow-xs'
                  : 'bg-white border-[#DDD8C9] text-stone-700 hover:border-stone-400'
              }`}
            >
              <span>All</span>
            </button>

            {/* Pure Veg Pill */}
            <button
              onClick={() => {
                setVegOnly(true);
                setNonVegOnly(false);
              }}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                vegOnly
                  ? 'bg-emerald-900 text-emerald-100 border-emerald-700 shadow-xs'
                  : 'bg-white border-[#DDD8C9] text-stone-700 hover:border-emerald-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Veg</span>
            </button>

            {/* Non-Veg Pill */}
            <button
              onClick={() => {
                setNonVegOnly(true);
                setVegOnly(false);
              }}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                nonVegOnly
                  ? 'bg-rose-900 text-rose-100 border-rose-700 shadow-xs'
                  : 'bg-white border-[#DDD8C9] text-stone-700 hover:border-rose-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Non-Veg</span>
            </button>

            {/* Chef's Signature Pill */}
            <button
              onClick={() => setChefSpecialsOnly(!chefSpecialsOnly)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                chefSpecialsOnly
                  ? 'bg-[#163024] text-[#dfc78f] border-[#c5a86a] shadow-xs'
                  : 'bg-white border-[#DDD8C9] text-stone-700 hover:border-[#c5a86a]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#c5a86a]" />
              <span>Chef&apos;s Special</span>
            </button>
          </div>
        )}

        {/* Row 5: Horizontal Category Scroll Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {visibleCategories.map(cat => {
            const isSelected = activeCategoryId === cat.id;
            const displayName = cat.id === 'all'
              ? (activeMenuType === 'drink' ? 'All Beverages' : 'All Delicacies')
              : cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-[#163024] text-[#f7f4ec] border-[#163024] shadow-xs'
                    : 'bg-white text-stone-700 border-[#DDD8C9] hover:border-stone-400'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Dishes & Drinks List View — Compact Mobile-First Presentation */}
      <div className="space-y-5 pt-1">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-[#DDD8C9] p-6 shadow-xs">
            <div className="w-14 h-14 bg-stone-100 text-stone-400 rounded-full mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-800">
              {activeMenuType === 'drink' ? 'No beverages found' : 'No delicacies found'}
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              We couldn&apos;t find items matching &ldquo;{searchQuery}&rdquo;. Try clearing filters or exploring other categories.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setVegOnly(false);
                setNonVegOnly(false);
                setChefSpecialsOnly(false);
                setActiveCategoryId('all');
              }}
              className="px-4 py-2 bg-[#163024] text-[#f7f4ec] rounded-xl text-xs font-bold cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          groupedItems.map(group => {
            if (!group.category || group.items.length === 0) return null;
            return (
              <div key={group.category.id} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-1.5 pt-1">
                  <h3 className="font-serif text-sm sm:text-base font-bold text-[#163024] tracking-wide flex items-center gap-2">
                    <span>{group.category.name}</span>
                    <span className="text-xs font-mono font-normal text-stone-400">
                      ({group.items.length})
                    </span>
                  </h3>
                </div>

                {/* Compact Horizontal Item List */}
                <div className="space-y-2.5">
                  {group.items.map((item, index) => {
                    const section = item.subCategory?.trim() || '';
                    const previousSection = index > 0
                      ? group.items[index - 1].subCategory?.trim() || ''
                      : '';
                    const showSectionHeading = Boolean(section) && section !== previousSection;
                    const cartMatches = cart.filter(c => c.item.id === item.id);
                    const totalQtyInCart = cartMatches.reduce((acc, curr) => acc + curr.quantity, 0);

                    return (
                      <React.Fragment key={item.id}>
                        {showSectionHeading && (
                          <h4 className="pt-3 pb-1 text-xs sm:text-sm font-bold text-[#244737] border-b border-[#DDD8C9]">
                            {section}
                          </h4>
                        )}
                      <SharedMenuItemCard
                        key={item.id}
                        item={item}
                        addAriaLabel={`Add ${item.name}`}
                        cartQuantity={totalQtyInCart}
                        selectedPortionLabel={cartMatches[0]?.selectedPortion?.label}
                        onAddToCart={(menuItem, portionLabel, portionPrice) => {
                          if (portionLabel && portionPrice && onAddToCartWithPortion) {
                            onAddToCartWithPortion(menuItem, portionLabel, portionPrice);
                          } else {
                            onQuickAddToCart(menuItem);
                          }
                        }}
                        onSelectPortion={(menuItem, portionLabel, portionPrice) => {
                          if (onAddToCartWithPortion) {
                            onAddToCartWithPortion(menuItem, portionLabel, portionPrice);
                          } else {
                            onQuickAddToCart(menuItem);
                          }
                        }}
                        onUpdateQuantity={(delta) => {
                          if (cartMatches.length > 0) {
                            onUpdateCartQty(cartMatches[0].id, delta);
                          } else if (delta > 0) {
                            onQuickAddToCart(item);
                          }
                        }}
                        onOpenDetail={onOpenItemDetail}
                      />
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Sticky Bottom Cart Banner */}
      {cart.length > 0 ? (
        <div className="fixed bottom-4 inset-x-3 sm:inset-x-4 sm:max-w-md sm:mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <button
            id="btn-view-cart-floating"
            onClick={onOpenCartDrawer}
            aria-label={`View Tray - ${totalCartCount} ${totalCartCount === 1 ? 'item' : 'items'}, total ₹${totalCartPrice}`}
            className="w-full p-3.5 bg-[#163024] hover:bg-[#12261d] active:scale-[0.99] text-[#F7F4EC] rounded-2xl shadow-2xl border border-[#c5a86a]/50 flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-[#c5a86a] text-[#163024] flex items-center justify-center shadow-xs">
                <ShoppingCart className="w-5 h-5 text-[#163024]" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#163024] text-[#dfc78f] border-2 border-[#c5a86a] rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                  {totalCartCount}
                </span>
              </div>
              <div className="text-left font-sans">
                <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">
                  Table {tableNumber}
                </span>
                <span className="font-bold text-sm text-white font-mono">
                  ₹{(totalCartPrice ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#dfc78f] tracking-wide">View Tray</span>
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </button>
        </div>
      ) : activeOrder && activeOrder.paymentStatus !== 'paid' ? (
        <div className="fixed bottom-4 inset-x-3 sm:inset-x-4 sm:max-w-md sm:mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <div className="w-full p-2.5 sm:p-3 bg-[#163024]/95 backdrop-blur-md text-[#F7F4EC] rounded-2xl shadow-2xl border border-[#c5a86a]/50 flex items-center justify-between gap-2">
            <div
              onClick={onViewOrderStatus}
              className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
            >
              <div className="w-8 h-8 rounded-xl bg-[#c5a86a]/20 border border-[#c5a86a]/40 text-[#dfc78f] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-left font-sans truncate">
                <span className="text-[10px] text-[#dfc78f] uppercase font-bold tracking-wider block">
                  Table {tableNumber} • Running Order
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  #{activeOrder.orderNumber} • ₹{(activeOrder.grandTotal ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onViewOrderStatus && (
                <button
                  onClick={onViewOrderStatus}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                >
                  Track
                </button>
              )}
              {onViewBill && (
                <button
                  onClick={onViewBill}
                  className="px-3 py-1.5 bg-gradient-to-r from-[#c5a86a] to-[#dfc78f] text-[#163024] rounded-xl text-[11px] font-bold shadow-md hover:brightness-105 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Settle Bill</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
