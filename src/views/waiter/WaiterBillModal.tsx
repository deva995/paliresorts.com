import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  X,
  Receipt,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Hotel,
  ShieldCheck,
  RefreshCw,
  DollarSign
} from 'lucide-react';

interface WaiterBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  onSettled?: (message: string) => void;
}

export const WaiterBillModal: React.FC<WaiterBillModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  onSettled
}) => {
  const {
    tables,
    currentUser,
    activeRestaurantId,
    settlementRequests,
    requestSettlementForSession,
    settleTableBill,
    fetchSettlementRequests
  } = useApp();

  const [bill, setBill] = useState<any>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Settlement Request inputs (for waiter)
  const [preferredMethod, setPreferredMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO'>('CASH');
  const [notes, setNotes] = useState('');

  // Direct Settlement inputs (for cashier / manager / owner)
  const [tenderMethod, setTenderMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'ROOM_FOLIO'>('CASH');
  const [amountTendered, setAmountTendered] = useState<string>('');

  const outlet = currentUser.role === 'SUPER_ADMIN' ? activeRestaurantId : (currentUser.restaurantId || activeRestaurantId);
  const table = tables.find(t => t.restaurantId === outlet && t.number === tableNumber);

  // Check if current user has billing / settlement authority
  const canSettle = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'RESTAURANT_OWNER' || currentUser.role === 'CASHIER') return true;
    const perms = currentUser.permissions || [];
    return perms.includes('bill:settle') || perms.includes('payment:process');
  }, [currentUser]);

  // Check if there is an active settlement request for this table
  const activeRequest = useMemo(() => {
    if (!tableNumber || !settlementRequests) return null;
    return settlementRequests.find(
      sr => sr.tableNumber === tableNumber && (sr.status === 'PENDING' || sr.status === 'ACCEPTED')
    );
  }, [tableNumber, settlementRequests]);

  const fetchBill = async () => {
    if (!table?.activeSessionId) {
      setError('No active sitting is available for this table.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const savedBills = await api.request<any[]>(`/dining-sessions/${table.activeSessionId}/bills`).catch(() => []);
      const activeBill = Array.isArray(savedBills) ? savedBills.find((b: any) => b.status !== 'VOIDED') : null;
      const result = activeBill
        ? await api.request(`/bills/${activeBill.id}`)
        : await api.request(`/dining-sessions/${table.activeSessionId}/bill-preview`);
      
      setBill(result);
      if (result) {
        const bal = (result.balancePaise ?? result.grandTotalPaise ?? 0) / 100;
        setAmountTendered(bal > 0 ? bal.toFixed(2) : '0.00');
      }
    } catch (e: any) {
      setError(e.detail || e.message || 'Unable to load bill details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setBill(null);
      setError('');
      setSuccessMessage('');
      setNotes('');
      return;
    }
    fetchBill();
    fetchSettlementRequests(outlet).catch(() => {});
  }, [isOpen, table?.activeSessionId, outlet]);

  if (!isOpen) return null;

  const money = (n: number | undefined | null) => {
    const val = Number(n || 0);
    return `₹${(val / 100).toFixed(2)}`;
  };

  const balancePaise = bill ? (bill.balancePaise ?? bill.grandTotalPaise ?? 0) : 0;
  const tenderedPaise = Math.round(Number(amountTendered || 0) * 100);
  const changeDuePaise = tenderMethod === 'CASH' && tenderedPaise > balancePaise ? tenderedPaise - balancePaise : 0;

  // Handle Waiter Request Settlement
  const handleRequestSettlement = async () => {
    if (!table?.activeSessionId) {
      setError('Active dining session not found for this table.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await requestSettlementForSession(table.activeSessionId, {
        paymentMethodPreference: preferredMethod,
        notes: notes.trim() || undefined
      });

      if (res.success) {
        setSuccessMessage(`Settlement requested for Table ${tableNumber}! Cashier notified.`);
        await fetchSettlementRequests(outlet);
      } else {
        setError(res.error || 'Failed to request settlement.');
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to dispatch settlement request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Direct Cashier / Owner Settlement
  const handleDirectSettlement = async () => {
    if (!table?.activeSessionId && !tableNumber) {
      setError('Table context missing.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const tenderedAmount = Number(amountTendered) || (balancePaise / 100);
      const res = await settleTableBill(
        table?.number || tableNumber,
        tenderMethod.toLowerCase() as any,
        tenderedAmount
      );

      if (res.success) {
        setSuccessMessage(`Table ${tableNumber} settled successfully! Payment recorded and table released.`);
        if (onSettled) onSettled(`Table ${tableNumber} settled`);
        await fetchBill();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'Settlement failed.');
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to execute settlement transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150 font-sans">
      <div
        role="dialog"
        aria-label={`Table ${tableNumber} Billing & Settlement`}
        className="bg-white rounded-2xl max-w-lg w-full border border-[#DDD8C9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 bg-[#163024] text-[#F7F4EC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#C5A86A]" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base text-[#F7F4EC]">
                  Table {tableNumber} • Bill & Settlement
                </h3>
                {activeRequest && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      activeRequest.status === 'PENDING'
                        ? 'bg-amber-400 text-stone-900'
                        : activeRequest.status === 'ACCEPTED'
                        ? 'bg-blue-400 text-white'
                        : 'bg-emerald-400 text-stone-900'
                    }`}
                  >
                    {activeRequest.status === 'PENDING' ? 'Cashier Requested' : activeRequest.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#DDD8C9] mt-0.5">
                {bill?.invoiceNumber ? `Invoice #${bill.invoiceNumber}` : 'Active Sitting • Pre-Bill Preview'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close billing modal"
            className="p-1.5 rounded-xl text-[#DDD8C9] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts / Error & Success Banners */}
        {error && (
          <div role="alert" className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2.5 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-[#2D5A3D] text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C5A86A] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-[#1D241F]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C5A86A]" />
              <p className="text-xs font-medium">Loading authoritative bill calculation...</p>
            </div>
          ) : !bill ? (
            <div className="py-8 text-center text-stone-500 text-xs">
              <p>No bill data available for this table.</p>
            </div>
          ) : (
            <>
              {/* Itemized Snapshot Card */}
              <div className="bg-[#F7F4EC] p-3.5 rounded-xl border border-[#DDD8C9] space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-1.5">
                  <span className="text-[11px] font-bold text-[#163024] uppercase tracking-wider">
                    Itemized Order Snapshot
                  </span>
                  <span className="text-[11px] text-[#687067] font-medium">
                    {bill.items?.length || 0} items
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-[#DDD8C9]/50 text-xs pr-1">
                  {bill.items?.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-white border border-[#DDD8C9] font-bold text-[11px] flex items-center justify-center text-[#163024]">
                          {item.quantity}
                        </span>
                        <div>
                          <span className="font-semibold text-[#163024]">{item.itemName || item.name}</span>
                          {item.portion && (
                            <span className="text-[10px] text-[#687067] ml-1.5">({item.portion})</span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-medium text-[#163024]">
                        {money(item.totalPricePaise)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bill Breakdown */}
                <div className="border-t border-[#DDD8C9] pt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-[#687067]">
                    <span>Subtotal:</span>
                    <span className="font-mono text-[#163024]">{money(bill.subtotalPaise)}</span>
                  </div>
                  {Number(bill.discountPaise || 0) > 0 && (
                    <div className="flex justify-between text-emerald-800 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">-{money(bill.discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#687067]">
                    <span>CGST (2.5%):</span>
                    <span className="font-mono text-[#163024]">{money(bill.cgstPaise)}</span>
                  </div>
                  <div className="flex justify-between text-[#687067]">
                    <span>SGST (2.5%):</span>
                    <span className="font-mono text-[#163024]">{money(bill.sgstPaise)}</span>
                  </div>
                  {Number(bill.roundingPaise || 0) !== 0 && (
                    <div className="flex justify-between text-[#687067]">
                      <span>Rounding:</span>
                      <span className="font-mono text-[#163024]">{money(bill.roundingPaise)}</span>
                    </div>
                  )}
                  <div className="border-t border-[#DDD8C9] pt-1.5 flex justify-between items-center text-sm font-bold text-[#163024]">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-[#163024]">{money(bill.grandTotalPaise)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold pt-0.5">
                    <span className="text-[#687067]">Outstanding Balance:</span>
                    <span className={`font-mono ${balancePaise === 0 ? 'text-emerald-700' : 'text-amber-800 font-bold'}`}>
                      {money(balancePaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION MODE 1: Direct Cashier / Manager Settlement */}
              {canSettle ? (
                <div className="bg-white p-3.5 rounded-xl border border-[#C5A86A]/60 shadow-xs space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#163024] uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-[#2D5A3D]" />
                    <span>Authorized Cashier Settlement</span>
                  </div>

                  {balancePaise === 0 ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>This bill is fully settled. Table can be released when guests depart.</span>
                    </div>
                  ) : (
                    <>
                      {/* Tender Selector */}
                      <div>
                        <label className="text-[11px] font-semibold text-[#687067] block mb-1">
                          Payment Method:
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'CASH', label: 'Cash', icon: Banknote },
                            { id: 'UPI', label: 'UPI', icon: QrCode },
                            { id: 'CARD', label: 'Card', icon: CreditCard },
                            { id: 'ROOM_FOLIO', label: 'Folio', icon: Hotel }
                          ].map(t => {
                            const Icon = t.icon;
                            const isSelected = tenderMethod === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setTenderMethod(t.id as any)}
                                className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#163024] text-[#C5A86A] border-[#163024]'
                                    : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-stone-200'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-[10px]">{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Cash Tender & Change Calculation */}
                      {tenderMethod === 'CASH' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[#687067]">
                              Amount Tendered (₹):
                            </label>
                            {changeDuePaise > 0 && (
                              <span className="text-[11px] font-bold text-emerald-700">
                                Change Due: {money(changeDuePaise)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="1"
                              min={(balancePaise / 100).toFixed(2)}
                              value={amountTendered}
                              onChange={e => setAmountTendered(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-lg text-xs font-mono font-bold text-[#163024] focus:outline-none focus:ring-1 focus:ring-[#C5A86A]"
                              placeholder={(balancePaise / 100).toFixed(2)}
                            />
                            <button
                              type="button"
                              onClick={() => setAmountTendered((balancePaise / 100).toFixed(2))}
                              className="px-2.5 py-1 text-[11px] font-bold bg-[#DDD8C9]/50 hover:bg-[#DDD8C9] text-[#163024] rounded-lg transition-colors cursor-pointer"
                            >
                              Exact
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleDirectSettlement}
                        disabled={submitting}
                        className="w-full py-2.5 bg-[#2D5A3D] hover:bg-[#1f402a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Recording Payment...</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4 text-[#C5A86A]" />
                            <span>Confirm {money(balancePaise)} Settlement</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* ACTION MODE 2: Floor Waiter Settlement Request Workflow */
                <div className="bg-white p-3.5 rounded-xl border border-[#DDD8C9] shadow-xs space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#163024] uppercase tracking-wider">
                    <Send className="w-4 h-4 text-[#526B4A]" />
                    <span>Cashier Settlement Request</span>
                  </div>

                  {activeRequest ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-900 font-bold">
                        <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                        <span>
                          {activeRequest.status === 'PENDING'
                            ? 'Settlement request is pending in Cashier inbox'
                            : 'Settlement request accepted by Cashier'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Requested by {activeRequest.requestedByStaffName || 'Floor Server'} with{' '}
                        <strong>{activeRequest.paymentMethodPreference || 'CASH'}</strong> tender preference.
                      </p>
                      <div className="text-[10px] text-amber-700 bg-amber-100/60 p-2 rounded">
                        Duplicate submission is disabled. Cashier has received this sitting's bill totals and will process receipt shortly.
                      </div>
                    </div>
                  ) : balancePaise === 0 ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>This table is already fully settled. No action required.</span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-[#687067] block">
                          Guest Payment Preference:
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'CASH', label: 'Cash', icon: Banknote },
                            { id: 'UPI', label: 'UPI', icon: QrCode },
                            { id: 'CARD', label: 'Card', icon: CreditCard },
                            { id: 'ROOM_FOLIO', label: 'Folio', icon: Hotel }
                          ].map(t => {
                            const Icon = t.icon;
                            const isSelected = preferredMethod === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setPreferredMethod(t.id as any)}
                                className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#163024] text-[#C5A86A] border-[#163024]'
                                    : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-stone-200'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-[10px]">{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#687067] block mb-1">
                          Server Note to Cashier (Optional):
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="e.g. Guest needs change for ₹500, split request, etc."
                          className="w-full px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-lg text-xs text-[#163024] focus:outline-none focus:ring-1 focus:ring-[#C5A86A]"
                          maxLength={150}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestSettlement}
                        disabled={submitting || Boolean(activeRequest)}
                        className="w-full py-2.5 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#C5A86A]" />
                            <span>Sending to Cashier...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-[#C5A86A]" />
                            <span>Request Settlement / Send to Cashier</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F7F4EC] border-t border-[#DDD8C9] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
