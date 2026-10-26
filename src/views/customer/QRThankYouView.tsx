import React from 'react';
import { Sparkles, Receipt, ArrowRight, Utensils, ShieldCheck, Heart, CheckCircle2 } from 'lucide-react';
import { Order } from '../../types';

interface QRThankYouViewProps {
  tableNumber: string;
  order?: Order | null;
  onViewDetailedBill: () => void;
  onBackToMenu: () => void;
  onEndSession?: () => void;
}

export const QRThankYouView: React.FC<QRThankYouViewProps> = ({
  tableNumber,
  order,
  onViewDetailedBill,
  onBackToMenu,
  onEndSession
}) => {
  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate items and breakdown from order if present
  const items = order?.items || [
    { menuItemId: 'p1', name: 'Paneer Tikka Angaar', quantity: 2, price: 380 },
    { menuItemId: 'p2', name: 'Murgh Dum Biryani', quantity: 1, price: 450 }
  ];

  const subtotal = order?.subtotal || items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const taxAmount = order?.tax || Math.round(subtotal * 0.05);
  const tipAmount = order?.tipAmount || 0;
  const grandTotal = order?.grandTotal || subtotal + taxAmount + tipAmount;
  const paymentStatus = order?.paymentStatus === 'paid' ? 'Paid Online' : 'Settled at Table';

  return (
    <div className="min-h-[720px] rounded-3xl bg-[#fcfbf7] text-stone-900 p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden font-sans border border-[#DDD8C9] shadow-2xl animate-in fade-in duration-300">
      
      {/* Top Resort Branding */}
      <div className="flex flex-col items-center text-center pt-2 space-y-2">
        <div className="p-3 bg-white rounded-2xl shadow-xs border border-[#DDD8C9] inline-block">
          <img
            src="/palilogo.png"
            alt="Pali Resort & Club"
            className="h-12 w-auto object-contain mx-auto"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#163024]/10 text-[#163024] text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-[#c5a86a]" />
          <span>Table {tableNumber} • Fine Dining</span>
        </div>
      </div>

      {/* Center Section: Final Bill Card + Closing Greeting */}
      <div className="my-auto space-y-5 flex flex-col items-center">
        
        {/* Warm Closing Heading */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#163024] tracking-tight">
            Thank You for Dining With Us
          </h2>
          <p className="text-stone-600 text-xs max-w-xs mx-auto">
            It was an absolute pleasure hosting you today at Pali Resort & Club.
          </p>
        </div>

        {/* Final Bill Detailed Card */}
        <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-[#DDD8C9] shadow-md text-left space-y-3.5">
          
          {/* Bill Header */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                Final Bill
              </span>
              <p className="font-mono text-xs font-bold text-stone-800">
                {order ? `#${order.orderNumber}` : `INV-${Date.now().toString().slice(-6)}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {paymentStatus}
              </span>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5">{currentDateFormatted}</p>
            </div>
          </div>

          {/* Items Breakdown */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Items Ordered
            </span>
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-stone-50">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="font-mono text-stone-500 font-semibold">{it.quantity}x</span>
                  <span className="font-medium text-stone-800 truncate">{it.name}</span>
                </div>
                <span className="font-mono text-stone-900 font-semibold shrink-0">
                  ₹{it.price * it.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* Subtotal, Taxes & Tip */}
          <div className="space-y-1 pt-1 border-t border-stone-100 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-mono">₹{subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (5%)</span>
              <span className="font-mono">₹{taxAmount}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between text-[#526B4A]">
                <span>Captain Gratuity</span>
                <span className="font-mono">+₹{tipAmount}</span>
              </div>
            )}
          </div>

          {/* Final Total Amount */}
          <div className="pt-2 border-t border-[#DDD8C9] flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#163024]">
              Total
            </span>
            <span className="font-serif font-bold text-2xl text-[#163024]">
              ₹{(grandTotal ?? 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Payment Status Pill */}
          <div className="flex items-center justify-between text-xs pt-1 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
            <span className="text-stone-500">Payment Status</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{paymentStatus}</span>
            </span>
          </div>

          {/* Detailed Invoice Button */}
          <button
            onClick={onViewDetailedBill}
            className="w-full py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#163024] font-bold text-xs border border-stone-200 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-[#526B4A]" />
              <span>View Detailed Table Invoice</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
          </button>
        </div>

        {/* Resort Heritage Note */}
        <div className="w-full max-w-sm rounded-2xl border border-[#DDD8C9] bg-white p-3.5 text-center space-y-1">
          <div className="flex items-center justify-center gap-1 text-[#c5a86a]">
            <Heart className="w-4 h-4 fill-current" />
          </div>
          <p className="text-xs font-serif italic text-stone-700">
            &ldquo;We look forward to welcoming you back to nature&apos;s sanctuary.&rdquo;
          </p>
          <p className="text-[10px] text-stone-400 font-sans tracking-widest uppercase font-semibold">
            Pali Resort & Club • Nature&apos;s Gateway
          </p>
        </div>

      </div>

      {/* Bottom Actions */}
      <div className="pt-4 flex flex-col items-center space-y-2.5">
        <button
          onClick={onBackToMenu}
          className="w-full max-w-sm py-3.5 px-5 rounded-2xl bg-[#163024] hover:bg-[#11241b] text-white font-bold text-xs tracking-wider uppercase shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
        >
          <Utensils className="w-4 h-4 text-[#dfc78f]" />
          <span>Back to Dining Menu</span>
        </button>

        {onEndSession && (
          <button
            onClick={onEndSession}
            className="text-xs text-stone-500 hover:text-stone-800 underline font-medium cursor-pointer"
          >
            Exit Dining Session
          </button>
        )}
      </div>

    </div>
  );
};
