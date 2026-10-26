import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KitchenTicket, KitchenTicketStatus } from '../../types';
import { TicketCard } from './TicketCard';
import { KitchenItemBoard } from './KitchenItemBoard';
import { playKitchenSound } from './audioAlerts';
import { matchesKitchenStation } from '../../utils/kitchenStation';
import {
  ChefHat,
  CookingPot,
  Wine,
  Coffee,
  Beer,
  Clock,
  Flame,
  AlertTriangle,
  Sparkles,
  Layers,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Tv,
  RotateCcw,
  CheckCircle2,
  Activity,
  LayoutGrid,
  BarChart3,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface KitchenExecutiveViewProps {
  onToggleTvMode: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  currentTime: Date;
}

export const KitchenExecutiveView: React.FC<KitchenExecutiveViewProps> = ({
  onToggleTvMode,
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
    pushRoute,
    restaurantSyncError,
    refreshRestaurantData
  } = useApp();

  const [executiveTab, setExecutiveTab] = useState<'item-board' | 'station-matrix'>('station-matrix');
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scoped to Pali Resort & Club
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

  // Compute Station-specific metrics
  const getStationMetrics = (stationType: 'cooking' | 'bar' | 'beverages' | 'drinks') => {
    const tickets = resortTickets.filter(
      t => matchesKitchenStation(t, stationType) && t.status !== 'completed' && t.status !== 'cancelled'
    );
    const newCount = tickets.filter(t => t.status === 'new').length;
    const preparingCount = tickets.filter(t => t.status === 'preparing' || t.status === 'accepted').length;
    const readyCount = tickets.filter(t => t.status === 'ready').length;
    const delayedCount = tickets.filter(t => getElapsedMins(t) >= 15).length;
    const avgMins = tickets.length > 0
      ? Math.round(tickets.reduce((acc, t) => acc + getElapsedMins(t), 0) / tickets.length)
      : 0;

    return {
      total: tickets.length,
      newCount,
      preparingCount,
      readyCount,
      delayedCount,
      avgMins
    };
  };

  const cookingMetrics = useMemo(() => getStationMetrics('cooking'), [resortTickets, currentTime]);
  const barMetrics = useMemo(() => getStationMetrics('bar'), [resortTickets, currentTime]);
  const beveragesMetrics = useMemo(() => getStationMetrics('beverages'), [resortTickets, currentTime]);
  const drinksMetrics = useMemo(() => getStationMetrics('drinks'), [resortTickets, currentTime]);

  // Bottleneck alerts (tickets >= 15 mins)
  const delayedTickets = useMemo(() => {
    return resortTickets.filter(
      t => t.status !== 'completed' && t.status !== 'cancelled' && getElapsedMins(t) >= 15
    );
  }, [resortTickets, currentTime]);

  // Filtered ticket queue
  const filteredTickets = useMemo(() => {
    return resortTickets.filter(t => {
      if (t.status === 'cancelled') return false;

      // Station filter
      if (selectedStation !== 'all') {
        if (!matchesKitchenStation(t, selectedStation)) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'active') {
          if (t.status === 'completed') return false;
        } else if (t.status !== selectedStatus) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (t.orderNumber || '').toLowerCase().includes(q) ||
          (t.tableNumber || '').toLowerCase().includes(q) ||
          (t.destination || '').toLowerCase().includes(q) ||
          (t.waiterName || '').toLowerCase().includes(q) ||
          t.items.some(i => i.name.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [resortTickets, selectedStation, selectedStatus, searchQuery, currentTime]);

  const [actionError, setActionError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {actionError && <p role="alert" className="text-red-700">{actionError}</p>}
      {/* 1. Header & Controls */}
      <div className="bg-[#163024] text-[#F7F4EC] p-6 rounded-3xl border border-[#244737] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C5A86A] text-[#163024] flex items-center justify-center font-serif text-2xl font-black shadow-md shrink-0">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-serif font-bold text-[#F7F4EC] tracking-tight">
                Executive Kitchen Operations Console
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#C5A86A]/20 text-[#C5A86A] text-[10px] font-black uppercase tracking-wider border border-[#C5A86A]/30">
                Supervisor Deck
              </span>
            </div>
            <p className="text-xs text-[#DDD8C9] mt-1">
              Central operational oversight across Cooking, Bar, Beverages, and Drinks production lines at Pali Resort & Club.
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tab Switcher: Production Items vs Station Matrix */}
          <div className="flex items-center p-1 bg-[#0F2018] border border-[#244737] rounded-xl gap-1">
            <button
              id="tab-exec-production-items"
              disabled
              title="Quantity batching is unavailable. Use persisted ticket controls."
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                executiveTab === 'item-board'
                  ? 'bg-[#C5A86A] text-[#163024] shadow-xs'
                  : 'text-[#DDD8C9] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>PRODUCTION ITEMS</span>
            </button>
            <button
              id="tab-exec-station-matrix"
              onClick={() => setExecutiveTab('station-matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                executiveTab === 'station-matrix'
                  ? 'bg-[#C5A86A] text-[#163024] shadow-xs'
                  : 'text-[#DDD8C9] hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>STATION MATRIX</span>
            </button>
          </div>

          <button
            id="btn-toggle-audio-executive"
            onClick={onToggleAudio}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              audioEnabled
                ? 'bg-white/10 hover:bg-white/20 text-[#F7F4EC] border-white/20'
                : 'bg-[#C53030]/20 text-rose-300 border-[#C53030]/40'
            }`}
            title={audioEnabled ? 'Mute Kitchen Chimes' : 'Unmute Kitchen Chimes'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-[#C5A86A]" /> : <VolumeX className="w-4 h-4" />}
            <span>{audioEnabled ? 'Audio Chimes On' : 'Chimes Muted'}</span>
          </button>

          <button
            id="btn-enter-tv-mode"
            onClick={onToggleTvMode}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C5A86A] hover:bg-[#b39556] text-[#163024] flex items-center gap-2 transition-colors cursor-pointer shadow-md"
            title="Launch High-Contrast TV Mode (1920x1080)"
          >
            <Tv className="w-4 h-4" />
            <span>Kitchen TV Mode</span>
          </button>
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

      {/* Primary Display based on Tab */}
      {executiveTab === 'item-board' ? (
        <KitchenItemBoard
          initialStation="all"
          onToggleTvMode={onToggleTvMode}
        />
      ) : (
        <>
          {/* 2. Bottleneck Alert Banner (When any ticket >= 15m) */}
          {delayedTickets.length > 0 && (
            <div className="p-4 bg-rose-50 border-2 border-[#C53030] rounded-2xl shadow-sm flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C53030] text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#C53030] uppercase tracking-wide flex items-center gap-2">
                    <span>Production Bottleneck Detected ({delayedTickets.length} orders overdue)</span>
                  </h4>
                  <p className="text-xs text-rose-900 mt-0.5">
                    The following tickets have exceeded the 15-minute preparation threshold and require immediate line dispatch attention:
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {delayedTickets.map(t => (
                      <span
                        key={t.id}
                        className="px-2 py-1 rounded bg-[#C53030] text-white text-xs font-mono font-bold flex items-center gap-1 shadow-2xs"
                      >
                        <span>{t.orderNumber}</span>
                        <span>({t.tableNumber ? `Table ${t.tableNumber}` : t.destination})</span>
                        <span className="text-amber-300 font-extrabold">{getElapsedMins(t)}m</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. 4 Station Operational Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cooking Line Card */}
            <div
              onClick={() => pushRoute('/kitchen/kds/cooking')}
              className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#163024] text-[#F7F4EC] flex items-center justify-center">
                    <CookingPot className="w-5 h-5 text-[#C5A86A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#163024] group-hover:text-[#526B4A] transition-colors">
                      Cooking Line
                    </h3>
                    <p className="text-[10px] text-[#687067]">Grill, Tandoor & Curries</p>
                  </div>
                </div>
                <span className="font-mono text-xl font-black text-[#163024]">
                  {cookingMetrics.total}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#DDD8C9] text-center">
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Prep</span>
                  <span className="font-bold font-mono text-xs text-[#163024]">{cookingMetrics.preparingCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Ready</span>
                  <span className="font-bold font-mono text-xs text-emerald-800">{cookingMetrics.readyCount}</span>
                </div>
                <div className={`p-1.5 rounded-lg ${cookingMetrics.delayedCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-[#F7F4EC]'}`}>
                  <span className="text-[9px] font-bold uppercase block">Delay</span>
                  <span className="font-bold font-mono text-xs">{cookingMetrics.delayedCount}</span>
                </div>
              </div>
            </div>

            {/* Bar & Cellar Card */}
            <div
              onClick={() => pushRoute('/kitchen/kds/bar')}
              className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#526B4A] text-white flex items-center justify-center">
                    <Wine className="w-5 h-5 text-[#C5A86A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#163024] group-hover:text-[#526B4A] transition-colors">
                      Bar & Cellar
                    </h3>
                    <p className="text-[10px] text-[#687067]">Cocktails & Premium Wines</p>
                  </div>
                </div>
                <span className="font-mono text-xl font-black text-[#163024]">
                  {barMetrics.total}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#DDD8C9] text-center">
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Prep</span>
                  <span className="font-bold font-mono text-xs text-[#163024]">{barMetrics.preparingCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Ready</span>
                  <span className="font-bold font-mono text-xs text-emerald-800">{barMetrics.readyCount}</span>
                </div>
                <div className={`p-1.5 rounded-lg ${barMetrics.delayedCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-[#F7F4EC]'}`}>
                  <span className="text-[9px] font-bold uppercase block">Delay</span>
                  <span className="font-bold font-mono text-xs">{barMetrics.delayedCount}</span>
                </div>
              </div>
            </div>

            {/* Beverages Station Card */}
            <div
              onClick={() => pushRoute('/kitchen/beverages')}
              className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#163024] text-white flex items-center justify-center">
                    <Coffee className="w-5 h-5 text-[#C5A86A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#163024] group-hover:text-[#526B4A] transition-colors">
                      Beverages Station
                    </h3>
                    <p className="text-[10px] text-[#687067]">Teas, Juices & Mocktails</p>
                  </div>
                </div>
                <span className="font-mono text-xl font-black text-[#163024]">
                  {beveragesMetrics.total}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#DDD8C9] text-center">
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Prep</span>
                  <span className="font-bold font-mono text-xs text-[#163024]">{beveragesMetrics.preparingCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Ready</span>
                  <span className="font-bold font-mono text-xs text-emerald-800">{beveragesMetrics.readyCount}</span>
                </div>
                <div className={`p-1.5 rounded-lg ${beveragesMetrics.delayedCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-[#F7F4EC]'}`}>
                  <span className="text-[9px] font-bold uppercase block">Delay</span>
                  <span className="font-bold font-mono text-xs">{beveragesMetrics.delayedCount}</span>
                </div>
              </div>
            </div>

            {/* Drinks Station Card */}
            <div
              onClick={() => pushRoute('/kitchen/drinks')}
              className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#526B4A] text-white flex items-center justify-center">
                    <Beer className="w-5 h-5 text-[#C5A86A]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#163024] group-hover:text-[#526B4A] transition-colors">
                      Drinks Station
                    </h3>
                    <p className="text-[10px] text-[#687067]">Draught Beers & Sodas</p>
                  </div>
                </div>
                <span className="font-mono text-xl font-black text-[#163024]">
                  {drinksMetrics.total}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#DDD8C9] text-center">
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Prep</span>
                  <span className="font-bold font-mono text-xs text-[#163024]">{drinksMetrics.preparingCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#F7F4EC]">
                  <span className="text-[9px] font-bold text-[#687067] uppercase block">Ready</span>
                  <span className="font-bold font-mono text-xs text-emerald-800">{drinksMetrics.readyCount}</span>
                </div>
                <div className={`p-1.5 rounded-lg ${drinksMetrics.delayedCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-[#F7F4EC]'}`}>
                  <span className="text-[9px] font-bold uppercase block">Delay</span>
                  <span className="font-bold font-mono text-xs">{drinksMetrics.delayedCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Filter and Search Controls */}
          <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Station Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Stations' },
                { id: 'cooking', label: 'Cooking Line' },
                { id: 'bar', label: 'Bar & Cellar' },
                { id: 'beverages', label: 'Beverages' },
                { id: 'drinks', label: 'Drinks' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedStation === st.id
                      ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                      : 'bg-[#F7F4EC] hover:bg-[#DDD8C9] text-[#163024] border border-[#DDD8C9]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Search & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#687067]" />
                <input
                  type="text"
                  placeholder="Search table, order, waiter..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs text-[#163024] placeholder-[#687067] focus:outline-none focus:ring-1 focus:ring-[#163024] w-56"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs font-bold text-[#163024] focus:outline-none focus:ring-1 focus:ring-[#163024]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="new">New</option>
                <option value="accepted">Accepted</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready for Service</option>
                <option value="completed">Completed / Served</option>
              </select>
            </div>
          </div>

          {/* 5. Live Master Ticket Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#163024]">
              <span>Master Culinary Dispatch Feed ({filteredTickets.length} tickets)</span>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="p-12 bg-white rounded-3xl border border-[#DDD8C9] text-center space-y-3">
                <CookingPot className="w-12 h-12 text-[#DDD8C9] mx-auto" />
                <h4 className="font-bold text-[#163024] text-base">No Matching Tickets</h4>
                <p className="text-xs text-[#687067] max-w-sm mx-auto">
                  All line queues are clear or no orders match your search parameters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTickets.map(ticket => {
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
                      onCancel={async ticket => {
                        const reason = window.prompt('Cancellation reason (3 to 500 characters)');
                        if (reason === null) return;
                        const result = await cancelKitchenTicket(ticket.id, reason);
                        setActionError(result.success ? null : result.error || 'Cancellation failed');
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
