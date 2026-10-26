import React, { useState } from 'react';
import { AggregatedProductionItem } from '../../types';
import { ProductionTraceModal } from './ProductionTraceModal';
import {
  Clock,
  Flame,
  AlertTriangle,
  Play,
  CheckCircle2,
  CheckCheck,
  Search,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface ProductionItemCardProps {
  item: AggregatedProductionItem;
  onPrepare: (aggregatedItemId: string, qty: number) => void;
  onMarkReady: (aggregatedItemId: string, qty: number) => void;
  onFastOut: (aggregatedItemId: string, qty: number) => void;
  onRecall: (aggregatedItemId: string, qty: number, reason: string) => void;
  isTvMode?: boolean;
}

export const ProductionItemCard: React.FC<ProductionItemCardProps> = ({
  item,
  onPrepare,
  onMarkReady,
  onFastOut,
  onRecall,
  isTvMode = false
}) => {
  const [showTrace, setShowTrace] = useState<boolean>(false);
  const [showPrepareSelector, setShowPrepareSelector] = useState<boolean>(false);
  const [showReadySelector, setShowReadySelector] = useState<boolean>(false);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [recallReason, setRecallReason] = useState<string>('');
  const [recallQty, setRecallQty] = useState<number>(1);

  // Time & Delay styling
  const isDelayed = item.delayStatus === 'delayed';
  const isWarning = item.delayStatus === 'warning';

  const delayBadgeColor = isDelayed
    ? 'bg-rose-50 text-[#C53030] border-rose-300 animate-pulse'
    : isWarning
    ? 'bg-amber-50 text-amber-900 border-amber-300'
    : 'bg-emerald-50 text-emerald-900 border-emerald-200';

  const cardBorder = isTvMode
    ? isDelayed
      ? 'border-[#C53030] shadow-red-950/30'
      : 'border-[#C5A86A]/50'
    : isDelayed
    ? 'border-[#C53030] ring-1 ring-[#C53030]'
    : 'border-[#DDD8C9] hover:border-[#163024]/40';

  const cardBg = isTvMode ? 'bg-[#163024] text-[#F7F4EC]' : 'bg-white text-[#1D241F]';

  return (
    <>
      <div
        id={`prod-card-${item.id}`}
        className={`rounded-3xl border ${cardBorder} ${cardBg} p-4 sm:p-5 shadow-sm transition-all flex flex-col justify-between gap-4 relative overflow-hidden h-full min-w-0`}
      >
        {/* Top Header: Service Type, Station, Delay Elapsed Badge */}
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-[#DDD8C9]/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Primary Service Type Filter (Section 3) */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                  item.serviceType === 'takeaway'
                    ? 'bg-[#C5A86A] text-[#163024]'
                    : isTvMode
                    ? 'bg-[#526B4A] text-white'
                    : 'bg-[#163024] text-[#F7F4EC]'
                }`}
              >
                {item.serviceType === 'takeaway' ? 'TAKE AWAY' : 'DINE IN'}
              </span>

              {/* Station Badge */}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                isTvMode ? 'bg-white/15 text-[#DDD8C9]' : 'bg-[#F7F4EC] text-[#526B4A] border border-[#DDD8C9]'
              }`}>
                {item.stationName}
              </span>

              {/* Portion if non-standard */}
              {item.portion && item.portion !== 'Regular' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-mono font-bold shrink-0">
                  {item.portion}
                </span>
              )}
            </div>

            {/* Elapsed Timer with Alert Status (Section 28) */}
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border shrink-0 ${delayBadgeColor}`}>
              {isDelayed ? (
                <Flame className="w-3.5 h-3.5 text-[#C53030] animate-bounce" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>{item.elapsedMinutes}m {isDelayed ? 'DELAYED' : ''}</span>
            </div>
          </div>

          {/* Item Name & Details (Section 4 & 29) */}
          <div className="mt-3 space-y-1">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h3
                className={`font-serif font-black tracking-tight break-words min-w-0 flex-1 ${
                  isTvMode ? 'text-2xl text-[#F7F4EC]' : 'text-lg text-[#163024]'
                }`}
              >
                {item.menuItemName}
              </h3>
              {item.isVeg ? (
                <span className="w-4 h-4 rounded border-2 border-emerald-600 flex items-center justify-center shrink-0 mt-1" title="Vegetarian">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                </span>
              ) : (
                <span className="w-4 h-4 rounded border-2 border-rose-600 flex items-center justify-center shrink-0 mt-1" title="Non-Vegetarian">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                </span>
              )}
            </div>

            {/* Modifiers & Special Notes (Section 8) */}
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {item.modifiers.map((mod, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-[#F7F4EC] text-[#163024] text-[10px] font-bold border border-[#DDD8C9] break-words"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            )}

            {/* Special Instructions & Allergens */}
            {item.specialInstructions && item.specialInstructions.length > 0 && (
              <p className={`text-xs italic pt-1 break-words ${isTvMode ? 'text-[#C5A86A]' : 'text-[#526B4A]'}`}>
                &ldquo;{item.specialInstructions.join('; ')}&rdquo;
              </p>
            )}

            {item.allergenInformation && item.allergenInformation.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-[#C53030] font-black uppercase tracking-wider pt-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{item.allergenInformation.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Big Production Counters (Section 4: PENDING | PREPARING | READY) */}
        <div className="my-2">
          <div
            className={`grid grid-cols-3 gap-2 p-3 rounded-2xl border text-center font-mono ${
              isTvMode ? 'bg-[#0F2018] border-[#244737]' : 'bg-[#F7F4EC]/60 border-[#DDD8C9]'
            }`}
          >
            {/* 1. PENDING */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
              item.quantityPending > 0
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-white/40 border-transparent text-[#687067]'
            }`}>
              <span className="text-[10px] font-sans font-black uppercase tracking-widest text-[#687067]">
                Pending
              </span>
              <span className={`font-black ${isTvMode ? 'text-3xl' : 'text-2xl'} ${
                item.quantityPending > 0 ? 'text-[#C5A86A]' : 'text-[#687067]'
              }`}>
                {item.quantityPending}
              </span>
            </div>

            {/* 2. PREPARING */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
              item.quantityPreparing > 0
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : 'bg-white/40 border-transparent text-[#687067]'
            }`}>
              <span className="text-[10px] font-sans font-black uppercase tracking-widest text-[#687067]">
                Preparing
              </span>
              <span className={`font-black ${isTvMode ? 'text-3xl' : 'text-2xl'} ${
                item.quantityPreparing > 0 ? 'text-[#526B4A]' : 'text-[#687067]'
              }`}>
                {item.quantityPreparing}
              </span>
            </div>

            {/* 3. READY */}
            <div className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
              item.quantityReady > 0
                ? 'bg-green-100/90 border-green-300 text-green-950'
                : 'bg-white/40 border-transparent text-[#687067]'
            }`}>
              <span className="text-[10px] font-sans font-black uppercase tracking-widest text-[#687067]">
                Ready
              </span>
              <span className={`font-black ${isTvMode ? 'text-3xl' : 'text-2xl'} ${
                item.quantityReady > 0 ? 'text-[#163024]' : 'text-[#687067]'
              }`}>
                {item.quantityReady}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2">
          {/* Primary Operations: [ PREPARE ] and [ MARK READY ] (Section 4) */}
          <div className="grid grid-cols-2 gap-2">
            {/* [ PREPARE ] */}
            <button
              id={`btn-prepare-${item.id}`}
              disabled={item.quantityPending <= 0}
              onClick={() => {
                if (item.quantityPending === 1) {
                  onPrepare(item.id, 1);
                } else {
                  setShowPrepareSelector(!showPrepareSelector);
                  setShowReadySelector(false);
                }
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                item.quantityPending > 0
                  ? 'bg-[#C5A86A] hover:bg-[#b39556] text-[#163024]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PREPARE {item.quantityPending > 1 ? `(${item.quantityPending})` : ''}</span>
            </button>

            {/* [ MARK READY ] */}
            <button
              id={`btn-ready-${item.id}`}
              disabled={item.quantityPreparing <= 0}
              onClick={() => {
                if (item.quantityPreparing === 1) {
                  onMarkReady(item.id, 1);
                } else {
                  setShowReadySelector(!showReadySelector);
                  setShowPrepareSelector(false);
                }
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                item.quantityPreparing > 0
                  ? 'bg-[#163024] hover:bg-[#244737] text-[#F7F4EC]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>MARK READY {item.quantityPreparing > 1 ? `(${item.quantityPreparing})` : ''}</span>
            </button>
          </div>

          {/* Quick Quantity Popover for Prepare (Partial Preparation - Section 10) */}
          {showPrepareSelector && item.quantityPending > 0 && (
            <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] space-y-1.5 animate-in fade-in">
              <span className="text-[11px] font-bold text-[#163024] block">Select Quantity to Prepare:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    onPrepare(item.id, 1);
                    setShowPrepareSelector(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] hover:bg-[#163024] hover:text-[#F7F4EC] cursor-pointer"
                >
                  Prepare 1
                </button>
                {item.quantityPending >= 2 && (
                  <button
                    onClick={() => {
                      onPrepare(item.id, 2);
                      setShowPrepareSelector(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] hover:bg-[#163024] hover:text-[#F7F4EC] cursor-pointer"
                  >
                    Prepare 2
                  </button>
                )}
                {item.quantityPending >= 3 && (
                  <button
                    onClick={() => {
                      onPrepare(item.id, 3);
                      setShowPrepareSelector(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] hover:bg-[#163024] hover:text-[#F7F4EC] cursor-pointer"
                  >
                    Prepare 3
                  </button>
                )}
                <button
                  onClick={() => {
                    onPrepare(item.id, item.quantityPending);
                    setShowPrepareSelector(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#C5A86A] text-[#163024] text-xs font-black hover:bg-[#b39556] cursor-pointer"
                >
                  Prepare All ({item.quantityPending})
                </button>
              </div>
            </div>
          )}

          {/* Quick Quantity Popover for Mark Ready (Partial Ready - Section 12, 14) */}
          {showReadySelector && item.quantityPreparing > 0 && (
            <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#DDD8C9] space-y-1.5 animate-in fade-in">
              <span className="text-[11px] font-bold text-[#163024] block">Select Quantity to Mark Ready:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    onMarkReady(item.id, 1);
                    setShowReadySelector(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] hover:bg-[#163024] hover:text-[#F7F4EC] cursor-pointer"
                >
                  Ready 1
                </button>
                {item.quantityPreparing >= 2 && (
                  <button
                    onClick={() => {
                      onMarkReady(item.id, 2);
                      setShowReadySelector(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-white border border-[#DDD8C9] text-xs font-bold text-[#163024] hover:bg-[#163024] hover:text-[#F7F4EC] cursor-pointer"
                  >
                    Ready 2
                  </button>
                )}
                <button
                  onClick={() => {
                    onMarkReady(item.id, item.quantityPreparing);
                    setShowReadySelector(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#163024] text-[#F7F4EC] text-xs font-black hover:bg-[#244737] cursor-pointer"
                >
                  Ready All ({item.quantityPreparing})
                </button>
              </div>
            </div>
          )}

          {/* Fast Out / Handoff Button (Section 13: Ready -> Completed, leaves active KDS) */}
          {item.quantityReady > 0 && (
            <button
              id={`btn-fast-out-${item.id}`}
              onClick={() => onFastOut(item.id, item.quantityReady)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Hand over to Server or Takeaway Counter. Clears completed quantity from active KDS."
            >
              <CheckCheck className="w-4 h-4" />
              <span>FAST OUT / HANDOFF ({item.quantityReady} READY)</span>
            </button>
          )}

          {/* Secondary Actions: [ TRACE ] (Section 30) & [ RECALL ] (Section 39) */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              id={`btn-trace-${item.id}`}
              onClick={() => setShowTrace(true)}
              className="text-[#526B4A] hover:text-[#163024] font-bold flex items-center gap-1 transition-colors cursor-pointer py-1"
              title="Inspect underlying orders and tables (Section 30)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>TRACE ({item.orderRefs.length})</span>
            </button>

            {(item.quantityReady > 0 || item.quantityPreparing > 0) && (
              <button
                id={`btn-recall-${item.id}`}
                onClick={() => {
                  setRecallQty(1);
                  setShowRecallModal(true);
                }}
                className="text-[#687067] hover:text-[#C53030] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer py-1"
                title="Recall item quantity (Section 39)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Recall</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Traceability Modal */}
      {showTrace && (
        <ProductionTraceModal
          item={item}
          onClose={() => setShowTrace(false)}
        />
      )}

      {/* Recall Confirmation Modal (Section 39) */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#DDD8C9] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#C5A86A] flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#163024]">Recall Production Item</h4>
                <p className="text-xs text-[#687067]">
                  {item.menuItemName} ({item.portion || 'Regular'})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#163024]">Quantity to Recall</label>
              <input
                type="number"
                min={1}
                max={item.quantityReady > 0 ? item.quantityReady : item.quantityPreparing}
                value={recallQty}
                onChange={e => setRecallQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 rounded-xl border border-[#DDD8C9] text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#163024]">Recall Reason (Required for Audit Log)</label>
              <textarea
                value={recallReason}
                onChange={e => setRecallReason(e.target.value)}
                placeholder="e.g. Plating remake requested, guest changed spice preference..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-[#DDD8C9] text-xs text-[#163024]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRecallModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#687067] hover:bg-[#F7F4EC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!recallReason.trim()}
                onClick={() => {
                  onRecall(item.id, recallQty, recallReason.trim());
                  setShowRecallModal(false);
                  setRecallReason('');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  recallReason.trim()
                    ? 'bg-[#163024] hover:bg-[#244737] text-[#F7F4EC]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Confirm Recall
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
