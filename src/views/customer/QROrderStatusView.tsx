import React from 'react';
import { Order, OrderItem } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bell,
  Sparkles,
  ArrowRight,
  Utensils,
  Receipt,
  Wine,
  Flame,
  ShieldCheck,
  RotateCcw,
  Check
} from 'lucide-react';

interface QROrderStatusViewProps {
  order: Order;
  onOrderMore: () => void;
  onCallWaiter: () => void;
  onViewBill?: () => void;
}

const PIPELINE_STEPS = [
  { key: 'ordered', label: 'ORDERED', desc: 'Order received' },
  { key: 'pending', label: 'PENDING', desc: 'Queued at station' },
  { key: 'preparing', label: 'PREPARING', desc: 'Chef/Bar crafting' },
  { key: 'ready', label: 'READY', desc: 'Plated & garnished' },
  { key: 'served', label: 'COMPLETED', desc: 'Delivered to table' },
];

export const QROrderStatusView: React.FC<QROrderStatusViewProps> = ({
  order,
  onOrderMore,
  onCallWaiter,
  onViewBill
}) => {
  const { updateOrderItemStatus } = useApp();

  // Helper to get numeric step index (0 to 4)
  const getStepIndex = (status: OrderItem['status']): number => {
    switch (status) {
      case 'ordered':
        return 0;
      case 'pending':
        return 1;
      case 'preparing':
        return 2;
      case 'ready':
        return 3;
      case 'served':
      case 'completed':
        return 4;
      default:
        return 1;
    }
  };

  // Helper to format status text and badge styling
  const getStatusBadge = (status: OrderItem['status']) => {
    switch (status) {
      case 'ordered':
        return {
          label: 'ORDERED',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
        };
      case 'pending':
        return {
          label: 'PENDING',
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'preparing':
        return {
          label: 'PREPARING',
          bg: 'bg-orange-100 text-orange-800 border-orange-300 animate-pulse',
          dot: 'bg-orange-600',
        };
      case 'ready':
        return {
          label: 'READY',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
          dot: 'bg-emerald-600',
        };
      case 'served':
      case 'completed':
        return {
          label: 'COMPLETED',
          bg: 'bg-[#163024] text-[#dfc78f] border-[#c5a86a]',
          dot: 'bg-[#dfc78f]',
        };
      default:
        return {
          label: 'PENDING',
          bg: 'bg-stone-100 text-stone-700 border-stone-300',
          dot: 'bg-stone-500',
        };
    }
  };

  // Split order items into Food and Bar/Beverage items
  const foodItems = order.items.filter(i => i.menuType !== 'drink');
  const barItems = order.items.filter(i => i.menuType === 'drink');

  // Overall order progress estimation
  const totalItems = order.items.length;
  const completedItems = order.items.filter(i => i.status === 'served' || i.status === 'completed').length;
  const readyItems = order.items.filter(i => i.status === 'ready').length;
  const preparingItems = order.items.filter(i => i.status === 'preparing').length;

  // Advance an item to its next status for testing/preview
  const advanceItemStatus = (item: OrderItem) => {
    const currentIdx = getStepIndex(item.status);
    const nextIdx = (currentIdx + 1) % PIPELINE_STEPS.length;
    const nextKey = PIPELINE_STEPS[nextIdx].key as OrderItem['status'];
    updateOrderItemStatus(order.id, item.id, nextKey);
  };

  return (
    <div className="bg-[#fcfbf7] rounded-3xl border border-[#e8e1cf] overflow-hidden shadow-xl space-y-4 animate-in fade-in duration-300 font-sans pb-4">
      
      {/* Royal Celebration Header */}
      <div className="bg-[#1b382b] text-[#f7f4ec] p-5 sm:p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#c5a86a_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        
        <div className="relative z-10 space-y-2">
          <div className="w-14 h-14 bg-[#c5a86a]/20 border border-[#c5a86a] rounded-full mx-auto flex items-center justify-center text-[#dfc78f] shadow-lg animate-pulse">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#dfc78f] block">
            Pali Resort & Club • Live Kitchen & Bar Dispatch
          </span>

          <div className="space-y-0.5">
            <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[#fcfbf7]">
              ORDER #{order.orderNumber}
            </h1>
            <p className="text-xs font-bold text-[#dfc78f] font-mono tracking-wider">
              Table {order.tableNumber}
            </p>
          </div>

          <p className="text-xs text-stone-300 max-w-sm mx-auto font-sans leading-relaxed">
            Your dishes have been routed to executive culinary stations. Track each item below in real time.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
            <div className="px-3 py-1 bg-white/10 rounded-xl border border-white/15 flex items-center gap-1.5">
              <span className="text-stone-300">Overall Status:</span>
              <span className="font-bold text-[#dfc78f] uppercase font-mono">{order.status}</span>
            </div>
            <div className="px-3 py-1 bg-white/10 rounded-xl border border-white/15 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#dfc78f]" />
              <span className="text-stone-300">Est. Time:</span>
              <span className="font-bold text-[#dfc78f]">~15-20 Mins</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        
        {/* Live Tracking Progress Overview */}
        <div className="p-3.5 bg-white rounded-2xl border border-[#e8e1cf] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-800">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#c5a86a]" />
              <span>Dishes in Preparation ({totalItems})</span>
            </span>
            <span className="text-[11px] text-stone-500">
              {completedItems} Served • {readyItems} Ready • {preparingItems} Cooking
            </span>
          </div>

          {/* Simple aggregate progress bar */}
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-[#163024] h-full transition-all duration-500"
              style={{ width: `${(completedItems / totalItems) * 100}%` }}
              title="Served items"
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${(readyItems / totalItems) * 100}%` }}
              title="Ready items"
            />
            <div
              className="bg-orange-400 h-full transition-all duration-500 animate-pulse"
              style={{ width: `${(preparingItems / totalItems) * 100}%` }}
              title="Preparing items"
            />
          </div>
        </div>

        {/* Section 1: Food Items (if present) */}
        {foodItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-serif text-sm font-bold text-[#163024] uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#c5a86a]" />
                <span>FOOD MENU ITEMS ({foodItems.length})</span>
              </h3>
              <span className="text-[10px] text-stone-400 uppercase font-mono">Kitchen Station</span>
            </div>

            <div className="space-y-2.5">
              {foodItems.map(item => {
                const stepIdx = getStepIndex(item.status);
                const badge = getStatusBadge(item.status);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-2xl border border-[#e8e1cf] hover:border-[#c5a86a]/60 shadow-2xs space-y-3 transition-all"
                  >
                    {/* Item Row: Name, Quantity & Live Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Veg / Non-Veg Indicator */}
                        <span
                          className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                            item.isVeg ? 'bg-emerald-600 ring-2 ring-emerald-100' : 'bg-rose-600 ring-2 ring-rose-100'
                          }`}
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900 leading-tight">
                            {item.name}
                          </h4>
                          {item.notes && (
                            <p className="text-[11px] text-stone-500 italic mt-0.5">
                              "{item.notes}"
                            </p>
                          )}
                          <span className="font-mono text-xs text-stone-500 font-semibold">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity & Live Status Badge */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-mono font-bold text-xs text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md">
                          × {item.quantity}
                        </span>
                        
                        <div
                          onClick={() => advanceItemStatus(item)}
                          title="Click to simulate advancing kitchen status"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider flex items-center gap-1.5 cursor-pointer shadow-2xs transition-transform active:scale-95 ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step Pipeline Progress Bar: ORDERED → PENDING → PREPARING → READY → COMPLETED */}
                    <div className="pt-1.5 border-t border-stone-100">
                      <div className="grid grid-cols-5 gap-1">
                        {PIPELINE_STEPS.map((step, idx) => {
                          const isCurrent = idx === stepIdx;
                          const isDone = idx < stepIdx;

                          return (
                            <div key={step.key} className="flex flex-col items-center space-y-1">
                              <div
                                className={`w-full h-1.5 rounded-full transition-colors ${
                                  isDone
                                    ? 'bg-[#163024]'
                                    : isCurrent
                                    ? 'bg-orange-500 animate-pulse'
                                    : 'bg-stone-200'
                                }`}
                              />
                              <span
                                className={`text-[9px] font-mono font-semibold tracking-tighter truncate ${
                                  isCurrent
                                    ? 'text-orange-600 font-bold'
                                    : isDone
                                    ? 'text-[#163024]'
                                    : 'text-stone-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Bar & Beverage Items (if present) */}
        {barItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-serif text-sm font-bold text-[#163024] uppercase tracking-wider flex items-center gap-2">
                <Wine className="w-4 h-4 text-[#c5a86a]" />
                <span>BAR & BEVERAGES ({barItems.length})</span>
              </h3>
              <span className="text-[10px] text-stone-400 uppercase font-mono">Bar Station</span>
            </div>

            <div className="space-y-2.5">
              {barItems.map(item => {
                const stepIdx = getStepIndex(item.status);
                const badge = getStatusBadge(item.status);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-2xl border border-[#e8e1cf] hover:border-[#c5a86a]/60 shadow-2xs space-y-3 transition-all"
                  >
                    {/* Item Row: Name, Quantity & Live Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-sky-500 ring-2 ring-sky-100" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900 leading-tight">
                            {item.name}
                          </h4>
                          {item.notes && (
                            <p className="text-[11px] text-stone-500 italic mt-0.5">
                              "{item.notes}"
                            </p>
                          )}
                          <span className="font-mono text-xs text-stone-500 font-semibold">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity & Live Status Badge */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-mono font-bold text-xs text-stone-800 bg-stone-100 px-2 py-0.5 rounded-md">
                          × {item.quantity}
                        </span>
                        
                        <div
                          onClick={() => advanceItemStatus(item)}
                          title="Click to simulate advancing bar status"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider flex items-center gap-1.5 cursor-pointer shadow-2xs transition-transform active:scale-95 ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step Pipeline Progress Bar: ORDERED → PENDING → PREPARING → READY → COMPLETED */}
                    <div className="pt-1.5 border-t border-stone-100">
                      <div className="grid grid-cols-5 gap-1">
                        {PIPELINE_STEPS.map((step, idx) => {
                          const isCurrent = idx === stepIdx;
                          const isDone = idx < stepIdx;

                          return (
                            <div key={step.key} className="flex flex-col items-center space-y-1">
                              <div
                                className={`w-full h-1.5 rounded-full transition-colors ${
                                  isDone
                                    ? 'bg-[#163024]'
                                    : isCurrent
                                    ? 'bg-orange-500 animate-pulse'
                                    : 'bg-stone-200'
                                }`}
                              />
                              <span
                                className={`text-[9px] font-mono font-semibold tracking-tighter truncate ${
                                  isCurrent
                                    ? 'text-orange-600 font-bold'
                                    : isDone
                                    ? 'text-[#163024]'
                                    : 'text-stone-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Bill Summary */}
        <div className="p-4 bg-white rounded-2xl border border-[#e8e1cf] space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-stone-600">
            <span>Subtotal ({order.items.length} items)</span>
            <span className="font-mono">₹{order.subtotal}</span>
          </div>

          <div className="flex justify-between items-center text-stone-600">
            <span>GST (5%)</span>
            <span className="font-mono">₹{order.gstAmount}</span>
          </div>

          {(order.tipAmount || 0) > 0 && (
            <div className="flex justify-between items-center text-stone-600">
              <span>Captain Tip</span>
              <span className="font-mono">₹{order.tipAmount}</span>
            </div>
          )}

          <div className="pt-2 border-t border-[#e8e1cf] flex justify-between items-center font-bold text-stone-900">
            <span className="font-serif text-sm">Grand Total</span>
            <span className="font-mono text-base text-[#163024]">₹{order.grandTotal}</span>
          </div>
        </div>

        {/* Action Buttons: Order More, Call Waiter, Request Bill */}
        <div className="space-y-2.5 pt-1">
          {onViewBill && (
            <button
              onClick={onViewBill}
              className="w-full py-3 px-4 rounded-xl bg-[#c5a86a] hover:bg-[#b89a5b] text-[#163024] text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-md border border-[#dfc78f] transition-all cursor-pointer active:scale-98"
            >
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#163024]" />
                <span>Request Bill / Settle Table</span>
              </span>
              <span className="font-mono font-bold text-sm">
                ₹{order.grandTotal} →
              </span>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={onCallWaiter}
              className="py-3 px-4 rounded-xl border border-[#e8e1cf] bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer active:scale-98"
            >
              <Bell className="w-4 h-4 text-[#1b382b]" />
              <span>Call Waiter</span>
            </button>

            <button
              onClick={onOrderMore}
              className="py-3 px-4 rounded-xl bg-[#1b382b] hover:bg-[#152e23] text-[#f7f4ec] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md border border-[#c5a86a]/40 transition-colors cursor-pointer active:scale-98"
            >
              <Utensils className="w-4 h-4 text-[#c5a86a]" />
              <span>Order More</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-stone-400 font-sans">
          Statuses synchronize live with the kitchen line. Tap any status badge above to test progression.
        </p>

      </div>
    </div>
  );
};
