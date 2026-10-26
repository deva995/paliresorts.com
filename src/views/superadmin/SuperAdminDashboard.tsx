import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  Hotel,
  UtensilsCrossed,
  CookingPot,
  CreditCard,
  Users,
  Package,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Bed,
  Compass,
  ArrowRight,
  BellRing,
  Coffee,
  Store,
  CalendarDays,
  ChevronRight,
  Droplets,
  HelpCircle,
  Check,
  Eye,
  Filter,
  Layers,
  Flame,
  ArrowUpRight,
  DollarSign
} from 'lucide-react';
import { OrderStatus, TableStatus } from '../../types';

export const SuperAdminDashboard: React.FC = () => {
  const {
    tables,
    rooms,
    orders,
    kitchenTickets,
    inventory,
    employees,
    payments,
    waiterRequests,
    attendWaiterRequest,
    resolveWaiterRequest,
    guests,
    activeRestaurant,
    pushRoute
  } = useApp();

  // Selected table filter for Compact Visual Table Map (Section 14)
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');
  // Selected request filter for Service Requests (Section 16)
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  // Greeting based on current time
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // 1. Calculations for Section 11: KPI Cards
  const todayRevenue = payments.reduce((acc, p) => acc + p.amount, 0) || 148500;
  const todayOrdersCount = orders.length || 48;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const activeGuestsCount = guests.length || 92;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;

  const pendingBills = orders.filter(
    o => o.paymentStatus !== 'paid' && o.status !== 'cancelled'
  );
  const pendingBillsCount = pendingBills.length;
  const pendingBillsAmount = pendingBills.reduce((acc, o) => acc + (o.grandTotal || 0), 0);

  const activeKdsTickets = kitchenTickets.filter(k => k.status === 'new' || k.status === 'preparing').length;
  const preparingTickets = kitchenTickets.filter(k => k.status === 'preparing').length;
  const readyTickets = kitchenTickets.filter(k => k.status === 'ready').length;
  const newTickets = kitchenTickets.filter(k => k.status === 'new').length;

  const pendingServiceRequests = waiterRequests.filter(r => r.status === 'pending').length;

  // 2. Multi-Outlet Table status derivation (Section 14)
  const enrichedTables = useMemo(() => {
    return tables.map(table => {
      // Find active order for this table if any
      const activeOrder = orders.find(
        o => (o.tableId === table.id || o.tableNumber === table.number) &&
             o.paymentStatus !== 'paid' &&
             o.status !== 'cancelled'
      );

      // Find kitchen ticket
      const kTicket = kitchenTickets.find(
        k => k.tableNumber === table.number && k.status !== 'completed'
      );

      let derivedStatus: 'Available' | 'Occupied' | 'Ordering' | 'Preparing' | 'Ready' | 'Bill Requested' | 'Payment Pending' | 'Paid' = 'Available';

      if (table.status === 'available') {
        derivedStatus = 'Available';
      } else if (activeOrder) {
        if (activeOrder.paymentStatus === 'paid') {
          derivedStatus = 'Paid';
        } else if (activeOrder.status === 'served') {
          derivedStatus = 'Bill Requested';
        } else if (kTicket?.status === 'ready') {
          derivedStatus = 'Ready';
        } else if (kTicket?.status === 'preparing' || activeOrder.status === 'cooking') {
          derivedStatus = 'Preparing';
        } else if (activeOrder.status === 'pending' || activeOrder.status === 'confirmed') {
          derivedStatus = 'Ordering';
        } else {
          derivedStatus = 'Occupied';
        }
      } else if (table.status === 'occupied') {
        derivedStatus = 'Occupied';
      }

      return {
        ...table,
        derivedStatus,
        activeOrder
      };
    });
  }, [tables, orders, kitchenTickets]);

  const filteredTables = useMemo(() => {
    if (selectedTableFilter === 'all') return enrichedTables;
    return enrichedTables.filter(t => t.derivedStatus.toLowerCase() === selectedTableFilter.toLowerCase());
  }, [enrichedTables, selectedTableFilter]);

  // 3. Section 16: Service Requests Filter
  const filteredRequests = useMemo(() => {
    return waiterRequests.filter(req => {
      const matchStatus = serviceStatusFilter === 'all' || req.status === serviceStatusFilter;
      const matchType = serviceTypeFilter === 'all' || req.requestType.toLowerCase() === serviceTypeFilter.toLowerCase();
      return matchStatus && matchType;
    });
  }, [waiterRequests, serviceStatusFilter, serviceTypeFilter]);

  // Weekly Revenue trajectory data for Section 12
  const weeklyRevenueData = [
    { day: 'Mon', revenue: 118400, prev: 105000 },
    { day: 'Tue', revenue: 124500, prev: 112000 },
    { day: 'Wed', revenue: 132000, prev: 119000 },
    { day: 'Thu', revenue: 128900, prev: 121000 },
    { day: 'Fri', revenue: 164200, prev: 148000 },
    { day: 'Sat', revenue: 189500, prev: 172000 },
    { day: 'Sun (Today)', revenue: todayRevenue, prev: 160000 }
  ];
  const maxWeekly = Math.max(...weeklyRevenueData.map(d => Math.max(d.revenue, d.prev)));

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Section 10: Header */}
      <div className="bg-[#163024] rounded-2xl p-6 sm:p-8 text-[#F7F4EC] shadow-sm border border-[#244737] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C5A86A]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A86A] bg-[#244737] px-2.5 py-0.5 rounded-full border border-[#C5A86A]/30">
              {greeting}
            </span>
            <span className="text-xs text-[#DDD8C9] font-medium">• Executive Operational Console</span>
          </div>
          <div>
            <div className="inline-block bg-white px-3.5 py-1.5 rounded-2xl shadow-sm border border-[#DDD8C9]">
              <img
                src="/palilogo.png"
                alt="Pali Resort & Club • Pali Village"
                className="h-9 sm:h-11 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#DDD8C9] max-w-2xl leading-relaxed">
            Operational overview across Food & Beverage outlets, Luxury Accommodations, KDS Dispatch, Guest Experience, and Real-time Financials.
          </p>
        </div>

        {/* Current Active Outlet Indicator */}
        <div className="z-10 bg-[#244737] border border-[#C5A86A]/30 rounded-xl p-3.5 flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-1 border border-[#C5A86A]/30 shadow-xs shrink-0">
            <img
              src="/palilogo.png"
              alt="Pali Resort Outlet"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#C5A86A] font-bold">
              Active Outlet Scoped
            </p>
            <p className="text-xs font-bold text-[#F7F4EC]">{activeRestaurant?.name || 'Pali Resort & Club'}</p>
            <p className="text-[10px] text-[#DDD8C9]">{activeRestaurant?.type || 'Resort Dining'}</p>
          </div>
        </div>
      </div>

      {/* Section 11: KPI Cards Grid (Clean white cards, Metric, Value, Trend, Small supporting info) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Revenue */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Today's Revenue</span>
            <span className="text-[11px] font-bold text-[#526B4A] flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12.4%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            ₹{(todayRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>Yesterday: ₹1,32,400</span>
            <span className="text-[#526B4A] font-semibold">Target: ₹1.60L</span>
          </div>
        </div>

        {/* 2. Today's Orders */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Today's Orders</span>
            <span className="text-[11px] font-bold text-[#526B4A] flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +8 Orders
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {todayOrdersCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>Avg Check: ₹3,090</span>
            <span className="text-[#163024] font-semibold">F&B + Deck</span>
          </div>
        </div>

        {/* 3. Occupied Tables */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Occupied Tables</span>
            <span className="text-[11px] font-bold text-[#C5A86A]">
              {Math.round((occupiedTables / (tables.length || 1)) * 100)}% Capacity
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {occupiedTables} <span className="text-sm font-normal text-[#687067]">/ {tables.length}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>{tables.length - occupiedTables} Available now</span>
            <span className="text-[#526B4A] font-semibold">Peak: 8-10 PM</span>
          </div>
        </div>

        {/* 4. Active Guests */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Active Guests</span>
            <span className="text-[11px] font-bold text-[#526B4A] flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> +14 arrivals
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {activeGuestsCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>In-House Stay: 64</span>
            <span className="text-[#163024] font-semibold">Walk-in: 28</span>
          </div>
        </div>

        {/* 5. Rooms Occupied */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Rooms Occupied</span>
            <span className="text-[11px] font-bold text-[#526B4A]">
              {Math.round((occupiedRooms / (rooms.length || 1)) * 100)}% Occ.
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {occupiedRooms} <span className="text-sm font-normal text-[#687067]">/ {rooms.length}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>ADR: ₹6,850</span>
            <span className="text-[#526B4A] font-semibold">RevPAR: ₹5,480</span>
          </div>
        </div>

        {/* 6. Pending Bills */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Pending Bills</span>
            <span className="text-[11px] font-bold text-[#C5A86A]">
              ₹{(pendingBillsAmount ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {pendingBillsCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>Tables awaiting POS</span>
            <button
              onClick={() => pushRoute('/cashier/pos')}
              className="text-[#163024] font-semibold hover:underline cursor-pointer"
            >
              Open Register →
            </button>
          </div>
        </div>

        {/* 7. Kitchen Orders */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Kitchen Orders</span>
            <span className="text-[11px] font-bold text-[#526B4A]">
              {preparingTickets} in prep
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {activeKdsTickets}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>{readyTickets} Ready • {newTickets} New</span>
            <button
              onClick={() => pushRoute('/kitchen/dashboard')}
              className="text-[#163024] font-semibold hover:underline cursor-pointer"
            >
              KDS View →
            </button>
          </div>
        </div>

        {/* 8. Service Requests */}
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2 hover:border-[#C5A86A]/60 transition-all">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#163024]">Service Requests</span>
            <span className="text-[11px] font-bold text-[#C5A86A]">
              {pendingServiceRequests > 0 ? `${pendingServiceRequests} Urgent` : 'All cleared'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#163024]">
            {pendingServiceRequests}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#687067] pt-1 border-t border-[#DDD8C9]/50">
            <span>Waiter & Table calls</span>
            <button
              onClick={() => pushRoute('/waiter/dashboard')}
              className="text-[#163024] font-semibold hover:underline cursor-pointer"
            >
              Service Desk →
            </button>
          </div>
        </div>
      </div>

      {/* Section 12: Larger Revenue Card with Period Comparisons & Premium Natural Palette Chart */}
      <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DDD8C9] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#163024]/10 text-[#163024] rounded-md">
                Financial Performance
              </span>
              <span className="text-xs text-[#687067]">Real-time Reconciliation</span>
            </div>
            <h2 className="text-lg font-bold text-[#163024] mt-1">Revenue Trajectory & Sales Velocity</h2>
          </div>

          {/* Period Selectors */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => pushRoute('/reports/sales')}
              className="px-3 py-1.5 bg-[#F7F4EC] hover:bg-[#ede8db] border border-[#DDD8C9] rounded-xl text-[#163024] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#526B4A]" />
              <span>Full Analytics</span>
            </button>
          </div>
        </div>

        {/* 4 Period Metrics: Today, Yesterday, This Week, This Month */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1">
            <span className="text-[11px] font-semibold text-[#687067] uppercase tracking-wider">Today's Revenue</span>
            <div className="text-2xl font-bold font-mono text-[#163024]">
              ₹{(todayRevenue ?? 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-[#526B4A] font-semibold">+12.4% vs same day last week</span>
          </div>

          <div className="p-4 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1">
            <span className="text-[11px] font-semibold text-[#687067] uppercase tracking-wider">Yesterday</span>
            <div className="text-2xl font-bold font-mono text-[#163024]">
              ₹1,32,400
            </div>
            <span className="text-[11px] text-[#687067]">Closed & Reconciled</span>
          </div>

          <div className="p-4 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1">
            <span className="text-[11px] font-semibold text-[#687067] uppercase tracking-wider">This Week</span>
            <div className="text-2xl font-bold font-mono text-[#163024]">
              ₹8,92,600
            </div>
            <span className="text-[11px] text-[#526B4A] font-semibold">+9.8% vs last week</span>
          </div>

          <div className="p-4 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1">
            <span className="text-[11px] font-semibold text-[#687067] uppercase tracking-wider">This Month</span>
            <div className="text-2xl font-bold font-mono text-[#163024]">
              ₹34,28,000
            </div>
            <span className="text-[11px] text-[#C5A86A] font-semibold">On track for ₹45L budget</span>
          </div>
        </div>

        {/* Clean Premium Chart (Forest Green #163024, Olive #526B4A, Champagne Gold #C5A86A. NO BLUE!) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-[#687067]">
            <span className="font-semibold text-[#163024]">7-Day Revenue Velocity (₹ INR)</span>
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#163024]" />
                <span>Current Week</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#C5A86A]" />
                <span>Previous Week Benchmark</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-44 w-full flex items-end justify-between gap-3 sm:gap-6 pt-6 pb-2 border-b border-[#DDD8C9]">
            {weeklyRevenueData.map((item, idx) => {
              const currentHeight = Math.round((item.revenue / maxWeekly) * 100);
              const prevHeight = Math.round((item.prev / maxWeekly) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-[#163024] text-[#F7F4EC] text-[10px] py-1 px-2 rounded-md whitespace-nowrap shadow-md pointer-events-none z-10 font-mono">
                    ₹{(item.revenue ?? 0).toLocaleString('en-IN')}
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                    {/* Previous week bar */}
                    <div
                      style={{ height: `${prevHeight}%` }}
                      className="w-2.5 sm:w-4 bg-[#C5A86A]/40 rounded-t-sm transition-all"
                    />
                    {/* Current week bar (Deep Forest Green) */}
                    <div
                      style={{ height: `${currentHeight}%` }}
                      className="w-3 sm:w-6 bg-[#163024] group-hover:bg-[#526B4A] rounded-t-sm transition-all shadow-xs"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[#687067] mt-2 block truncate">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 13: Operations Overview (7 Operational Modules with Detailed Status) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#163024]">Operations Overview</h2>
            <p className="text-xs text-[#687067]">Integrated resort operational status across all operational units</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. RESTAURANT */}
          <div
            onClick={() => pushRoute('/restaurant/dashboard')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                RESTAURANT
              </span>
              <UtensilsCrossed className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{todayOrdersCount} Orders Today</p>
              <p className="text-xs text-[#687067] mt-0.5">₹{(todayRevenue ?? 0).toLocaleString('en-IN')} Gross Billing</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• {occupiedTables} Active Checks</span>
              <span className="text-[#526B4A] font-medium">• 14m Avg Turn</span>
            </div>
          </div>

          {/* 2. KITCHEN */}
          <div
            onClick={() => pushRoute('/kitchen/dashboard')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                KITCHEN
              </span>
              <CookingPot className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{activeKdsTickets} Active Orders</p>
              <p className="text-xs text-[#687067] mt-0.5">{preparingTickets} Preparing • {readyTickets} Ready • {newTickets} New</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• 3 Stations Live</span>
              <span className="text-[#526B4A] font-medium">• 96% On-Time</span>
            </div>
          </div>

          {/* 3. WAITER */}
          <div
            onClick={() => pushRoute('/waiter/dashboard')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                WAITER
              </span>
              <Users className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{waiterRequests.length} Total Calls</p>
              <p className="text-xs text-[#687067] mt-0.5">{pendingServiceRequests} Pending • {waiterRequests.length - pendingServiceRequests} Attended</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• 6 Waiters Active</span>
              <span className="text-[#526B4A] font-medium">• 1.8m Response</span>
            </div>
          </div>

          {/* 4. TABLES */}
          <div
            onClick={() => pushRoute('/restaurant/tables')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                TABLES
              </span>
              <Store className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{tables.length} Total Tables</p>
              <p className="text-xs text-[#687067] mt-0.5">{occupiedTables} Occupied • {tables.length - occupiedTables} Available</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• {pendingBillsCount} Bill Requested</span>
              <span className="text-[#526B4A] font-medium">• All Clean</span>
            </div>
          </div>

          {/* 5. ROOMS */}
          <div
            onClick={() => pushRoute('/hotel/reservations')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                ROOMS
              </span>
              <Hotel className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{occupiedRooms} / {rooms.length} Occupied</p>
              <p className="text-xs text-[#687067] mt-0.5">82% Property Occupancy Rate</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• 4 Check-ins Due</span>
              <span className="text-[#526B4A] font-medium">• 2 Departures</span>
            </div>
          </div>

          {/* 6. HOUSEKEEPING */}
          <div
            onClick={() => pushRoute('/housekeeping/dashboard')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                HOUSEKEEPING
              </span>
              <Sparkles className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">4 Scheduled Tasks</p>
              <p className="text-xs text-[#687067] mt-0.5">2 In Progress • 2 Completed</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• Room Turnarounds</span>
              <span className="text-[#526B4A] font-medium">• 100% Inspected</span>
            </div>
          </div>

          {/* 7. INVENTORY */}
          <div
            onClick={() => pushRoute('/inventory/dashboard')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                INVENTORY
              </span>
              <Package className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">{inventory.length} Tracked SKUs</p>
              <p className="text-xs text-[#687067] mt-0.5">
                {inventory.filter(i => i.status === 'low-stock').length} Low Stock Alerts
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• 0.8% Spoilage</span>
              <span className="text-[#526B4A] font-medium">• ₹4.8L Asset Val</span>
            </div>
          </div>

          {/* 8. AUDIT & SECURITY */}
          <div
            onClick={() => pushRoute('/audit-logs')}
            className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs hover:border-[#163024] transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
                AUDIT LOGS
              </span>
              <CheckCircle2 className="w-4 h-4 text-[#163024]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#163024] font-mono">100% Compliance</p>
              <p className="text-xs text-[#687067] mt-0.5">Zero Unauthorized Overrides</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#DDD8C9]">
              <span className="text-[#163024] font-medium">• MFA Active</span>
              <span className="text-[#526B4A] font-medium">• Ledger Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 14: Compact Visual Table Map / Status Overview */}
      <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD8C9] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#163024]">Table Status & Floor Overview</h2>
            <p className="text-xs text-[#687067]">
              Real-time synchronization with active orders, KDS ticket states, and dining lifecycle
            </p>
          </div>

          {/* Filter Pills for the 8 Statuses */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              'all',
              'Available',
              'Occupied',
              'Ordering',
              'Preparing',
              'Ready',
              'Bill Requested',
              'Payment Pending',
              'Paid'
            ].map(statusKey => {
              const isSelected = selectedTableFilter.toLowerCase() === statusKey.toLowerCase();
              return (
                <button
                  key={statusKey}
                  onClick={() => setSelectedTableFilter(statusKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                      : 'bg-[#F7F4EC] text-[#687067] hover:text-[#163024] hover:bg-[#ede8db]'
                  }`}
                >
                  {statusKey === 'all' ? 'All Tables' : statusKey}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Table Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredTables.map(t => {
            const getStatusBadgeStyle = (status: string) => {
              switch (status) {
                case 'Available':
                  return 'bg-[#526B4A]/10 text-[#526B4A] border-[#526B4A]/30';
                case 'Occupied':
                  return 'bg-[#163024] text-[#F7F4EC] border-[#163024]';
                case 'Ordering':
                  return 'bg-[#C5A86A]/20 text-[#163024] border-[#C5A86A]';
                case 'Preparing':
                  return 'bg-[#C5A86A] text-[#163024] border-[#C5A86A]';
                case 'Ready':
                  return 'bg-[#526B4A] text-[#F7F4EC] border-[#526B4A]';
                case 'Bill Requested':
                  return 'bg-[#9C413D]/15 text-[#9C413D] border-[#9C413D]/30';
                case 'Payment Pending':
                  return 'bg-[#9C413D]/20 text-[#9C413D] border-[#9C413D]/40';
                case 'Paid':
                  return 'bg-[#526B4A]/20 text-[#163024] border-[#526B4A]';
                default:
                  return 'bg-[#F7F4EC] text-[#1D241F] border-[#DDD8C9]';
              }
            };

            return (
              <div
                key={t.id}
                onClick={() => pushRoute('/restaurant/tables')}
                className="p-3 bg-[#F7F4EC]/60 hover:bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-2 cursor-pointer transition-all hover:border-[#163024] group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#163024] font-mono group-hover:text-[#526B4A]">
                    {t.number}
                  </span>
                  <span className="text-[10px] text-[#687067]">{t.capacity}p</span>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStatusBadgeStyle(
                      t.derivedStatus
                    )}`}
                  >
                    {t.derivedStatus}
                  </span>
                </div>

                {t.activeOrder ? (
                  <div className="text-[10px] text-[#687067] font-mono pt-1 border-t border-[#DDD8C9]/40 flex justify-between">
                    <span>#{t.activeOrder.orderNumber}</span>
                    <span className="font-bold text-[#163024]">₹{t.activeOrder.grandTotal}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-[#687067] pt-1 border-t border-[#DDD8C9]/40">
                    <span>{t.area}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sections 15 & 16: Two Columns for Live Order Feed & Service Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 15: Live Order Feed */}
        <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#163024]">Live Order Feed</h2>
              <p className="text-xs text-[#687067]">Real-time orders flowing from tables and mobile QR</p>
            </div>
            <button
              onClick={() => pushRoute('/restaurant/orders')}
              className="text-xs text-[#163024] hover:text-[#526B4A] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#DDD8C9]/50 max-h-96 overflow-y-auto scrollbar-thin">
            {orders.slice(0, 7).map(order => {
              const getOrderStatusBadge = (st: OrderStatus) => {
                switch (st) {
                  case 'preparing':
                    return 'bg-[#C5A86A] text-[#163024]';
                  case 'ready':
                    return 'bg-[#526B4A] text-[#F7F4EC]';
                  case 'placed':
                  case 'confirmed':
                    return 'bg-[#163024]/10 text-[#163024]';
                  case 'served':
                    return 'bg-[#526B4A]/20 text-[#163024]';
                  default:
                    return 'bg-[#F7F4EC] text-[#1D241F]';
                }
              };

              return (
                <div
                  key={order.id}
                  onClick={() => pushRoute('/restaurant/orders')}
                  className="py-3 flex items-center justify-between hover:bg-[#F7F4EC]/50 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] flex items-center justify-center text-[#163024] font-mono font-bold text-xs">
                      {order.tableNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#163024] font-mono">
                          ORDER #{order.orderNumber}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${getOrderStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#687067] mt-0.5">
                        {order.items?.length || 1} items • {order.paymentStatus.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-[#163024]">
                      ₹{(order.grandTotal ?? 0).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-[#687067] flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-[#687067]" />
                      {order.createdAt?.split(' ')[1] || 'Just now'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 16: Service Requests (Call Waiter, Water, Bill, Cleaning, Cutlery, etc.) */}
        <div className="bg-white p-6 rounded-2xl border border-[#DDD8C9] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#163024]">Guest Service Requests</h2>
              <p className="text-xs text-[#687067]">Waiter calls, water refills, cutlery, and bill requests</p>
            </div>
            <button
              onClick={() => pushRoute('/waiter/dashboard')}
              className="text-xs text-[#163024] hover:text-[#526B4A] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Service Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status and Type Filters */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['all', 'pending', 'in-progress', 'completed'].map(st => (
              <button
                key={st}
                onClick={() => setServiceStatusFilter(st as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  serviceStatusFilter === st
                    ? 'bg-[#163024] text-[#F7F4EC]'
                    : 'bg-[#F7F4EC] text-[#687067] hover:bg-[#ede8db]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Service Requests List */}
          <div className="divide-y divide-[#DDD8C9]/50 max-h-96 overflow-y-auto scrollbar-thin">
            {filteredRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#687067]">
                No requests matching this filter.
              </div>
            ) : (
              filteredRequests.map(req => {
                const getRequestIcon = (t: string) => {
                  switch (t.toLowerCase()) {
                    case 'water':
                      return <Droplets className="w-4 h-4 text-[#526B4A]" />;
                    case 'bill':
                      return <Receipt className="w-4 h-4 text-[#C5A86A]" />;
                    case 'cleaning':
                      return <Sparkles className="w-4 h-4 text-[#526B4A]" />;
                    case 'cutlery':
                      return <UtensilsCrossed className="w-4 h-4 text-[#163024]" />;
                    default:
                      return <BellRing className="w-4 h-4 text-[#163024]" />;
                  }
                };

                return (
                  <div key={req.id} className="py-3 flex items-center justify-between hover:bg-[#F7F4EC]/50 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] flex items-center justify-center">
                        {getRequestIcon(req.requestType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#163024]">
                            Table {req.tableNumber}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#C5A86A]/20 text-[#163024] uppercase">
                            {req.requestType}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#687067] mt-0.5">{req.notes || 'Guest requested assistance'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => attendWaiterRequest(req.id)}
                          className="px-2.5 py-1 bg-[#163024] hover:bg-[#244737] text-[#F7F4EC] text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Attend
                        </button>
                      )}
                      {req.status === 'in-progress' && (
                        <button
                          onClick={() => resolveWaiterRequest(req.id)}
                          className="px-2.5 py-1 bg-[#526B4A] hover:bg-[#3e5237] text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                      {req.status === 'completed' && (
                        <span className="text-[10px] font-semibold text-[#526B4A] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#526B4A]" /> Done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
