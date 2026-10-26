import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { X, Clock, Flame, Leaf, Plus, Minus, Check, Sparkles, Utensils, Wine } from 'lucide-react';

interface QRItemDetailModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number, portion?: { label: string; price: number }, note?: string) => void;
}

export const QRItemDetailModal: React.FC<QRItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  if (!isOpen || !item) return null;

  const [imgError, setImgError] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState<{ label: string; price: number }>(
    item.portionOptions && item.portionOptions.length > 0 ? item.portionOptions[0] : { label: 'Standard', price: item.price }
  );
  const [spiceLevel, setSpiceLevel] = useState<'Mild' | 'Medium' | 'Fiery'>('Medium');
  const [cookingNotes, setCookingNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const currentPrice = selectedPortion.price;
  const totalPrice = currentPrice * quantity;

  const handleAdd = () => {
    setAddedAnimation(true);
    const combinedNotes = [
      selectedPortion.label !== 'Standard' ? `Portion: ${selectedPortion.label}` : '',
      item.isVeg === false || item.isSpicy ? `Spice: ${spiceLevel}` : '',
      cookingNotes.trim() ? cookingNotes.trim() : '',
    ].filter(Boolean).join(' • ');

    onAddToCart(item, quantity, selectedPortion, combinedNotes);

    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="bg-[#fcfbf7] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e1cf] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Dish Hero Image with Botanical Gradient */}
        <div className="relative h-56 sm:h-64 w-full bg-stone-900 overflow-hidden shrink-0 flex items-center justify-center">
          {item.image && !imgError ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-[#163024] flex items-center justify-center text-[#dfc78f]/40">
              {item.menuType === 'drink' ? (
                <Wine className="w-16 h-16" />
              ) : (
                <Utensils className="w-16 h-16" />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1b382b] via-black/20 to-transparent" />

          {/* Top Close and Badges */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border ${
                item.isVeg
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
              }`}>
                {item.isVeg ? <Leaf className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
                <span>{item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}</span>
              </span>

              {item.isChefSpecial && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#c5a86a] text-[#1b382b] border border-[#dfc78f] shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Chef's Choice</span>
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dish Title on Gradient Banner */}
          <div className="absolute bottom-3 inset-x-4 text-white">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-[#dfc78f] block">
              {item.categoryName} {item.subCategory ? `• ${item.subCategory}` : ''}
            </span>
            <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#fcfbf7] leading-tight">
              {item.name}
            </h3>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 font-sans">
          {/* Description & Timing */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {item.description}
            </p>
            <div className="flex items-center gap-4 text-[11px] text-stone-500 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#c5a86a]" />
                <span>Prep: ~{item.preparationTimeMinutes || 15} mins</span>
              </span>
              <span className="text-stone-300">•</span>
              <span className="text-stone-500 font-mono">GST 5% included</span>
            </div>
          </div>

          {/* Portion Selection (if options exist) */}
          {item.portionOptions && item.portionOptions.length > 1 && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700">
                Choose Portion / Serving
              </label>
              <div className="grid grid-cols-2 gap-2">
                {item.portionOptions.map((opt, idx) => {
                  const isSel = selectedPortion.label === opt.label;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPortion(opt)}
                      className={`p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                        isSel
                          ? 'border-[#1b382b] bg-[#1b382b]/5 ring-1 ring-[#1b382b]'
                          : 'border-[#e8e1cf] bg-white hover:border-[#c5a86a]'
                      }`}
                    >
                      <span className="text-xs font-semibold text-stone-800">{opt.label}</span>
                      <span className="text-xs font-bold font-mono text-[#1b382b]">₹{opt.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spice Level Preference (for savory items) */}
          {item.menuType === 'food' && item.categoryId !== 'sweets' && item.categoryId !== 'salads-chaats' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700">
                Spice Intensity Preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Mild', 'Medium', 'Fiery'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSpiceLevel(lvl)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      spiceLevel === lvl
                        ? 'border-[#1b382b] bg-[#1b382b] text-[#f7f4ec] shadow-xs'
                        : 'border-[#e8e1cf] bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {lvl === 'Mild' && '🌿 Mild'}
                    {lvl === 'Medium' && '🌶️ Balanced'}
                    {lvl === 'Fiery' && '🔥 Fiery'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Cooking Instructions */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700">
              Kitchen Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Less oil, extra lemon wedges, well-done, with ice..."
              value={cookingNotes}
              onChange={e => setCookingNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#e8e1cf] focus:border-[#1b382b] rounded-xl text-xs text-stone-800 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Sticky Footer Bar with Quantity and Add Button */}
        <div className="p-4 bg-white border-t border-[#e8e1cf] flex items-center gap-3 shrink-0">
          {/* Quantity Stepper */}
          <div className="flex items-center bg-[#f7f4ec] border border-[#e8e1cf] rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 disabled:opacity-30 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-9 text-center font-mono font-bold text-sm text-stone-900">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              aria-label="Increase quantity"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Order Button */}
          <button
            onClick={handleAdd}
            className={`flex-1 py-3.5 px-4 rounded-xl font-sans font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-between transition-all cursor-pointer ${
              addedAnimation
                ? 'bg-emerald-700 text-white'
                : 'bg-[#1b382b] hover:bg-[#152e23] active:scale-[0.99] text-[#f7f4ec] border border-[#c5a86a]/40'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {addedAnimation ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 text-[#c5a86a]" />}
              <span>{addedAnimation ? 'Added to Order!' : 'Add to Order'}</span>
            </span>
            <span className="font-mono text-sm font-bold text-[#dfc78f]">
              ₹{totalPrice}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
