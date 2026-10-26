import React, { useState } from 'react';
import {
  Utensils,
  Wine,
  Bell,
  Droplets,
  Receipt,
  Sparkles,
  ArrowRight,
  Search,
  Flame,
  Leaf,
  Clock,
  Plus,
  Check,
  ChefHat,
  MessageSquarePlus,
  ShieldCheck
} from 'lucide-react';
import { MenuItem, MenuCategory, Order } from '../../types';
import { RESORT_FOOD_MENU, RESORT_DRINK_MENU } from '../../data/resortMenuData';
import { CartLineItem } from './QRCartDrawer';

interface QRHomeExploreViewProps {
  tableNumber: string;
  guestName?: string;
  restaurantName?: string;
  items?: MenuItem[];
  categories?: MenuCategory[];
  onOpenFoodMenu: () => void;
  onOpenDrinkMenu: () => void;
  onOpenSearch: (query: string) => void;
  onOpenWaiterModal: (type?: string) => void;
  onViewBill: () => void;
  cart: CartLineItem[];
  onQuickAddToCart: (item: MenuItem) => void;
  onOpenCart: () => void;
  activeOrder?: Order | null;
  onViewOrderStatus?: () => void;
}

export const QRHomeExploreView: React.FC<QRHomeExploreViewProps> = ({
  tableNumber,
  guestName,
  restaurantName = 'Pali Resort & Club',
  items,
  categories,
  onOpenFoodMenu,
  onOpenDrinkMenu,
  onOpenSearch,
  onOpenWaiterModal,
  onViewBill,
  cart,
  onQuickAddToCart,
  onOpenCart,
  activeOrder,
  onViewOrderStatus
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [waterRequested, setWaterRequested] = useState(false);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Hand-picked signature Chef's Specials for the Explore Home view
  // Featured dishes come exclusively from the live guest menu.
  const chefSpecials: MenuItem[] = (items ?? [])
    .filter(i => i.menuType !== 'drink' && i.isAvailable !== false)
    .slice(0, 4);

  const handleWaterClick = () => {
    setWaterRequested(true);
    onOpenWaiterModal('water');
    setTimeout(() => setWaterRequested(false), 4000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onOpenSearch(searchInput.trim());
    } else {
      onOpenFoodMenu();
    }
  };

  return (
    <div className="space-y-4 font-sans text-stone-900 pb-20">
      {/* Top Resort Greeting & Table Badge Bar */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-white border border-[#DDD8C9] p-1.5 shadow-xs flex items-center justify-center">
            <img
              src="/palilogo.png"
              alt="Pali Resort"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              {getGreeting()}
            </p>
            <h2 className="text-base font-serif font-bold text-[#163024] leading-tight">
              {guestName ? guestName : 'Resort Guest'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Table Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#163024] text-[#dfc78f] rounded-xl border border-[#c5a86a]/30 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#c5a86a]" />
            <span className="font-mono font-bold text-xs">Table {tableNumber || 'T-05'}</span>
          </div>

          {/* Quick Concierge Bell */}
          <button
            id="btn-quick-call-waiter"
            onClick={() => onOpenWaiterModal('call-waiter')}
            className="w-9 h-9 rounded-xl bg-white hover:bg-stone-50 border border-[#DDD8C9] flex items-center justify-center text-stone-700 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Call Captain / Waiter"
          >
            <Bell className="w-4 h-4 text-[#163024]" />
          </button>
        </div>
      </div>

      {/* Live Order Active Banner if existing */}
      {activeOrder && (
        <div
          onClick={onViewOrderStatus}
          className="p-3 bg-gradient-to-r from-[#163024] to-[#254d3a] text-white rounded-2xl border border-[#c5a86a]/40 shadow-md flex items-center justify-between cursor-pointer hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-xs font-bold text-[#dfc78f] font-mono">
                Order #{activeOrder.orderNumber} in Progress
              </p>
              <p className="text-[11px] text-stone-200">
                {activeOrder.status === 'ready'
                  ? 'Ready for service! Delivering to table.'
                  : 'Kitchen is preparing your delicious dishes.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#dfc78f] bg-white/10 px-2.5 py-1 rounded-lg">
            <span>Track</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          id="input-explore-search"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search dishes, drinks, ingredients..."
          className="w-full bg-white border border-[#DDD8C9] rounded-2xl py-3 pl-11 pr-4 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#163024] shadow-xs"
        />
        <Search className="w-4 h-4 text-stone-400 absolute left-4 top-3.5" />
      </form>

      {/* Hero Banner: Good Food Greater Moments (DINE · RELAX · BELONG) */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#e8e1cf] min-h-[170px] flex flex-col justify-end p-5 text-white">
        <img
          src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1000&auto=format&fit=crop&q=80"
          alt="Good Food Greater Moments"
          className="absolute inset-0 w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e2118] via-[#163024]/60 to-transparent" />

        <div className="relative z-10 space-y-1">
          <span className="text-[10px] tracking-widest uppercase font-bold text-[#dfc78f] bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full inline-block">
            DINE · RELAX · BELONG
          </span>
          <h3 className="text-xl font-serif font-bold text-white leading-snug">
            Good Food. Greater Moments.
          </h3>
          <p className="text-xs text-white/80 max-w-[240px]">
            Experience authentic coastal & royal recipes crafted fresh with handpicked spices.
          </p>
        </div>
      </div>

      {/* Two Prominent Gateway Cards: Food Menu & Bar Menu */}
      <div className="grid grid-cols-2 gap-3">
        {/* Food Menu Card */}
        <div
          id="card-open-food-menu"
          onClick={onOpenFoodMenu}
          className="group relative h-36 rounded-2xl overflow-hidden shadow-md border border-[#e8e1cf] cursor-pointer hover:shadow-xl transition-all"
        >
          <img
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80"
            alt="Food Menu"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e2118] via-[#163024]/50 to-transparent" />
          <div className="relative z-10 h-full p-3.5 flex flex-col justify-end text-white">
            <div className="w-7 h-7 rounded-xl bg-[#c5a86a]/90 text-[#163024] flex items-center justify-center mb-1.5">
              <Utensils className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm font-serif font-bold text-white leading-tight">
              Food Menu
            </h4>
            <p className="text-[10px] text-[#dfc78f] flex items-center gap-1 mt-0.5 font-medium">
              <span>Explore cuisine</span>
              <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
        </div>

        {/* Bar & Beverages Card */}
        <div
          id="card-open-bar-menu"
          onClick={onOpenDrinkMenu}
          className="group relative h-36 rounded-2xl overflow-hidden shadow-md border border-[#e8e1cf] cursor-pointer hover:shadow-xl transition-all"
        >
          <img
            src="https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80"
            alt="Bar & Beverages"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e2118] via-[#163024]/50 to-transparent" />
          <div className="relative z-10 h-full p-3.5 flex flex-col justify-end text-white">
            <div className="w-7 h-7 rounded-xl bg-[#c5a86a]/90 text-[#163024] flex items-center justify-center mb-1.5">
              <Wine className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm font-serif font-bold text-white leading-tight">
              Bar & Beverages
            </h4>
            <p className="text-[10px] text-[#dfc78f] flex items-center gap-1 mt-0.5 font-medium">
              <span>Refreshing drinks</span>
              <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
        </div>
      </div>

      {/* Concierge Quick Service Actions Bar */}
      <div className="bg-white rounded-2xl p-3 border border-[#DDD8C9] shadow-xs">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">
            Table Concierge
          </span>
          <span className="text-[10px] text-[#526B4A] font-semibold">Instant Response</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {/* Call Waiter */}
          <button
            onClick={() => onOpenWaiterModal('call-waiter')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-[#163024]/10 text-[#163024] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold">Call Captain</span>
          </button>

          {/* Refill Water */}
          <button
            onClick={handleWaterClick}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
              {waterRequested ? <Check className="w-4 h-4 text-emerald-600" /> : <Droplets className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-semibold">
              {waterRequested ? 'Requested' : 'Refill Water'}
            </span>
          </button>

          {/* View Bill */}
          <button
            onClick={onViewBill}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold">Table Bill</span>
          </button>

          {/* Special Request */}
          <button
            onClick={() => onOpenWaiterModal('cutlery')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#526B4A] flex items-center justify-center">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold">Cutlery / Help</span>
          </button>
        </div>
      </div>

      {/* Chef's Specials Highlight Section */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#c5a86a]" />
            <h3 className="text-sm font-serif font-bold text-[#163024]">
              Chef&apos;s Signature Specials
            </h3>
          </div>
          <button
            onClick={onOpenFoodMenu}
            className="text-[11px] font-bold text-[#526B4A] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>See full menu</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {chefSpecials.map((item) => {
            const inCart = cart.find(c => c.item.id === item.id);
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-2.5 border border-[#DDD8C9] shadow-xs flex flex-col justify-between space-y-2"
              >
                <div className="relative h-24 rounded-xl overflow-hidden">
                  <img
                    src={item.image || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Veg / Non-Veg badge */}
                  <span
                    className={`absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-sm flex items-center justify-center border bg-white ${
                      item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                  </span>

                  <span className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{item.preparationTimeMinutes || 15}m</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-stone-900 line-clamp-1 leading-tight">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                  <span className="text-xs font-serif font-bold text-[#163024]">
                    ₹{item.price}
                  </span>

                  <button
                    onClick={() => onQuickAddToCart(item)}
                    className="px-2.5 py-1 rounded-lg bg-[#163024] hover:bg-[#254d3a] text-white text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{inCart ? `${inCart.quantity} in cart` : 'Add'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
