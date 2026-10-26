import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, TableBill } from '../../types';
import { api, generateIdempotencyKey } from '../../api/client';
import {
  X,
  Receipt,
  Utensils,
  Wine,
  Heart,
  CheckCircle2,
  Clock,
  CreditCard,
  QrCode,
  Banknote,
  Building,
  ShieldCheck,
  Printer,
  Sparkles,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';

interface QRTableBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  onOrderMore?: () => void;
  onPaymentSuccess?: () => void;
}

export const QRTableBillModal: React.FC<QRTableBillModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  onOrderMore,
  onPaymentSuccess
}) => {
  const { getTableBill, updateOrderTip, processTablePayment, requestTableBill } = useApp();
  const [bill, setBill] = useState<TableBill | null>(null);

  // Tip selection
  const [selectedTipType, setSelectedTipType] = useState<'none' | '5%' | '10%' | '15%' | 'custom'>('none');
  const [customTipInput, setCustomTipInput] = useState<string>('');

  // Payment flow
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'confirmed' | 'failed'>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());

  const loadBill = async () => {
    setIsLoadingBill(true);
    setErrorMessage(null);
    try {
      if (api.getGuestToken()) {
        const guestBill = await api.guestGetBill();
        if (guestBill) {
          const subtotalPaise = guestBill.subtotalPaise || 0;
          const cgstPaise = guestBill.cgstPaise ?? 0;
          const sgstPaise = guestBill.sgstPaise ?? 0;
          const grandTotalPaise = guestBill.grandTotalPaise ?? (subtotalPaise + cgstPaise + sgstPaise);

          const mappedBill: TableBill = {
            id: guestBill.id,
            diningSessionId: guestBill.diningSessionId,
            billNumber: guestBill.invoiceNumber || guestBill.billNumber || `BILL-${tableNumber}`,
            orderId: guestBill.id || `ord-${tableNumber}`,
            tableId: `tbl-${tableNumber}`,
            tableNumber: tableNumber,
            restaurantId: guestBill.outletId || 'rest-1',
            restaurantName: 'Pali Resort & Club',
            guestName: 'Valued Guest',
            foodItems: (guestBill.items || []).filter((i: any) => !i.isDrink).map((i: any) => ({
              id: i.id || i.orderItemId,
              menuItemId: i.orderItemId,
              name: i.itemName,
              price: (i.unitPricePaise || 0) / 100,
              quantity: i.quantity,
              isVeg: true,
              status: 'served'
            })),
            barItems: (guestBill.items || []).filter((i: any) => i.isDrink).map((i: any) => ({
              id: i.id || i.orderItemId,
              menuItemId: i.orderItemId,
              name: i.itemName,
              price: (i.unitPricePaise || 0) / 100,
              quantity: i.quantity,
              isVeg: true,
              status: 'served'
            })),
            foodSubtotal: 0,
            barSubtotal: 0,
            subtotal: subtotalPaise / 100,
            taxRate: 5,
            taxAmount: (cgstPaise + sgstPaise) / 100,
            tipAmount: (guestBill.tipPaise || 0) / 100,
            tipType: 'none',
            grandTotal: grandTotalPaise / 100,
            paymentStatus: guestBill.status === 'SETTLED' ? 'paid' : 'pending',
            billStatus: guestBill.status === 'SETTLED' ? 'settled' : 'requested',
            createdAt: guestBill.createdAt || new Date().toISOString(),
            subtotalPaise,
            cgstPaise,
            sgstPaise,
            grandTotalPaise,
            balancePaise: guestBill.balancePaise ?? grandTotalPaise,
            paidPaise: guestBill.paidPaise || 0
          };
          setBill(mappedBill);
          if (guestBill.status === 'SETTLED') {
            setPaymentStatus('confirmed');
          }
          setIsLoadingBill(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Failed to load guest bill from server endpoint:', err);
      setErrorMessage(err.detail || err.message || 'Unable to fetch bill from server. Please retry.');
    }
    setIsLoadingBill(false);

    setBill(null);
    setErrorMessage(previous=>previous||'Verify your guest session before viewing its saved bill.');
  };

  // Load authoritative bill from guest endpoint
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(generateIdempotencyKey());
      loadBill();
    } else {
      setPaymentStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen, tableNumber]);

  if (!isOpen) return null;

  if (!bill) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-[#fcfbf7] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden p-6 space-y-4 text-center font-sans">
          <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
            {isLoadingBill ? <Loader2 className="w-7 h-7 animate-spin text-[#1b382b]" /> : <Receipt className="w-7 h-7" />}
          </div>
          <h3 className="font-serif text-lg font-bold text-stone-800">
            {errorMessage ? 'Error Loading Bill' : 'No Active Orders Yet'}
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            {errorMessage || `Table ${tableNumber} currently has no active dining bill. Browse our menu to place your first order.`}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            {errorMessage && (
              <button
                onClick={loadBill}
                className="px-4 py-2 bg-[#1b382b] hover:bg-[#152e23] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
            >
              Close
            </button>
            {onOrderMore && !errorMessage && (
              <button
                onClick={() => {
                  onClose();
                  onOrderMore();
                }}
                className="px-4 py-2 bg-[#1b382b] hover:bg-[#152e23] text-white rounded-xl text-xs font-bold"
              >
                Browse Menu
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Server-authoritative integer paise figures
  const subtotalPaise = bill.subtotalPaise ?? Math.round(bill.subtotal * 100);
  const cgstPaise = bill.cgstPaise ?? Math.round((subtotalPaise * 25) / 1000);
  const sgstPaise = bill.sgstPaise ?? Math.round((subtotalPaise * 25) / 1000);
  const totalGstPaise = cgstPaise + sgstPaise;
  const grandTotalPaise = bill.grandTotalPaise ?? (subtotalPaise + totalGstPaise);

  // UI divides by 100 for display only
  const subtotal = subtotalPaise / 100;
  const cgst = cgstPaise / 100;
  const sgst = sgstPaise / 100;
  const totalGst = totalGstPaise / 100;
  const grandTotal = grandTotalPaise / 100;

  const handlePayNow = async () => {
    setPaymentStatus('failed');
    setErrorMessage('Online payments are blocked - CLIENT API REQUIRED. Please ask an authorized cashier to record cash received.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="bg-[#fcfbf7] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom duration-200 font-sans">
        
        {/* Header */}
        <div className="bg-[#1b382b] text-[#f7f4ec] px-5 py-4 flex items-center justify-between border-b border-[#2b4d3c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 flex items-center justify-center text-[#dfc78f]">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold tracking-wide">Dining Bill & Receipt</h3>
              <p className="text-[11px] text-[#dfc78f]">
                Table {bill.tableNumber} • {bill.billNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Confirmed Receipt View */}
          {paymentStatus === 'confirmed' ? (
            <div className="space-y-4 text-center py-2 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Payment Settled Successfully
                </span>
                <h3 className="font-serif text-2xl font-bold text-stone-900 pt-1">
                  ₹{grandTotal}
                </h3>
                <p className="text-xs text-stone-500">
                  Paid via {paymentMethod.toUpperCase()} • Txn: {transactionId || 'TXN-SETTLED'}
                </p>
                <p className="text-[11px] text-stone-400">
                  Thank you for dining at {bill.restaurantName}! Your table captain has been notified.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 text-left space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Dining Table</span>
                  <span className="font-bold text-stone-900">{bill.tableNumber}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Guest Name</span>
                  <span className="font-medium text-stone-800">{bill.guestName}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Bill Number</span>
                  <span className="font-mono font-bold text-stone-800">{bill.billNumber}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Items</span>
                  <span>{bill.foodItems.length + bill.barItems.length} delicacies</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Gross Subtotal</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Central GST (2.5% CGST)</span>
                  <span className="font-mono">₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>State GST (2.5% SGST)</span>
                  <span className="font-mono">₹{sgst.toFixed(2)}</span>
                </div>
                <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-stone-900 text-sm">
                  <span>Amount Paid</span>
                  <span className="font-mono text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-stone-300"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    if (onPaymentSuccess) {
                      onPaymentSuccess();
                    }
                  }}
                  className="flex-1 py-2.5 px-3 bg-[#1b382b] hover:bg-[#152e23] text-white rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Restaurant & Bill Info */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e8e1cf] text-xs">
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#1b382b]">{bill.restaurantName}</h4>
                  <p className="text-[11px] text-stone-500 font-sans">
                    Table: <span className="font-bold text-stone-800">{bill.tableNumber}</span> • {bill.guestName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-stone-700 text-xs block">{bill.billNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                    {bill.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
              </div>

              {/* Food Items Breakdown */}
              {bill.foodItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-stone-200">
                    <span className="flex items-center gap-1.5 text-[#1b382b]">
                      <Utensils className="w-3.5 h-3.5 text-[#c5a86a]" />
                      <span>Food Items ({bill.foodItems.length})</span>
                    </span>
                    <span className="font-mono">₹{bill.foodSubtotal}</span>
                  </div>
                  <div className="space-y-1.5 divide-y divide-stone-100">
                    {bill.foodItems.map(item => (
                      <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          <span className="font-medium text-stone-800">{item.name}</span>
                          <span className="text-stone-400 font-mono">×{item.quantity}</span>
                        </div>
                        <span className="font-mono font-semibold text-stone-800">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bar Items Breakdown */}
              {bill.barItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-stone-200">
                    <span className="flex items-center gap-1.5 text-[#1b382b]">
                      <Wine className="w-3.5 h-3.5 text-[#c5a86a]" />
                      <span>Bar & Drinks ({bill.barItems.length})</span>
                    </span>
                    <span className="font-mono">₹{bill.barSubtotal}</span>
                  </div>
                  <div className="space-y-1.5 divide-y divide-stone-100">
                    {bill.barItems.map(item => (
                      <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#526B4A]" />
                          <span className="font-medium text-stone-800">{item.name}</span>
                          <span className="text-stone-400 font-mono">×{item.quantity}</span>
                        </div>
                        <span className="font-mono font-semibold text-stone-800">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Calculation Summary (Server integer paise / 100) */}
              <div className="p-4 bg-white rounded-2xl border border-[#e8e1cf] space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Gross Subtotal</span>
                  <span className="font-mono font-bold">₹{(subtotalPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Central GST (2.5% CGST)</span>
                  <span className="font-mono font-bold">₹{(cgstPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>State GST (2.5% SGST)</span>
                  <span className="font-mono font-bold">₹{(sgstPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#526B4A] font-medium text-[11px]">
                  <span>Total Statutory GST (5%)</span>
                  <span className="font-mono font-bold text-[#526B4A]">₹{(totalGstPaise / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-[#e8e1cf] pt-2 flex justify-between font-bold text-stone-900 text-sm">
                  <div>
                    <span className="block font-serif text-base">Grand Total</span>
                    <span className="text-[10px] text-stone-400 font-normal">Authoritative server total</span>
                  </div>
                  <span className="font-mono font-black text-[#1b382b] text-base">₹{(grandTotalPaise / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods Selection */}
              {bill.paymentStatus !== 'paid' && (
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
                    Select Payment Method
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'upi', label: 'UPI / QR', icon: QrCode },
                      { id: 'card', label: 'Card / POS', icon: CreditCard },
                      { id: 'cash', label: 'Cash to Waiter', icon: Banknote },
                      { id: 'room-charge', label: 'Room Charge', icon: Building }
                    ].map(method => {
                      const Icon = method.icon;
                      const active = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                            active
                              ? 'bg-[#1b382b] text-[#f7f4ec] border-[#1b382b] shadow-xs'
                              : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[11px] font-bold">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={paymentStatus === 'processing'}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] shrink-0 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Actions */}
        {paymentStatus !== 'confirmed' && bill.paymentStatus !== 'paid' && (
          <div className="p-4 bg-white border-t border-[#e8e1cf] shrink-0">
            <button
              onClick={handlePayNow}
              disabled={paymentStatus === 'processing'}
              className="w-full py-3.5 px-4 bg-[#1b382b] hover:bg-[#152e23] active:scale-[0.99] text-[#f7f4ec] font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-between border border-[#c5a86a]/40 transition-all cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                {paymentStatus === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#c5a86a]" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#c5a86a]" />
                    <span>Pay Now via {paymentMethod.toUpperCase()}</span>
                  </>
                )}
              </span>
              <span className="font-mono text-sm font-bold text-[#dfc78f]">
                ₹{grandTotal}
              </span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
