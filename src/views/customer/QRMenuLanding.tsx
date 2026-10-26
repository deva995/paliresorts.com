import React, { useState, useRef, useEffect } from 'react';
import {
  Utensils,
  Wine,
  Bell,
  Droplets,
  Receipt,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Flame,
  Leaf,
  Clock,
  ArrowRight
} from 'lucide-react';

import { Order, MenuItem } from '../../types';

interface QRMenuLandingProps {
  tableNumber: string;
  guestName: string;
  restaurantName?: string;
  items?: MenuItem[];
  onOpenFoodMenu: () => void;
  onOpenDrinkMenu: () => void;
  onOpenWaiterModal: (type?: string) => void;
  onViewBill?: () => void;
  activeOrder?: Order | null;
  onViewOrderStatus?: () => void;
}

export const QRMenuLanding: React.FC<QRMenuLandingProps> = ({
  tableNumber,
  guestName,
  restaurantName = 'Pali Resort & Club',
  items = [],
  onOpenFoodMenu,
  onOpenDrinkMenu,
  onOpenWaiterModal,
  onViewBill,
  activeOrder,
  onViewOrderStatus,
}) => {
  const foodCount = items.filter(i => i.menuType !== 'drink').length;
  const drinkCount = items.filter(i => i.menuType === 'drink').length;
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Sync scroll position when active slide changes programmatically
  const scrollToSlide = (index: 0 | 1) => {
    setActiveSlide(index);
    if (carouselRef.current) {
      const container = carouselRef.current;
      const slideWidth = container.offsetWidth;
      container.scrollTo({
        left: index * slideWidth,
        behavior: 'smooth',
      });
    }
  };

  // Handle scroll events to update active dot/tab indicator
  const handleScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, offsetWidth } = carouselRef.current;
      const currentIndex = Math.round(scrollLeft / offsetWidth) as 0 | 1;
      if (currentIndex === 0 || currentIndex === 1) {
        if (currentIndex !== activeSlide) {
          setActiveSlide(currentIndex);
        }
      }
    }
  };

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && activeSlide === 0) {
        scrollToSlide(1);
      } else if (diff < 0 && activeSlide === 1) {
        scrollToSlide(0);
      }
    }
    touchStartXRef.current = null;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-sans pb-4">
      
      {/* Top Welcome Header & Locked Table Banner */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#e8e1cf] bg-[#163024]">
        <div className="relative h-44 sm:h-52 w-full overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&auto=format&fit=crop&q=80"
            alt={restaurantName}
            className="w-full h-full object-cover object-center transform scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#163024] via-[#163024]/65 to-black/35" />
          
          {/* Top Bar with Logo & Locked Table Pill */}
          <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-10">
            <div className="inline-flex items-center px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-xl border border-[#DDD8C9] shadow-sm">
              <img
                src="/palilogo.png"
                alt="Pali Resort & Club"
                className="h-6 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#c5a86a] text-[#163024] font-sans font-bold text-xs rounded-full shadow-md border border-[#dfc78f]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#163024]" />
              <span className="text-[10px] uppercase font-bold text-[#163024]/80">Table</span>
              <span className="font-mono text-xs">{tableNumber}</span>
            </div>
          </div>

          {/* Hero Greeting */}
          <div className="absolute bottom-3 inset-x-4 text-[#f7f4ec] space-y-1 z-10">
            <div className="flex items-center gap-1.5 text-[10px] font-sans font-bold uppercase tracking-widest text-[#dfc78f]">
              <Sparkles className="w-3 h-3 text-[#dfc78f]" />
              <span>Sanctuary Dining Experience</span>
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#fcfbf7] leading-tight">
              Welcome, {guestName || 'Valued Guest'}
            </h1>
            <p className="text-[11px] text-stone-200 font-sans max-w-sm line-clamp-1">
              Swipe below to explore our Food Menu and Bar & Beverages.
            </p>
          </div>
        </div>

        {/* Quick Hospitality Actions */}
        <div className="bg-[#12261d] p-2.5 border-t border-[#234735]">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onOpenWaiterModal('call-waiter')}
              className="flex-1 py-2 px-2 bg-[#1b382b] hover:bg-[#234735] text-[#f7f4ec] border border-[#c5a86a]/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#dfc78f]" />
              <span className="text-[11px]">Call Captain</span>
            </button>

            <button
              onClick={() => onOpenWaiterModal('water')}
              className="flex-1 py-2 px-2 bg-[#1b382b] hover:bg-[#234735] text-[#f7f4ec] border border-[#c5a86a]/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px]">Refill Water</span>
            </button>

            <button
              onClick={() => {
                if (onViewBill) {
                  onViewBill();
                } else {
                  onOpenWaiterModal('bill');
                }
              }}
              className="flex-1 py-2 px-2 bg-[#1b382b] hover:bg-[#234735] text-[#f7f4ec] border border-[#c5a86a]/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-[#dfc78f]" />
              <span className="text-[11px]">View Bill</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Order In-Progress Tracker Pill (if active) */}
      {activeOrder && onViewOrderStatus && (
        <div
          onClick={onViewOrderStatus}
          className="p-3 bg-gradient-to-r from-[#163024] to-[#1e3f30] text-[#f7f4ec] rounded-2xl border border-[#c5a86a]/40 shadow-md flex items-center justify-between cursor-pointer hover:border-[#c5a86a] transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a] flex items-center justify-center text-[#dfc78f] shrink-0 animate-pulse">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-[#dfc78f]">
                  ORDER #{activeOrder.orderNumber}
                </span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-[#c5a86a] text-[#163024] font-bold">
                  {activeOrder.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-stone-300 truncate">
                {activeOrder.items.length} dishes in live preparation pipeline
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#dfc78f] flex items-center gap-1 shrink-0">
            <span>Live Status</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      )}

      {/* Horizontal Carousel Section */}
      <div className="space-y-3">
        
        {/* Carousel Quick Segment Tabs */}
        <div className="flex p-1 bg-[#ede8db] rounded-2xl border border-[#ded7c4] shadow-2xs">
          <button
            onClick={() => scrollToSlide(0)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSlide === 0
                ? 'bg-[#163024] text-[#f7f4ec] shadow-md border border-[#244b38]'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Utensils className={`w-3.5 h-3.5 ${activeSlide === 0 ? 'text-[#c5a86a]' : 'text-stone-500'}`} />
            <span>FOOD MENU ({foodCount})</span>
          </button>

          <button
            onClick={() => scrollToSlide(1)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSlide === 1
                ? 'bg-[#c5a86a] text-[#163024] shadow-md border border-[#b39556]'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Wine className={`w-3.5 h-3.5 ${activeSlide === 1 ? 'text-[#163024]' : 'text-stone-500'}`} />
            <span>BAR & BEVERAGES ({drinkCount})</span>
          </button>
        </div>

        {/* Carousel Viewport with Swipe & Snap */}
        <div className="relative">
          {/* Prev / Next Arrows */}
          <button
            onClick={() => scrollToSlide(0)}
            disabled={activeSlide === 0}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 shadow-md border border-stone-200 flex items-center justify-center text-stone-800 transition-opacity cursor-pointer ${
              activeSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            aria-label="Previous menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => scrollToSlide(1)}
            disabled={activeSlide === 1}
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 shadow-md border border-stone-200 flex items-center justify-center text-stone-800 transition-opacity cursor-pointer ${
              activeSlide === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            aria-label="Next menu"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Carousel Track */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-3xl"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            
            {/* CAROUSEL SLIDE 1: FOOD MENU */}
            <div className="w-full shrink-0 snap-center p-1">
              <div
                onClick={onOpenFoodMenu}
                className="group relative bg-[#fcfbf7] rounded-3xl overflow-hidden border-2 border-[#163024]/20 hover:border-[#163024] shadow-lg transition-all cursor-pointer flex flex-col"
              >
                {/* Visual Header Image */}
                <div className="relative h-56 sm:h-64 w-full overflow-hidden bg-stone-900">
                  <img
                    src="https://images.unsplash.com/photo-1544025162-d76694265947?w=900&auto=format&fit=crop&q=80"
                    alt="Pali Resort Food Menu"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  {/* Top Floating Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#163024]/95 text-[#dfc78f] border border-[#c5a86a]/40 shadow-sm backdrop-blur-md">
                      {foodCount} Authentic Dishes
                    </span>
                  </div>

                  {/* Title Overlay */}
                  <div className="absolute bottom-3.5 inset-x-4 text-white space-y-1">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#dfc78f] tracking-widest">
                      <Utensils className="w-3.5 h-3.5 text-[#dfc78f]" />
                      <span>Executive Resort Culinary</span>
                    </div>
                    <h2 className="font-serif text-2xl font-bold tracking-wide text-white group-hover:text-[#dfc78f] transition-colors">
                      FOOD MENU
                    </h2>
                    <p className="text-xs text-stone-200 line-clamp-2">
                      Artisanal Clay Tandoor, Dum Biryanis, Coastal Curries, Kebabs & Breads
                    </p>
                  </div>
                </div>

                {/* Card Body & Highlights */}
                <div className="p-4 space-y-3 bg-[#fcfbf7]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                      <Leaf className="w-3 h-3 text-emerald-600" /> Pure Veg Specials
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 text-[11px] font-semibold border border-rose-200">
                      <Flame className="w-3 h-3 text-rose-600" /> Tandoori Non-Veg
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                      Awadhi Biryani
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed font-sans line-clamp-2">
                    Indulge in royal Awadhi preparations, succulent Murgh Malai Tikka, authentic Dal Makhani, and fresh artisanal tandoor breads.
                  </p>

                  {/* Big Touch CTA Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFoodMenu();
                    }}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#163024] hover:bg-[#0f2219] text-[#f7f4ec] text-xs font-bold tracking-wider uppercase flex items-center justify-between shadow-md border border-[#c5a86a]/40 transition-all cursor-pointer active:scale-98"
                  >
                    <span className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-[#dfc78f]" />
                      <span>ENTER FOOD MENU</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-sm text-[#dfc78f]">
                      <span>View 50+ Dishes</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* CAROUSEL SLIDE 2: BAR & BEVERAGES */}
            <div className="w-full shrink-0 snap-center p-1">
              <div
                onClick={onOpenDrinkMenu}
                className="group relative bg-[#fcfbf7] rounded-3xl overflow-hidden border-2 border-[#c5a86a]/40 hover:border-[#c5a86a] shadow-lg transition-all cursor-pointer flex flex-col"
              >
                {/* Visual Header Image */}
                <div className="relative h-56 sm:h-64 w-full overflow-hidden bg-stone-900">
                  <img
                    src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=900&auto=format&fit=crop&q=80"
                    alt="Pali Resort Bar & Beverages"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  {/* Top Floating Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#c5a86a] text-[#163024] border border-[#dfc78f] shadow-sm backdrop-blur-md">
                      {drinkCount} Spirits & Cocktails
                    </span>
                  </div>

                  {/* Title Overlay */}
                  <div className="absolute bottom-3.5 inset-x-4 text-white space-y-1">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#dfc78f] tracking-widest">
                      <Wine className="w-3.5 h-3.5 text-[#dfc78f]" />
                      <span>Resort Lounge & Cellar</span>
                    </div>
                    <h2 className="font-serif text-2xl font-bold tracking-wide text-white group-hover:text-[#dfc78f] transition-colors">
                      BAR & BEVERAGES
                    </h2>
                    <p className="text-xs text-stone-200 line-clamp-2">
                      Single Malts, Aged Scotch, Chilled Beers, Cocktails & Fresh Mocktails
                    </p>
                  </div>
                </div>

                {/* Card Body & Highlights */}
                <div className="p-4 space-y-3 bg-[#fcfbf7]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 text-[11px] font-semibold border border-amber-200">
                      Single Malts & Scotch
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-semibold border border-sky-200">
                      Chilled Draft Beers
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 text-[11px] font-semibold border border-purple-200">
                      Reserve Wines & Coolers
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed font-sans line-clamp-2">
                    Explore curated single malts like Glenfiddich 12, Johnnie Walker Black Label, refreshing Lime Sodas, and handcrafted tropical mocktails.
                  </p>

                  {/* Big Touch CTA Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDrinkMenu();
                    }}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#c5a86a] hover:bg-[#b89a5b] text-[#163024] text-xs font-bold tracking-wider uppercase flex items-center justify-between shadow-md border border-[#dfc78f] transition-all cursor-pointer active:scale-98"
                  >
                    <span className="flex items-center gap-2">
                      <Wine className="w-4 h-4 text-[#163024]" />
                      <span>ENTER BAR & BEVERAGES</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-sm text-[#163024]">
                      <span>View 35+ Drinks</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => scrollToSlide(0)}
            className={`h-2 rounded-full transition-all cursor-pointer ${
              activeSlide === 0 ? 'w-7 bg-[#163024]' : 'w-2 bg-stone-300 hover:bg-stone-400'
            }`}
            aria-label="Go to Food Menu"
          />
          <button
            onClick={() => scrollToSlide(1)}
            className={`h-2 rounded-full transition-all cursor-pointer ${
              activeSlide === 1 ? 'w-7 bg-[#c5a86a]' : 'w-2 bg-stone-300 hover:bg-stone-400'
            }`}
            aria-label="Go to Bar and Beverages"
          />
        </div>

        <p className="text-center text-[10px] text-stone-400 font-sans">
          Swipe or tap tabs above to switch between Food Menu and Bar & Beverages
        </p>

      </div>

      {/* Resort Footer */}
      <footer className="pt-3 text-center space-y-1 text-[11px] text-stone-500 font-sans border-t border-[#e8e1cf]">
        <p className="font-serif font-bold text-xs text-[#163024] tracking-wide">
          {restaurantName}
        </p>
        <p className="text-[10px] text-stone-400 font-mono">
          Table {tableNumber} • Verified QR Dining Session
        </p>
      </footer>

    </div>
  );
};
