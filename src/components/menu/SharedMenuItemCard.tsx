import React from 'react';
import { MenuItem } from '../../types';
import { Sparkles, Utensils, Wine, Clock, Plus, Minus } from 'lucide-react';

export interface SharedMenuItemCardProps {
  item: MenuItem;
  cartQuantity: number;
  selectedPortionLabel?: string;
  onSelectPortion?: (item: MenuItem, portionLabel: string, price: number) => void;
  onAddToCart: (item: MenuItem, portionLabel?: string, price?: number) => void;
  onUpdateQuantity: (delta: number) => void;
  onOpenDetail?: (item: MenuItem) => void;
  showCategoryBadge?: boolean;
  addAriaLabel?: string;
}

export const SharedMenuItemCard: React.FC<SharedMenuItemCardProps> = ({
  item,
  cartQuantity,
  selectedPortionLabel,
  onSelectPortion,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetail,
  showCategoryBadge = false,
  addAriaLabel
}) => {
  const [imgError, setImgError] = React.useState(false);
  const isSoldOut = item.isAvailable === false;
  const isDrink = item.menuType === 'drink';

  // Determine current active portion
  const currentPortion = item.portionOptions?.find(
    p => p.label === (selectedPortionLabel || item.portionOptions?.[0]?.label)
  );
  const displayPrice = currentPortion ? currentPortion.price : item.price;
  const activeLabel = currentPortion ? currentPortion.label : (selectedPortionLabel || 'Standard');

  return (
    <div
      className={`bg-white rounded-2xl border p-2.5 sm:p-3.5 shadow-2xs transition-all flex gap-3 items-center ${
        isSoldOut
          ? 'opacity-60 bg-stone-50 border-[#DDD8C9]'
          : cartQuantity > 0
          ? 'border-[#C5A86A] bg-amber-50/15 ring-1 ring-[#C5A86A]/30'
          : 'border-[#DDD8C9] hover:border-[#c5a86a]/60 hover:shadow-xs'
      }`}
    >
      {/* LEFT: Food / Drink Photograph (84px–96px) */}
      <div
        onClick={() => {
          if (!isSoldOut && onOpenDetail) onOpenDetail(item);
        }}
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 relative bg-stone-100 border border-stone-200/70 select-none ${
          isSoldOut ? 'cursor-not-allowed' : onOpenDetail ? 'cursor-pointer' : ''
        }`}
      >
        {item.image && !imgError ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover object-center transition-transform duration-300 hover:scale-105 ${
              isSoldOut ? 'grayscale contrast-75' : ''
            }`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-[#FAF8F2] flex items-center justify-center text-stone-400">
            {isDrink ? (
              <Wine className="w-6 h-6 text-[#526B4A]/50" />
            ) : (
              <Utensils className="w-6 h-6 text-[#526B4A]/50" />
            )}
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-1">
            <span className="text-[9px] font-bold text-white uppercase tracking-wider px-1.5 py-0.5 bg-black/65 rounded backdrop-blur-2xs text-center leading-none">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: Item Details & Interactive Actions */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 self-stretch">
        <div>
          {/* Badges: Veg/Non-Veg, Category & Chef's Special */}
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span
              className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                item.isVeg ? 'border-emerald-700 bg-emerald-50' : 'border-rose-700 bg-rose-50'
              }`}
              title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-700' : 'bg-rose-700'}`} />
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${item.isVeg ? 'text-emerald-800' : 'text-rose-800'}`}>
              {item.isVeg ? 'VEG' : 'NON-VEG'}
            </span>

            {showCategoryBadge && item.categoryName && (
              <span className="text-[9px] font-mono text-[#687067] px-1.5 py-0.2 bg-[#F7F4EC] rounded border border-[#DDD8C9]">
                {item.categoryName}
              </span>
            )}

            {item.isChefSpecial && !isSoldOut && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#163024]/10 text-[#163024] border border-[#c5a86a]/40">
                <Sparkles className="w-2.5 h-2.5 text-[#c5a86a]" />
                <span>Chef&apos;s Special</span>
              </span>
            )}
          </div>

          {/* Item Name */}
          <h4
            onClick={() => {
              if (!isSoldOut && onOpenDetail) onOpenDetail(item);
            }}
            className={`font-serif font-bold text-stone-900 text-sm sm:text-base leading-snug line-clamp-1 hover:text-[#163024] transition-colors ${
              isSoldOut ? 'cursor-not-allowed text-stone-500' : onOpenDetail ? 'cursor-pointer' : ''
            }`}
            title={item.name}
          >
            {item.name}
          </h4>

          {/* Item Description */}
          {item.description && (
            <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5 leading-snug">
              {item.description.replace(/<!--portions:.*?-->/, '')}
            </p>
          )}

          {/* Portion Options Chips */}
          {item.portionOptions && item.portionOptions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {item.portionOptions.map(p => {
                const isSelected = activeLabel === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectPortion) {
                        onSelectPortion(item, p.label, p.price);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#163024] text-[#F7F4EC] border-[#163024] shadow-xs'
                        : 'bg-[#F7F4EC] text-[#163024] border-[#DDD8C9] hover:bg-[#DDD8C9]/40'
                    }`}
                  >
                    {p.label}: ₹{p.price}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Row: Price, Prep Time & Add/Quantity Button */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-stone-100">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="font-serif font-bold text-sm sm:text-base text-[#163024] shrink-0">
              ₹{displayPrice}
            </span>
            {item.portionOptions && item.portionOptions.length > 1 && (
              <span className="text-[10px] text-stone-400 font-sans truncate">
                ({item.portionOptions.length} sizes)
              </span>
            )}
            {item.preparationTimeMinutes && (
              <span className="inline-flex items-center gap-1 text-[10px] text-stone-500 font-medium shrink-0">
                <Clock className="w-3 h-3 text-[#c5a86a]" />
                <span>{item.preparationTimeMinutes}m</span>
              </span>
            )}
          </div>

          {/* Interactive Add or Stepper Controls */}
          <div className="shrink-0">
            {isSoldOut ? (
              <span className="px-2.5 py-1.5 bg-stone-100 text-stone-400 border border-stone-200 rounded-lg text-[10px] font-bold uppercase tracking-wider select-none inline-flex items-center min-h-[44px]">
                Sold Out
              </span>
            ) : cartQuantity > 0 ? (
              <div className="flex items-center bg-[#163024] text-[#F7F4EC] rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(-1);
                  }}
                  className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 cursor-pointer active:scale-95 transition-all"
                  title="Decrease quantity"
                  aria-label={`Decrease ${item.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-mono font-bold text-xs text-[#F7F4EC]">
                  {cartQuantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(1);
                  }}
                  className="min-w-[36px] min-h-[44px] rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 cursor-pointer active:scale-95 transition-all"
                  title="Increase quantity"
                  aria-label={`Increase ${item.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(item, currentPortion?.label, currentPortion?.price);
                }}
                className="min-h-[44px] px-3.5 bg-[#163024] hover:bg-[#204333] active:scale-95 text-[#F7F4EC] rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1.5 border border-[#c5a86a]/40 transition-all cursor-pointer"
                aria-label={addAriaLabel || undefined}
              >
                <Plus className="w-3.5 h-3.5 text-[#dfc78f]" />
                <span>ADD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
