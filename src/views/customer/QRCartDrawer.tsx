import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { X, Trash2, Plus, Minus, ChefHat, ArrowRight, ShieldCheck, Sparkles, Utensils, Wine, Heart } from 'lucide-react';

export interface CartLineItem {
  id: string; // unique line id
  item: MenuItem;
  quantity: number;
  selectedPortion?: { label: string; price: number };
  notes?: string;
  unitPrice: number;
}

interface QRCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLineItem[];
  onUpdateQty: (lineId: string, delta: number) => void;
  onRemoveItem: (lineId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (
    notes: string,
    guestName: string
  ) => Promise<void> | void;
  tableNumber: string;
  guestName: string;
  taxRate?: number;
  activeRound?: number;
  isRepeatOrder?: boolean;
  errorMessage?: string | null;
  isPlacingOrder?: boolean;
}

export const QRCartDrawer: React.FC<QRCartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  tableNumber,
  guestName,
  taxRate = 5,
  activeRound = 1,
  isRepeatOrder = false,
  errorMessage = null,
  isPlacingOrder = false,
}) => {
  const [specialNotes, setSpecialNotes] = useState('');
  const [customGuestName, setCustomGuestName] = useState(guestName || 'Resort Guest');
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const isSubmitting = isSubmittingLocal || isPlacingOrder;
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Tip Selection State (Default: No Tip)
  const [selectedTipType, setSelectedTipType] = useState<'none' | '5%' | '10%' | '15%' | 'custom'>('none');
  const [customTipInput, setCustomTipInput] = useState<string>('');

  if (!isOpen) return null;

  const effectiveTaxRate = typeof taxRate === 'number' ? taxRate : 5;

  // Food vs Bar separation
  const foodLines = cart.filter(
    line => line.item.menuType !== 'drink' &&
      !line.item.categoryId?.includes('spirit') &&
      !line.item.categoryId?.includes('beer') &&
      !line.item.categoryId?.includes('wine') &&
      !line.item.categoryId?.includes('cocktail')
  );
  const barLines = cart.filter(
    line => line.item.menuType === 'drink' ||
      line.item.categoryId?.includes('spirit') ||
      line.item.categoryId?.includes('beer') ||
      line.item.categoryId?.includes('wine') ||
      line.item.categoryId?.includes('cocktail')
  );

  const foodSubtotal = foodLines.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0);
  const barSubtotal = barLines.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0);
  const subtotal = foodSubtotal + barSubtotal;
  const gstAmount = Math.round(subtotal * (effectiveTaxRate / 100));

  // Compute Tip Amount
  let calculatedTip = 0;
  let tipPercentageNum: number | undefined = undefined;
  if (selectedTipType === '5%') {
    calculatedTip = Math.round(subtotal * 0.05);
    tipPercentageNum = 5;
  } else if (selectedTipType === '10%') {
    calculatedTip = Math.round(subtotal * 0.10);
    tipPercentageNum = 10;
  } else if (selectedTipType === '15%') {
    calculatedTip = Math.round(subtotal * 0.15);
    tipPercentageNum = 15;
  } else if (selectedTipType === 'custom') {
    const parsed = parseInt(customTipInput, 10);
    calculatedTip = !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }

  const grandTotal = subtotal + gstAmount + calculatedTip;

  const handleSubmit = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmittingLocal(true);
    try {
      await onPlaceOrder(specialNotes, customGuestName);
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="bg-[#fcfbf7] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Drawer Header */}
        <div className="bg-[#163024] text-[#F7F4EC] px-5 py-4 flex items-center justify-between border-b border-[#234b39] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 flex items-center justify-center text-[#dfc78f]">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold tracking-wide">Your Selection</h3>
              <p className="text-[11px] text-[#dfc78f] font-sans">
                Table {tableNumber} • {cart.length} item{cart.length !== 1 ? 's' : ''} ({foodLines.length} Food, {barLines.length} Bar)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-[11px] text-stone-300 hover:text-rose-300 font-sans px-2 py-1 rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 font-sans">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
              <X className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 bg-stone-100 text-stone-400 rounded-full mx-auto flex items-center justify-center">
                <ChefHat className="w-6 h-6" />
              </div>
              <h4 className="font-serif text-lg font-bold text-stone-800">Your tray is empty</h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Explore our food and beverage menus to select handcrafted delicacies for your table.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-[#1b382b] text-[#f7f4ec] rounded-xl text-xs font-bold font-sans uppercase tracking-wider"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              {/* Food Section (if any) */}
              {foodLines.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-[#e8e1cf]">
                    <span className="flex items-center gap-1.5 text-[#1b382b]">
                      <Utensils className="w-3.5 h-3.5 text-[#c5a86a]" />
                      <span>Food Items ({foodLines.length})</span>
                    </span>
                    <span className="font-mono text-stone-800">₹{foodSubtotal}</span>
                  </div>
                  <div className="space-y-2.5">
                    {foodLines.map(line => {
                      const lineTotal = line.unitPrice * line.quantity;
                      return (
                        <div
                          key={line.id}
                          className="p-3 bg-white rounded-2xl border border-[#e8e1cf] flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img
                              src={line.item.image}
                              alt={line.item.name}
                              className="w-13 h-13 rounded-xl object-cover shrink-0 border border-stone-200"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${line.item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                                <h4 className="font-sans font-bold text-xs text-stone-900 truncate">
                                  {line.item.name}
                                </h4>
                              </div>

                              {line.selectedPortion && line.selectedPortion.label !== 'Standard' && (
                                <span className="text-[10px] font-semibold text-[#1b382b] bg-[#1b382b]/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                  {line.selectedPortion.label}
                                </span>
                              )}

                              {line.notes && (
                                <p className="text-[10px] text-stone-500 line-clamp-1 italic mt-0.5">
                                  {line.notes}
                                </p>
                              )}

                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-xs font-bold text-stone-900">
                                  ₹{lineTotal}
                                </span>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  (₹{line.unitPrice} ea)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-[#f7f4ec] border border-[#e8e1cf] rounded-xl p-0.5">
                              <button
                                onClick={() => onUpdateQty(line.id, -1)}
                                className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 cursor-pointer active:scale-95 transition-all"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-xs text-stone-900">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQty(line.id, 1)}
                                className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 cursor-pointer active:scale-95 transition-all"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => onRemoveItem(line.id)}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bar Section (if any) */}
              {barLines.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-[#e8e1cf]">
                    <span className="flex items-center gap-1.5 text-[#1b382b]">
                      <Wine className="w-3.5 h-3.5 text-[#c5a86a]" />
                      <span>Bar & Beverages ({barLines.length})</span>
                    </span>
                    <span className="font-mono text-stone-800">₹{barSubtotal}</span>
                  </div>
                  <div className="space-y-2.5">
                    {barLines.map(line => {
                      const lineTotal = line.unitPrice * line.quantity;
                      return (
                        <div
                          key={line.id}
                          className="p-3 bg-white rounded-2xl border border-[#e8e1cf] flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img
                              src={line.item.image}
                              alt={line.item.name}
                              className="w-13 h-13 rounded-xl object-cover shrink-0 border border-stone-200"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0 bg-[#526B4A]" />
                                <h4 className="font-sans font-bold text-xs text-stone-900 truncate">
                                  {line.item.name}
                                </h4>
                              </div>

                              {line.selectedPortion && (
                                <span className="text-[10px] font-semibold text-[#163024] bg-[#526B4A]/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                  {line.selectedPortion.label}
                                </span>
                              )}

                              {line.notes && (
                                <p className="text-[10px] text-stone-500 line-clamp-1 italic mt-0.5">
                                  {line.notes}
                                </p>
                              )}

                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-xs font-bold text-stone-900">
                                  ₹{lineTotal}
                                </span>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  (₹{line.unitPrice} ea)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-[#f7f4ec] border border-[#e8e1cf] rounded-xl p-0.5">
                              <button
                                onClick={() => onUpdateQty(line.id, -1)}
                                className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 cursor-pointer active:scale-95 transition-all"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-xs text-stone-900">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQty(line.id, 1)}
                                className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 cursor-pointer active:scale-95 transition-all"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => onRemoveItem(line.id)}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guest Name & Cooking Preferences */}
              <div className="pt-2 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                      Guest / Party Name
                    </label>
                    <input
                      type="text"
                      value={customGuestName}
                      onChange={e => setCustomGuestName(e.target.value)}
                      placeholder="e.g. Mr. Rajesh"
                      className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#1b382b] rounded-xl text-xs text-stone-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                      Dining Table
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`Table ${tableNumber}`}
                      className="w-full px-3 py-2 bg-stone-100 border border-[#e8e1cf] rounded-xl text-xs font-mono font-bold text-stone-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Special Kitchen / Bar Notes
                  </label>
                  <input
                    type="text"
                    value={specialNotes}
                    onChange={e => setSpecialNotes(e.target.value)}
                    placeholder="e.g. Serve starters first, less spice in curries, ice on the side"
                    className="w-full px-3 py-2 bg-white border border-[#e8e1cf] focus:border-[#1b382b] rounded-xl text-xs text-stone-800 outline-none"
                  />
                </div>
              </div>

              {/* Tip Selection (Default: No Tip) */}
              <div className="p-4 bg-white rounded-2xl border border-[#e8e1cf] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-800">
                    <Heart className="w-3.5 h-3.5 text-[#c5a86a]" />
                    <span>Tip for Service</span>
                  </div>
                  {calculatedTip > 0 && (
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      +₹{calculatedTip}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {(['none', '5%', '10%', '15%', 'custom'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedTipType(option)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                        selectedTipType === option
                          ? 'bg-[#1b382b] text-[#f7f4ec] border-[#1b382b] shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {option === 'none' ? 'No Tip' : option === 'custom' ? 'Custom' : option}
                    </button>
                  ))}
                </div>

                {selectedTipType === 'custom' && (
                  <div className="pt-1">
                    <div className="relative flex items-center">
                      <span className="absolute left-3 font-mono text-xs font-bold text-stone-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Enter tip amount"
                        value={customTipInput}
                        onChange={e => setCustomTipInput(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-stone-50 border border-[#e8e1cf] focus:border-[#1b382b] rounded-xl text-xs font-mono font-bold text-stone-800 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Price Calculation Summary */}
              <div className="p-4 bg-white rounded-2xl border border-[#e8e1cf] space-y-2 text-xs">
                {foodSubtotal > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Food Subtotal ({foodLines.reduce((a, b) => a + b.quantity, 0)} items)</span>
                    <span className="font-mono font-bold">₹{foodSubtotal}</span>
                  </div>
                )}
                {barSubtotal > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Bar Subtotal ({barLines.reduce((a, b) => a + b.quantity, 0)} items)</span>
                    <span className="font-mono font-bold">₹{barSubtotal}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600 font-medium">
                  <span>Estimated Subtotal</span>
                  <span className="font-mono font-bold">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Estimated GST ({effectiveTaxRate}% Restaurant Tax)</span>
                  <span className="font-mono font-bold">₹{gstAmount}</span>
                </div>
                {calculatedTip > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Staff Tip ({selectedTipType === 'custom' ? 'Custom' : selectedTipType})</span>
                    <span className="font-mono font-bold">₹{calculatedTip}</span>
                  </div>
                )}
                <div className="border-t border-[#e8e1cf] pt-2 flex justify-between font-bold text-stone-900 text-sm">
                  <span>Estimated Grand Total</span>
                  <span className="font-mono font-black text-[#1b382b] text-base">₹{grandTotal}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400 pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Food routed to Kitchen KDS • Drinks routed to Bar Station</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Action Footer */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-[#e8e1cf] shrink-0 font-sans space-y-2">
            <button
              id="btn-send-to-kitchen"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
              className="w-full py-4 px-5 bg-[#163024] hover:bg-[#11241b] active:scale-[0.99] text-[#F7F4EC] font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-between border border-[#c5a86a]/40 transition-all cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#c5a86a]" />
                <span>
                  {isRepeatOrder
                    ? `Send Round ${activeRound} to Kitchen`
                    : 'Send Order to Kitchen'}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-[#dfc78f]">
                <span>₹{(grandTotal ?? 0).toLocaleString('en-IN')}</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
            <p className="text-center text-[10px] text-stone-500 font-sans">
              Verify your mobile before ordering • Multiple rounds • Pay at the end
            </p>
          </div>
        )}

      </div>

      {/* Requirement 16: Order Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] max-w-md w-full rounded-3xl border border-[#e8e1cf] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#e8e1cf] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1b382b] text-[#dfc78f] flex items-center justify-center">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#163024]">
                    {isRepeatOrder ? `Confirm Round ${activeRound} Order` : 'Send Order to Kitchen'}
                  </h3>
                  <p className="text-[11px] font-sans text-stone-500 font-semibold">Table {tableNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="min-w-[44px] min-h-[44px] rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer transition-colors"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items Summary */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Order Items Summary</p>
              {cart.map(line => (
                <div key={line.id} className="flex items-center justify-between text-xs py-1 border-b border-stone-100 font-sans">
                  <span className="font-medium text-stone-800">
                    {line.quantity}x {line.item.name}
                    {line.selectedPortion && line.selectedPortion.label !== 'Standard' && (
                      <span className="text-[10px] text-stone-500"> ({line.selectedPortion.label})</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-stone-900">₹{line.unitPrice * line.quantity}</span>
                </div>
              ))}
            </div>

            {/* Total breakdown */}
            <div className="p-3 bg-white rounded-2xl border border-[#e8e1cf] space-y-1.5 text-xs font-sans">
              <div className="flex justify-between text-stone-600">
                <span>Estimated Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
                <span className="font-mono">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Estimated Tax ({effectiveTaxRate}% GST)</span>
                <span className="font-mono">₹{gstAmount}</span>
              </div>
              <div className="border-t border-stone-200 pt-1.5 flex justify-between font-bold text-stone-900 text-sm">
                <span>Estimated Round Total</span>
                <span className="font-mono text-base font-black text-[#163024]">₹{grandTotal}</span>
              </div>
              <p className="text-[10px] text-stone-400 pt-1">
                Dishes will be sent immediately to kitchen. You can order more rounds anytime, and pay together at the end.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 font-sans pt-1">
              <button
                onClick={async () => {
                  await handleSubmit();
                  setShowConfirmModal(false);
                }}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#163024] hover:bg-[#12261d] active:scale-[0.99] text-[#f7f4ec] font-bold text-xs uppercase tracking-wider rounded-xl shadow-md border border-[#c5a86a]/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#c5a86a]" />
                <span>
                  {isSubmitting
                    ? 'Firing to Kitchen...'
                    : isRepeatOrder
                    ? `FIRE ROUND ${activeRound} TO KITCHEN`
                    : 'FIRE TO KITCHEN'}
                </span>
              </button>

              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="w-full py-2.5 text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
              >
                Back to Tray / Edit Items
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
