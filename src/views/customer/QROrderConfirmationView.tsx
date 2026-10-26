import React from 'react';
import { Check, Sparkles, ArrowRight, ShieldCheck, Clock, Receipt, Utensils } from 'lucide-react';
import { Order } from '../../types';

interface QROrderConfirmationViewProps {
  order: Order;
  onTrackOrder: () => void;
  onViewBill?: () => void;
  onOrderMore?: () => void;
}

export const QROrderConfirmationView: React.FC<QROrderConfirmationViewProps> = ({
  order,
  onTrackOrder,
  onViewBill,
  onOrderMore
}) => {
  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const latestRound = order.items && order.items.length > 0
    ? order.items.reduce((max, it) => Math.max(max, it.round || 1), 1)
    : 1;

  return (
    <div className="min-h-[720px] rounded-3xl bg-[#163024] text-[#F7F4EC] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden font-sans shadow-2xl border border-[#234b39] animate-in fade-in zoom-in-95 duration-400">
      {/* Background Golden Twinkling Sparkles */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-12 left-10 w-2 h-2 rounded-full bg-[#dfc78f] blur-[1px] animate-pulse" />
        <div className="absolute top-28 right-12 w-1.5 h-1.5 rounded-full bg-[#dfc78f] blur-[1px] animate-pulse delay-300" />
        <div className="absolute bottom-36 left-16 w-2 h-2 rounded-full bg-[#dfc78f] blur-[1px] animate-pulse delay-700" />
        <div className="absolute bottom-20 right-14 w-2 h-2 rounded-full bg-[#dfc78f] blur-[1px] animate-pulse delay-500" />
        <div className="absolute top-1/2 left-8 w-1 h-1 rounded-full bg-[#dfc78f] blur-[0.5px]" />
      </div>

      {/* Top Resort Logo Badge */}
      <div className="relative z-10 flex flex-col items-center text-center pt-2">
        <div className="p-2.5 bg-white/95 rounded-2xl shadow-xl border border-[#c5a86a]/30 mb-2">
          <img
            src="/palilogo.png"
            alt="Pali Resort & Club"
            className="h-10 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-[10px] tracking-widest text-[#dfc78f] uppercase font-bold">
          Pali Resort & Club • Nature&apos;s Gateway
        </span>
      </div>

      {/* Center Checkmark with Concentric Radiant Rings */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center space-y-5">
        {/* Animated Concentric Rings */}
        <div className="relative flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border border-[#c5a86a]/20 animate-ping absolute" />
          <div className="w-24 h-24 rounded-full border border-[#c5a86a]/40 flex items-center justify-center bg-[#c5a86a]/10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#c5a86a] to-[#dfc78f] text-[#163024] flex items-center justify-center shadow-xl shadow-[#c5a86a]/30 transform scale-100 hover:scale-105 transition-transform">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-1.5 max-w-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 text-[#dfc78f] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Round {latestRound} Sent to Kitchen</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
            Delicacies in Preparation
          </h2>
          <p className="text-xs text-stone-300 leading-relaxed">
            Your order has been fired to the kitchen & bar stations. Multiple rounds can be ordered anytime before settlement!
          </p>
        </div>

        {/* Order Details Summary Card */}
        <div className="w-full max-w-xs bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-left space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <span className="text-[10px] text-[#dfc78f] uppercase tracking-wider font-bold">
                Order Number
              </span>
              <p className="font-mono font-bold text-white text-base">
                #{order.orderNumber}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#dfc78f] uppercase tracking-wider font-bold">
                Table
              </span>
              <p className="font-mono font-bold text-white text-base">
                Table {order.tableNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-200">
            <span>{order.paymentStatus === 'paid' ? 'Amount Paid' : 'Running Table Total'}</span>
            <span className="font-mono font-bold text-[#dfc78f] text-sm">
              ₹{(order?.grandTotal ?? 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-200">
            <span>Estimated Preparation Time</span>
            <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>15–20 Mins</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-200">
            <span>Date & Time</span>
            <span className="font-mono text-[11px] text-stone-300">{currentDateFormatted}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-200">
            <span>Payment Status</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{order.paymentStatus === 'paid' ? 'Paid Online' : 'Pay at Final Settlement'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions & Elegant Footer */}
      <div className="relative z-10 pt-4 flex flex-col items-center space-y-2.5">
        <div className="flex items-center gap-2 w-full max-w-xs">
          {onOrderMore && (
            <button
              onClick={onOrderMore}
              className="flex-1 py-3.5 px-3 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Utensils className="w-4 h-4 text-[#dfc78f]" />
              <span>Order More</span>
            </button>
          )}

          <button
            id="btn-track-your-order"
            onClick={onTrackOrder}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#c5a86a] via-[#dfc78f] to-[#b89552] text-[#163024] font-bold text-xs shadow-2xl hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer group"
          >
            <span>Track Order</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#163024] group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {onViewBill && (
          <button
            onClick={onViewBill}
            className="w-full max-w-xs py-3 px-4 rounded-2xl bg-[#163024] hover:bg-[#1a382a] text-[#dfc78f] border border-[#c5a86a]/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Receipt className="w-4 h-4 text-[#dfc78f]" />
            <span>Final Bill Settlement (₹{(order?.grandTotal ?? 0).toLocaleString('en-IN')})</span>
          </button>
        )}

        <div className="pt-1 text-center">
          <p className="text-white/60 text-[11px] font-serif italic tracking-wider">
            Thank you for dining at Pali Resort & Club
          </p>
        </div>
      </div>
    </div>
  );
};
