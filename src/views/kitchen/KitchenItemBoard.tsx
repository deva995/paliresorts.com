import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { aggregateProductionItems } from '../../utils/productionAggregator';
import { ProductionItemCard } from './ProductionItemCard';
import { ProductionTestSuiteModal } from './ProductionTestSuiteModal';
import {
  Search,
  SlidersHorizontal,
  Flame,
  Tv,
  Wifi,
  WifiOff,
  RefreshCw,
  FlaskConical,
  UtensilsCrossed,
  Wine,
  Coffee,
  GlassWater,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { KitchenStationType } from '../../types';

interface KitchenItemBoardProps {
  initialStation?: KitchenStationType | 'all';
  stationFilter?: 'all' | 'tandoor' | 'curry' | 'chinese' | 'pantry' | 'bar';
  isTvMode?: boolean;
  onToggleTvMode?: () => void;
}

export const KitchenItemBoard: React.FC<KitchenItemBoardProps> = ({
  initialStation = 'all',
  stationFilter,
  isTvMode = false,
  onToggleTvMode
}) => {
  const {
    orders,
    kitchenTickets,
    currentUser,
    isKitchenOffline,
    toggleKitchenOffline,
    productionEvents,
    prepareProductionItem,
    readyProductionItem,
    handoffProductionItem,
    recallProductionItem,
    syncOfflineProductionEvents
  } = useApp();

  const isKitchenCooking = currentUser.role === 'KITCHEN_COOKING';
  const isKitchenBar = currentUser.role === 'KITCHEN_BAR' || currentUser.role === 'BEVERAGES' || currentUser.role === 'DRINKS';

  // Primary Filters (Section 3: ALL | DINE IN | TAKE AWAY)
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'dine-in' | 'takeaway'>('all');

  // Station Filter (Cooking, Bar, Beverages, Drinks)
  const userRoleStation = useMemo((): KitchenStationType | 'all' => {
    if (currentUser.role === 'KITCHEN_COOKING') return 'cooking';
    if (currentUser.role === 'KITCHEN_BAR') return 'bar';
    if (currentUser.role === 'BEVERAGES') return 'beverages';
    if (currentUser.role === 'DRINKS') return 'drinks';
    return (initialStation as KitchenStationType | 'all') || 'all';
  }, [currentUser.role, initialStation]);

  const [selectedStation, setSelectedStation] = useState<KitchenStationType | 'all'>(userRoleStation);
  const [activeStationCode, setActiveStationCode] = useState<string>(stationFilter || 'all');

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'priority' | 'oldest' | 'name'>('priority');
  const [showTestSuite, setShowTestSuite] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Derive aggregated production items from context
  const aggregatedItems = useMemo(() => {
    return aggregateProductionItems(orders, kitchenTickets);
  }, [orders, kitchenTickets]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    return aggregatedItems
      .filter(item => {
        // Role filter: KITCHEN_COOKING sees hot stations, KITCHEN_BAR sees beverage tickets
        if (isKitchenCooking) {
          const sCode = (item.stationCode || '').toUpperCase();
          if (sCode && !['TANDOOR', 'CURRY', 'CHINESE'].includes(sCode)) {
            return false;
          }
        }
        if (isKitchenBar) {
          const sCode = (item.stationCode || '').toUpperCase();
          if (sCode && sCode !== 'BAR' && item.stationType !== 'bar') {
            return false;
          }
        }

        // Specific station filter (Tandoor, Curry, Chinese, Pantry, Bar)
        const currentStation = (stationFilter || activeStationCode || 'all').toLowerCase();
        if (currentStation !== 'all') {
          const sCode = (item.stationCode || '').toLowerCase();
          if (sCode && sCode !== currentStation) {
            return false;
          }
        }

        // Service type filter
        if (serviceTypeFilter !== 'all' && item.serviceType !== serviceTypeFilter) {
          return false;
        }
        // Legacy stationType filter
        if (selectedStation !== 'all' && item.stationType !== selectedStation) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = item.menuItemName.toLowerCase().includes(q);
          const matchesMod = item.modifiers?.some(m => m.toLowerCase().includes(q));
          const matchesNotes = item.specialInstructions?.some(n => n.toLowerCase().includes(q));
          if (!matchesName && !matchesMod && !matchesNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'priority') {
          // 1. Delayed pending (>15m) first
          if (a.delayStatus === 'delayed' && b.delayStatus !== 'delayed') return -1;
          if (b.delayStatus === 'delayed' && a.delayStatus !== 'delayed') return 1;

          // 2. High pending quantity first
          if (a.quantityPending > 0 && b.quantityPending === 0) return -1;
          if (b.quantityPending > 0 && a.quantityPending === 0) return 1;

          // 3. Oldest elapsed
          return b.elapsedMinutes - a.elapsedMinutes;
        } else if (sortOrder === 'oldest') {
          return b.elapsedMinutes - a.elapsedMinutes;
        } else {
          return a.menuItemName.localeCompare(b.menuItemName);
        }
      });
  }, [aggregatedItems, serviceTypeFilter, selectedStation, searchQuery, sortOrder]);

  // Totals calculations
  const totals = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let delayed = 0;

    displayItems.forEach(item => {
      pending += item.quantityPending;
      preparing += item.quantityPreparing;
      ready += item.quantityReady;
      if (item.delayStatus === 'delayed') delayed++;
    });

    return { pending, preparing, ready, delayed, activeCount: displayItems.length };
  }, [displayItems]);

  const handleSyncOffline = () => {
    setIsSyncing(true);
    setTimeout(() => {
      syncOfflineProductionEvents();
      setIsSyncing(false);
    }, 400);
  };

  const isExecutiveOrAdmin =
    currentUser.role === 'KITCHEN_EXECUTIVE' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'RESTAURANT_OWNER' ||
    currentUser.role === 'RESTAURANT_MANAGER';

  return (
    <div className={`space-y-5 ${isTvMode ? 'p-6 bg-[#0B1711] min-h-screen text-[#F7F4EC]' : ''}`}>
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-3xl p-4 sm:p-5 border border-[#DDD8C9] shadow-xs">
        {/* Service Type Switcher: [ ALL ] [ DINE IN ] [ TAKE AWAY ] (Section 3) */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#F7F4EC] rounded-2xl border border-[#DDD8C9]/80 overflow-x-auto">
          <button
            id="filter-all-service"
            onClick={() => setServiceTypeFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              serviceTypeFilter === 'all'
                ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                : 'text-[#687067] hover:text-[#163024]'
            }`}
          >
            All Services
          </button>
          <button
            id="filter-dine-in"
            onClick={() => setServiceTypeFilter('dine-in')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              serviceTypeFilter === 'dine-in'
                ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                : 'text-[#687067] hover:text-[#163024]'
            }`}
          >
            Dine In
          </button>
          <button
            id="filter-takeaway"
            onClick={() => setServiceTypeFilter('takeaway')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              serviceTypeFilter === 'takeaway'
                ? 'bg-[#C5A86A] text-[#163024] shadow-xs'
                : 'text-[#687067] hover:text-[#163024]'
            }`}
          >
            Take Away
          </button>
        </div>

        {/* Station Tabs (Filtered if Executive, fixed if station role) */}
        {isExecutiveOrAdmin && (
          <div className="flex items-center gap-1 p-1 bg-[#F7F4EC] rounded-2xl border border-[#DDD8C9]/80 overflow-x-auto">
            <button
              onClick={() => setSelectedStation('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedStation === 'all' ? 'bg-white text-[#163024] shadow-xs' : 'text-[#687067]'
              }`}
            >
              All Stations
            </button>
            <button
              onClick={() => setSelectedStation('cooking')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedStation === 'cooking' ? 'bg-white text-[#163024] shadow-xs' : 'text-[#687067]'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" /> Cooking
            </button>
            <button
              onClick={() => setSelectedStation('bar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedStation === 'bar' ? 'bg-white text-[#163024] shadow-xs' : 'text-[#687067]'
              }`}
            >
              <Wine className="w-3.5 h-3.5" /> Bar
            </button>
            <button
              onClick={() => setSelectedStation('beverages')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedStation === 'beverages' ? 'bg-white text-[#163024] shadow-xs' : 'text-[#687067]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" /> Beverages
            </button>
            <button
              onClick={() => setSelectedStation('drinks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedStation === 'drinks' ? 'bg-white text-[#163024] shadow-xs' : 'text-[#687067]'
              }`}
            >
              <GlassWater className="w-3.5 h-3.5" /> Drinks
            </button>
          </div>
        )}

        {/* Right Tools: Offline toggle, TV Mode toggle, Test Suite button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Offline Mode Switcher (Section 33-36) */}
          <button
            id="btn-toggle-kitchen-offline"
            onClick={toggleKitchenOffline}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isKitchenOffline
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
            title="Toggle simulated offline operation"
          >
            {isKitchenOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                <span>OFFLINE MODE</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span>ONLINE</span>
              </>
            )}
          </button>

          {/* Sync Offline Queue */}
          {isKitchenOffline && (
            <button
              id="btn-sync-offline-events"
              disabled={isSyncing}
              onClick={handleSyncOffline}
              className="px-3 py-2 rounded-xl bg-[#163024] hover:bg-[#244737] text-[#F7F4EC] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Queue</span>
            </button>
          )}

          {/* TV Mode Toggle (Section 42-47) */}
          {onToggleTvMode && (
            <button
              id="btn-toggle-tv-mode"
              onClick={onToggleTvMode}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isTvMode
                  ? 'bg-[#C5A86A] text-[#163024] border-[#C5A86A]'
                  : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-[#DDD8C9]/40'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{isTvMode ? 'Exit TV Mode' : 'TV Mode (1080p)'}</span>
            </button>
          )}

          {/* Test Suite Modal Trigger (Hidden in Production) */}
          <button
            id="btn-open-phase7-tests"
            onClick={() => setShowTestSuite(true)}
            className="hidden px-3 py-2 rounded-xl bg-[#F7F4EC] hover:bg-[#DDD8C9]/40 text-[#163024] border border-[#DDD8C9] text-xs font-bold items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5 text-[#C5A86A]" />
            <span>Phase 7 Tests</span>
          </button>
        </div>
      </div>

      {/* Production Overview Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-[#DDD8C9] flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider block">Pending</span>
            <span className="text-2xl font-black text-[#C5A86A] font-mono">{totals.pending}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#C5A86A] flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DDD8C9] flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider block">Preparing</span>
            <span className="text-2xl font-black text-[#526B4A] font-mono">{totals.preparing}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#526B4A] flex items-center justify-center font-bold">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DDD8C9] flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider block">Ready</span>
            <span className="text-2xl font-black text-[#163024] font-mono">{totals.ready}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 text-[#163024] flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-[#DDD8C9] flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#687067] uppercase tracking-wider block">Delayed ({'>15m'})</span>
            <span className="text-2xl font-black text-[#C53030] font-mono">{totals.delayed}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#C53030] flex items-center justify-center font-bold">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#687067] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-production-items"
            type="text"
            placeholder="Search items, modifiers, allergens..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-[#DDD8C9] text-xs text-[#163024] placeholder:text-[#687067] focus:outline-hidden focus:border-[#163024]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#687067] font-bold">Sort:</span>
          <select
            id="select-sort-production-items"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] focus:outline-hidden"
          >
            <option value="priority">Priority (Delayed &gt; Oldest Pending)</option>
            <option value="oldest">Oldest Punched First</option>
            <option value="name">Alphabetical (A - Z)</option>
          </select>
        </div>
      </div>

      {/* Production Cards Grid (Primary Item-Based KDS Screen - Section 2, 4) */}
      {displayItems.length > 0 ? (
        <div
          id="production-items-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        >
          {displayItems.map(item => (
            <ProductionItemCard
              key={item.id}
              item={item}
              onPrepare={prepareProductionItem}
              onMarkReady={readyProductionItem}
              onFastOut={handoffProductionItem}
              onRecall={recallProductionItem}
              isTvMode={isTvMode}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#DDD8C9] space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-[#F7F4EC] text-[#526B4A] mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="font-serif font-bold text-lg text-[#163024]">
            Active Production Line Clear
          </h4>
          <p className="text-xs text-[#687067] max-w-md mx-auto">
            All kitchen and bar production items for this filter are completed or handed over. Incoming orders will automatically populate this station board.
          </p>
        </div>
      )}

      {/* Test Suite Modal */}
      {showTestSuite && (
        <ProductionTestSuiteModal onClose={() => setShowTestSuite(false)} />
      )}
    </div>
  );
};
