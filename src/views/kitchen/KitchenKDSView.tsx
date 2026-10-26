import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KitchenTicket, KitchenTicketStatus } from '../../types';
import { KitchenExecutiveView } from './KitchenExecutiveView';
import { KitchenStationKDSView } from './KitchenStationKDSView';
import { KitchenTvMode } from './KitchenTvMode';
import { playKitchenSound } from './audioAlerts';
import { TicketCard } from './TicketCard';
import {
  CookingPot,
  Wine,
  Coffee,
  Beer,
  Clock,
  CheckCircle2,
  ChefHat,
  Volume2,
  VolumeX,
  Tv,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const KitchenKDSView: React.FC = () => {
  const {
    kitchenTickets,
    activeRestaurantId,
    updateKitchenTicketStatus,
    updateKitchenItemStatus,
    recallKitchenTicket,
    cancelKitchenTicket,
    currentRoute,
    currentUser,
    pushRoute,
    restaurantSyncError,
    refreshRestaurantData
  } = useApp();

  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [completedSearch, setCompletedSearch] = useState<string>('');

  // Track ticket IDs to trigger audio chime on new orders
  const prevTicketIdsRef = useRef<Set<string>>(new Set(kitchenTickets.map(t => t.id)));

  // Live timer tick every 10 seconds for real-time elapsed recalculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // AppContext owns authorization-aware polling; manual refresh remains available.

  // Filter scoped to Pali Resort & Club
  const resortTickets = useMemo(() => {
    return kitchenTickets.filter(t => t.restaurantId === activeRestaurantId);
  }, [kitchenTickets,activeRestaurantId]);

  // Audio alert on new incoming tickets
  useEffect(() => {
    const currentIds = new Set(resortTickets.map(t => t.id));
    const hasNewTicket = resortTickets.some(
      t => !prevTicketIdsRef.current.has(t.id) && t.status === 'new'
    );
    if (hasNewTicket && prevTicketIdsRef.current.size > 0) {
      playKitchenSound('new_order', audioEnabled);
    }
    prevTicketIdsRef.current = currentIds;
  }, [resortTickets, audioEnabled]);

  const getElapsedMins = (ticket: KitchenTicket) => {
    if (ticket.createdAtTimestamp) {
      return Math.max(0, Math.floor((currentTime.getTime() - ticket.createdAtTimestamp) / 60000));
    }
    return ticket.elapsedMinutes || 0;
  };

  // Group companion tickets by orderId
  const ticketsByOrderId = useMemo(() => {
    const map = new Map<string, KitchenTicket[]>();
    resortTickets.forEach(t => {
      const oid = t.orderId || t.orderNumber || t.id;
      if (!map.has(oid)) map.set(oid, []);
      map.get(oid)!.push(t);
    });
    return map;
  }, [resortTickets]);

  // Derive target station for TV Mode
  const getTvStationType = (): 'cooking' | 'bar' | 'beverages' | 'drinks' | 'all' => {
    if (currentRoute.includes('/bar') || currentUser.role === 'KITCHEN_BAR') return 'bar';
    if (currentRoute.includes('/beverages') || currentUser.role === 'BEVERAGES') return 'beverages';
    if (currentRoute.includes('/drinks') || currentUser.role === 'DRINKS') return 'drinks';
    if (currentRoute.includes('/cooking') || currentUser.role === 'KITCHEN_COOKING') return 'cooking';
    return 'all';
  };

  // If TV Mode is activated, render fullscreen high-contrast TV view
  if (isTvMode) {
    return (
      <KitchenTvMode
        onExitTvMode={() => setIsTvMode(false)}
        stationType={getTvStationType()}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 1. Dedicated Route: Executive Kitchen Dashboard (/kitchen/executive)
  if (
    currentRoute.startsWith('/kitchen/executive') ||
    (currentUser.role === 'KITCHEN_EXECUTIVE' && currentRoute === '/kitchen')
  ) {
    return (
      <KitchenExecutiveView
        onToggleTvMode={() => setIsTvMode(true)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 2. Dedicated Route: Cooking KDS (/kitchen/kds/cooking or /kitchen/cooking)
  if (
    currentRoute.includes('/cooking') ||
    (currentUser.role === 'KITCHEN_COOKING' && (currentRoute === '/kitchen' || currentRoute === '/kitchen/kds'))
  ) {
    return (
      <KitchenStationKDSView
        stationType="cooking"
        stationTitle="Cooking Line KDS • Grill &amp; Tandoor"
        stationSubtitle="Hot appetizers, tandoori specialties, curries, and breads production line."
        onToggleTvMode={() => setIsTvMode(true)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 3. Dedicated Route: Bar KDS (/kitchen/kds/bar or /kitchen/bar)
  if (
    currentRoute.includes('/bar') ||
    (currentUser.role === 'KITCHEN_BAR' && (currentRoute === '/kitchen' || currentRoute === '/kitchen/kds'))
  ) {
    return (
      <KitchenStationKDSView
        stationType="bar"
        stationTitle="Bar &amp; Cellar KDS • Mixology Deck"
        stationSubtitle="Handcrafted cocktails, premium spirits, cellar wines, and artisan beverages."
        onToggleTvMode={() => setIsTvMode(true)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 4. Dedicated Route: Beverages Preparation (/kitchen/beverages)
  if (
    currentRoute.includes('/beverages') ||
    (currentUser.role === 'BEVERAGES' && (currentRoute === '/kitchen' || currentRoute === '/kitchen/kds'))
  ) {
    return (
      <KitchenStationKDSView
        stationType="beverages"
        stationTitle="Beverages Station • Teas, Coffees &amp; Juices"
        stationSubtitle="Cold-pressed juices, milkshakes, artisanal teas, coffee roasts, and fresh mocktails."
        onToggleTvMode={() => setIsTvMode(true)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 5. Dedicated Route: Drinks Preparation (/kitchen/drinks)
  if (
    currentRoute.includes('/drinks') ||
    (currentUser.role === 'DRINKS' && (currentRoute === '/kitchen' || currentRoute === '/kitchen/kds'))
  ) {
    return (
      <KitchenStationKDSView
        stationType="drinks"
        stationTitle="Drinks Station • Draughts &amp; Refreshers"
        stationSubtitle="Chilled draught beer pours, bottled ciders, aerated sodas, and table waters."
        onToggleTvMode={() => setIsTvMode(true)}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        currentTime={currentTime}
      />
    );
  }

  // 6. Dedicated Route: Completed Orders History (/kitchen/completed)
  if (currentRoute.includes('/completed')) {
    const completedList = resortTickets.filter(t => {
      if (t.status !== 'completed') return false;
      if (completedSearch.trim()) {
        const q = completedSearch.toLowerCase();
        return (
          (t.orderNumber || '').toLowerCase().includes(q) ||
          (t.tableNumber || '').toLowerCase().includes(q) ||
          (t.destination || '').toLowerCase().includes(q) ||
          t.items.some(i => i.name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="bg-[#163024] text-[#F7F4EC] p-6 rounded-3xl border border-[#244737] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#526B4A] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <CheckCircle2 className="w-6 h-6 text-[#C5A86A]" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#F7F4EC]">
                Completed / Fulfilled Kitchen Orders
              </h2>
              <p className="text-xs text-[#DDD8C9] mt-0.5">
                Archived records of delivered KOTs and BOTs. Served tickets are final. A remake requires a new authorized order.
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#687067]" />
            <input
              type="text"
              placeholder="Search fulfilled orders..."
              value={completedSearch}
              onChange={e => setCompletedSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-[#F7F4EC] placeholder-[#DDD8C9] focus:outline-none focus:ring-1 focus:ring-[#C5A86A] w-64"
            />
          </div>
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

        {completedList.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-[#DDD8C9] text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#DDD8C9] mx-auto" />
            <h4 className="font-bold text-[#163024] text-base">No Completed Orders</h4>
            <p className="text-xs text-[#687067] max-w-sm mx-auto">
              Dispatched tickets bumped from the line will be logged here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {completedList.map(ticket => (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl border border-[#DDD8C9] p-4 space-y-3 shadow-xs opacity-90 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-black text-sm text-[#163024]">
                      {ticket.orderNumber || `#${ticket.id}`}
                    </span>
                    <p className="text-xs font-bold text-[#526B4A]">
                      {ticket.tableNumber ? `Table ${ticket.tableNumber}` : ticket.destination || 'Dine-In'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                    Delivered
                  </span>
                </div>

                <div className="space-y-1 text-xs text-[#163024] border-t border-b border-[#DDD8C9] py-2">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="truncate">{item.name}</span>
                      <span className="font-mono font-bold">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-[#687067] flex items-center justify-between">
                  <span>Server: {ticket.waiterName || 'Staff'}</span>
                  <span>Station: {ticket.stationType || ticket.station}</span>
                </div>

                <button
                  id={`btn-recall-completed-${ticket.id}`}
                  disabled
                  title="Served tickets cannot be rolled back. Create a new authorized order for a remake."
                  className="w-full py-2 bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#DDD8C9]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#163024]" />
                  <span>Recall unavailable after handover</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 7. General Unified / Active Orders KDS (/kitchen/active or /kitchen/kds)
  return (
    <KitchenStationKDSView
      stationType="all"
      stationTitle="Central Kitchen Display System (KDS)"
      stationSubtitle="Real-time multi-station production board for Pali Resort &amp; Club."
      onToggleTvMode={() => setIsTvMode(true)}
      audioEnabled={audioEnabled}
      onToggleAudio={() => setAudioEnabled(!audioEnabled)}
      currentTime={currentTime}
    />
  );
};
