import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KitchenTicket, KitchenTicketStatus } from '../../types';
import { TicketCard } from './TicketCard';
import { KitchenItemBoard } from './KitchenItemBoard';
import { playKitchenSound } from './audioAlerts';
import {
  CookingPot,
  Wine,
  Coffee,
  Beer,
  Clock,
  Volume2,
  VolumeX,
  Tv,
  Search,
  Filter,
  Flame,
  LayoutGrid,
  Columns,
  RotateCcw,
  Sparkles,
  XCircle,
  Layers,
  Utensils,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

import { getTicketStation, isTicketVisibleForRole, matchesKitchenStation, type KitchenStationFilter } from '../../utils/kitchenStation';
export { getTicketStation, isTicketVisibleForRole } from '../../utils/kitchenStation';

interface KitchenStationKDSViewProps {
  stationType: 'cooking' | 'bar' | 'beverages' | 'drinks' | 'all';
  stationTitle: string;
  stationSubtitle: string;
  onToggleTvMode: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  currentTime: Date;
}

export const KitchenStationKDSView: React.FC<KitchenStationKDSViewProps> = ({
  stationType,
  stationTitle,
  stationSubtitle,
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
    currentUser,
    restaurantSyncError,
    refreshRestaurantData
  } = useApp();

  const isKitchenCooking = currentUser.role === 'KITCHEN_COOKING';
  const isKitchenBar = currentUser.role === 'KITCHEN_BAR' || currentUser.role === 'BEVERAGES' || currentUser.role === 'DRINKS';

  const [selectedStationFilter, setSelectedStationFilter] = useState<KitchenStationFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'items' | 'kanban' | 'grid'>('kanban');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cancelModalTicket, setCancelModalTicket] = useState<KitchenTicket | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const availableStationFilters: { id: KitchenStationFilter; label: string }[] = useMemo(() => {
    if (isKitchenCooking) {
      return [
        { id: 'all', label: 'All Hot Stations' },
        { id: 'tandoor', label: 'Tandoor' },
        { id: 'curry', label: 'Curry' },
        { id: 'chinese', label: 'Chinese' }
      ];
    }
    if (isKitchenBar) {
      return [{ id: 'bar', label: 'Bar & Beverages' }];
    }
    return [
      { id: 'all', label: 'All Stations' },
      { id: 'tandoor', label: 'Tandoor' },
      { id: 'curry', label: 'Curry' },
      { id: 'chinese', label: 'Chinese' },
      { id: 'pantry', label: 'Pantry' },
      { id: 'bar', label: 'Bar' }
    ];
  }, [isKitchenCooking, isKitchenBar]);

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

  // Filter tickets for this specific station & role
  const stationTickets = useMemo(() => {
    return resortTickets.filter(t => {
      if (t.status === 'cancelled') return false;

      // 1. Role filter: KITCHEN_COOKING sees hot stations, KITCHEN_BAR sees beverage tickets
      if (!isTicketVisibleForRole(t, currentUser.role)) {
        return false;
      }

      // 2. Specific Station filter (Tandoor, Curry, Chinese, Pantry, Bar)
      if (selectedStationFilter !== 'all') {
        if (getTicketStation(t) !== selectedStationFilter) return false;
      }

      // 3. StationType filter
      if (stationType !== 'all') {
        if (!matchesKitchenStation(t, stationType)) return false;
      }

      // 4. Search
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
  }, [resortTickets, selectedStationFilter, stationType, searchQuery, currentUser.role, currentTime]);

  const activeTickets = useMemo(() => {
    return stationTickets.filter(t => t.status !== 'completed');
  }, [stationTickets]);

  const completedTickets = useMemo(() => {
    return stationTickets.filter(t => t.status === 'completed');
  }, [stationTickets]);

  const delayedTickets = useMemo(() => {
    return activeTickets.filter(t => getElapsedMins(t) >= 15);
  }, [activeTickets, currentTime]);

  // Station Icon Selector
  const getStationIcon = () => {
    switch (stationType) {
      case 'bar':
        return Wine;
      case 'beverages':
        return Coffee;
      case 'drinks':
        return Beer;
      case 'cooking':
      default:
        return CookingPot;
    }
  };

  const StationIcon = getStationIcon();

  const handleAdvance = async (ticket: KitchenTicket) => {
    let next: KitchenTicketStatus = 'accepted';
    if (ticket.status === 'new') next = 'accepted';
    else if (ticket.status === 'accepted') next = 'preparing';
    else if (ticket.status === 'preparing') {
      next = 'ready';

    } else if (ticket.status === 'ready') {
      next = 'completed';

    }
    const res = await updateKitchenTicketStatus(ticket.id, next);
    if (res.success && (next === 'ready' || next === 'completed')) playKitchenSound(next === 'ready' ? 'order_ready' : 'bump', audioEnabled);
    if (!res.success && res.error) {
      setActionError(res.error);
    } else {
      setActionError(null);
    }
    return res;
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalTicket || isActionPending) return;
    if (cancelReason.trim().length < 3) { setActionError('Enter a cancellation reason of at least 3 characters.'); return; }
    setIsActionPending(true);
    const res = await cancelKitchenTicket(cancelModalTicket.id, cancelReason.trim());
    setIsActionPending(false);
    if (res.success) {
      setCancelModalTicket(null);
      setCancelReason('');
      setActionError(null);
    } else {
      setActionError(res.error || 'Failed to cancel ticket on server');
    }
  };

  // 1. Kanban View
  const renderKanban = () => {
    const columns: { status: KitchenTicketStatus; title: string; color: string; badgeColor: string }[] = [
      {
        status: 'new',
        title: 'New Tickets',
        color: 'border-[#C5A86A] bg-[#F7F4EC] text-[#163024]',
        badgeColor: 'bg-[#C5A86A] text-[#163024]'
      },
      {
        status: 'accepted',
        title: 'Accepted',
        color: 'border-[#DDD8C9] bg-[#F7F4EC]/60 text-[#163024]',
        badgeColor: 'bg-[#DDD8C9] text-[#163024]'
      },
      {
        status: 'preparing',
        title: 'In Preparation',
        color: 'border-[#526B4A] bg-[#163024]/5 text-[#163024]',
        badgeColor: 'bg-[#526B4A] text-white'
      },
      {
        status: 'ready',
        title: 'Ready for Service',
        color: 'border-[#163024] bg-[#163024]/10 text-[#163024]',
        badgeColor: 'bg-[#163024] text-[#F7F4EC]'
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map(col => {
          const colTickets = activeTickets.filter(t => t.status === col.status);
          return (
            <div
              key={col.status}
              id={`station-col-${col.status}`}
              className="bg-[#F7F4EC]/60 rounded-2xl p-3 border border-[#DDD8C9] flex flex-col gap-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between font-bold text-xs ${col.color}`}>
                <span>{col.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono ${col.badgeColor}`}>
                  {colTickets.length}
                </span>
              </div>

              {/* Ticket Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTickets.length === 0 ? (
                  <div className="p-8 text-center text-[#687067] text-xs border border-dashed border-[#DDD8C9] rounded-xl bg-white/60">
                    No orders currently in {col.title.toLowerCase()}
                  </div>
                ) : (
                  colTickets.map(ticket => {
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
                        onCancel={t => setCancelModalTicket(t)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 2. Grid View
  const renderGrid = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeTickets.length === 0 ? (
          <div className="col-span-full p-12 bg-white rounded-3xl border border-[#DDD8C9] text-center space-y-3">
            <StationIcon className="w-12 h-12 text-[#DDD8C9] mx-auto" />
            <h4 className="font-bold text-[#163024] text-base">Station Line Clear</h4>
            <p className="text-xs text-[#687067] max-w-sm mx-auto">
              No active tickets currently in preparation for this station. New tickets punched will trigger an audible chime.
            </p>
          </div>
        ) : (
          activeTickets.map(ticket => {
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
                onCancel={t => setCancelModalTicket(t)}
              />
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Station Banner */}
      <div className="bg-[#163024] text-[#F7F4EC] p-6 rounded-3xl border border-[#244737] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C5A86A] text-[#163024] flex items-center justify-center font-serif text-2xl font-black shadow-md shrink-0">
            <StationIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-serif font-bold text-[#F7F4EC] tracking-tight">
                {stationTitle}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#526B4A] text-[#F7F4EC] text-[10px] font-black uppercase tracking-wider">
                Live KDS
              </span>
            </div>
            <p className="text-xs text-[#DDD8C9] mt-1">{stationSubtitle}</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id={`btn-toggle-audio-${stationType}`}
            onClick={onToggleAudio}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              audioEnabled
                ? 'bg-white/10 hover:bg-white/20 text-[#F7F4EC] border-white/20'
                : 'bg-[#C53030]/20 text-rose-300 border-[#C53030]/40'
            }`}
            title={audioEnabled ? 'Mute Kitchen Chimes' : 'Unmute Kitchen Chimes'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-[#C5A86A]" /> : <VolumeX className="w-4 h-4" />}
            <span>{audioEnabled ? 'Audio Alerts On' : 'Alerts Muted'}</span>
          </button>

          <button
            id={`btn-tv-mode-${stationType}`}
            onClick={onToggleTvMode}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C5A86A] hover:bg-[#b39556] text-[#163024] flex items-center gap-2 transition-colors cursor-pointer shadow-md"
            title="Launch High-Contrast TV Mode (1920x1080 Landscape)"
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

      {/* Server Action Error Banner */}
      {actionError && (
        <div className="bg-rose-50 border-2 border-[#C53030] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-800 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Kitchen Status Update Failed</p>
              <p className="text-xs text-rose-700">{actionError}</p>
            </div>
          </div>
          <button
            onClick={() => { setActionError(null); refreshRestaurantData(); }}
            className="px-3.5 py-1.5 bg-[#163024] hover:bg-[#0f2219] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Retry Server Sync</span>
          </button>
        </div>
      )}

      {/* 2. Bottleneck Alert Banner (if delayed) */}
      {delayedTickets.length > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-[#C53030] rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C53030] text-white flex items-center justify-center shrink-0 animate-pulse">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-[#C53030] uppercase tracking-wider block">
              Delayed Order Alert ({delayedTickets.length} order{delayedTickets.length > 1 ? 's' : ''} &gt; 15 mins)
            </span>
            <p className="text-xs text-rose-900 mt-0.5">
              Please expedite preparation for {delayedTickets.map(t => t.orderNumber).join(', ')}.
            </p>
          </div>
        </div>
      )}

      {/* Station Filters (Tandoor, Curry, Chinese, Pantry, Bar) */}
      <div className="bg-white p-3 rounded-2xl border border-[#DDD8C9] shadow-2xs flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-[#163024] flex items-center gap-1 shrink-0 px-1">
          <Filter className="w-3.5 h-3.5 text-[#526B4A]" />
          Stations:
        </span>
        {availableStationFilters.map(st => (
          <button
            key={st.id}
            id={`btn-station-filter-${st.id}`}
            onClick={() => setSelectedStationFilter(st.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
              selectedStationFilter === st.id
                ? 'bg-[#163024] text-[#F7F4EC] border-[#163024] shadow-xs'
                : 'bg-[#F7F4EC]/60 text-[#526B4A] border-[#DDD8C9] hover:border-[#163024] hover:text-[#163024]'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* 3. Filter, Search & View Mode Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Active Stats */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-[#163024]">
            Active Line Orders: <strong>{activeTickets.length}</strong>
          </span>
          <span className="text-[#687067]">•</span>
          <span className="text-[#526B4A]">
            Fulfilled in Loaded Queue: <strong>{completedTickets.length}</strong>
          </span>
        </div>

        {/* View Mode & Search */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#687067]" />
            <input
              type="text"
              placeholder="Search table, order, notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] text-xs text-[#163024] placeholder-[#687067] focus:outline-none focus:ring-1 focus:ring-[#163024] w-56"
            />
          </div>

          <div className="flex items-center p-1 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl gap-0.5">
            <button
              id="btn-view-items"
              disabled
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'items'
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'text-[#526B4A] hover:text-[#163024]'
              }`}
              title="Quantity batching is unavailable. Use the persisted ticket and item controls."
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Production Items</span>
            </button>
            <button
              id="btn-view-kanban"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'text-[#526B4A] hover:text-[#163024]'
              }`}
              title="Kanban Tickets View"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              id="btn-view-grid"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'text-[#526B4A] hover:text-[#163024]'
              }`}
              title="Grid Tickets View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Production Board / Tickets Board */}
      {viewMode === 'items' ? (
        <KitchenItemBoard
          initialStation={stationType}
          onToggleTvMode={onToggleTvMode}
        />
      ) : viewMode === 'kanban' ? (
        renderKanban()
      ) : (
        renderGrid()
      )}

      {/* 5. Cancel Ticket Confirmation Modal */}
      {cancelModalTicket && (
        <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#DDD8C9] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-[#C53030] flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#163024]">Cancel KDS Ticket</h4>
                <p className="text-xs text-[#687067]">
                  Order {cancelModalTicket.orderNumber} ({cancelModalTicket.tableNumber ? `Table ${cancelModalTicket.tableNumber}` : cancelModalTicket.destination})
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#163024]">Cancellation Reason</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Guest changed mind, 86 inventory stockout..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-[#DDD8C9] text-xs text-[#163024] focus:outline-none focus:ring-1 focus:ring-[#163024]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalTicket(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#687067] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
              >
                Go Back
              </button>
              <button
                disabled={isActionPending || cancelReason.trim().length < 3}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C53030] hover:bg-rose-700 text-white shadow-md transition-colors cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
