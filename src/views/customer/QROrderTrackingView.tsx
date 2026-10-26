import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ChefHat,
  Bell,
  Sparkles,
  ArrowRight,
  Utensils,
  Receipt,
  Wine,
  ShieldCheck,
  Heart,
  Plus
} from 'lucide-react';
import { Order, OrderItem } from '../../types';

interface QROrderTrackingViewProps {
  order: Order;
  onOrderMore: () => void;
  onCallWaiter: () => void;
  onViewBill: () => void;
  onViewThankYou: () => void;
  onRefresh?: () => void;
}

export const QROrderTrackingView: React.FC<QROrderTrackingViewProps> = ({
  order,
  onOrderMore,
  onCallWaiter,
  onViewBill,
  onViewThankYou,
  onRefresh
}) => {
  // Live polling for guest order tracker every 5 seconds
  React.useEffect(() => {
    if (onRefresh) {
      onRefresh();
      const interval = setInterval(() => {
        onRefresh();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [onRefresh]);
  // Determine current timeline progress index:
  // 0: Placed
  // 1: Confirmed
  // 2: Preparing
  // 3: Ready
  // 4: Delivered
  const getProgressIndex = (status: Order['status']): number => {
    switch (String(status).toLowerCase()) {
      case 'placed':
      case 'ordered':
        return 0;
      case 'confirmed':
      case 'accepted':
        return 1;
      case 'preparing':
      case 'in-kitchen':
        return 2;
      case 'ready':
        return 3;
      case 'delivered':
      case 'served':
      case 'completed':
        return 4;
      default:
        return 0;
    }
  };

  const currentStep = getProgressIndex(order.status);

  const TIMELINE_STEPS = [
    {
      title: 'PLACED',
      time: order.time || 'Placed',
      desc: 'Your order has been placed and received by the resort system.'
    },
    {
      title: 'CONFIRMED',
      time: 'Confirmed',
      desc: 'Your order has been acknowledged and accepted by the kitchen.'
    },
    {
      title: 'PREPARING',
      time: 'In Progress',
      desc: 'Our culinary master chefs are crafting your dishes fresh.'
    },
    {
      title: 'READY',
      time: 'Nearly Ready',
      desc: 'Dishes are being artfully plated, garnished, and quality-checked.'
    },
    {
      title: 'DELIVERED',
      time: 'Delivered',
      desc: `Your personal captain has served dishes to Table ${order.tableNumber}.`
    }
  ];

  return (
    <div className="space-y-4 font-sans text-stone-900 pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onOrderMore}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 p-1 -ml-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-stone-700" />
          <span>Menu</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onCallWaiter}
            className="flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-[#163024]" />
            <span>Call Captain</span>
          </button>

          <div className="flex items-center gap-1 px-3 py-1 bg-[#163024] text-[#dfc78f] rounded-full text-xs font-bold font-mono">
            <span>Table {order.tableNumber}</span>
          </div>
        </div>
      </div>

      {/* Screen Title */}
      <div>
        <h2 className="text-xl font-serif font-bold text-[#163024] leading-tight">
          Track Your Order
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Freshly prepared. Just for you.
        </p>
      </div>

      {/* Live Operational Pipeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#DDD8C9] shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Live Order
            </span>
            <p className="font-mono font-bold text-stone-900 text-base">
              #{order.orderNumber}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {order.status.toUpperCase()}
          </span>
        </div>

        {/* Vertical Timeline */}
        <div className="space-y-6 relative pl-2">
          {/* Vertical Line */}
          <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-stone-200" />

          {TIMELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div key={idx} className="flex items-start gap-4 relative z-10">
                {/* Node Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-[#163024] border-[#c5a86a] text-[#dfc78f] shadow-md ring-4 ring-[#c5a86a]/20'
                      : 'bg-stone-100 border-stone-300 text-stone-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dfc78f] animate-ping" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-stone-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-bold ${
                        isCurrent ? 'text-[#163024]' : isCompleted ? 'text-stone-800' : 'text-stone-400'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <span className="text-[11px] font-mono text-stone-400">
                      {step.time}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ordered Items Status List */}
      <div className="bg-white rounded-2xl p-4 border border-[#DDD8C9] shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            Ordered Delicacies ({order.items.length})
          </span>
          <span className="text-xs font-mono font-bold text-[#163024]">
            Total ₹{order.grandTotal}
          </span>
        </div>

        <div className="space-y-2">
          {order.items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-xl bg-stone-50 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                />
                <span className="font-semibold text-stone-800">
                  {item.quantity}x {item.name}
                </span>
                {item.round && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                    Round {item.round}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-600 uppercase font-mono shrink-0">
                {item.status || order.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resort Architectural Sketch / Heritage Quote Box */}
      <div className="p-4 rounded-2xl bg-[#f7f4ec] border border-[#e2dcce] text-center space-y-2">
        <p className="text-xs font-serif italic text-stone-600">
          &ldquo;Good food brings people together.&rdquo;
        </p>
        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">
          Pali Resort & Club • Nature&apos;s Gateway
        </p>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-4 inset-x-4 sm:max-w-md sm:mx-auto z-40 flex items-center gap-2">
        <button
          onClick={onOrderMore}
          className="flex-1 py-3.5 px-4 rounded-xl bg-white hover:bg-stone-50 text-[#163024] font-bold text-xs border border-[#DDD8C9] shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 text-[#163024]" />
          <span>Order More Dishes</span>
        </button>

        <button
          onClick={onViewBill || onViewThankYou}
          className="flex-1 py-3.5 px-4 rounded-xl bg-[#163024] hover:bg-[#254d3a] text-[#dfc78f] font-bold text-xs border border-[#c5a86a]/40 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Receipt className="w-4 h-4 text-[#dfc78f]" />
          <span>Final Bill Settlement</span>
        </button>
      </div>
    </div>
  );
};
