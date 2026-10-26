import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KitchenTicket, KitchenTicketStatus, KitchenStationType } from '../../types';
import { TicketCard } from './TicketCard';
import { KitchenItemBoard } from './KitchenItemBoard';
import { playKitchenSound } from './audioAlerts';
import { isTicketVisibleForRole, matchesKitchenStation } from '../../utils/kitchenStation';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Clock,
  Flame,
  ChefHat,
  CookingPot,
  Wine,
  Coffee,
  Beer,
  X,
  Sparkles,
  Layers,
  LayoutGrid,
  Receipt
} from 'lucide-react';

interface KitchenTvModeProps {
  onExitTvMode: () => void;
  stationType?: 'cooking' | 'bar' | 'beverages' | 'drinks' | 'all';
  audioEnabled: boolean;
  onToggleAudio: () => void;
  currentTime: Date;
}

export const KitchenTvMode: React.FC<KitchenTvModeProps> = ({
  onExitTvMode,
  stationType = 'all',
  audioEnabled,
  onToggleAudio,
  currentTime
}) => {
  const {
    kitchenTickets,
    activeRestaurantId,
    updateKitchenTicketStatus,
    updateKitchenItemStatus,
    recallKitchenTicket,
    cancelKitchenTicket,
    currentUser
  } = useApp();

  const [activeStation, setActiveStation] = useState<string>(stationType);
  const [digitalTime, setDigitalTime] = useState<string>('');
  const [tvViewMode, setTvViewMode] = useState<'item-board' | 'tickets'>('tickets');

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setDigitalTime(
        d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtered to Pali Resort
  const resortTickets = useMemo(() => {
    return kitchenTickets.filter(t => t.restaurantId === activeRestaurantId);
  }, [kitchenTickets,activeRestaurantId]);

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

  // Filter tickets for this TV station with role-based access
  const stationTickets = useMemo(() => {
    return resortTickets.filter(t => {
      if (t.status === 'cancelled' || t.status === 'completed') return false;

      // Role filtering: KITCHEN_COOKING sees hot stations, KITCHEN_BAR sees beverage tickets
      if (!isTicketVisibleForRole(t, currentUser.role)) {
        return false;
      }

      if (!matchesKitchenStation(t, activeStation)) return false;
      return true;
    });
  }, [resortTickets, activeStation, currentUser.role, currentTime]);

  const delayedTickets = useMemo(() => {
    return stationTickets.filter(t => getElapsedMins(t) >= 15);
  }, [stationTickets, currentTime]);

  const handleAdvance = async (ticket: KitchenTicket) => {
    let next: KitchenTicketStatus = 'accepted';
    if (ticket.status === 'new') next = 'accepted';
    else if (ticket.status === 'accepted') next = 'preparing';
    else if (ticket.status === 'preparing') {
      next = 'ready';

    } else if (ticket.status === 'ready') {
      next = 'completed';

    }
    const result = await updateKitchenTicketStatus(ticket.id, next);
    if (result.success && (next === 'ready' || next === 'completed')) playKitchenSound(next === 'ready' ? 'order_ready' : 'bump', audioEnabled);
    return result;
  };

  // Station label
  const getStationLabel = () => {
    switch (activeStation) {
      case 'tandoor':
        return 'TANDOOR & CLAY OVEN LINE';
      case 'curry':
        return 'CURRY & GRAVY LINE';
      case 'chinese':
        return 'WOK & CHINESE LINE';
      case 'pantry':
        return 'COLD PANTRY & DESSERTS';
      case 'cooking':
        return 'COOKING LINE (GRILL & TANDOOR)';
      case 'bar':
        return 'BAR & CELLAR';
      case 'beverages':
        return 'BEVERAGES STATION';
      case 'drinks':
        return 'DRINKS STATION';
      default:
        return 'MASTER KITCHEN PRODUCTION LINE';
    }
  };

  const isExecutiveOrAdmin =
    currentUser.role === 'KITCHEN_EXECUTIVE' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'RESTAURANT_OWNER';

  return (
    <div
      id="kitchen-tv-mode-screen"
      className="fixed inset-0 z-50 bg-[#0F2018] text-[#F7F4EC] flex flex-col overflow-hidden select-none"
    >
      {/* 1. TV Header Bar - High-Contrast 1920x1080 Layout */}
      <div className="h-20 bg-[#163024] border-b-2 border-[#C5A86A] px-6 flex items-center justify-between shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white px-3 py-1.5 rounded-2xl shadow-md border border-[#DDD8C9] flex items-center justify-center shrink-0">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club • Pali Village"
              className="h-10 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-black tracking-wider text-[#F7F4EC] uppercase">
                {getStationLabel()}
              </h1>
              <span className="px-3 py-1 rounded-full bg-[#526B4A] text-white text-xs font-black tracking-wider uppercase">
                TV DISPATCH (5M LEGIBILITY)
              </span>
            </div>
            <p className="text-xs text-[#C5A86A] font-semibold mt-0.5">
              Active KDS Line • {stationTickets.length} Active Tickets In Pipeline
            </p>
          </div>
        </div>

        {/* View mode switcher: Item Board vs Ticket View */}
        <div className="hidden md:flex items-center p-1 bg-[#0F2018] border border-[#244737] rounded-xl gap-1">
          <button
            disabled
            title="Quantity batching is unavailable. Use persisted ticket controls."
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              tvViewMode === 'item-board'
                ? 'bg-[#C5A86A] text-[#163024] shadow-xs'
                : 'text-[#DDD8C9] hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>PRODUCTION ITEMS</span>
          </button>
          <button
            onClick={() => setTvViewMode('tickets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              tvViewMode === 'tickets'
                ? 'bg-[#C5A86A] text-[#163024] shadow-xs'
                : 'text-[#DDD8C9] hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>KOT TICKETS</span>
          </button>
        </div>

        {/* Station switcher if supervisor */}
        {isExecutiveOrAdmin && (
          <div className="hidden xl:flex items-center p-1 bg-[#0F2018] border border-[#244737] rounded-xl gap-1">
            {[
              { id: 'all', label: 'All Stations' },
              { id: 'cooking', label: 'Cooking' },
              { id: 'bar', label: 'Bar' },
              { id: 'beverages', label: 'Beverages' },
              { id: 'drinks', label: 'Drinks' }
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setActiveStation(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeStation === st.id
                    ? 'bg-[#C5A86A] text-[#163024]'
                    : 'text-[#DDD8C9] hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Right side: Clock, Audio, Exit */}
        <div className="flex items-center gap-4">
          {/* Live Digital Clock */}
          <div className="text-right font-mono pr-4 border-r border-[#244737]">
            <span className="text-2xl font-black text-[#C5A86A] tracking-wider block">
              {digitalTime || '12:00:00 PM'}
            </span>
            <span className="text-[10px] text-[#DDD8C9] uppercase font-bold tracking-widest">
              IST • REAL-TIME
            </span>
          </div>

          <button
            onClick={onToggleAudio}
            className={`p-3 rounded-2xl transition-colors cursor-pointer border ${
              audioEnabled
                ? 'bg-[#526B4A] text-white border-[#526B4A]'
                : 'bg-rose-900/50 text-rose-300 border-rose-700'
            }`}
            title={audioEnabled ? 'Mute Alert Chimes' : 'Unmute Alert Chimes'}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={onExitTvMode}
            className="px-4 py-2.5 bg-[#C5A86A] hover:bg-[#b39556] text-[#163024] text-xs font-black rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            title="Exit Fullscreen TV Mode"
          >
            <Minimize2 className="w-4 h-4" />
            <span>EXIT TV MODE</span>
          </button>
        </div>
      </div>

      {/* 2. Bottleneck Delay Alert Ticker (if any overdue) */}
      {delayedTickets.length > 0 && (
        <div className="bg-[#C53030] text-white px-6 py-2 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3 font-bold text-sm">
            <Flame className="w-5 h-5 animate-pulse text-amber-300 shrink-0" />
            <span className="uppercase tracking-wide">
              BOTTLENECK WARNING: {delayedTickets.length} ORDER{delayedTickets.length > 1 ? 'S' : ''} EXCEEDING 15 MINUTES!
            </span>
          </div>
          <div className="flex items-center gap-3">
            {delayedTickets.map(t => (
              <span
                key={t.id}
                className="px-2 py-0.5 rounded bg-white text-[#C53030] text-xs font-mono font-black"
              >
                {t.orderNumber} ({t.tableNumber ? `Table ${t.tableNumber}` : t.destination}) • {getElapsedMins(t)}m
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Main Production Display */}
      <div className="flex-1 p-6 overflow-y-auto">
        {tvViewMode === 'item-board' ? (
          <KitchenItemBoard
            initialStation={activeStation as KitchenStationType | 'all'}
            isTvMode={true}
            onToggleTvMode={onExitTvMode}
          />
        ) : stationTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-[#163024] border-2 border-[#C5A86A]/40 flex items-center justify-center text-[#C5A86A] shadow-2xl">
              <CookingPot className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-serif font-black text-[#F7F4EC]">
              ALL TICKETS CLEARED
            </h2>
            <p className="text-base text-[#DDD8C9] max-w-md">
              Zero pending orders currently on the {getStationLabel()} line. New incoming orders will alert audibly and appear in real time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {stationTickets.map(ticket => {
              const oid = ticket.orderId || ticket.orderNumber || ticket.id;
              const allWithOid = ticketsByOrderId.get(oid) || [];
              const companions = allWithOid.filter(c => c.id !== ticket.id);

              return (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  companionTickets={companions}
                  elapsedMinutes={getElapsedMins(ticket)}
                  onAdvanceStatus={handleAdvance}
                  onToggleItem={updateKitchenItemStatus}
                  onRecall={recallKitchenTicket}
                  onCancel={() => window.alert('Exit TV mode to cancel a ticket with a recorded reason.')}
                  isTvMode={true}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
