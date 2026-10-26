import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Coins,
  CheckCircle2,
  Lock,
  QrCode,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { PaymentMethod } from '../../types';
import { CartLineItem } from './QRCartDrawer';

interface QRPaymentViewProps {
  tableNumber: string;
  guestName: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  itemCount: number;
  items?: CartLineItem[];
  onBack: () => void;
  onConfirmPayment: (method: PaymentMethod, notes?: string) => Promise<void>;
}

export const QRPaymentView: React.FC<QRPaymentViewProps> = ({
  tableNumber,
  guestName,
  totalAmount,
  subtotal,
  taxAmount,
  tipAmount,
  itemCount,
  items = [],
  onBack,
  onConfirmPayment
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'qr'>('gpay');
  const [savePaymentMethod, setSavePaymentMethod] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [showItemsList, setShowItemsList] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const handlePay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirmPayment(selectedMethod);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-stone-900 pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 p-1 -ml-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-stone-700" />
          <span>Back to Cart</span>
        </button>

        <div className="flex items-center gap-1 px-3 py-1 bg-[#163024] text-[#dfc78f] rounded-full text-xs font-bold font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#c5a86a]" />
          <span>Table {tableNumber}</span>
        </div>
      </div>

      {/* Title & Subheading */}
      <div>
        <h2 className="text-xl font-serif font-bold text-[#163024] leading-tight">
          Payment Method
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Choose a secure payment option to complete your order
        </p>
      </div>

      {/* Order Amount Highlight Card */}
      <div className="p-4 bg-white rounded-2xl border border-[#DDD8C9] shadow-xs space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
              Total Order Amount
            </span>
            <div className="text-2xl font-serif font-bold text-[#163024]">
              ₹{(totalAmount ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-stone-500">{itemCount} items ordered</span>
            <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
              <Lock className="w-3 h-3" />
              <span>256-bit Encrypted</span>
            </div>
          </div>
        </div>

        {/* Itemized Order Summary */}
        {items.length > 0 && (
          <div className="pt-1 pb-2 border-b border-stone-100">
            <button
              type="button"
              onClick={() => setShowItemsList(!showItemsList)}
              className="w-full flex items-center justify-between text-xs text-stone-700 hover:text-stone-900 font-semibold py-1 cursor-pointer"
            >
              <span>View Order Items ({items.length})</span>
              <span className="text-[11px] text-[#526B4A] font-bold">
                {showItemsList ? 'Hide ▲' : 'Show ▼'}
              </span>
            </button>

            {showItemsList && (
              <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto">
                {items.map(line => (
                  <div key={line.id} className="flex items-center justify-between text-xs text-stone-700 py-1 border-b border-stone-50">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${line.item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      <span className="font-medium truncate">
                        {line.quantity}x {line.item.name}
                        {line.selectedPortion && line.selectedPortion.label !== 'Standard' && (
                          <span className="text-[10px] text-stone-400 font-normal"> ({line.selectedPortion.label})</span>
                        )}
                      </span>
                    </div>
                    <span className="font-mono text-stone-900 font-semibold shrink-0">
                      ₹{line.unitPrice * line.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Small Breakdown */}
        <div className="text-xs text-stone-600 space-y-1 pt-1">
          <div className="flex justify-between">
            <span>Items Subtotal</span>
            <span className="font-mono">₹{subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (5%)</span>
            <span className="font-mono">₹{taxAmount}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex justify-between text-[#526B4A] font-medium">
              <span>Captain Gratuity / Tip</span>
              <span className="font-mono">+₹{tipAmount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Options Selection */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 px-1">
          Select Payment Option
        </h3>

        {/* OPTION 1: UPI (Recommended) */}
        <div
          onClick={() => setSelectedMethod('upi')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedMethod === 'upi'
              ? 'bg-white border-[#163024] shadow-md ring-1 ring-[#163024]'
              : 'bg-white border-[#DDD8C9] hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-black text-xs">
                UPI
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-stone-900">UPI Instant Pay</h4>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Google Pay, PhonePe, Paytm, BHIM & QR
                </p>
              </div>
            </div>

            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedMethod === 'upi'
                  ? 'border-[#163024] bg-[#163024] text-white'
                  : 'border-stone-300'
              }`}
            >
              {selectedMethod === 'upi' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* Sub-options for UPI */}
          {selectedMethod === 'upi' && (
            <div className="mt-3.5 pt-3.5 border-t border-stone-100 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'gpay', name: 'Google Pay', icon: 'GPay' },
                  { id: 'phonepe', name: 'PhonePe', icon: 'PhPe' },
                  { id: 'paytm', name: 'Paytm', icon: 'Paytm' },
                  { id: 'bhim', name: 'BHIM UPI', icon: 'BHIM' }
                ].map(app => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUpiApp(app.id as any);
                      setShowUpiQr(false);
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      selectedUpiApp === app.id && !showUpiQr
                        ? 'bg-[#163024] text-[#dfc78f] border-[#163024] shadow-xs'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </div>

              {/* Show Table QR Code toggle */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUpiQr(!showUpiQr);
                  }}
                  className="text-xs text-[#526B4A] hover:text-[#163024] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#526B4A]" />
                  <span>{showUpiQr ? 'Hide Table QR Code' : 'Scan & Pay via Table UPI QR'}</span>
                </button>
              </div>

              {showUpiQr && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center space-y-2">
                  <div className="w-36 h-36 mx-auto bg-white p-2.5 rounded-xl border border-stone-300 shadow-xs flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=paliclub@axisbank&pn=PaliResort&am=${totalAmount}&tn=Table${tableNumber}`}
                      alt="UPI QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[11px] text-stone-600 font-mono">
                    Scan with any UPI app to pay ₹{totalAmount}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OPTION 2: Credit / Debit Card */}
        <div
          onClick={() => setSelectedMethod('card')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedMethod === 'card'
              ? 'bg-white border-[#163024] shadow-md ring-1 ring-[#163024]'
              : 'bg-white border-[#DDD8C9] hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">Credit / Debit Card</h4>
                <p className="text-[11px] text-stone-500">
                  Visa, MasterCard, RuPay & Amex
                </p>
              </div>
            </div>

            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedMethod === 'card'
                  ? 'border-[#163024] bg-[#163024] text-white'
                  : 'border-stone-300'
              }`}
            >
              {selectedMethod === 'card' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {selectedMethod === 'card' && (
            <div className="mt-3.5 pt-3.5 border-t border-stone-100 space-y-3" onClick={e => e.stopPropagation()}>
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  maxLength={19}
                  placeholder="4532 •••• •••• 8920"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  className="w-full bg-[#fcfbf7] border border-stone-300 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-[#163024]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                    Valid Thru (MM/YY)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="08/29"
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                    className="w-full bg-[#fcfbf7] border border-stone-300 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-[#163024]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                    CVV
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="•••"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value)}
                    className="w-full bg-[#fcfbf7] border border-stone-300 rounded-xl py-2 px-3 text-xs font-mono outline-none focus:border-[#163024]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OPTION 3: Net Banking */}
        <div
          onClick={() => setSelectedMethod('netbanking')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedMethod === 'netbanking'
              ? 'bg-white border-[#163024] shadow-md ring-1 ring-[#163024]'
              : 'bg-white border-[#DDD8C9] hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">Net Banking</h4>
                <p className="text-[11px] text-stone-500">
                  HDFC, ICICI, SBI, Axis & all Indian banks
                </p>
              </div>
            </div>

            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedMethod === 'netbanking'
                  ? 'border-[#163024] bg-[#163024] text-white'
                  : 'border-stone-300'
              }`}
            >
              {selectedMethod === 'netbanking' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>
        </div>

        {/* OPTION 4: Pay at Table / Cash to Waiter */}
        <div
          onClick={() => setSelectedMethod('cash')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedMethod === 'cash'
              ? 'bg-white border-[#163024] shadow-md ring-1 ring-[#163024]'
              : 'bg-white border-[#DDD8C9] hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                <Coins className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">Pay at Table</h4>
                <p className="text-[11px] text-stone-500">
                  Pay cash or card to table captain after your meal
                </p>
              </div>
            </div>

            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                selectedMethod === 'cash'
                  ? 'border-[#163024] bg-[#163024] text-white'
                  : 'border-stone-300'
              }`}
            >
              {selectedMethod === 'cash' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>
        </div>
      </div>

      {/* Save Payment Method Checkbox */}
      <label className="flex items-center gap-2.5 px-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={savePaymentMethod}
          onChange={e => setSavePaymentMethod(e.target.checked)}
          className="w-4 h-4 rounded text-[#163024] focus:ring-[#163024] border-stone-300"
        />
        <span className="text-xs text-stone-600">
          Save this payment method for faster checkout next time
        </span>
      </label>

      {/* Sticky Bottom Pay Action */}
      <div className="fixed bottom-4 inset-x-4 sm:max-w-md sm:mx-auto z-40">
        <button
          id="btn-pay-securely"
          type="button"
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#163024] to-[#234b39] text-[#f7f4ec] font-bold text-sm shadow-2xl hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-between border border-[#c5a86a]/40 cursor-pointer disabled:opacity-60"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#dfc78f]" />
            <span>{selectedMethod === 'cash' ? 'Confirm Order • Pay at Table' : 'Pay Now'}</span>
          </div>

          <div className="flex items-center gap-1 font-mono text-base text-[#dfc78f] font-bold">
            <span>₹{(totalAmount ?? 0).toLocaleString('en-IN')}</span>
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        </button>
      </div>
    </div>
  );
};
